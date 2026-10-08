import type {
  EditorialEntry,
  Entry,
  EntryMetadata,
  EntrySummary,
  EntryTaxonomy,
  Lang,
  Localized,
  Relation,
  ReviewState,
  Revision,
  RevisionSnapshot,
} from "@/lib/model/types";
import { CONTENT_ROLE_IDS, LEVEL_IDS } from "@/lib/model/vocab";
import { genusForLegacyDomain } from "@/lib/taxonomy/legacy";
import { diffLines } from "diff";
import { entries, relations as relationFixtures } from "@/mock/entries";
import {
  ServiceError,
  type DraftInput,
  type EditorialQuery,
  type EntryQuery,
  type EntryRepository,
  type ReviewTransitionInput,
  type SavedRevision,
  type WorkingDraft,
} from "@/lib/services/contracts";
import { bilingualComplete, bodyAssetIds, splitLabel, uniqueSlug, validateMetadata } from "@/lib/entries/lifecycle";
import { bodyAt } from "./body";
import type { TaxonomyStore } from "./taxonomy";
import { paginate, type MockContext } from "./context";

/*
 * In-memory entries with the same lifecycle as the database: each entry keeps
 * a public snapshot (what readers see) and its revisions (what editors see).
 * Saving and submitting never touch the public snapshot; publishing and
 * rolling back replace it as a whole.
 */

interface MockRevision {
  number: number;
  authorId: string;
  createdAt: string;
  note: string;
  state: ReviewState;
  /** Absent on fixture revisions, which recorded no title or summary. */
  title?: Localized;
  summary?: Localized;
  metadata?: EntryMetadata;
  taxonomy: EntryTaxonomy;
}

interface MockEntry {
  id: string;
  slug: string;
  formerSlugs: string[];
  authorId: string;
  createdAt: string;
  /** The fixture as written: what unrecorded revisions fall back to. */
  base: EntrySummary;
  /** What readers see; null until first published. */
  public: EntrySummary | null;
  latest: number;
  status: ReviewState;
  editedAt: string;
  archivedAt?: string;
  returnNote?: string;
  returnedAt?: string;
  revisions: MockRevision[];
}

const statsOf = (before: string, after: string) =>
  diffLines(before, after).reduce(
    (stats, part) => {
      const lines = part.value.split("\n").length - Number(part.value.endsWith("\n"));
      if (part.added) stats.added += lines;
      if (part.removed) stats.removed += lines;
      return stats;
    },
    { added: 0, removed: 0 },
  );

const languagesOf = (body: string): Lang[] => {
  const langs: Lang[] = [];
  if (body.includes(":::zh")) langs.push("zh");
  if (body.includes(":::en")) langs.push("en");
  return langs.length ? langs : (["zh", "en"] as Lang[]);
};

const taxonomyOf = (entry: Partial<EntryTaxonomy>): EntryTaxonomy => ({
  categoryId: entry.categoryId ?? "",
  auxiliaryCategoryIds: [...(entry.auxiliaryCategoryIds ?? [])],
  species: entry.species,
  level: entry.level ?? "concept",
  contentRole: entry.contentRole ?? "foundation",
});

