import "server-only";
import type { EditorialEntry, Entry, EntryMetadata, Relation, RevisionSnapshot } from "@/lib/model/types";
import type {
  DraftInput,
  EditorialPacket,
  EntryQuery,
  EntryRepository,
  ReviewTransitionInput,
  SavedRevision,
  WorkingDraft,
  WorkingDraftResult,
} from "./contracts";
import { createSupabaseAuthAdapter } from "./supabase-auth";
import {
  client,
  jsonList,
  localized,
  mapRevision,
  mapSnapshot,
  mapSummary,
  number,
  optionalNumber,
  optionalText,
  result,
  rpc,
  text,
  type Row,
  type SupabaseClient,
} from "./supabase-shared";

/** Association rows for many entries, in their recorded order, one paged query per table. */
async function associations(c: SupabaseClient, table: string, key: string, entryIds: string[]) {
  const grouped = new Map<string, string[]>();
  for (let offset = 0; ; offset += 1000) {
    const linked = (await result(
      await c
        .from(table)
        .select("*")
        .in("entry_id", entryIds)
        .order("entry_id")
        .order(table === "entry_auxiliary_categories" ? key : "position")
        .order(key)
        .range(offset, offset + 999),
    )) as unknown as Row[];
    for (const row of linked) {
      const id = text(row.entry_id);
      grouped.set(id, [...(grouped.get(id) ?? []), text(row[key])]);
    }
    if (linked.length < 1000) break;
  }
  return grouped;
}

async function withAssociations(c: SupabaseClient, rows: Row[]) {
  if (!rows.length) return [];
  const ids = rows.map((row) => text(row.id));
  const [contributors, sources, tags, auxiliary] = await Promise.all([
    associations(c, "entry_contributors", "author_id", ids),
    associations(c, "entry_sources", "source_id", ids),
    associations(c, "entry_tags", "tag_id", ids),
    associations(c, "entry_auxiliary_categories", "category_id", ids),
  ]);
  return rows.map((row) => {
    const entry = mapSummary(row);
    return {
      ...entry,
      contributorIds: contributors.get(entry.id) ?? [],
      sourceIds: sources.get(entry.id) ?? [],
      tagIds: tags.get(entry.id) ?? [],
      auxiliaryCategoryIds: auxiliary.get(entry.id) ?? [],
    };
  });
}

/** Readers' rows: published and not archived, whatever the caller may also see. */
const publicEntries = (c: SupabaseClient) =>
  c.from("entries").select("*").is("deleted_at", null).not("published_revision_number", "is", null);

function editorialOf(row: Row, latest?: Row, author?: Row | null): EditorialEntry {
  return {
    id: text(row.id),
    slug: text(row.slug),
    title:
      latest && latest.title_zh != null
        ? localized(latest, "title_zh", "title_en")
        : localized(row, "title_zh", "title_en"),
    summary:
      latest && latest.summary_zh != null
        ? localized(latest, "summary_zh", "summary_en")
        : localized(row, "summary_zh", "summary_en"),
    status: row.status as EditorialEntry["status"],
    latestRevision: number(row.latest_revision_number),
    publishedRevision: optionalNumber(row.published_revision_number),
    authorId: text(row.author_id),
    authorName: author ? localized(author, "name_zh", "name_en") : { zh: "", en: "" },
    categoryId: optionalText(row.category_id),
    editedAt: text(row.edited_at ?? row.updated_at),
    publishedAt: optionalText(row.published_at),
    archivedAt: optionalText(row.deleted_at),
    returnNote: optionalText(row.return_note),
    returnedAt: optionalText(row.returned_at),
  };
}

/** What readers see now, as metadata, for revisions that did not record theirs. */
async function publicMetadata(c: SupabaseClient, row: Row): Promise<Partial<EntryMetadata>> {
  const [entry] = await withAssociations(c, [row]);
  return {
    scale: entry.scale,
    role: entry.role,
    analogue: entry.analogue,
    heroAssetId: entry.heroAssetId,
    contributorIds: entry.contributorIds,
    sourceIds: entry.sourceIds,
    tagIds: entry.tagIds,
    categoryId: entry.categoryId,
    auxiliaryCategoryIds: entry.auxiliaryCategoryIds,
    species: entry.species,
    level: entry.level,
    contentRole: entry.contentRole,
  };
}

async function snapshot(c: SupabaseClient, revisionId: string, entry: Row, fallback?: Partial<EntryMetadata>) {
  const [revision, body] = await Promise.all([
    c.from("entry_revisions").select("*").eq("id", revisionId).maybeSingle(),
    c.from("entry_revision_bodies").select("body").eq("revision_id", revisionId).maybeSingle(),
  ]);
  const row = (await result(revision)) as Row | null;
  if (!row) return null;
  const bodyRow = (await result(body)) as Row | null;
  return mapSnapshot(row, text(bodyRow?.body), entry, fallback);
}

