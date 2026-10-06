import type { EntrySummary, Lang, Localized, Revision } from "@/lib/model/types";
import { DOMAIN_IDS } from "@/lib/model/vocab";
import { diffLines } from "diff";
import { entries, relations, type EntryFixture } from "@/mock/entries";
import {
  ServiceError,
  type DraftInput,
  type EntryQuery,
  type EntryRepository,
  type ReviewTransitionInput,
} from "@/lib/services/contracts";
import { bodyAt } from "./body";

const working = entries.map((entry) => ({ ...entry, revisions: entry.revisions.map((revision) => ({ ...revision })) }));
const bodies = new Map<string, string>();
for (const entry of working) bodies.set(`${entry.id}@r${entry.revision}`, bodyAt(entry.slug, entry.revision));
const summaryOf = (entry: EntryFixture): EntrySummary => {
  const { revisions, ...summary } = entry;
  void revisions;
  return summary;
};
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
const revisionsOf = (entry: EntryFixture): Revision[] =>
  entry.revisions
    .map((r, i) => ({
      id: `${entry.id}@r${r.number}`,
      entryId: entry.id,
      number: r.number,
      parentId: i ? `${entry.id}@r${entry.revisions[i - 1].number}` : undefined,
      authorId: r.authorId,
      createdAt: r.createdAt,
      note: r.note,
      state: r.state,
      stats: statsOf(
        i
          ? (bodies.get(`${entry.id}@r${entry.revisions[i - 1].number}`) ??
              bodyAt(entry.slug, entry.revisions[i - 1].number))
          : "",
        bodies.get(`${entry.id}@r${r.number}`) ?? bodyAt(entry.slug, r.number),
      ),
    }))
    .reverse();

/* ── Creating a new entry from the editor ────────────────────────────────── */

const nextEntryId = () => {
  const max = working.reduce((m, e) => Math.max(m, Number(e.id.replace(/^PW-/, "")) || 0), 0);
  return `PW-${String(max + 1).padStart(4, "0")}`;
};

const slugFor = (title: Localized, id: string): string => {
  const base =
    title.en
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `new-${id.slice(3).toLowerCase()}`;
  let slug = base;
  for (let n = 2; working.some((x) => x.slug === slug); n++) slug = `${base}-${n}`;
  return slug;
};

const languagesOf = (body: string): Lang[] => {
  const langs: Lang[] = [];
  if (body.includes(":::zh")) langs.push("zh");
  if (body.includes(":::en")) langs.push("en");
  return langs.length ? langs : (["zh", "en"] as Lang[]);
};

const metadataOf = (input: DraftInput) =>
  input.metadata ?? {
    scale: "micro" as const,
    role: "observer" as const,
    contributorIds: [],
    sourceIds: [],
    tagIds: [],
    relationDrafts: [],
    pendingSources: [],
    pendingTags: [],
  };

const createEntry = (input: DraftInput): Revision => {
  if (!input.domain || !DOMAIN_IDS.includes(input.domain))
    throw new ServiceError("invalid", "A new entry needs one of the ten phyla");
  const now = new Date().toISOString();
  const id = nextEntryId();
  working.push({
    id,
    slug: slugFor(input.title, id),
    title: input.title,
    summary: input.summary,
    domain: input.domain,
    scale: metadataOf(input).scale,
    role: metadataOf(input).role,
    analogue: metadataOf(input).analogue,
    status: "draft",
    authorId: input.authorId,
    contributorIds: metadataOf(input).contributorIds,
    sourceIds: metadataOf(input).sourceIds,
    tagIds: metadataOf(input).tagIds,
    heroAssetId: metadataOf(input).heroAssetId,
    bodyLanguages: languagesOf(input.body),
    createdAt: now,
    updatedAt: now,
    revision: 1,
    revisions: [{ number: 1, authorId: input.authorId, createdAt: now, state: "draft", note: input.note }],
  });
  bodies.set(`${id}@r1`, input.body);
  return {
    id: `${id}@r1`,
    entryId: id,
    number: 1,
    authorId: input.authorId,
    createdAt: now,
    note: input.note,
    state: "draft",
    stats: statsOf("", input.body),
  };
};

