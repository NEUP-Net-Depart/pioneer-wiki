import { diffLines } from "diff";
import type { Author, Category, Lang, RevisionSnapshot, Source, Tag } from "@/lib/model/types";
import { CONTENT_ROLES, LEVELS } from "@/lib/model/vocab";

/*
 * What a reviewer compares: every field of the draft contract, as readable
 * values, between the public revision and the one waiting. Unchanged fields
 * are left out, so a metadata-only change is as visible as a body edit.
 */

export interface FieldChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface DiffChunk {
  kind: "added" | "removed" | "context";
  lines: string[];
}

export interface Lookups {
  authors: Author[];
  sources: Source[];
  tags: Tag[];
  categories: Category[];
}

const ROLES = { host: ["宿主", "Host"], symbiont: ["共生者", "Symbiont"], decomposer: ["分解者", "Decomposer"], observer: ["观察者", "Observer"] } as const;
const SCALES = { macro: ["宏观", "Macro"], micro: ["微观", "Micro"] } as const;
const KINDS = {
  symbiosis: ["共生", "symbiosis"],
  source: ["来源", "source"],
  taxonomy: ["分类", "taxonomy"],
  contrast: ["对照", "contrast"],
  dependency: ["依赖", "dependency"],
  dispute: ["争议", "dispute"],
} as const;

export function bodyChanges(before: string, after: string): DiffChunk[] {
  return diffLines(before, after).flatMap((change) => {
    const lines = change.value
      .replace(/\n$/, "")
      .split("\n")
      .filter((line, index, all) => line || index < all.length - 1);
    return lines.length ? [{ kind: change.added ? "added" : change.removed ? "removed" : "context", lines }] : [];
  });
}

export function fieldChanges(
  before: RevisionSnapshot | null,
  after: RevisionSnapshot,
  lookups: Lookups,
  lang: Lang,
): FieldChange[] {
  const i = lang === "zh" ? 0 : 1;
  const names = <T extends { id: string }>(list: T[], ids: string[], name: (item: T) => string) =>
    ids.map((id) => {
      const item = list.find((x) => x.id === id);
      return item ? name(item) : id;
    });
  const describe = (s: RevisionSnapshot | null): Record<string, [string, string]> => {
    if (!s) return {};
    const m = s.metadata;
    const genus = lookups.categories.find((c) => c.id === m.categoryId);
    const aux = names(lookups.categories, m.auxiliaryCategoryIds ?? [], (c) => c.name[lang]);
    return {
      titleZh: [lang === "zh" ? "中文标题" : "Chinese title", s.title.zh],
      titleEn: [lang === "zh" ? "英文标题" : "English title", s.title.en],
      summaryZh: [lang === "zh" ? "中文摘要" : "Chinese summary", s.summary.zh],
      summaryEn: [lang === "zh" ? "英文摘要" : "English summary", s.summary.en],
      genus: [lang === "zh" ? "门类" : "Genus", genus ? `${genus.name[lang]} · ${genus.scientificName}` : (m.categoryId ?? "")],
      auxiliary: [lang === "zh" ? "交叉门类" : "Cross-genus", aux.join("、")],
      species: [lang === "zh" ? "物种" : "Species", m.species ?? ""],
      level: [lang === "zh" ? "层级" : "Level", m.level ? (LEVELS[m.level]?.[lang] ?? m.level) : ""],
      contentRole: [lang === "zh" ? "用途" : "Purpose", m.contentRole ? (CONTENT_ROLES[m.contentRole]?.[lang] ?? m.contentRole) : ""],
      scale: [lang === "zh" ? "尺度" : "Scale", SCALES[m.scale]?.[i] ?? m.scale],
      role: [lang === "zh" ? "生态角色" : "Role", ROLES[m.role]?.[i] ?? m.role],
      analogue: [
        lang === "zh" ? "生物类比" : "Analogue",
        m.analogue ? `${m.analogue.name[lang]}${m.analogue.note?.[lang] ? ` — ${m.analogue.note[lang]}` : ""}` : "",
      ],
      hero: [lang === "zh" ? "封面图" : "Cover image", m.heroAssetId ?? ""],
      contributors: [lang === "zh" ? "贡献者" : "Contributors", names(lookups.authors, m.contributorIds, (a) => a.name[lang]).join("、")],
      sources: [lang === "zh" ? "来源" : "Sources", names(lookups.sources, m.sourceIds, (x) => x.title).join("\n")],
      tags: [lang === "zh" ? "标签" : "Tags", names(lookups.tags, m.tagIds, (t) => t.label[lang]).join("、")],
      relations: [
        lang === "zh" ? "关系" : "Relations",
        m.relationDrafts.map((r) => `${KINDS[r.kind]?.[i] ?? r.kind} → ${r.to} (${r.strength})`).join("\n"),
      ],
      pendingTags: [lang === "zh" ? "新标签（发布时创建）" : "New tags (created on publish)", m.pendingTags.join("、")],
      pendingSources: [lang === "zh" ? "新来源（发布时创建）" : "New sources (created on publish)", m.pendingSources.join("\n")],
    };
  };
  const was = describe(before);
  const now = describe(after);
  return Object.keys(now).flatMap((field) => {
    const old = was[field]?.[1] ?? "";
    const next = now[field][1];
    return old === next ? [] : [{ field, label: now[field][0], before: old, after: next }];
  });
}