export function createEntryRepository(): EntryRepository {
  const auth = createSupabaseAuthAdapter();
  return {
    async listEntries(query: EntryQuery = {}) {
      if (query.status?.length && !query.status.includes("published")) return [];
      const c = await client();
      let request = publicEntries(c);
      if (query.domain?.length) request = request.in("domain", query.domain);
      if (query.categoryId?.length) request = request.in("category_id", query.categoryId);
      if (query.familyId?.length) {
        const genera = (await result(
          await c.from("taxon_categories").select("id").in("family_id", query.familyId),
        )) as Row[];
        request = request.in(
          "category_id",
          genera.map((row) => text(row.id)),
        );
      }
      if (query.auxiliaryCategoryId?.length) {
        const linked = (await result(
          await c.from("entry_auxiliary_categories").select("entry_id").in("category_id", query.auxiliaryCategoryId),
        )) as Row[];
        request = request.in(
          "id",
          linked.map((row) => text(row.entry_id)),
        );
      }
      if (query.scale?.length) request = request.in("scale", query.scale);
      if (query.featured !== undefined) request = request.eq("featured", query.featured);
      const rows = (await result(
        await request
          .order(query.sort === "created" ? "created_at" : "published_at", { ascending: false, nullsFirst: false })
          .order("id")
          .limit(query.limit ?? 1000),
      )) as Row[];
      return withAssociations(c, rows);
    },

    async getEntry(slug) {
      const c = await client();
      const rows = (await result(await publicEntries(c).or(`slug.eq.${slug},former_slugs.cs.{${slug}}`))) as Row[];
      const row = rows.find((candidate) => candidate.slug === slug) ?? rows[0];
      if (!row) return null;
      const [entry] = await withAssociations(c, [row]);
      const bodyRow = (await result(
        await c
          .from("entry_revision_bodies")
          .select("body")
          .eq("revision_id", `${entry.id}@r${entry.revision}`)
          .maybeSingle(),
      )) as Row | null;
      return { ...entry, body: text(bodyRow?.body) } as Entry;
    },

    async getEntryById(id) {
      const c = await client();
      const row = (await result(await publicEntries(c).eq("id", id).maybeSingle())) as Row | null;
      return row ? this.getEntry(text(row.slug)) : null;
    },

    async listRevisions(entryId, options) {
      const c = await client();
      let request = c
        .from("entry_revisions")
        .select(
          "id, entry_id, number, parent_id, author_id, created_at, note, state, metadata, added_lines, removed_lines",
        )
        .eq("entry_id", entryId);
      if ((options?.scope ?? "public") === "public") request = request.eq("state", "published");
      return ((await result(await request.order("number", { ascending: false }))) as Row[]).map(mapRevision);
    },

    async getRevisionBody(revisionId) {
      const c = await client();
      const row = (await result(
        await c.from("entry_revision_bodies").select("body").eq("revision_id", revisionId).maybeSingle(),
      )) as Row | null;
      return row ? text(row.body) : null;
    },

    async getRevision(revisionId) {
      const c = await client();
      const entryId = revisionId.split("@r")[0];
      const entry = (await result(await c.from("entries").select("*").eq("id", entryId).maybeSingle())) as Row | null;
      if (!entry) return null;
      return snapshot(c, revisionId, entry, await publicMetadata(c, entry));
    },

    async listRelations(entryId) {
      const c = await client();
      let request = c.from("relations").select("*");
      if (entryId) request = request.or(`from_entry_id.eq.${entryId},to_entry_id.eq.${entryId}`);
      const rows = (await result(await request.order("id"))) as Row[];
      return rows.map((row): Relation => ({
        id: text(row.id),
        from: text(row.from_entry_id),
        to: text(row.to_entry_id),
        kind: row.kind as Relation["kind"],
        note: localized(row, "note_zh", "note_en"),
        strength: number(row.strength) as Relation["strength"],
      }));
    },

    async listEditorial(query) {
      const payload = await rpc<{ total: number; rows: Row[] }>("pw_list_editorial_entries", {
        p_scope: query.scope,
        p_text: query.text ?? "",
        p_status: query.status ?? [],
        p_view: query.view ?? "active",
        p_limit: query.limit ?? 25,
        p_offset: query.offset ?? 0,
      });
      return {
        total: number(payload.total),
        rows: jsonList<Row>(payload.rows).map((row): EditorialEntry => ({
          id: text(row.id),
          slug: text(row.slug),
          title: row.title as EditorialEntry["title"],
          summary: row.summary as EditorialEntry["summary"],
          status: row.status as EditorialEntry["status"],
          latestRevision: number(row.latestRevision),
          publishedRevision: optionalNumber(row.publishedRevision),
          authorId: text(row.authorId),
          authorName: row.authorName as EditorialEntry["authorName"],
          categoryId: optionalText(row.categoryId),
          editedAt: text(row.editedAt),
          publishedAt: optionalText(row.publishedAt),
          archivedAt: optionalText(row.archivedAt),
          returnNote: optionalText(row.returnNote),
          returnedAt: optionalText(row.returnedAt),
        })),
      };
    },

    async getEditorial(key): Promise<EditorialPacket | null> {
      const account = await auth.getCurrentAccount();
      if (!account || !/^[A-Za-z0-9_-]+$/.test(key)) return null;
      const c = await client();
      const row = (await result(
        await c.from("entries").select("*").or(`id.eq.${key},slug.eq.${key}`).limit(1).maybeSingle(),
      )) as Row | null;
      if (!row || (account.role !== "admin" && account.authorId !== row.author_id)) return null;
      const fallback = await publicMetadata(c, row);
      const latestId = `${text(row.id)}@r${number(row.latest_revision_number)}`;
      const publishedNumber = optionalNumber(row.published_revision_number);
      const [latest, published, author] = await Promise.all([
        snapshot(c, latestId, row, fallback),
        publishedNumber ? snapshot(c, `${text(row.id)}@r${publishedNumber}`, row, fallback) : Promise.resolve(null),
        c.from("authors").select("name_zh, name_en").eq("id", text(row.author_id)).maybeSingle(),
      ]);
      if (!latest) return null;
      const latestRow: Row = {
        title_zh: latest.title.zh,
        title_en: latest.title.en,
        summary_zh: latest.summary.zh,
        summary_en: latest.summary.en,
      };
      return {
        entry: editorialOf(row, latestRow, (await result(author)) as Row | null),
        latest: latest as RevisionSnapshot,
        published,
      };
    },

    async saveDraft(input: DraftInput) {
      const row = await rpc<Row>("pw_save_draft", {
        p_entry_id: input.entryId ?? null,
        p_domain: input.domain ?? null,
        p_title_zh: input.title.zh,
        p_title_en: input.title.en,
        p_summary_zh: input.summary.zh,
        p_summary_en: input.summary.en,
        p_body: input.body,
        p_note: input.note,
        p_base_revision: input.baseRevision ?? null,
        p_metadata: input.metadata ?? null,
        p_category_id: input.categoryId ?? null,
      });
      return {
        ...mapRevision(row),
        withdrewReview: Boolean(row.withdrewReview),
        slug: optionalText(row.slug),
      } as SavedRevision;
    },

    async transition(input: ReviewTransitionInput) {
      return mapRevision(
        await rpc<Row>("pw_entry_lifecycle", {
          p_entry_id: input.entryId,
          p_action: input.action,
          p_expected_revision: input.expectedRevision ?? null,
          p_target_revision_id: input.targetRevisionId ?? null,
          p_note: input.note ?? null,
        }),
      );
    },

    async setArchived(entryId, archived, reason) {
      const row = await rpc<Row>("pw_set_entry_archived", {
        p_entry_id: entryId,
        p_archived: archived,
        p_reason: reason ?? null,
      });
      return { id: text(row.id), slug: text(row.slug), archivedAt: optionalText(row.archivedAt) };
    },

    async renameSlug(entryId, slug) {
      const row = await rpc<Row>("pw_admin_rename_entry_slug", { p_entry_id: entryId, p_slug: slug });
      return { slug: text(row.slug), formerSlugs: jsonList<string>(row.formerSlugs) };
    },

    async getWorkingDraft(query): Promise<WorkingDraft | null> {
      const account = await auth.getCurrentAccount();
      if (!account) return null;
      const c = await client();
      let request = c
        .from("entry_working_drafts")
        .select("id, entry_id, base_revision, payload, version, updated_at")
        .eq("owner_id", account.id);
      request = query.id
        ? request.eq("id", query.id)
        : query.entryId
          ? request.eq("entry_id", query.entryId)
          : request.is("entry_id", null);
      const rows = (await result(await request.order("updated_at", { ascending: false }).limit(1))) as Row[];
      const row = rows[0];
      return row
        ? {
            id: text(row.id),
            entryId: optionalText(row.entry_id),
            baseRevision: optionalNumber(row.base_revision),
            payload: (row.payload ?? {}) as Record<string, unknown>,
            version: number(row.version),
            savedAt: text(row.updated_at),
          }
        : null;
    },

    async saveWorkingDraft(input): Promise<WorkingDraftResult> {
      const row = await rpc<Row>("pw_save_working_draft", {
        p_id: input.id ?? null,
        p_entry_id: input.entryId ?? null,
        p_base_revision: input.baseRevision ?? null,
        p_payload: input.payload,
        p_known_version: input.knownVersion ?? null,
      });
      const base = { id: text(row.id), version: number(row.version), savedAt: text(row.savedAt) };
      return row.conflict
        ? { ...base, conflict: true, payload: (row.payload ?? {}) as Record<string, unknown> }
        : { ...base, conflict: false };
    },

    async deleteWorkingDraft(id) {
      const account = await auth.getCurrentAccount();
      if (!account) return;
      const c = await client();
      await result(await c.from("entry_working_drafts").delete().eq("id", id).eq("owner_id", account.id));
    },
  };
}
