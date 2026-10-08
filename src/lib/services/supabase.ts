import "server-only";
import type {
  Account,
  Asset,
  Author,
  Category,
  Chronicle,
  ChronicleDetail,
  ChronicleResource,
  Entry,
  EntrySummary,
  EntryTaxonomy,
  Family,
  FriendLink,
  Member,
  MemberCover,
  MemberPatch,
  Relation,
  Revision,
  Source,
  Tag,
  TaxonKind,
  TaxonLink,
  TaxonSnapshot,
  TaxonVersion,
  ForumPost,
  ForumThread,
} from "@/lib/model/types";
import type {
  ChronicleQuery,
  ChronicleRepository,
  CommunityRepository,
  DraftInput,
  EntryQuery,
  EntryRepository,
  ReferenceRepository,
  ReviewTransitionInput,
  SearchAdapter,
  SearchQuery,
  SearchResult,
  TaxonPatch,
  TaxonomyRepository,
  WikiServices,
} from "./contracts";
import { ServiceError } from "./contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAuthAdapter } from "./supabase-auth";
import { readProjects } from "@/lib/members/project-validation";
import { readMemberGithub, readMemberLinks, validateMemberPatch } from "@/lib/members/validation";
import { validatePost, validateThread } from "@/lib/forum/validation";
import { facetsOf, searchWords } from "@/lib/chronicles/query";

type Row = Record<string, unknown>;
const text = (value: unknown): string => (typeof value === "string" ? value : "");
const optionalText = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);
const number = (value: unknown): number => (typeof value === "number" ? value : Number(value ?? 0));
const bool = (value: unknown): boolean => Boolean(value);
const localized = (row: Row, zh: string, en: string) => ({ zh: text(row[zh]), en: text(row[en]) });

async function result<T>(value: { data: T | null; error: { message: string; code?: string } | null }): Promise<T> {
  if (value.error) {
    const code =
      value.error.code === "42501"
        ? "forbidden"
        : value.error.code === "40001"
          ? "conflict"
          : value.error.code === "22023"
            ? "invalid"
            : "unavailable";
    throw new ServiceError(code, value.error.message);
  }
  return value.data as T;
}

function mapAuthor(row: Row): Author {
  return {
    id: text(row.id),
    handle: text(row.handle),
    name: localized(row, "name_zh", "name_en"),
    affiliation: localized(row, "affiliation_zh", "affiliation_en"),
    role: row.role as Author["role"],
    sigil: text(row.sigil),
  };
}
function mapSource(row: Row): Source {
  return {
    id: text(row.id),
    kind: row.kind as Source["kind"],
    title: text(row.title),
    creators: text(row.creators),
    year: row.year == null ? undefined : number(row.year),
    publisher: optionalText(row.publisher),
    url: optionalText(row.url),
    locator: optionalText(row.locator),
  };
}
function mapTag(row: Row): Tag {
  return { id: text(row.id), label: localized(row, "label_zh", "label_en") };
}
function mapAsset(row: Row): Asset {
  return {
    id: text(row.id),
    src: text(row.src),
    width: number(row.width),
    height: number(row.height),
    alt: localized(row, "alt_zh", "alt_en"),
    caption: localized(row, "caption_zh", "caption_en"),
    credit: text(row.credit),
    license: text(row.license),
    sourceUrl: optionalText(row.source_url),
  };
}

