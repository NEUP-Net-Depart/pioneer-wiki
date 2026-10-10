import "server-only";
import type {
  Category,
  Chronicle,
  ChronicleDetail,
  ChronicleResource,
  ContentVersion,
  Family,
  ForumPost,
  ForumThread,
  FriendLink,
  Member,
  MemberCover,
  TaxonKind,
  TaxonLink,
  TaxonSnapshot,
  TaxonVersion,
} from "@/lib/model/types";
import type {
  ArchiveView,
  ChronicleQuery,
  ChronicleRepository,
  CommunityRepository,
  MemberAdminPatch,
  SearchAdapter,
  SearchQuery,
  SearchResult,
  TaxonPatch,
  TaxonomyRepository,
  WikiServices,
} from "./contracts";
import { ServiceError } from "./contracts";
import { createSupabaseAuthAdapter } from "./supabase-auth";
import { createEntryRepository } from "./supabase-entries";
import {
  createAccountRepository,
  createAuditRepository,
  createOperationsAdapter,
  createReferenceRepository,
} from "./supabase-admin";
import {
  bool,
  client,
  jsonList,
  localized,
  number,
  optionalText,
  result,
  rpc,
  text,
  type Row,
  type SupabaseClient,
} from "./supabase-shared";
import { readProjects } from "@/lib/members/project-validation";
import { readMemberGithub, readMemberLinks, validateMemberPatch } from "@/lib/members/validation";
import { validatePost, validateThread } from "@/lib/forum/validation";
import { facetsOf, searchWords } from "@/lib/chronicles/query";
import { STORED_NAME } from "@/lib/media/store";

function createSearchAdapter(): SearchAdapter {
  return {
    async search(query: SearchQuery): Promise<SearchResult> {
      const payload = await rpc<{ hits: SearchResult["hits"]; total: number; facets: SearchResult["facets"] }>(
        "pw_search_entries_v2",
        {
          p_text: query.text,
          p_domain: query.filters?.domain ?? [],
          p_scale: query.filters?.scale ?? [],
          p_status: query.filters?.status ?? [],
          p_lang: query.filters?.lang ?? [],
          p_author: query.filters?.author ?? [],
          p_limit: query.limit ?? 50,
          p_offset: query.offset ?? 0,
          p_family: query.filters?.familyId ?? [],
          p_category: query.filters?.categoryId ?? [],
        },
      );
      return {
        hits: payload.hits.map((row) => ({
          entry: row.entry,
          familyId: row.familyId,
          score: row.score,
          matchedFields: row.matchedFields as Array<"id" | "title" | "summary" | "body" | "tags" | "author" | "source">,
          snippet: row.snippet,
        })),
        total: payload.total,
        facets: payload.facets,
      };
    },
  };
}

function mapTaxon(row: Row): Family {
  return {
    id: text(row.id),
    slug: text(row.slug),
    formerSlugs: Array.isArray(row.former_slugs) ? (row.former_slugs as string[]) : [],
    name: localized(row, "name_zh", "name_en"),
    scientificName: text(row.scientific_name),
    taxonNameZh: optionalText(row.taxon_name_zh),
    intro: localized(row, "intro_zh", "intro_en"),
    essay: text(row.essay),
    emblemAssetId: optionalText(row.emblem_asset_id),
    links: Array.isArray(row.links) ? (row.links as TaxonLink[]) : [],
    leadId: optionalText(row.lead_id),
    collaboratorIds: Array.isArray(row.collaborator_ids) ? (row.collaborator_ids as string[]) : [],
    sortOrder: number(row.sort_order),
    status: row.status === "archived" ? "archived" : "active",
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    version: number(row.version),
  };
}

function mapCategory(row: Row): Category {
  return { ...mapTaxon(row), familyId: text(row.family_id), representativeSlug: optionalText(row.representative_slug) };
}