export function createMockEntryRepository(): EntryRepository {
  return {
    async listEntries(q: EntryQuery = {}) {
      return working
        .filter((e) => !q.status || q.status.includes(e.status))
        .filter((e) => !q.domain || q.domain.includes(e.domain))
        .filter((e) => !q.scale || q.scale.includes(e.scale))
        .filter((e) => q.featured === undefined || Boolean(e.featured) === q.featured)
        .sort((a, b) =>
          (q.sort === "created" ? b.createdAt : b.updatedAt).localeCompare(
            q.sort === "created" ? a.createdAt : a.updatedAt,
          ),
        )
        .slice(0, q.limit ?? Number.MAX_SAFE_INTEGER)
        .map(summaryOf);
    },
    async getEntry(slug) {
      const e = working.find((x) => x.slug === slug);
      return e ? { ...summaryOf(e), body: bodies.get(`${e.id}@r${e.revision}`) ?? bodyAt(e.slug, e.revision) } : null;
    },
    async getEntryById(id) {
      const e = working.find((x) => x.id === id);
      return e ? { ...summaryOf(e), body: bodies.get(`${e.id}@r${e.revision}`) ?? bodyAt(e.slug, e.revision) } : null;
    },
    async listRevisions(id) {
      const e = working.find((x) => x.id === id);
      return e ? revisionsOf(e) : [];
    },
    async getRevisionBody(id) {
      const [entryId, revision] = id.split("@r");
      const e = working.find((x) => x.id === entryId);
      return e ? (bodies.get(id) ?? bodyAt(e.slug, Number(revision))) : null;
    },
    async listRelations(entryId) {
      return entryId ? relations.filter((r) => r.from === entryId || r.to === entryId) : relations;
    },
    async saveDraft(input: DraftInput) {
      const e = input.entryId ? working.find((x) => x.id === input.entryId) : undefined;
      if (input.entryId && !e) throw new ServiceError("invalid", "Entry does not exist");
      if (!e) return createEntry(input);
      if (input.baseRevision !== undefined && input.baseRevision !== e.revision)
        throw new ServiceError("conflict", "The entry changed while you were editing it");
      const number = e.revisions.length + 1;
      const metadata = metadataOf(input);
      const revision = {
        number,
        authorId: input.authorId,
        createdAt: new Date().toISOString(),
        note: input.note,
        state: "draft" as const,
      };
      e.revisions.push(revision);
      e.status = "draft";
      e.updatedAt = revision.createdAt;
      e.revision = number;
      e.scale = metadata.scale;
      e.role = metadata.role;
      e.analogue = metadata.analogue;
      e.contributorIds = metadata.contributorIds;
      e.sourceIds = metadata.sourceIds;
      e.tagIds = metadata.tagIds;
      e.heroAssetId = metadata.heroAssetId;
      bodies.set(`${e.id}@r${number}`, input.body);
      return {
        id: `${e.id}@r${number}`,
        entryId: e.id,
        number,
        parentId: `${e.id}@r${number - 1}`,
        authorId: revision.authorId,
        createdAt: revision.createdAt,
        note: revision.note,
        state: revision.state,
        stats: statsOf(bodies.get(`${e.id}@r${number - 1}`) ?? bodyAt(e.slug, number - 1), input.body),
      };
    },
    async transition(input: ReviewTransitionInput) {
      const e = working.find((x) => x.id === input.entryId);
      if (!e) throw new ServiceError("invalid", "Entry does not exist");
      const allowed =
        (input.action === "submit" && e.status === "draft") ||
        (input.action === "publish" && e.status === "in_review") ||
        (input.action === "rollback" && Boolean(input.targetRevisionId));
      if (!allowed) throw new ServiceError("conflict", `Cannot ${input.action} from ${e.status}`);
      const state = input.action === "submit" ? "in_review" : ("published" as const);
      const number = e.revisions.length + 1;
      const createdAt = new Date().toISOString();
      e.revisions.push({ number, authorId: input.actorId, createdAt, note: input.note ?? input.action, state });
      const sourceBody =
        input.action === "rollback" && input.targetRevisionId
          ? bodies.get(input.targetRevisionId)
          : (bodies.get(`${e.id}@r${e.revision}`) ?? bodyAt(e.slug, e.revision));
      bodies.set(`${e.id}@r${number}`, sourceBody ?? "");
      e.status = state;
      e.updatedAt = createdAt;
      e.revision = number;
      return {
        id: `${e.id}@r${number}`,
        entryId: e.id,
        number,
        parentId: `${e.id}@r${number - 1}`,
        authorId: input.actorId,
        createdAt,
        note: input.note ?? input.action,
        state,
        stats: statsOf(bodies.get(`${e.id}@r${number - 1}`) ?? bodyAt(e.slug, number - 1), sourceBody ?? ""),
      };
    },
  };
}