function mapSummary(row: Row, revision?: number, published = false): EntrySummary {
  const analogueName = localized(row, "analogue_name_zh", "analogue_name_en");
  return {
    id: text(row.id),
    slug: text(row.slug),
    title: localized(row, "title_zh", "title_en"),
    summary: localized(row, "summary_zh", "summary_en"),
    analogue:
      analogueName.zh || analogueName.en
        ? { name: analogueName, note: localized(row, "analogue_note_zh", "analogue_note_en") }
        : undefined,
    domain: optionalText(row.domain) as EntrySummary["domain"],
    categoryId: text(row.category_id),
    auxiliaryCategoryIds: [],
    species: optionalText(row.species),
    level: (optionalText(row.level) ?? "concept") as EntrySummary["level"],
    contentRole: (optionalText(row.content_role) ?? "foundation") as EntrySummary["contentRole"],
    scale: row.scale as EntrySummary["scale"],
    role: row.role as EntrySummary["role"],
    status: published ? "published" : (row.status as EntrySummary["status"]),
    authorId: text(row.author_id),
    contributorIds: [],
    sourceIds: [],
    tagIds: [],
    bodyLanguages: ["zh", "en"],
    heroAssetId: optionalText(row.hero_asset_id),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    revision: revision ?? number(row.published_revision_number ?? row.latest_revision_number),
    featured: bool(row.featured),
  };
}

function mapRevision(row: Row): Revision {
  return {
    id: text(row.id),
    entryId: text(row.entry_id),
    number: number(row.number),
    parentId: optionalText(row.parent_id),
    authorId: text(row.author_id),
    createdAt: text(row.created_at),
    note: text(row.note),
    state: row.state as Revision["state"],
    taxonomy: (row.metadata as { taxonomy?: EntryTaxonomy } | null)?.taxonomy,
    stats: { added: number(row.added_lines), removed: number(row.removed_lines) },
  };
}

async function ids(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: string,
  id: string,
  key: string,
): Promise<string[]> {
  const rows = (await result(await client.from(table).select(key).eq("entry_id", id))) as unknown as Row[];
  return rows.map((row) => text(row[key]));
}

async function summary(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  row: Row,
  revision?: number,
  published = false,
): Promise<EntrySummary> {
  const value = mapSummary(row, revision, published);
  const [contributorIds, sourceIds, tagIds, auxiliaryCategoryIds] = await Promise.all([
    ids(client, "entry_contributors", value.id, "author_id"),
    ids(client, "entry_sources", value.id, "source_id"),
    ids(client, "entry_tags", value.id, "tag_id"),
    ids(client, "entry_auxiliary_categories", value.id, "category_id"),
  ]);
  return { ...value, contributorIds, sourceIds, tagIds, auxiliaryCategoryIds };
}

function revisionFor(row: Row, account: Account | null): { number: number; published: boolean } {
  const privileged = Boolean(account?.role === "admin" || (account?.authorId && account.authorId === row.author_id));
  return {
    number: privileged ? number(row.latest_revision_number) : number(row.published_revision_number),
    published: !privileged,
  };
}
async function visibleRevision(row: Row): Promise<{ number: number; published: boolean }> {
  return revisionFor(row, await createSupabaseAuthAdapter().getCurrentAccount());
}