/** A taxon_versions row; the RPCs answer with the same fields in camelCase. */
function mapTaxonVersion(row: Row): TaxonVersion {
  const kind = row.kind as TaxonKind;
  const data = (row.data ?? {}) as Row;
  return {
    id: text(row.id),
    kind,
    taxonId: text(row.taxon_id ?? row.taxonId),
    number: number(row.number),
    data: kind === "family" ? mapTaxon(data) : mapCategory(data),
    note: text(row.note),
    authorId: optionalText(row.author_id ?? row.authorId),
    createdAt: text(row.created_at ?? row.createdAt),
  };
}

function mapSnapshot(row: Row): TaxonSnapshot {
  return {
    scientificName: text(row.scientific_name),
    rank: row.rank as TaxonSnapshot["rank"],
    acceptedName: text(row.accepted_name),
    authority: text(row.authority),
    synonyms: Array.isArray(row.synonyms) ? row.synonyms.map(String) : [],
    sources: Array.isArray(row.sources) ? (row.sources as TaxonSnapshot["sources"]) : [],
    verifiedAt: text(row.verified_at),
  };
}

function createTaxonomyRepository(): TaxonomyRepository {
  const table = (kind: TaxonKind) => (kind === "family" ? "taxon_families" : "taxon_categories");
  /** By slug or a former slug; the current slug wins if both match. */
  const bySlug = async (kind: TaxonKind, slug: string, includeArchived = false): Promise<Row | null> => {
    const c = await client();
    let request = c.from(table(kind)).select("*").or(`slug.eq.${slug},former_slugs.cs.{${slug}}`);
    if (!includeArchived) request = request.eq("status", "active");
    const rows = (await result(await request)) as Row[];
    return rows.find((row) => row.slug === slug) ?? rows[0] ?? null;
  };
  const versionRpc = async (name: string, args: Record<string, unknown>) => mapTaxonVersion(await rpc<Row>(name, args));
  return {
    async listFamilies(query = {}) {
      const c = await client();
      let request = c.from("taxon_families").select("*");
      if (!query.includeArchived) request = request.eq("status", "active");
      return ((await result(await request.order("sort_order").order("id"))) as Row[]).map(mapTaxon);
    },
    async listCategories(query = {}) {
      const c = await client();
      let request = c.from("taxon_categories").select("*, taxon_families(sort_order)");
      if (!query.includeArchived) request = request.eq("status", "active");
      if (query.familyId) request = request.eq("family_id", query.familyId);
      const rows = (await result(await request)) as Array<Row & { taxon_families?: { sort_order?: number } }>;
      return rows
        .sort(
          (a, b) =>
            number(a.taxon_families?.sort_order) - number(b.taxon_families?.sort_order) ||
            number(a.sort_order) - number(b.sort_order) ||
            text(a.id).localeCompare(text(b.id)),
        )
        .map(mapCategory);
    },
    async getFamily(slug, query = {}) {
      const row = await bySlug("family", slug, query.includeArchived);
      return row ? mapTaxon(row) : null;
    },
    async getCategory(slug, query = {}) {
      const row = await bySlug("category", slug, query.includeArchived);
      return row ? mapCategory(row) : null;
    },
    async saveTaxon(input) {
      return versionRpc("pw_save_taxon", {
        p_kind: input.kind,
        p_id: input.id ?? null,
        p_patch: input.patch satisfies TaxonPatch,
        p_note: input.note,
        p_base_version: input.baseVersion ?? null,
      });
    },
    async archiveTaxon(kind, id, _actorId, note) {
      return versionRpc("pw_set_taxon_status", { p_kind: kind, p_id: id, p_status: "archived", p_note: note ?? null });
    },
    async restoreTaxon(kind, id, _actorId, note) {
      return versionRpc("pw_set_taxon_status", { p_kind: kind, p_id: id, p_status: "active", p_note: note ?? null });
    },
    async listTaxonVersions(kind, id) {
      const c = await client();
      const rows = (await result(
        await c
          .from("taxon_versions")
          .select("*")
          .eq("kind", kind)
          .eq("taxon_id", id)
          .order("number", { ascending: false }),
      )) as Row[];
      return rows.map(mapTaxonVersion);
    },
    async revertTaxon(kind, id, versionNumber) {
      return versionRpc("pw_revert_taxon", { p_kind: kind, p_id: id, p_number: versionNumber });
    },
    async snapshots(scientificNames) {
      if (!scientificNames.length) return {};
      const c = await client();
      const rows = (await result(
        await c.from("taxon_snapshots").select("*").in("scientific_name", scientificNames),
      )) as Row[];
      return Object.fromEntries(rows.map((row) => [text(row.scientific_name), mapSnapshot(row)]));
    },
  };
}

