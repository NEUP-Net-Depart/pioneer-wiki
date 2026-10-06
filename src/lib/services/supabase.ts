import "server-only";
import type {
  Asset,
  Author,
  Entry,
  EntrySummary,
  FriendLink,
  Member,
  MemberCover,
  MemberPatch,
  Relation,
  Revision,
  Source,
  Tag,
  ForumPost,
  ForumThread,
} from "@/lib/model/types";
import type {
  CommunityRepository,
  DraftInput,
  EntryQuery,
  EntryRepository,
  ReferenceRepository,
  ReviewTransitionInput,
  SearchAdapter,
  SearchQuery,
  SearchResult,
  WikiServices,
} from "./contracts";
import { ServiceError } from "./contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAuthAdapter } from "./supabase-auth";

type Row = Record<string, unknown>;
const text = (value: unknown): string => (typeof value === "string" ? value : "");
const optionalText = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);
const number = (value: unknown): number => (typeof value === "number" ? value : Number(value ?? 0));
const bool = (value: unknown): boolean => Boolean(value);
const localized = (row: Row, zh: string, en: string) => ({ zh: text(row[zh]), en: text(row[en]) });

async function result<T>(value: { data: T | null; error: { message: string; code?: string } | null }): Promise<T> {
  if (value.error) {
    const code = value.error.code === "42501" ? "forbidden" : value.error.code === "40001" ? "conflict" : "unavailable";
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
    year: number(row.year),
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
    domain: row.domain as EntrySummary["domain"],
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
  const [contributorIds, sourceIds, tagIds] = await Promise.all([
    ids(client, "entry_contributors", value.id, "author_id"),
    ids(client, "entry_sources", value.id, "source_id"),
    ids(client, "entry_tags", value.id, "tag_id"),
  ]);
  return { ...value, contributorIds, sourceIds, tagIds };
}

async function visibleRevision(row: Row): Promise<{ number: number; published: boolean }> {
  const account = await createSupabaseAuthAdapter().getCurrentAccount();
  const privileged = Boolean(account?.role === "admin" || (account?.authorId && account.authorId === row.author_id));
  return {
    number: privileged ? number(row.latest_revision_number) : number(row.published_revision_number),
    published: !privileged,
  };
}

function createEntryRepository(): EntryRepository {
  return {
    async listEntries(query: EntryQuery = {}) {
      const client = await createSupabaseServerClient();
      let request = client.from("entries").select("*").is("deleted_at", null);
      if (query.domain?.length) request = request.in("domain", query.domain);
      if (query.scale?.length) request = request.in("scale", query.scale);
      if (query.status?.length) request = request.in("status", query.status);
      if (query.featured !== undefined) request = request.eq("featured", query.featured);
      const rows = (await result(
        await request
          .order(query.sort === "created" ? "created_at" : "updated_at", { ascending: false })
          .limit(query.limit ?? 1000),
      )) as Row[];
      return Promise.all(
        rows.map(async (row) => {
          const visible = await visibleRevision(row);
          return summary(client, row, visible.number, visible.published);
        }),
      );
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
      const first = <T extends string>(values?: T[]) => values?.[0] ?? null;
      const rows = (await result(
        await c.rpc("pw_search_entries", {
          p_text: query.text,
          p_domain: first(query.filters?.domain),
          p_scale: first(query.filters?.scale),
          p_status: first(query.filters?.status),
          p_lang: first(query.filters?.lang),
          p_author: first(query.filters?.author),
          p_limit: query.limit ?? 50,
          p_offset: query.offset ?? 0,
        }),
      )) as Array<{ entry: EntrySummary; score: number; matchedFields: string[]; snippet: null }>;
      return {
        hits: rows.map((row) => ({
          entry: row.entry,
          score: row.score,
          matchedFields: row.matchedFields as Array<"id" | "title" | "summary" | "body" | "tags" | "author" | "source">,
          snippet: row.snippet,
        })),
        total: rows.length,
        facets: { domain: {}, scale: {}, status: {}, lang: {} },
      };
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
    links: Array.isArray(row.links) ? (row.links as Array<{ label: string; url: string }>) : [],
    github: optionalText(row.github),
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
      const c = await createSupabaseServerClient();
      const values: Row = {};
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
    references: createReferenceRepository(),
    search: createSearchAdapter(),
    auth: createSupabaseAuthAdapter(),
    community: createCommunityRepository(),
  };
}
