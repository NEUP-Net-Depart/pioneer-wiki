import type { EntryMetadata, Localized, RelationKind } from "@/lib/model/types";
import { ServiceError } from "@/lib/services/contracts";

/*
 * Rules both backends share, in the words the database uses for them
 * (supabase/migrations/202610140002_entry_snapshots.sql).
 */

const RELATION_KINDS: RelationKind[] = ["symbiosis", "source", "taxonomy", "contrast", "dependency", "dispute"];

/** Both titles, both summaries, and a :::zh and a :::en block at the start of a line. */
export function bilingualComplete(title: Localized, summary: Localized, body: string): boolean {
  return (
    Boolean(title.zh.trim() && title.en.trim() && summary.zh.trim() && summary.en.trim()) &&
    /(^|\n):::zh/.test(body) &&
    /(^|\n):::en/.test(body)
  );
}

/** Asset ids a body places as ![…](asset:<id>). */
export function bodyAssetIds(body: string): string[] {
  return [...new Set([...body.matchAll(/\]\(asset:([A-Za-z0-9_-]+)\)/g)].map((match) => match[1]))];
}

function strings(value: unknown, maxItems: number, maxLength: number, reason: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems) throw new ServiceError("invalid", reason);
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") throw new ServiceError("invalid", reason);
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > maxLength) throw new ServiceError("invalid", reason);
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

export interface MetadataReferences {
  entryId?: string;
  entryExists: (id: string) => boolean;
  authorExists: (id: string) => boolean;
  sourceExists: (id: string) => boolean;
  tagExists: (id: string) => boolean;
  assetVisible: (id: string) => boolean;
}

/** The editable metadata of a draft, normalised; throws the database's reasons for bad values. */
export function validateMetadata(input: Partial<EntryMetadata> | undefined, refs: MetadataReferences): EntryMetadata {
  const m = input ?? {};
  const scale = m.scale ?? "micro";
  const role = m.role ?? "observer";
  if (scale !== "macro" && scale !== "micro") throw new ServiceError("invalid", "invalid_scale");
  if (!["host", "symbiont", "decomposer", "observer"].includes(role)) throw new ServiceError("invalid", "invalid_role");
  const analogue =
    m.analogue && (m.analogue.name.zh.trim() || m.analogue.name.en.trim())
      ? {
          name: { zh: m.analogue.name.zh.trim(), en: m.analogue.name.en.trim() },
          note: { zh: m.analogue.note?.zh.trim() ?? "", en: m.analogue.note?.en.trim() ?? "" },
        }
      : undefined;
  if (analogue && (analogue.name.zh.length > 80 || analogue.name.en.length > 80))
    throw new ServiceError("invalid", "invalid_analogue");
  const heroAssetId = m.heroAssetId || undefined;
  if (heroAssetId && !refs.assetVisible(heroAssetId)) throw new ServiceError("invalid", "unknown_hero_asset");
  const contributorIds = strings(m.contributorIds, 20, 80, "invalid_contributors");
  const sourceIds = strings(m.sourceIds, 120, 80, "invalid_sources");
  const tagIds = strings(m.tagIds, 30, 80, "invalid_tags");
  if (contributorIds.some((id) => !refs.authorExists(id))) throw new ServiceError("invalid", "unknown_contributor");
  if (sourceIds.some((id) => !refs.sourceExists(id))) throw new ServiceError("invalid", "unknown_source");
  if (tagIds.some((id) => !refs.tagExists(id))) throw new ServiceError("invalid", "unknown_tag");
  const relationDrafts: EntryMetadata["relationDrafts"] = [];
  if (m.relationDrafts && (!Array.isArray(m.relationDrafts) || m.relationDrafts.length > 40))
    throw new ServiceError("invalid", "invalid_relations");
  for (const relation of m.relationDrafts ?? []) {
    if (!relation.to) throw new ServiceError("invalid", "relation_target_required");
    if (relation.to === refs.entryId) throw new ServiceError("invalid", "relation_to_self");
    if (!refs.entryExists(relation.to)) throw new ServiceError("invalid", "unknown_relation_target");
    if (!RELATION_KINDS.includes(relation.kind)) throw new ServiceError("invalid", "invalid_relation_kind");
    if (relationDrafts.some((r) => r.to === relation.to && r.kind === relation.kind)) continue;
    relationDrafts.push({
      to: relation.to,
      kind: relation.kind,
      strength: Math.max(1, Math.min(3, Number(relation.strength) || 1)) as 1 | 2 | 3,
      note: { zh: relation.note?.zh.trim() ?? "", en: relation.note?.en.trim() ?? "" },
    });
  }
  return {
    scale,
    role,
    analogue,
    heroAssetId,
    contributorIds,
    sourceIds,
    tagIds,
    relationDrafts,
    pendingSources: strings(m.pendingSources, 20, 500, "invalid_pending_sources"),
    pendingTags: strings(m.pendingTags, 20, 40, "invalid_pending_tags"),
  };
}

/** "中文 / English" or "中文 | English" gives both labels; one name serves both languages. */
export function splitLabel(label: string): Localized {
  const parts = label.split(/\s*[/|｜]\s*/).map((part) => part.trim());
  return parts.length > 1 && parts[0] && parts[1]
    ? { zh: parts[0], en: parts[1] }
    : { zh: label.trim(), en: label.trim() };
}

/** A URL segment from a title that no other entry uses now or used before. */
export function uniqueSlug(title: string, id: string, taken: (slug: string) => boolean): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || `entry-${id.replace(/\D/g, "")}`;
  let slug = base;
  for (let n = 2; taken(slug); n++) slug = `${base.slice(0, 60)}-${n}`;
  return slug;
}