function mapMember(row: Row): Member {
  const cover = row.cover_src
    ? {
        src: text(row.cover_src),
        width: number(row.cover_width),
        height: number(row.cover_height),
        print: (row.cover_print as MemberCover["print"]) ?? "original",
      }
    : undefined;
  return {
    id: text(row.id),
    name: localized(row, "name_zh", "name_en"),
    handle: text(row.handle),
    role: localized(row, "role_zh", "role_en"),
    bio: localized(row, "bio_zh", "bio_en"),
    about: text(row.about),
    plate: {
      number: number(row.plate_number),
      emblem: text(row.plate_emblem),
      ink: row.plate_ink as Member["plate"]["ink"],
      border: row.plate_border as Member["plate"]["border"],
      motto: text(row.plate_motto),
    },
    cover,
    joined: text(row.joined),
    authorId: optionalText(row.author_id),
    links: readMemberLinks(row.links),
    github: readMemberGithub(row.github),
    projects: readProjects(row.projects),
    sample: bool(row.sample),
    archivedAt: optionalText(row.archived_at),
    version: row.version == null ? undefined : number(row.version),
  };
}

function mapLink(row: Row): FriendLink {
  return {
    id: text(row.id),
    name: localized(row, "name_zh", "name_en"),
    url: text(row.url),
    description: localized(row, "description_zh", "description_en"),
    emblem: text(row.emblem),
    since: text(row.since),
    sample: bool(row.sample),
    archivedAt: optionalText(row.archived_at),
    sortOrder: number(row.sort_order),
    version: row.version == null ? undefined : number(row.version),
  };
}

function mapThread(row: Row, postCount = 0, excerpt = "", lastActivityAt?: string): ForumThread {
  return {
    id: text(row.id),
    number: number(row.number),
    title: text(row.title),
    category: row.category as ForumThread["category"],
    authorName: text(row.author_name),
    memberId: optionalText(row.member_id),
    createdAt: text(row.created_at),
    lastActivityAt: lastActivityAt ?? text(row.created_at),
    postCount,
    excerpt,
    lockedAt: optionalText(row.locked_at),
    hiddenAt: optionalText(row.deleted_at),
    moderationNote: optionalText(row.moderation_note),
    hiddenPosts: row.hidden_posts == null ? undefined : number(row.hidden_posts),
  };
}
function mapPost(row: Row): ForumPost {
  return {
    id: text(row.id),
    threadId: text(row.thread_id),
    authorName: text(row.author_name),
    memberId: optionalText(row.member_id),
    body: text(row.body),
    createdAt: text(row.created_at),
    hiddenAt: optionalText(row.deleted_at),
    moderationNote: optionalText(row.moderation_note),
  };
}

function mapChronicle(row: Row): ChronicleDetail {
  return {
    id: text(row.id),
    number: number(row.number),
    date: text(row.date),
    kind: row.kind as Chronicle["kind"],
    title: localized(row, "title_zh", "title_en"),
    summary: localized(row, "summary_zh", "summary_en"),
    hostIds: jsonList<string>(row.host_ids),
    resources: jsonList<ChronicleResource>(row.resources),
    gallery: jsonList<ChronicleDetail["gallery"][number]>(row.gallery),
    tags: jsonList<string>(row.tags),
    sample: bool(row.sample),
    body: optionalText(row.body),
    archivedAt: optionalText(row.archived_at),
    version: row.version == null ? undefined : number(row.version),
  };
}