export function createMockEntryRepository(taxonomy: TaxonomyStore, context: MockContext): EntryRepository {
  const bodies = new Map<string, string>();
  const relations: Relation[] = structuredClone(relationFixtures);
  const working = new Map<string, WorkingDraft & { ownerId: string }>();
  const store: MockEntry[] = entries.map((fixture) => {
    const { revisions, ...summary } = fixture;
    const published = revisions.filter((r) => r.state === "published").at(-1);
    for (const r of revisions) bodies.set(`${fixture.id}@r${r.number}`, bodyAt(fixture.slug, r.number));
    const base: EntrySummary = { ...summary, auxiliaryCategoryIds: [...summary.auxiliaryCategoryIds] };
    return {
      id: fixture.id,
      slug: fixture.slug,
      formerSlugs: [],
      authorId: fixture.authorId,
      createdAt: fixture.createdAt,
      base,
      public: published ? { ...structuredClone(base), status: "published", revision: published.number } : null,
      latest: revisions.at(-1)?.number ?? 0,
      status: fixture.status,
      editedAt: fixture.updatedAt,
      revisions: revisions.map((r) => {
        // As the snapshot migration does: the published revision of an entry with no newer work is
        // exactly what readers see, so it records that; any other fixture revision recorded nothing.
        const certain = published && r.number === published.number && published.number === revisions.at(-1)?.number;
        return {
          ...r,
          taxonomy: taxonomyOf(fixture),
          ...(certain
            ? {
                title: structuredClone(fixture.title),
                summary: structuredClone(fixture.summary),
                metadata: {
                  scale: fixture.scale,
                  role: fixture.role,
                  analogue: fixture.analogue,
                  heroAssetId: fixture.heroAssetId,
                  contributorIds: [...fixture.contributorIds],
                  sourceIds: [...fixture.sourceIds],
                  tagIds: [...fixture.tagIds],
                  relationDrafts: relationFixtures
                    .filter((x) => x.from === fixture.id)
                    .map((x) => ({ to: x.to, kind: x.kind, strength: x.strength, note: x.note })),
                  pendingSources: [],
                  pendingTags: [],
                },
              }
            : {}),
        };
      }),
    };
  });

  const byId = (id: string) => store.find((entry) => entry.id === id);
  const bodyOf = (entry: MockEntry, number: number) =>
    bodies.get(`${entry.id}@r${number}`) ?? bodyAt(entry.slug, number);
  const isPublic = (entry: MockEntry) => Boolean(entry.public && !entry.archivedAt);
  const familyOf = (categoryId: string) => taxonomy.categories.find((c) => c.id === categoryId)?.familyId;

  /** What the current account may do with an entry, as the database decides it. */
  const editor = () => {
    const account = context.requireActive();
    const admin = account.role === "admin";
    if (!account.authorId && !admin) throw new ServiceError("forbidden", "author_required");
    return { account, admin, authorId: account.authorId ?? "a-qingkong" };
  };
  const mayEdit = (entry: MockEntry) => {
    const account = context.account();
    return Boolean(account && (account.role === "admin" || account.authorId === entry.authorId));
  };

  const filingOf = (base: Partial<EntryTaxonomy> | undefined, changes: Partial<EntryMetadata> = {}): EntryTaxonomy => {
    const categoryId = changes.categoryId ?? base?.categoryId;
    const genus = taxonomy.categories.find((c) => c.id === categoryId);
    if (!genus || genus.status !== "active") throw new ServiceError("invalid", "invalid_category");
    const auxiliaryCategoryIds = [...new Set(changes.auxiliaryCategoryIds ?? base?.auxiliaryCategoryIds ?? [])];
    for (const aux of auxiliaryCategoryIds) {
      if (aux === genus.id) throw new ServiceError("invalid", "auxiliary_equals_primary");
      if (!taxonomy.categories.some((c) => c.id === aux && c.status === "active"))
        throw new ServiceError("invalid", "invalid_auxiliary_category");
    }
    const species = (changes.species ?? base?.species)?.trim() || undefined;
    if (species && !species.startsWith(`${genus.scientificName} `))
      throw new ServiceError("invalid", "species_outside_genus");
    const level = changes.level ?? base?.level ?? "concept";
    const contentRole = changes.contentRole ?? base?.contentRole ?? "foundation";
    if (!LEVEL_IDS.includes(level)) throw new ServiceError("invalid", "invalid_level");
    if (!CONTENT_ROLE_IDS.includes(contentRole)) throw new ServiceError("invalid", "invalid_content_role");
    return { categoryId: genus.id, auxiliaryCategoryIds, species, level, contentRole };
  };

  const validate = (metadata: Partial<EntryMetadata> | undefined, entryId: string) =>
    validateMetadata(metadata, {
      entryId,
      entryExists: (id) => Boolean(byId(id)),
      authorExists: (id) => context.authors.some((a) => a.id === id),
      sourceExists: (id) => context.sources.some((s) => s.id === id),
      tagExists: (id) => context.tags.some((t) => t.id === id),
      assetVisible: (id) =>
        context.assets.some(
          (a) => a.id === id && (a.reviewStatus === "approved" || a.ownerId === context.account()?.id),
        ),
    });

  /** The metadata readers see now, for revisions that did not record theirs. */
  const publicMetadata = (entry: MockEntry): EntryMetadata => {
    const shown = entry.public ?? entry.base;
    return {
      ...taxonomyOf(shown),
      scale: shown.scale,
      role: shown.role,
      analogue: shown.analogue,
      heroAssetId: shown.heroAssetId,
      contributorIds: [...shown.contributorIds],
      sourceIds: [...shown.sourceIds],
      tagIds: [...shown.tagIds],
      relationDrafts: relations
        .filter((r) => r.from === entry.id)
        .map((r) => ({ to: r.to, kind: r.kind, strength: r.strength, note: r.note })),
      pendingSources: [],
      pendingTags: [],
    };
  };

  const revisionOf = (entry: MockEntry, r: MockRevision): Revision => {
    const previous = entry.revisions.filter((x) => x.number < r.number).at(-1);
    return {
      id: `${entry.id}@r${r.number}`,
      entryId: entry.id,
      number: r.number,
      parentId: previous ? `${entry.id}@r${previous.number}` : undefined,
      authorId: r.authorId,
      createdAt: r.createdAt,
      note: r.note,
      state: r.state,
      taxonomy: r.taxonomy,
      stats: statsOf(previous ? bodyOf(entry, previous.number) : "", bodyOf(entry, r.number)),
    };
  };

  const snapshotOf = (entry: MockEntry, r: MockRevision): RevisionSnapshot => {
    const shown = entry.public ?? entry.base;
    return {
      ...revisionOf(entry, r),
      title: r.title ?? shown.title,
      summary: r.summary ?? shown.summary,
      body: bodyOf(entry, r.number),
      metadata: { ...publicMetadata(entry), ...r.metadata, ...r.taxonomy },
      recorded: Boolean(r.title),
    };
  };

  const editorialOf = (entry: MockEntry): EditorialEntry => {
    const latest = entry.revisions.find((r) => r.number === entry.latest);
    const shown = entry.public ?? entry.base;
    const author = context.authors.find((a) => a.id === entry.authorId);
    return {
      id: entry.id,
      slug: entry.slug,
      title: latest?.title ?? shown.title,
      summary: latest?.summary ?? shown.summary,
      status: entry.status,
      latestRevision: entry.latest,
      publishedRevision: entry.public?.revision,
      authorId: entry.authorId,
      authorName: author?.name ?? { zh: "", en: "" },
      categoryId: latest?.taxonomy.categoryId ?? shown.categoryId,
      editedAt: entry.editedAt,
      publishedAt: entry.public?.updatedAt,
      archivedAt: entry.archivedAt,
      returnNote: entry.returnNote,
      returnedAt: entry.returnedAt,
    };
  };

  /** Proposed tags and sources become real records when their revision is published. */
  const materialize = (metadata: EntryMetadata): EntryMetadata => {
    const tagIds = [...metadata.tagIds];
    for (const label of metadata.pendingTags) {
      const names = splitLabel(label);
      let tag = context.tags.find(
        (t) =>
          [t.label.zh, t.label.en].some((value) => [names.zh, names.en].map((n) => n.toLowerCase()).includes(value.toLowerCase())),
      );
      if (!tag) {
        tag = { id: `tag-${context.tags.length + 1}`, label: names };
        context.tags.push(tag);
      }
      if (!tagIds.includes(tag.id)) tagIds.push(tag.id);
    }
    const sourceIds = [...metadata.sourceIds];
    for (const line of metadata.pendingSources) {
      const url = line.match(/https?:\/\/[^\s<>"]+/)?.[0];
      const title = (line.replace(url ?? "", "").trim().replace(/^[\s.,;]+|[\s.,;]+$/g, "") || url || line).slice(0, 500);
      let source = context.sources.find((s) => (url && s.url === url) || s.title.toLowerCase() === title.toLowerCase());
      if (!source) {
        source = { id: `src-${context.sources.length + 1}`, kind: url ? "web" : "book", title, creators: "", url };
        context.sources.push(source);
      }
      if (!sourceIds.includes(source.id)) sourceIds.push(source.id);
    }
    return { ...metadata, tagIds, sourceIds, pendingTags: [], pendingSources: [] };
  };

  const applySnapshot = (entry: MockEntry, r: MockRevision) => {
    const snap = snapshotOf(entry, r);
    const body = snap.body;
    entry.public = {
      ...(entry.public ?? entry.base),
      title: snap.title,
      summary: snap.summary,
      ...r.taxonomy,
      auxiliaryCategoryIds: [...r.taxonomy.auxiliaryCategoryIds],
      scale: snap.metadata.scale,
      role: snap.metadata.role,
      analogue: snap.metadata.analogue,
      heroAssetId: snap.metadata.heroAssetId,
      contributorIds: snap.metadata.contributorIds.filter((id) => id !== entry.authorId),
      sourceIds: [...snap.metadata.sourceIds],
      tagIds: [...snap.metadata.tagIds],
      bodyLanguages: languagesOf(body),
      status: "published",
      revision: r.number,
      updatedAt: r.createdAt,
    };
    for (let i = relations.length - 1; i >= 0; i--) if (relations[i].from === entry.id) relations.splice(i, 1);
    for (const draft of snap.metadata.relationDrafts)
      if (byId(draft.to))
        relations.push({ id: `rel-${entry.id}-${draft.to}-${draft.kind}`, from: entry.id, ...draft });
  };

  const assertAssetsPublic = (heroAssetId: string | undefined, body: string) => {
    const blocked = [...bodyAssetIds(body), ...(heroAssetId ? [heroAssetId] : [])].filter(
      (id) => !context.assets.some((a) => a.id === id && a.reviewStatus === "approved"),
    );
    if (blocked.length) throw new ServiceError("conflict", "assets_not_approved", "assets_not_approved", blocked.join(", "));
  };

  const append = (entry: MockEntry, revision: Omit<MockRevision, "number">, body: string): MockRevision => {
    const next = { ...revision, number: entry.latest + 1 };
    entry.revisions.push(next);
    entry.latest = next.number;
    entry.editedAt = next.createdAt;
    bodies.set(`${entry.id}@r${next.number}`, body);
    return next;
  };

  return {
    async listEntries(q: EntryQuery = {}) {
      if (q.status?.length && !q.status.includes("published")) return [];
      return store
        .filter(isPublic)
        .map((entry) => entry.public!)
        .filter((e) => !q.categoryId || q.categoryId.includes(e.categoryId))
        .filter((e) => !q.familyId || q.familyId.includes(familyOf(e.categoryId) ?? ""))
        .filter((e) => !q.auxiliaryCategoryId || e.auxiliaryCategoryIds.some((c) => q.auxiliaryCategoryId?.includes(c)))
        .filter((e) => !q.domain || (e.domain !== undefined && q.domain.includes(e.domain)))
        .filter((e) => !q.scale || q.scale.includes(e.scale))
        .filter((e) => q.featured === undefined || Boolean(e.featured) === q.featured)
        .sort((a, b) =>
          (q.sort === "created" ? b.createdAt : b.updatedAt).localeCompare(q.sort === "created" ? a.createdAt : a.updatedAt),
        )
        .slice(0, q.limit ?? Number.MAX_SAFE_INTEGER)
        .map((e) => structuredClone(e));
    },
    async getEntry(slug) {
      const entry = store.find((x) => isPublic(x) && (x.slug === slug || x.formerSlugs.includes(slug)));
      return entry ? ({ ...structuredClone(entry.public!), body: bodyOf(entry, entry.public!.revision) } as Entry) : null;
    },
    async getEntryById(id) {
      const entry = byId(id);
      return entry && isPublic(entry) ? this.getEntry(entry.slug) : null;
    },
    async listRevisions(id, options) {
      const entry = byId(id);
      if (!entry) return [];
      const editorial = options?.scope === "editorial" && mayEdit(entry);
      if (!editorial && !isPublic(entry)) return [];
      return entry.revisions
        .filter((r) => editorial || r.state === "published")
        .map((r) => revisionOf(entry, r))
        .reverse();
    },
    async getRevisionBody(id) {
      const [entryId, number] = id.split("@r");
      const entry = byId(entryId);
      const revision = entry?.revisions.find((r) => r.number === Number(number));
      if (!entry || !revision || (!mayEdit(entry) && !(isPublic(entry) && revision.state === "published"))) return null;
      return bodyOf(entry, revision.number);
    },
    async getRevision(id) {
      const [entryId, number] = id.split("@r");
      const entry = byId(entryId);
      const revision = entry?.revisions.find((r) => r.number === Number(number));
      if (!entry || !revision || (!mayEdit(entry) && !(isPublic(entry) && revision.state === "published"))) return null;
      return snapshotOf(entry, revision);
    },
    async listRelations(entryId) {
      const visible = (id: string) => {
        const entry = byId(id);
        return Boolean(entry && isPublic(entry));
      };
      return relations
        .filter((r) => visible(r.from) && visible(r.to))
        .filter((r) => !entryId || r.from === entryId || r.to === entryId)
        .map((r) => structuredClone(r));
    },
    async listEditorial(query: EditorialQuery) {
      const account = context.account();
      if (query.scope === "all" && account?.role !== "admin") throw new ServiceError("forbidden", "admin_required");
      if (query.scope === "mine" && !account?.authorId) return { rows: [], total: 0 };
      const text = query.text?.trim().toLowerCase() ?? "";
      const view = query.view ?? "active";
      const rows = store
        .filter((e) => query.scope === "all" || e.authorId === account?.authorId)
        .filter((e) => view === "all" || (view === "archived") === Boolean(e.archivedAt))
        .map(editorialOf)
        .filter(
          (e) =>
            !text ||
            [e.id, e.slug, e.title.zh, e.title.en].some((value) => value.toLowerCase().includes(text)),
        )
        .filter(
          (e) =>
            !query.status?.length ||
            query.status.includes(e.status) ||
            (query.status.includes("returned") && e.status === "draft" && Boolean(e.returnNote)) ||
            (query.status.includes("unpublished") && !e.publishedRevision),
        )
        .sort((a, b) => b.editedAt.localeCompare(a.editedAt) || a.id.localeCompare(b.id));
      return paginate(rows, query.limit, query.offset);
    },
    async getEditorial(key) {
      const entry = byId(key) ?? store.find((x) => x.slug === key);
      if (!entry || !mayEdit(entry)) return null;
      const latest = entry.revisions.find((r) => r.number === entry.latest);
      if (!latest) return null;
      const published = entry.public ? entry.revisions.find((r) => r.number === entry.public!.revision) : undefined;
      return {
        entry: editorialOf(entry),
        latest: snapshotOf(entry, latest),
        published: published ? snapshotOf(entry, published) : null,
      };
    },
    async saveDraft(input: DraftInput): Promise<SavedRevision> {
      const { admin, authorId } = editor();
      const title = { zh: input.title.zh ?? "", en: input.title.en ?? "" };
      const summary = { zh: input.summary.zh ?? "", en: input.summary.en ?? "" };
      if (!title.zh.trim() && !title.en.trim()) throw new ServiceError("invalid", "title_required");
      if (title.zh.length > 200 || title.en.length > 200) throw new ServiceError("invalid", "title_too_long");
      if (summary.zh.length > 2000 || summary.en.length > 2000) throw new ServiceError("invalid", "summary_too_long");
      if (input.body.length > 400_000) throw new ServiceError("invalid", "body_too_long");
      const now = new Date().toISOString();
      let entry = input.entryId ? byId(input.entryId) : undefined;
      if (input.entryId && !entry) throw new ServiceError("invalid", "entry_not_found");
      let withdrewReview = false;
      let filing: EntryTaxonomy;
      if (!entry) {
        filing = filingOf(
          {
            categoryId:
              input.categoryId ?? (input.domain ? genusForLegacyDomain(input.domain, taxonomy.categories) : undefined),
          },
          input.metadata,
        );
        const id = `PW-${String(store.reduce((m, e) => Math.max(m, Number(e.id.replace(/^PW-/, "")) || 0), 0) + 1).padStart(4, "0")}`;
        const metadata = validate(input.metadata, id);
        const base: EntrySummary = {
          id,
          slug: uniqueSlug(title.en, id, (slug) => store.some((e) => e.slug === slug || e.formerSlugs.includes(slug))),
          title,
          summary,
          ...filing,
          domain: input.domain,
          scale: metadata.scale,
          role: metadata.role,
          analogue: metadata.analogue,
          status: "draft",
          authorId,
          contributorIds: [],
          sourceIds: [],
          tagIds: [],
          bodyLanguages: languagesOf(input.body),
          heroAssetId: metadata.heroAssetId,
          createdAt: now,
          updatedAt: now,
          revision: 0,
        };
        entry = {
          id,
          slug: base.slug,
          formerSlugs: [],
          authorId,
          createdAt: now,
          base,
          public: null,
          latest: 0,
          status: "draft",
          editedAt: now,
          revisions: [],
        };
        store.push(entry);
        const revision = append(
          entry,
          { authorId, createdAt: now, note: input.note || "Save draft", state: "draft", title, summary, metadata, taxonomy: filing },
          input.body,
        );
        context.audit("save_revision", "entry", id, null, { revision: revision.number });
        return { ...revisionOf(entry, revision), slug: entry.slug, withdrewReview };
      }
      if (entry.authorId !== authorId && !admin) throw new ServiceError("forbidden", "forbidden");
      if (entry.archivedAt) throw new ServiceError("conflict", "entry_archived");
      if (input.baseRevision !== undefined && input.baseRevision !== null && input.baseRevision !== entry.latest)
        throw new ServiceError("conflict", "revision_conflict");
      const latest = entry.revisions.find((r) => r.number === entry.latest);
      filing = filingOf(latest?.taxonomy ?? taxonomyOf(entry.public ?? entry.base), input.metadata);
      const metadata = validate(input.metadata, entry.id);
      withdrewReview = entry.status === "in_review";
      const revision = append(
        entry,
        { authorId, createdAt: now, note: input.note || "Save draft", state: "draft", title, summary, metadata, taxonomy: filing },
        input.body,
      );
      entry.status = "draft";
      context.audit(withdrewReview ? "save_over_review" : "save_revision", "entry", entry.id, null, {
        revision: revision.number,
      });
      return { ...revisionOf(entry, revision), slug: entry.slug, withdrewReview };
    },
    async transition(input: ReviewTransitionInput) {
      const { admin, authorId } = editor();
      const entry = byId(input.entryId);
      if (!entry) throw new ServiceError("invalid", "entry_not_found");
      if (entry.archivedAt) throw new ServiceError("conflict", "entry_archived");
      const action = input.action;
      if ((action === "submit" || action === "withdraw") && entry.authorId !== authorId && !admin)
        throw new ServiceError("forbidden", "forbidden");
      if ((action === "return" || action === "publish" || action === "rollback") && !admin)
        throw new ServiceError("forbidden", "admin_required");
      if ((action === "return" || action === "publish") && input.expectedRevision === undefined)
        throw new ServiceError("invalid", "expected_revision_required");
      if (input.expectedRevision !== undefined && input.expectedRevision !== entry.latest)
        throw new ServiceError("conflict", "revision_conflict");
      const now = new Date().toISOString();
      const current = entry.revisions.find((r) => r.number === entry.latest)!;
      if (action === "withdraw" || action === "return") {
        if (entry.status !== "in_review") throw new ServiceError("conflict", "invalid_transition");
        if (action === "return" && !input.note?.trim()) throw new ServiceError("invalid", "reason_required");
        entry.status = "draft";
        entry.editedAt = now;
        entry.returnNote = action === "return" ? input.note!.trim() : undefined;
        entry.returnedAt = action === "return" ? now : undefined;
        context.audit(action, "entry", entry.id, null, { revision: entry.latest, note: input.note });
        return revisionOf(entry, current);
      }
      let source: MockRevision;
      let state: ReviewState;
      if (action === "submit") {
        if (entry.status !== "draft") throw new ServiceError("conflict", "invalid_transition");
        source = current;
        state = "in_review";
      } else if (action === "publish") {
        if (entry.status !== "in_review") throw new ServiceError("conflict", "invalid_transition");
        source = current;
        state = "published";
      } else {
        if (entry.status === "in_review") throw new ServiceError("conflict", "review_pending");
        const target = entry.revisions.find((r) => `${entry.id}@r${r.number}` === input.targetRevisionId);
        if (!target) throw new ServiceError("invalid", "revision_not_found");
        if (target.state !== "published") throw new ServiceError("invalid", "rollback_target_unpublished");
        source = target;
        state = "published";
      }
      const snap = snapshotOf(entry, source);
      const taxonomyCheck = filingOf(source.taxonomy);
      let metadata: EntryMetadata = { ...snap.metadata };
      if (state === "published") metadata = materialize(metadata);
      if (!bilingualComplete(snap.title, snap.summary, snap.body)) throw new ServiceError("invalid", "bilingual_incomplete");
      if (state === "published") assertAssetsPublic(metadata.heroAssetId, snap.body);
      const revision = append(
        entry,
        {
          authorId,
          createdAt: now,
          note: input.note || (action === "rollback" ? `Rollback to r${source.number}` : action),
          state,
          title: snap.title,
          summary: snap.summary,
          metadata,
          taxonomy: taxonomyCheck,
        },
        snap.body,
      );
      entry.status = state;
      entry.returnNote = undefined;
      entry.returnedAt = undefined;
      if (state === "published") applySnapshot(entry, revision);
      context.audit(action, "entry", entry.id, null, { revision: revision.number, source: source.number });
      return revisionOf(entry, revision);
    },
    async setArchived(entryId, archived, reason) {
      context.requireActive(true);
      const entry = byId(entryId);
      if (!entry) throw new ServiceError("invalid", "entry_not_found");
      if (Boolean(entry.archivedAt) === archived) throw new ServiceError("conflict", "unchanged_status");
      entry.archivedAt = archived ? new Date().toISOString() : undefined;
      context.audit(archived ? "archive" : "restore", "entry", entryId, null, { reason: reason ?? null });
      return { id: entry.id, slug: entry.slug, archivedAt: entry.archivedAt };
    },
    async renameSlug(entryId, slug) {
      context.requireActive(true);
      const entry = byId(entryId);
      if (!entry) throw new ServiceError("invalid", "entry_not_found");
      const next = slug.trim().toLowerCase();
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(next) || next.length > 80) throw new ServiceError("invalid", "invalid_slug");
      if (next === entry.slug) return { slug: entry.slug, formerSlugs: [...entry.formerSlugs] };
      if (store.some((e) => e !== entry && (e.slug === next || e.formerSlugs.includes(next))))
        throw new ServiceError("conflict", "slug_taken");
      entry.formerSlugs = [...entry.formerSlugs.filter((s) => s !== next), entry.slug];
      entry.slug = next;
      if (entry.public) entry.public.slug = next;
      context.audit("rename_slug", "entry", entryId, null, { slug: next });
      return { slug: entry.slug, formerSlugs: [...entry.formerSlugs] };
    },
    async getWorkingDraft(query) {
      const account = context.account();
      if (!account) return null;
      const found = [...working.values()]
        .filter((draft) => draft.ownerId === account.id)
        .find((draft) => (query.id ? draft.id === query.id : (draft.entryId ?? null) === (query.entryId ?? null)));
      if (!found) return null;
      const { ownerId, ...draft } = found;
      void ownerId;
      return structuredClone(draft);
    },
    async saveWorkingDraft(input) {
      const { account } = editor();
      if (input.entryId) {
        const entry = byId(input.entryId);
        if (!entry || !mayEdit(entry)) throw new ServiceError("forbidden", "forbidden");
      }
      if (JSON.stringify(input.payload).length > 2_000_000) throw new ServiceError("invalid", "invalid_draft_payload");
      const existing = [...working.values()].find(
        (draft) =>
          draft.ownerId === account.id && (input.id ? draft.id === input.id : (draft.entryId ?? null) === (input.entryId ?? null) && Boolean(input.entryId)),
      );
      const savedAt = new Date().toISOString();
      if (existing) {
        if (input.knownVersion !== undefined && existing.version > input.knownVersion)
          return { conflict: true, id: existing.id, version: existing.version, savedAt: existing.savedAt, payload: existing.payload };
        Object.assign(existing, {
          payload: structuredClone(input.payload),
          baseRevision: input.baseRevision,
          entryId: input.entryId ?? existing.entryId,
          version: existing.version + 1,
          savedAt,
        });
        return { conflict: false, id: existing.id, version: existing.version, savedAt };
      }
      const id = crypto.randomUUID();
      working.set(id, {
        id,
        ownerId: account.id,
        entryId: input.entryId,
        baseRevision: input.baseRevision,
        payload: structuredClone(input.payload),
        version: 1,
        savedAt,
      });
      return { conflict: false, id, version: 1, savedAt };
    },
    async deleteWorkingDraft(id) {
      const account = context.account();
      const draft = working.get(id);
      if (draft && draft.ownerId === account?.id) working.delete(id);
    },
  };
}

/** The search index's view of the store: published entries and bodies. */
export function publishedSearchSource(repository: EntryRepository) {
  return async () => {
    const list = await repository.listEntries();
    return Promise.all(
      list.map(async (entry) => ({ entry, body: (await repository.getRevisionBody(`${entry.id}@r${entry.revision}`)) ?? "" })),
    );
  };
}
