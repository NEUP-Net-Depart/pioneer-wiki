import "server-only";
import type { Asset, Author, EntryMetadata, EntrySummary, Revision, RevisionSnapshot, Source, Tag } from "@/lib/model/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ServiceError } from "./contracts";
import { fromDatabaseError } from "./errors";

/* Row readers and mappers shared by the Supabase repositories. */

export type Row = Record<string, unknown>;
export type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const text = (value: unknown): string => (typeof value === "string" ? value : "");
export const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;
export const number = (value: unknown): number => (typeof value === "number" ? value : Number(value ?? 0));
export const optionalNumber = (value: unknown): number | undefined =>
  value === null || value === undefined ? undefined : number(value);
export const bool = (value: unknown): boolean => Boolean(value);
export const localized = (row: Row, zh: string, en: string) => ({ zh: text(row[zh]), en: text(row[en]) });
export const jsonList = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** The data of a Supabase response, or its failure as a ServiceError. */
export async function result<T>(value: {
  data: T | null;
  error: { message: string; code?: string; details?: string | null } | null;
}): Promise<T> {
  if (value.error) throw fromDatabaseError(value.error);
  return value.data as T;
}

/** A client for this request; an unconfigured deployment is "unavailable", not a crash. */
export async function client(): Promise<SupabaseClient> {
  try {
    return await createSupabaseServerClient();
  } catch {
    throw new ServiceError("unavailable", "supabase_required");
  }
}

export async function rpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const c = await client();
  return (await result(await c.rpc(name, args))) as T;
}

export function mapAuthor(row: Row): Author {
  return {
    id: text(row.id),
    handle: text(row.handle),
    name: localized(row, "name_zh", "name_en"),
    affiliation: localized(row, "affiliation_zh", "affiliation_en"),
    role: row.role as Author["role"],
    sigil: text(row.sigil),
  };
}
export function mapSource(row: Row): Source {
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
export function mapTag(row: Row): Tag {
  return { id: text(row.id), label: localized(row, "label_zh", "label_en") };
}
export function mapAsset(row: Row): Asset {
  const caption = localized(row, "caption_zh", "caption_en");
  return {
    id: text(row.id),
    src: text(row.src),
    width: number(row.width),
    height: number(row.height),
    alt: localized(row, "alt_zh", "alt_en"),
    caption: caption.zh || caption.en ? caption : undefined,
    credit: text(row.credit),
    license: text(row.license),
    sourceUrl: optionalText(row.source_url),
    reviewStatus: (optionalText(row.review_status) as Asset["reviewStatus"]) ?? "approved",
  };
}

/** The public columns of an entries row: always the published revision. */
export function mapSummary(row: Row): EntrySummary {
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
    status: "published",
    authorId: text(row.author_id),
    contributorIds: [],
    sourceIds: [],
    tagIds: [],
    bodyLanguages: ["zh", "en"],
    heroAssetId: optionalText(row.hero_asset_id),
    createdAt: text(row.created_at),
    updatedAt: text(row.published_at ?? row.updated_at),
    revision: number(row.published_revision_number),
    featured: bool(row.featured),
  };
}

/** A revision row, or a revision as the lifecycle functions answer it (camelCase). */
export function mapRevision(row: Row): Revision {
  const stats = (row.stats ?? {}) as Row;
  return {
    id: text(row.id),
    entryId: text(row.entry_id ?? row.entryId),
    number: number(row.number),
    parentId: optionalText(row.parent_id ?? row.parentId),
    authorId: text(row.author_id ?? row.authorId),
    createdAt: text(row.created_at ?? row.createdAt),
    note: text(row.note),
    state: row.state as Revision["state"],
    taxonomy: ((row.metadata as Row | null)?.taxonomy ?? row.taxonomy ?? undefined) as Revision["taxonomy"],
    stats: {
      added: number(row.added_lines ?? stats.added),
      removed: number(row.removed_lines ?? stats.removed),
    },
  };
}

const EMPTY_METADATA: EntryMetadata = {
  scale: "micro",
  role: "observer",
  contributorIds: [],
  sourceIds: [],
  tagIds: [],
  relationDrafts: [],
  pendingSources: [],
  pendingTags: [],
  auxiliaryCategoryIds: [],
};

/** The draft contract a revision recorded, with what older revisions left out taken from `fallback`. */
export function metadataOf(value: unknown, fallback?: Partial<EntryMetadata>): EntryMetadata {
  const m = (value && typeof value === "object" ? value : {}) as Row;
  const taxonomy = (m.taxonomy ?? {}) as Row;
  const pick = <K extends keyof EntryMetadata>(key: K): EntryMetadata[K] | undefined =>
    (key in m ? (m[key] as EntryMetadata[K]) : undefined) ?? fallback?.[key];
  return {
    ...EMPTY_METADATA,
    scale: pick("scale") ?? "micro",
    role: pick("role") ?? "observer",
    analogue: pick("analogue") ?? undefined,
    heroAssetId: optionalText(pick("heroAssetId")),
    contributorIds: jsonList<string>(pick("contributorIds")),
    sourceIds: jsonList<string>(pick("sourceIds")),
    tagIds: jsonList<string>(pick("tagIds")),
    relationDrafts: jsonList(pick("relationDrafts")),
    pendingSources: jsonList<string>(m.pendingSources),
    pendingTags: jsonList<string>(m.pendingTags),
    categoryId: optionalText(taxonomy.categoryId ?? m.categoryId) ?? fallback?.categoryId,
    auxiliaryCategoryIds: jsonList<string>(taxonomy.auxiliaryCategoryIds ?? m.auxiliaryCategoryIds ?? fallback?.auxiliaryCategoryIds),
    species: optionalText(taxonomy.species ?? m.species) ?? fallback?.species,
    level: (optionalText(taxonomy.level ?? m.level) ?? fallback?.level) as EntryMetadata["level"],
    contentRole: (optionalText(taxonomy.contentRole ?? m.contentRole) ?? fallback?.contentRole) as EntryMetadata["contentRole"],
  };
}

/** A revision row with its body as a snapshot; `entry` supplies what an old revision did not record. */
export function mapSnapshot(row: Row, body: string, entry: Row, fallback?: Partial<EntryMetadata>): RevisionSnapshot {
  const recorded = row.title_zh != null || row.title_en != null;
  return {
    ...mapRevision(row),
    title: recorded ? localized(row, "title_zh", "title_en") : localized(entry, "title_zh", "title_en"),
    summary: recorded ? localized(row, "summary_zh", "summary_en") : localized(entry, "summary_zh", "summary_en"),
    body,
    metadata: metadataOf(row.metadata, fallback),
    recorded,
  };
}