/** A list row: everything but the account, which only the record page reads. */
const CHRONICLE_LIST_COLUMNS =
  "id, number, date, kind, title_zh, title_en, summary_zh, summary_en, host_ids, resources, gallery, tags, sample, archived_at, version";
const CHRONICLE_TEXT_COLUMNS = ["title_zh", "title_en", "summary_zh", "summary_en", "body"];

/**
 * The search words as a PostgREST `or` filter that matches them literally:
 * `imatch` is Postgres's case-insensitive `~*`, every regex character is
 * escaped so the words are never a pattern (`%`, `_` and `*` mean themselves,
 * unlike with `ilike`), and the value is quoted so commas, dots, colons and
 * brackets are never read as filter syntax.
 */
export function chronicleTextFilter(words: string): string {
  const literal = words.replace(/[\\^$.|?*+()[\]{}]/g, "\\$&");
  const quoted = `"${literal.replace(/["\\]/g, "\\$&")}"`;
  return CHRONICLE_TEXT_COLUMNS.map((column) => `${column}.imatch.${quoted}`).join(",");
}

/** The filtered public request, before any order or range: the count and every page share it. */
function chronicleRequest(
  c: SupabaseClient,
  columns: string,
  query: ChronicleQuery | undefined,
  count?: { count: "exact"; head: true },
) {
  let request = c.from("chronicles").select(columns, count).is("archived_at", null);
  if (query?.kind?.length) request = request.in("kind", query.kind);
  if (query?.year) request = request.gte("date", `${query.year}-01-01`).lte("date", `${query.year}-12-31`);
  if (query?.member) request = request.contains("host_ids", [query.member]);
  const words = searchWords(query?.q);
  if (words) request = request.or(chronicleTextFilter(words));
  return request;
}