function createEntryRepository(): EntryRepository {
  return {
    async listEntries(query: EntryQuery = {}) {
      const client = await createSupabaseServerClient();
      let request = client.from("entries").select("*").is("deleted_at", null);
      if (query.domain?.length) request = request.in("domain", query.domain);
      if (query.categoryId?.length) request = request.in("category_id", query.categoryId);
      if (query.familyId?.length) {
        const genera = (await result(
          await client.from("taxon_categories").select("id").in("family_id", query.familyId),
        )) as Row[];
        request = request.in(
          "category_id",
          genera.map((row) => text(row.id)),
        );
      }
      if (query.auxiliaryCategoryId?.length) {
        const linked = (await result(
          await client
            .from("entry_auxiliary_categories")
            .select("entry_id")
            .in("category_id", query.auxiliaryCategoryId),
        )) as Row[];
        request = request.in(
          "id",
          linked.map((row) => text(row.entry_id)),
        );
      }
      if (query.scale?.length) request = request.in("scale", query.scale);
      if (query.status?.length) request = request.in("status", query.status);
      if (query.featured !== undefined) request = request.eq("featured", query.featured);
      const rows = (await result(
        await request
          .order(query.sort === "created" ? "created_at" : "updated_at", { ascending: false })
          .limit(query.limit ?? 1000),
      )) as Row[];
      if (!rows.length) return [];
      const entryIds = rows.map((row) => text(row.id));
      const load = async (table: string, key: string) => {
        const grouped = new Map<string, string[]>();
        for (let offset = 0; ; offset += 1000) {
          const linked = (await result(
            await client
              .from(table)
              .select("*")
              .in("entry_id", entryIds)
              .order("entry_id")
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
      };
      const [account, contributors, sources, tags, auxiliary] = await Promise.all([
        createSupabaseAuthAdapter().getCurrentAccount(),
        load("entry_contributors", "author_id"),
        load("entry_sources", "source_id"),
        load("entry_tags", "tag_id"),
        load("entry_auxiliary_categories", "category_id"),
      ]);
      return rows.map((row) => {
        const visible = revisionFor(row, account);
        const entry = mapSummary(row, visible.number, visible.published);
        return {
          ...entry,
          contributorIds: contributors.get(entry.id) ?? [],
          sourceIds: sources.get(entry.id) ?? [],
          tagIds: tags.get(entry.id) ?? [],
          auxiliaryCategoryIds: auxiliary.get(entry.id) ?? [],
        };
      });
    },
    async getEntry(slug) {
      const client = await createSupabaseServerClient();
      const row = (await result(
        await client.from("entries").select("*").eq("slug", slug).is("deleted_at", null).maybeSingle(),
      )) as Row | null;
      if (!row) return null;
      const visible = await visibleRevision(row);
      if (!visible.number) return null;
      const bodyRow = (await result(
        await client
          .from("entry_revision_bodies")
          .select("body")
          .eq("revision_id", `${text(row.id)}@r${visible.number}`)
          .maybeSingle(),
      )) as Row | null;
      return { ...(await summary(client, row, visible.number, visible.published)), body: text(bodyRow?.body) } as Entry;
    },
    async getEntryById(id) {
      const client = await createSupabaseServerClient();
      const row = (await result(
        await client.from("entries").select("slug").eq("id", id).is("deleted_at", null).maybeSingle(),
      )) as Row | null;
      return row ? this.getEntry(text(row.slug)) : null;
    },
    async listRevisions(entryId) {
      const client = await createSupabaseServerClient();
      return (
        (await result(
          await client
            .from("entry_revisions")
            .select("*")
            .eq("entry_id", entryId)
            .order("number", { ascending: false }),
        )) as Row[]
      ).map(mapRevision);
    },
    async getRevisionBody(revisionId) {
      const client = await createSupabaseServerClient();
      const row = (await result(
        await client.from("entry_revision_bodies").select("body").eq("revision_id", revisionId).maybeSingle(),
      )) as Row | null;
      return row ? text(row.body) : null;
    },
    async listRelations(entryId) {
      const client = await createSupabaseServerClient();
      let request = client.from("relations").select("*");
      if (entryId) request = request.or(`from_entry_id.eq.${entryId},to_entry_id.eq.${entryId}`);
      const rows = (await result(await request)) as Row[];
      return rows.map((row) => ({
        id: text(row.id),
        from: text(row.from_entry_id),
        to: text(row.to_entry_id),
        kind: row.kind as Relation["kind"],
        note: localized(row, "note_zh", "note_en"),
        strength: number(row.strength) as Relation["strength"],
      }));
    },
    async saveDraft(input: DraftInput) {
      const client = await createSupabaseServerClient();
      return (await result(
        await client.rpc("pw_save_draft", {
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
        }),
      )) as Revision;
    },
    async transition(input: ReviewTransitionInput) {
      const client = await createSupabaseServerClient();
      return (await result(
        await client.rpc("pw_transition_entry", {
          p_entry_id: input.entryId,
          p_action: input.action,
          p_target_revision_id: input.targetRevisionId ?? null,
          p_note: input.note ?? null,
        }),
      )) as Revision;
    },
  };
}

function createReferenceRepository(): ReferenceRepository {
  return {
    async listAuthors() {
      const c = await createSupabaseServerClient();
      return ((await result(await c.from("authors").select("*"))) as Row[]).map(mapAuthor);
    },
    async listSources() {
      const c = await createSupabaseServerClient();
      return ((await result(await c.from("sources").select("*"))) as Row[]).map(mapSource);
    },
    async listTags() {
      const c = await createSupabaseServerClient();
      return ((await result(await c.from("tags").select("*"))) as Row[]).map(mapTag);
    },
    async listAssets() {
      const c = await createSupabaseServerClient();
      return ((await result(await c.from("assets").select("*"))) as Row[]).map(mapAsset);
    },
    async getAsset(id) {
      const c = await createSupabaseServerClient();
      const row = (await result(await c.from("assets").select("*").eq("id", id).maybeSingle())) as Row | null;
      return row ? mapAsset(row) : null;
    },
  };
}

function createSearchAdapter(): SearchAdapter {
  return {
    async search(query: SearchQuery): Promise<SearchResult> {
      const c = await createSupabaseServerClient();
      const payload = (await result(
        await c.rpc("pw_search_entries_v2", {
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
        }),
      )) as {
        hits: SearchResult["hits"];
        total: number;
        facets: SearchResult["facets"];
      };
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
    const client = await createSupabaseServerClient();
    let request = client.from(table(kind)).select("*").or(`slug.eq.${slug},former_slugs.cs.{${slug}}`);
    if (!includeArchived) request = request.eq("status", "active");
    const rows = (await result(await request)) as Row[];
    return rows.find((row) => row.slug === slug) ?? rows[0] ?? null;
  };
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const client = await createSupabaseServerClient();
    return mapTaxonVersion((await result(await client.rpc(name, args))) as Row);
  };
  return {
    async listFamilies(query = {}) {
      const client = await createSupabaseServerClient();
      let request = client.from("taxon_families").select("*");
      if (!query.includeArchived) request = request.eq("status", "active");
      return ((await result(await request.order("sort_order").order("id"))) as Row[]).map(mapTaxon);
    },
    async listCategories(query = {}) {
      const client = await createSupabaseServerClient();
      let request = client.from("taxon_categories").select("*, taxon_families(sort_order)");
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
      return rpc("pw_save_taxon", {
        p_kind: input.kind,
        p_id: input.id ?? null,
        p_patch: input.patch satisfies TaxonPatch,
        p_note: input.note,
        p_base_version: input.baseVersion ?? null,
      });
    },
    async archiveTaxon(kind, id, _actorId, note) {
      return rpc("pw_set_taxon_status", { p_kind: kind, p_id: id, p_status: "archived", p_note: note ?? null });
    },
    async restoreTaxon(kind, id, _actorId, note) {
      return rpc("pw_set_taxon_status", { p_kind: kind, p_id: id, p_status: "active", p_note: note ?? null });
    },
    async listTaxonVersions(kind, id) {
      const client = await createSupabaseServerClient();
      const rows = (await result(
        await client
          .from("taxon_versions")
          .select("*")
          .eq("kind", kind)
          .eq("taxon_id", id)
          .order("number", { ascending: false }),
      )) as Row[];
      return rows.map(mapTaxonVersion);
    },
    async revertTaxon(kind, id, versionNumber) {
      return rpc("pw_revert_taxon", { p_kind: kind, p_id: id, p_number: versionNumber });
    },
    async snapshots(scientificNames) {
      if (!scientificNames.length) return {};
      const client = await createSupabaseServerClient();
      const rows = (await result(
        await client.from("taxon_snapshots").select("*").in("scientific_name", scientificNames),
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
  };
}

const jsonList = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

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
  };
}

/** A list row: everything but the account, which only the record page reads. */
const CHRONICLE_LIST_COLUMNS =
  "id, number, date, kind, title_zh, title_en, summary_zh, summary_en, host_ids, resources, gallery, tags, sample";
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

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** The filtered request, before any order or range: the count and every page share it. */
function chronicleRequest(
  c: SupabaseClient,
  columns: string,
  query: ChronicleQuery | undefined,
  count?: { count: "exact"; head: true },
) {
  let request = c.from("chronicles").select(columns, count);
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
      const c = await createSupabaseServerClient();
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
      const c = await createSupabaseServerClient();
      const { count, error } = await chronicleRequest(c, "id", query, { count: "exact", head: true });
      await result({ data: null, error });
      return count ?? 0;
    },
    async chronicleFacets() {
      const c = await createSupabaseServerClient();
      // Read in pages of 1000 (the API's row cap), so a long archive is never counted short.
      const rows: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const page = (await result(
          await c
            .from("chronicles")
            .select("date, kind, host_ids, sample")
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
      const c = await createSupabaseServerClient();
      const at = (await result(
        await c.from("chronicles").select("date, number").eq("id", id).maybeSingle(),
      )) as Row | null;
      if (!at) return { older: null, newer: null };
      const date = text(at.date);
      const n = number(at.number);
      const [older, newer] = await Promise.all([
        c
          .from("chronicles")
          .select(CHRONICLE_LIST_COLUMNS)
          .or(`date.lt.${date},and(date.eq.${date},number.lt.${n})`)
          .order("date", { ascending: false })
          .order("number", { ascending: false })
          .limit(1)
          .maybeSingle(),
        c
          .from("chronicles")
          .select(CHRONICLE_LIST_COLUMNS)
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
    async getChronicle(id) {
      const c = await createSupabaseServerClient();
      const row = (await result(await c.from("chronicles").select("*").eq("id", id).maybeSingle())) as Row | null;
      return row ? mapChronicle(row) : null;
    },
  };
}

function createCommunityRepository(): CommunityRepository {
  return {
    async listLinks() {
      const c = await createSupabaseServerClient();
      const rows = (await result(await c.from("friend_links").select("*"))) as Row[];
      return rows.map(
        (r) =>
          ({
            id: text(r.id),
            name: localized(r, "name_zh", "name_en"),
            url: text(r.url),
            description: localized(r, "description_zh", "description_en"),
            emblem: text(r.emblem),
            since: text(r.since),
            sample: bool(r.sample),
          }) satisfies FriendLink,
      );
    },
    async listMembers() {
      const c = await createSupabaseServerClient();
      return ((await result(await c.from("members").select("*"))) as Row[]).map(mapMember);
    },
    async getMember(handle) {
      const c = await createSupabaseServerClient();
      const row = (await result(await c.from("members").select("*").eq("handle", handle).maybeSingle())) as Row | null;
      return row ? mapMember(row) : null;
    },
    async updateMember(handle, patch: MemberPatch) {
      patch = validateMemberPatch(patch);
      const c = await createSupabaseServerClient();
      const values: Row = {};
      if (patch.projects !== undefined) values.projects = patch.projects;
      if (patch.name) {
        values.name_zh = patch.name.zh;
        values.name_en = patch.name.en;
      }
      if (patch.role) {
        values.role_zh = patch.role.zh;
        values.role_en = patch.role.en;
      }
      if (patch.bio) {
        values.bio_zh = patch.bio.zh;
        values.bio_en = patch.bio.en;
      }
      if (patch.about !== undefined) values.about = patch.about;
      if (patch.links !== undefined) values.links = patch.links;
      if (patch.github !== undefined) values.github = patch.github;
      if (patch.plate) for (const [key, value] of Object.entries(patch.plate)) values[`plate_${key}`] = value;
      if (patch.coverPrint !== undefined) values.cover_print = patch.coverPrint;
      const row = (await result(
        await c.from("members").update(values).eq("handle", handle).select("*").maybeSingle(),
      )) as Row | null;
      return row ? mapMember(row) : null;
    },
    async setMemberCover(handle, cover) {
      const c = await createSupabaseServerClient();
      const values = cover
        ? { cover_src: cover.src, cover_width: cover.width, cover_height: cover.height, cover_print: cover.print }
        : { cover_src: null, cover_width: null, cover_height: null, cover_print: null };
      const row = (await result(
        await c.from("members").update(values).eq("handle", handle).select("*").maybeSingle(),
      )) as Row | null;
      return row ? mapMember(row) : null;
    },
    async listPostsBy(memberId) {
      const c = await createSupabaseServerClient();
      const posts = (await result(
        await c
          .from("forum_posts")
          .select("*")
          .eq("member_id", memberId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      )) as Row[];
      const items = await Promise.all(
        posts.map(async (post) => {
          const thread = (await result(
            await c.from("forum_threads").select("*").eq("id", post.thread_id).maybeSingle(),
          )) as Row | null;
          return thread ? { post: mapPost(post), thread: mapThread(thread) } : null;
        }),
      );
      return items.filter((item): item is { post: ForumPost; thread: ForumThread } => Boolean(item));
    },
    async listThreads(query) {
      const c = await createSupabaseServerClient();
      let request = c.from("forum_threads").select("*").is("deleted_at", null);
      if (query?.category) request = request.eq("category", query.category);
      const rows = (await result(
        await request.order("created_at", { ascending: false }).limit(query?.limit ?? 100),
      )) as Row[];
      return Promise.all(
        rows.map(async (row) => {
          const posts = (await result(
            await c
              .from("forum_posts")
              .select("body,created_at")
              .eq("thread_id", row.id)
              .is("deleted_at", null)
              .order("created_at", { ascending: false }),
          )) as Row[];
          return mapThread(
            row,
            posts.length,
            posts.at(-1) ? text(posts.at(-1)?.body).slice(0, 90) : "",
            posts[0] ? text(posts[0].created_at) : text(row.created_at),
          );
        }),
      );
    },
    async getThread(id) {
      const c = await createSupabaseServerClient();
      const thread = (await result(
        await c.from("forum_threads").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
      )) as Row | null;
      if (!thread) return null;
      const posts = (await result(
        await c.from("forum_posts").select("*").eq("thread_id", id).is("deleted_at", null).order("created_at"),
      )) as Row[];
      return {
        thread: mapThread(
          thread,
          posts.length,
          posts[0] ? text(posts[0].body).slice(0, 90) : "",
          posts.at(-1) ? text(posts.at(-1)?.created_at) : text(thread.created_at),
        ),
        posts: posts.map(mapPost),
      };
    },
    async createThread(input) {
      input = validateThread(input);
      const c = await createSupabaseServerClient();
      const id = `t-${Date.now()}`;
      const now = new Date().toISOString();
      const latest = (await result(
        await c.from("forum_threads").select("number").order("number", { ascending: false }).limit(1).maybeSingle(),
      )) as Row | null;
      const n = number(latest?.number) + 1;
      await result(
        await c.from("forum_threads").insert({
          id,
          number: n,
          title: input.title.trim(),
          category: input.category,
          author_name: input.authorName.trim(),
          member_id: input.memberId,
          created_at: now,
        }),
      );
      await result(
        await c.from("forum_posts").insert({
          id: `p-${n}-1`,
          thread_id: id,
          author_name: input.authorName.trim(),
          member_id: input.memberId,
          body: input.body.trim(),
          created_at: now,
        }),
      );
      return mapThread(
        {
          id,
          number: n,
          title: input.title,
          category: input.category,
          author_name: input.authorName,
          member_id: input.memberId,
          created_at: now,
        },
        1,
        input.body,
        now,
      );
    },
    async reply(input) {
      input = validatePost(input);
      const c = await createSupabaseServerClient();
      const thread = (await result(
        await c.from("forum_threads").select("number").eq("id", input.threadId).maybeSingle(),
      )) as Row | null;
      if (!thread) return null;
      const count = await c
        .from("forum_posts")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", input.threadId);
      const n = (count.count ?? 0) + 1;
      const post = {
        id: `p-${number(thread.number)}-${n}`,
        thread_id: input.threadId,
        author_name: input.authorName.trim(),
        member_id: input.memberId,
        body: input.body.trim(),
        created_at: new Date().toISOString(),
      };
      await result(await c.from("forum_posts").insert(post));
      return mapPost(post);
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
    community: createCommunityRepository(),
    chronicles: createChronicleRepository(),
  };
}
