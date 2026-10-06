"use client";

import { useState } from "react";
import type {
  Asset,
  Author,
  BioRole,
  DomainId,
  EntryMetadata,
  EntrySummary,
  Lang,
  RelationKind,
  Source,
  Tag,
} from "@/lib/model/types";
import {
  DOMAINS,
  DOMAIN_IDS,
  RELATION_KIND_IDS,
  RELATION_KINDS,
  ROLE_IDS,
  ROLES,
  SCALE_IDS,
  SCALES,
} from "@/lib/model/vocab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function SingleSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="font-mono text-meta tracking-[0.1em] text-ink-2 uppercase">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="pw-field h-9 w-full rounded-sm border-rule px-3 text-small shadow-none">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function MultiSelect({
  label,
  values,
  options,
  onChange,
  lang,
}: {
  label: string;
  values: string[];
  options: Array<{ id: string; label: string }>;
  onChange: (values: string[]) => void;
  lang: Lang;
}) {
  const toggle = (id: string) =>
    onChange(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  return (
    <fieldset className="min-w-0 flex-1">
      <legend className="mb-1.5 font-mono text-meta tracking-[0.1em] text-ink-2 uppercase">{label}</legend>
      <div className="pw-field grid max-h-40 gap-1 overflow-y-auto p-2">
        <div className="sr-only">{lang === "zh" ? "选择多个" : "Choose multiple"}</div>
        {options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-small hover:bg-ink/6"
          >
            <input
              type="checkbox"
              checked={values.includes(option.id)}
              onChange={() => toggle(option.id)}
              className="accent-[var(--color-indigo)]"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <p className="mt-1 text-meta text-ink-3">
        {lang === "zh" ? `${values.length} 项已选择` : `${values.length} selected`}
      </p>
    </fieldset>
  );
}

export function MetadataPanel({
  metadata,
  onChange,
  domain,
  onDomainChange,
  lang,
  sources,
  tags,
  authors,
  entries,
  assets,
  newSources,
  newTags,
  onNewSourcesChange,
  onNewTagsChange,
  onUpload,
}: {
  metadata: EntryMetadata;
  onChange: (next: EntryMetadata) => void;
  domain: DomainId;
  onDomainChange: (domain: DomainId) => void;
  lang: Lang;
  sources: Source[];
  tags: Tag[];
  authors: Author[];
  entries: EntrySummary[];
  assets: Asset[];
  newSources: string;
  newTags: string;
  onNewSourcesChange: (value: string) => void;
  onNewTagsChange: (value: string) => void;
  onUpload: (file: File, details: { altZh: string; altEn: string; credit: string; license: string }) => Promise<void>;
}) {
  const update = (patch: Partial<EntryMetadata>) => onChange({ ...metadata, ...patch });
  const relationTargets = entries.filter((entry) => entry.id !== metadata.relationDrafts[0]?.to);
  return (
    <div className="flex flex-col gap-3">
      <details open className="pw-sheet">
        <summary className="cursor-pointer list-none px-5 py-4 font-display text-h4 hover:text-indigo">
          {lang === "zh" ? "分类与生态属性" : "Taxonomy & ecology"}
        </summary>
        <div className="grid gap-4 border-t border-rule p-5 sm:grid-cols-3">
          <SingleSelect
            label={lang === "zh" ? "门类" : "Phylum"}
            value={domain}
            onChange={(value) => onDomainChange(value as DomainId)}
            options={DOMAIN_IDS.map((id) => ({ value: id, label: DOMAINS[id][lang] }))}
          />
          <SingleSelect
            label={lang === "zh" ? "尺度" : "Scale"}
            value={metadata.scale}
            onChange={(value) => update({ scale: value as EntryMetadata["scale"] })}
            options={SCALE_IDS.map((id) => ({ value: id, label: SCALES[id][lang] }))}
          />
          <SingleSelect
            label={lang === "zh" ? "生态角色" : "Ecological role"}
            value={metadata.role}
            onChange={(value) => update({ role: value as BioRole })}
            options={ROLE_IDS.map((id) => ({ value: id, label: ROLES[id][lang] }))}
          />
        </div>
      </details>
      <details open className="pw-sheet">
        <summary className="cursor-pointer list-none px-5 py-4 font-display text-h4 hover:text-indigo">
          {lang === "zh" ? "生物类比" : "Biological analogue"}
        </summary>
        <div className="grid gap-3 border-t border-rule p-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-meta text-ink-3">中文名称</span>
            <input
              value={metadata.analogue?.name.zh ?? ""}
              onChange={(event) =>
                update({
                  analogue: {
                    name: { zh: event.target.value, en: metadata.analogue?.name.en ?? "" },
                    note: metadata.analogue?.note,
                  },
                })
              }
              className="pw-field"
              placeholder="菌丝网络"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-ink-3">English name</span>
            <input
              value={metadata.analogue?.name.en ?? ""}
              onChange={(event) =>
                update({
                  analogue: {
                    name: { zh: metadata.analogue?.name.zh ?? "", en: event.target.value },
                    note: metadata.analogue?.note,
                  },
                })
              }
              className="pw-field"
              placeholder="Mycelial network"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-ink-3">中文说明</span>
            <textarea
              value={metadata.analogue?.note?.zh ?? ""}
              onChange={(event) =>
                update({
                  analogue: {
                    name: metadata.analogue?.name ?? { zh: "", en: "" },
                    note: { zh: event.target.value, en: metadata.analogue?.note?.en ?? "" },
                  },
                })
              }
              className="pw-field min-h-20"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-ink-3">English note</span>
            <textarea
              value={metadata.analogue?.note?.en ?? ""}
              onChange={(event) =>
                update({
                  analogue: {
                    name: metadata.analogue?.name ?? { zh: "", en: "" },
                    note: { zh: metadata.analogue?.note?.zh ?? "", en: event.target.value },
                  },
                })
              }
              className="pw-field min-h-20"
            />
          </label>
        </div>
      </details>
      <details open className="pw-sheet">
        <summary className="cursor-pointer list-none px-5 py-4 font-display text-h4 hover:text-indigo">
          {lang === "zh" ? "来源、标签与贡献者" : "Sources, tags & contributors"}
        </summary>
        <div className="flex flex-col gap-5 border-t border-rule p-5">
          <div className="flex flex-col gap-4 lg:flex-row">
            <MultiSelect
              label={lang === "zh" ? "来源" : "Sources"}
              values={metadata.sourceIds}
              options={sources.map((source) => ({ id: source.id, label: `${source.title} · ${source.year}` }))}
              onChange={(sourceIds) => update({ sourceIds })}
              lang={lang}
            />
            <MultiSelect
              label={lang === "zh" ? "标签" : "Tags"}
              values={metadata.tagIds}
              options={tags.map((tag) => ({
                id: tag.id,
                label: `${tag.label[lang]} · ${tag.label[lang === "zh" ? "en" : "zh"]}`,
              }))}
              onChange={(tagIds) => update({ tagIds })}
              lang={lang}
            />
            <MultiSelect
              label={lang === "zh" ? "贡献者" : "Contributors"}
              values={metadata.contributorIds}
              options={authors.map((author) => ({ id: author.id, label: author.name[lang] }))}
              onChange={(contributorIds) => update({ contributorIds })}
              lang={lang}
            />
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <label className="flex min-h-28 flex-col gap-1.5">
              <span className="text-meta text-ink-3">
                {lang === "zh" ? "待新增来源（每行一项）" : "New sources (one per line)"}
              </span>
              <textarea
                value={newSources}
                onChange={(event) => onNewSourcesChange(event.target.value)}
                className="pw-field h-20 resize-y"
                placeholder={lang === "zh" ? "作者、标题、年份、链接" : "Author, title, year, URL"}
              />
            </label>
            <label className="flex min-h-28 flex-col gap-1.5">
              <span className="text-meta text-ink-3">
                {lang === "zh" ? "待新增标签（逗号分隔）" : "New tags (comma separated)"}
              </span>
              <textarea
                value={newTags}
                onChange={(event) => onNewTagsChange(event.target.value)}
                className="pw-field h-20 resize-y"
                placeholder="streaming, 流式"
              />
            </label>
          </div>
        </div>
      </details>
      <details className="pw-sheet">
        <summary className="cursor-pointer list-none px-5 py-4 font-display text-h4 hover:text-indigo">
          {lang === "zh" ? "关系" : "Relations"}
        </summary>
        <div className="flex flex-col gap-3 border-t border-rule p-5">
          {metadata.relationDrafts.map((relation, index) => (
            <div key={`${relation.to}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_10rem_5rem_auto]">
              <SingleSelect
                label={lang === "zh" ? "目标" : "Target"}
                value={relation.to}
                onChange={(value) => {
                  const relationDrafts = [...metadata.relationDrafts];
                  relationDrafts[index] = { ...relation, to: value };
                  update({ relationDrafts });
                }}
                options={relationTargets.map((entry) => ({
                  value: entry.id,
                  label: `${entry.id} · ${entry.title[lang]}`,
                }))}
                placeholder={lang === "zh" ? "选择目标" : "Choose target"}
              />
              <SingleSelect
                label={lang === "zh" ? "类型" : "Kind"}
                value={relation.kind}
                onChange={(value) => {
                  const relationDrafts = [...metadata.relationDrafts];
                  relationDrafts[index] = { ...relation, kind: value as RelationKind };
                  update({ relationDrafts });
                }}
                options={RELATION_KIND_IDS.map((kind) => ({ value: kind, label: RELATION_KINDS[kind].label[lang] }))}
              />
              <SingleSelect
                label={lang === "zh" ? "强度" : "Strength"}
                value={String(relation.strength)}
                onChange={(value) => {
                  const relationDrafts = [...metadata.relationDrafts];
                  relationDrafts[index] = { ...relation, strength: Number(value) as 1 | 2 | 3 };
                  update({ relationDrafts });
                }}
                options={[
                  { value: "1", label: `1 · ${lang === "zh" ? "弱" : "low"}` },
                  { value: "2", label: `2 · ${lang === "zh" ? "中" : "medium"}` },
                  { value: "3", label: `3 · ${lang === "zh" ? "强" : "strong"}` },
                ]}
              />
              <button
                type="button"
                onClick={() => update({ relationDrafts: metadata.relationDrafts.filter((_, at) => at !== index) })}
                className="h-9 self-end px-2 text-small text-brick-ink"
              >
                {lang === "zh" ? "移除" : "Remove"}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              update({ relationDrafts: [...metadata.relationDrafts, { to: "", kind: "dependency", strength: 1 }] })
            }
            className="self-start rounded-sm border border-rule-strong px-3 py-2 text-small"
          >
            + {lang === "zh" ? "添加关系" : "Add relation"}
          </button>
        </div>
      </details>
      <details open className="pw-sheet">
        <summary className="cursor-pointer list-none px-5 py-4 font-display text-h4 hover:text-indigo">
          {lang === "zh" ? "插图" : "Illustration"}
        </summary>
        <div className="flex flex-col gap-5 border-t border-rule p-5">
          <SingleSelect
            label={lang === "zh" ? "标本图" : "Specimen plate"}
            value={metadata.heroAssetId ?? ""}
            onChange={(value) => update({ heroAssetId: value || undefined })}
            options={assets.map((asset) => ({ value: asset.id, label: `${asset.id} · ${asset.alt[lang]}` }))}
            placeholder={lang === "zh" ? "暂不选择" : "None"}
          />
          <AssetUpload lang={lang} onUpload={onUpload} />
          <p className="text-meta text-ink-3">
            {lang === "zh"
              ? "新上传插图会标记为待审核，并在发布时一起审阅许可和署名。"
              : "New uploads stay pending and are reviewed with the entry for license and attribution."}
          </p>
        </div>
      </details>
    </div>
  );
}

function AssetUpload({
  lang,
  onUpload,
}: {
  lang: Lang;
  onUpload: (file: File, details: { altZh: string; altEn: string; credit: string; license: string }) => Promise<void>;
}) {
  const [altZh, setAltZh] = useState("");
  const [altEn, setAltEn] = useState("");
  const [credit, setCredit] = useState("");
  const [license, setLicense] = useState("CC BY 4.0");
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-meta text-ink-3">{lang === "zh" ? "上传新插图" : "Upload new illustration"}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              await onUpload(file, { altZh, altEn, credit, license });
            } finally {
              setBusy(false);
              event.target.value = "";
            }
          }}
          className="pw-field text-small"
          disabled={busy}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-meta text-ink-3">Alt 中文</span>
        <input value={altZh} onChange={(event) => setAltZh(event.target.value)} className="pw-field" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-meta text-ink-3">Alt English</span>
        <input value={altEn} onChange={(event) => setAltEn(event.target.value)} className="pw-field" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-meta text-ink-3">Credit / 署名</span>
        <input value={credit} onChange={(event) => setCredit(event.target.value)} className="pw-field" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-meta text-ink-3">License / 许可</span>
        <input value={license} onChange={(event) => setLicense(event.target.value)} className="pw-field" />
      </label>
    </div>
  );
}