function createChronicleRepository(): ChronicleRepository {
  return {
    async listChronicles(query) {
      const c = await client();
      const offset = query?.offset ?? 0;
      const rows = (await result(
        await chronicleRequest(c, CHRONICLE_LIST_COLUMNS, query)
          .order("date", { ascending: false })
          .order("number", { ascending: false })
          .range(offset, offset + (query?.limit ?? 200) - 1),
      )) as unknown as Row[];
      return rows.map(mapChronicle);
    },
    async countChronicles(query) {
      const c = await client();
      const { count, error } = await chronicleRequest(c, "id", query, { count: "exact", head: true });
      await result({ data: null, error });
      return count ?? 0;
    },
    async chronicleFacets() {
      const c = await client();
      // Read in pages of 1000 (the API's row cap), so a long archive is never counted short.
      const rows: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const page = (await result(
          await c
            .from("chronicles")
            .select("date, kind, host_ids, sample")
            .is("archived_at", null)
            .order("number")
            .range(from, from + 999),
        )) as Row[];
        rows.push(...page);
        if (page.length < 1000) break;
      }
      return facetsOf(
        rows.map((row) => ({
          date: text(row.date),
          kind: row.kind as Chronicle["kind"],
          hostIds: jsonList<string>(row.host_ids),
          sample: bool(row.sample),
        })),
      );
    },
    async adjacentChronicles(id) {
      const c = await client();
      const at = (await result(
        await c.from("chronicles").select("date, number").eq("id", id).is("archived_at", null).maybeSingle(),
      )) as Row | null;
      if (!at) return { older: null, newer: null };
      const date = text(at.date);
      const n = number(at.number);
      const [older, newer] = await Promise.all([
        c
          .from("chronicles")
          .select(CHRONICLE_LIST_COLUMNS)
          .is("archived_at", null)
          .or(`date.lt.${date},and(date.eq.${date},number.lt.${n})`)
          .order("date", { ascending: false })
          .order("number", { ascending: false })
          .limit(1)
          .maybeSingle(),
        c
          .from("chronicles")
          .select(CHRONICLE_LIST_COLUMNS)
          .is("archived_at", null)
          .or(`date.gt.${date},and(date.eq.${date},number.gt.${n})`)
          .order("date")
          .order("number")
          .limit(1)
          .maybeSingle(),
      ]);
      const row = async (found: typeof older) => {
        const value = (await result(found)) as unknown as Row | null;
        return value ? mapChronicle(value) : null;
      };
      return { older: await row(older), newer: await row(newer) };
    },
    async getChronicle(id, query) {
      const c = await client();
      let request = c.from("chronicles").select("*").eq("id", id);
      if (!query?.includeArchived) request = request.is("archived_at", null);
      const row = (await result(await request.maybeSingle())) as Row | null;
      return row ? mapChronicle(row) : null;
    },
    async listForAdmin(query = {}) {
      const c = await client();
      const offset = query.offset ?? 0;
      let request = c.from("chronicles").select("*", { count: "exact" });
      if ((query.view ?? "active") === "active") request = request.is("archived_at", null);
      if (query.view === "archived") request = request.not("archived_at", "is", null);
      const words = searchWords(query.q);
      if (words) request = request.or(chronicleTextFilter(words));
      const response = await request
        .order("date", { ascending: false })
        .order("number", { ascending: false })
        .range(offset, offset + (query.limit ?? 25) - 1);
      const rows = (await result(response)) as Row[];
      return { rows: rows.map(mapChronicle), total: response.count ?? rows.length };
    },
    async saveChronicle(id, patch, baseVersion) {
      return mapChronicle(
        await rpc<Row>("pw_admin_save_chronicle", { p_id: id, p_patch: patch, p_base_version: baseVersion ?? null }),
      );
    },
    async setChronicleArchived(id, archived, reason) {
      return mapChronicle(
        await rpc<Row>("pw_admin_set_chronicle_archived", { p_id: id, p_archived: archived, p_reason: reason ?? null }),
      );
    },
  };
}

const byView = <T extends { is: (column: string, value: null) => T; not: (c: string, op: string, v: null) => T }>(
  request: T,
  column: string,
  view: ArchiveView = "active",
) => (view === "active" ? request.is(column, null) : view === "archived" ? request.not(column, "is", null) : request);

/** Validates the owner's fields in TypeScript (as the mock does) and passes the administrators' through. */
function memberPatchArgs(patch: MemberAdminPatch) {
  const { handle, joined, sample, authorId, ...owner } = patch;
  return {
    ...validateMemberPatch(owner),
    ...(handle !== undefined ? { handle } : {}),
    ...(joined !== undefined ? { joined } : {}),
    ...(sample !== undefined ? { sample } : {}),
    ...(authorId !== undefined ? { authorId } : {}),
  };
}

const COVER_BUCKET = "member-covers";

/** Best effort: a replaced page image whose removal fails is listed later as an orphan file. */
async function removeCoverFile(c: SupabaseClient, src: string | undefined) {
  const name = src?.split("/").at(-1) ?? "";
  if (!STORED_NAME.test(name)) return;
  await c.storage.from(COVER_BUCKET).remove([name]);
}

function createCommunityRepository(): CommunityRepository {
  const memberRow = async (handle: string, includeArchived = false): Promise<Row | null> => {
    const c = await client();
    let request = c.from("members").select("*").or(`handle.eq.${handle},former_handles.cs.{${handle}}`);
    if (!includeArchived) request = request.is("archived_at", null);
    const rows = (await result(await request)) as Row[];
    return rows.find((row) => row.handle === handle) ?? rows[0] ?? null;
  };
  const memberId = async (handle: string) => {
    const row = await memberRow(handle, true);
    if (!row) throw new ServiceError("not_found", "member_not_found");
    return text(row.id);
  };
  return {
    async listLinks(query) {
      const c = await client();
      const rows = (await result(
        await byView(c.from("friend_links").select("*"), "archived_at", query?.view).order("since").order("id"),
      )) as Row[];
      return rows.map(mapLink);
    },
    async saveLink(id, patch, baseVersion) {
      return mapLink(
        await rpc<Row>("pw_admin_save_link", { p_id: id, p_patch: patch, p_base_version: baseVersion ?? null }),
      );
    },
    async setLinkArchived(id, archived, reason) {
      return mapLink(
        await rpc<Row>("pw_admin_set_link_archived", { p_id: id, p_archived: archived, p_reason: reason ?? null }),
      );
    },
    async listMembers(query) {
      const c = await client();
      const rows = (await result(
        await byView(c.from("members").select("*"), "archived_at", query?.view).order("plate_number").order("id"),
      )) as Row[];
      return rows.map(mapMember);
    },
    async getMember(handle, query) {
      const row = await memberRow(handle, query?.includeArchived);
      return row ? mapMember(row) : null;
    },
    async updateMember(handle, patch, baseVersion) {
      // Malformed values are refused before anything reaches the database.
      const args = memberPatchArgs(patch);
      const row = await memberRow(handle, true);
      if (!row) return null;
      return mapMember(
        await rpc<Row>("pw_save_member", {
          p_member_id: text(row.id),
          p_patch: args,
          p_base_version: baseVersion ?? null,
        }),
      );
    },
    async setMemberCover(handle, cover) {
      const row = await memberRow(handle, true);
      if (!row) return null;
      return mapMember(await rpc<Row>("pw_set_member_cover", { p_member_id: text(row.id), p_cover: cover }));
    },
    async uploadMemberCover(handle, image, print) {
      const row = await memberRow(handle, true);
      if (!row) throw new ServiceError("not_found", "member_not_found");
      await rpc("pw_upload_allowance", { p_kind: "cover" });
      const c = await client();
      const stored = await c.storage
        .from(COVER_BUCKET)
        .upload(image.name, image.data, { contentType: "image/webp", upsert: false });
      if (stored.error) throw new ServiceError("unavailable", "upload_failed");
      let member: Member;
      try {
        await rpc("pw_register_cover_media", {
          p_object_path: image.name,
          p_width: image.width,
          p_height: image.height,
        });
        const src = c.storage.from(COVER_BUCKET).getPublicUrl(image.name).data.publicUrl;
        member = mapMember(
          await rpc<Row>("pw_set_member_cover", {
            p_member_id: text(row.id),
            p_cover: { src, width: image.width, height: image.height, print },
          }),
        );
      } catch (error) {
        await c.storage.from(COVER_BUCKET).remove([image.name]);
        throw error;
      }
      await removeCoverFile(c, optionalText(row.cover_src));
      return member;
    },
    async removeMemberCover(handle) {
      const row = await memberRow(handle, true);
      if (!row) throw new ServiceError("not_found", "member_not_found");
      const member = mapMember(await rpc<Row>("pw_set_member_cover", { p_member_id: text(row.id), p_cover: null }));
      await removeCoverFile(await client(), optionalText(row.cover_src));
      return member;
    },
    async readMemberImage(name) {
      if (!STORED_NAME.test(name)) return null;
      const c = await client();
      const { data, error } = await c.storage.from(COVER_BUCKET).download(name);
      return error || !data ? null : Buffer.from(await data.arrayBuffer());
    },
    async createMember(input) {
      return mapMember(await rpc<Row>("pw_admin_create_member", { p_patch: input }));
    },
    async setMemberArchived(handle, archived, reason) {
      return mapMember(
        await rpc<Row>("pw_admin_set_member_archived", {
          p_id: await memberId(handle),
          p_archived: archived,
          p_reason: reason ?? null,
        }),
      );
    },
    async listVersions(kind, objectId) {
      const c = await client();
      const rows = (await result(
        await c
          .from("content_versions")
          .select("*")
          .eq("kind", kind)
          .eq("object_id", objectId)
          .order("number", { ascending: false })
          .limit(50),
      )) as Row[];
      return rows.map((row): ContentVersion => ({
        kind,
        objectId,
        number: number(row.number),
        note: text(row.note),
        actorId: optionalText(row.actor_id),
        createdAt: text(row.created_at),
        data: (row.data ?? {}) as Record<string, unknown>,
      }));
    },
    async restoreVersion(kind, objectId, versionNumber) {
      await rpc("pw_restore_content_version", { p_kind: kind, p_id: objectId, p_number: versionNumber });
    },
    async listPostsBy(memberId) {
      const c = await client();
      const rows = (await result(
        await c
          .from("forum_posts")
          .select("*, forum_threads(*)")
          .eq("member_id", memberId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(200),
      )) as Array<Row & { forum_threads?: Row | null }>;
      return rows.flatMap((row) =>
        row.forum_threads && !row.forum_threads.deleted_at
          ? [{ post: mapPost(row), thread: mapThread(row.forum_threads) }]
          : [],
      );
    },
    async listThreads(query) {
      const payload = await rpc<{ rows: Row[] }>("pw_list_threads", {
        p_category: query?.category ?? null,
        p_view: query?.view ?? "public",
        p_limit: query?.limit ?? 100,
        p_offset: query?.offset ?? 0,
      });
      return jsonList<Row>(payload.rows).map((row) =>
        mapThread(row, number(row.post_count), text(row.excerpt), text(row.last_activity_at)),
      );
    },
    async getThread(id, query) {
      const c = await client();
      let threadRequest = c.from("forum_threads").select("*").eq("id", id);
      if (!query?.includeHidden) threadRequest = threadRequest.is("deleted_at", null);
      const thread = (await result(await threadRequest.maybeSingle())) as Row | null;
      if (!thread) return null;
      let postRequest = c.from("forum_posts").select("*").eq("thread_id", id);
      if (!query?.includeHidden) postRequest = postRequest.is("deleted_at", null);
      const posts = (await result(await postRequest.order("created_at").order("id"))) as Row[];
      const visible = posts.filter((post) => !post.deleted_at);
      return {
        thread: mapThread(
          thread,
          visible.length,
          visible[0] ? text(visible[0].body).slice(0, 90) : "",
          visible.at(-1) ? text(visible.at(-1)?.created_at) : text(thread.created_at),
        ),
        posts: posts.map(mapPost),
      };
    },
    async createThread(input) {
      input = validateThread(input);
      const row = await rpc<Row>("pw_create_forum_thread", {
        p_title: input.title,
        p_body: input.body,
        p_category: input.category,
      });
      return mapThread(row, number(row.post_count), text(row.excerpt), text(row.last_activity_at));
    },
    async reply(input) {
      input = validatePost(input);
      const row = await rpc<Row | null>("pw_reply_forum_thread", { p_thread_id: input.threadId, p_body: input.body });
      return row ? mapPost(row) : null;
    },
    async moderateThread(id, action, reason) {
      const dbAction = action === "archive" ? "hide" : action === "unarchive" ? "restore" : action;
      return mapThread(
        await rpc<Row>("pw_admin_moderate_thread", { p_id: id, p_action: dbAction, p_reason: reason ?? null }),
      );
    },
    async moderatePost(id, action, reason) {
      return mapPost(
        await rpc<Row>("pw_admin_moderate_post", { p_id: id, p_action: action, p_reason: reason ?? null }),
      );
    },
  };
}

export function createSupabaseServices(): WikiServices {
  return {
    entries: createEntryRepository(),
    taxonomy: createTaxonomyRepository(),
    references: createReferenceRepository(),
    search: createSearchAdapter(),
    auth: createSupabaseAuthAdapter(),
    accounts: createAccountRepository(),
    audit: createAuditRepository(),
    community: createCommunityRepository(),
    chronicles: createChronicleRepository(),
    operations: createOperationsAdapter(),
  };
}
