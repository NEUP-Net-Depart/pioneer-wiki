"use client";

import { useId, useMemo, useState } from "react";
import type {
  Asset,
  Author,
  BioRole,
  EntryMetadata,
  EntrySummary,
  Lang,
  RelationKind,
  Source,
  Tag,
} from "@/lib/model/types";
import { RELATION_KIND_IDS, RELATION_KINDS, ROLE_IDS, ROLES, SCALE_IDS, SCALES } from "@/lib/model/vocab";
import { cn } from "@/lib/utils";

/*
 * The rest of the entry's card, after the catalogue card: the register of its
 * sources, tags and hands; its ties to other specimens; its plates; and, folded
 * away, the fields of the first edition. Everything is set as archive
 * stationery — ruled lines, typed labels, stamped choices — never stock form
 * controls, and everything travels in the same draft contract as the body.
 */

/** Plate state for the species, decided by curators (public/catalogue/plates.json). */
export interface SpeciesPlateState {
  species?: string;
  /** The accessioned plate, when one has passed review. */
  plate?: { src: string; width: number; height: number; alt: string } | null;
}

/** A sheet of the entry's card: a numbered heading on a rule, its content beneath. */
function Sheet({
  number,
  title,
  aside,
  children,
  open = true,
}: {
  number: string;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="pw-sheet group/sheet">
      <summary className="flex cursor-pointer list-none items-baseline gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="w-6 font-display text-ink-3 italic">{number}</span>
        <span className="font-display text-h4 text-ink">{title}</span>
        <span className="ml-auto flex items-baseline gap-3 text-meta text-ink-3">
          {aside}
          <span aria-hidden="true" className="transition-transform duration-(--dur-quick) group-open/sheet:rotate-90">
            ›
          </span>
        </span>
      </summary>
      <div className="border-t border-rule px-5 pt-4 pb-5">{children}</div>
    </details>
  );
}

/**
 * A register of chosen items as a ruled list, with a typed search line beneath
 * to add more. Replaces a long list of checkboxes: what is chosen reads first,
 * what is available is found by typing.
 */
function Register({
  label,
  values,
  options,
  onChange,
  lang,
  empty,
}: {
  label: string;
  values: string[];
  options: Array<{ id: string; label: string; detail?: string }>;
  onChange: (values: string[]) => void;
  lang: Lang;
  empty: string;
}) {
  const id = useId();
  const zh = lang === "zh";
  const [query, setQuery] = useState("");
  const chosen = values
    .map((v) => options.find((o) => o.id === v))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => !values.includes(o.id))
      .filter((o) => !q || `${o.label} ${o.detail ?? ""}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [options, query, values]);
  return (
    <div className="flex min-w-0 flex-col">
      <p className="pw-label" id={`${id}-l`}>
        {label}
        <span className="ml-2 normal-case tracking-normal text-ink-3">· {chosen.length}</span>
      </p>
      <ol aria-labelledby={`${id}-l`} className="mt-1.5 flex flex-col">
        {chosen.length ? (
          chosen.map((o, i) => (
            <li key={o.id} className="group flex items-baseline gap-2 border-b border-rule py-1.5 text-small">
              <span className="w-5 shrink-0 font-display text-ink-3 italic">{i + 1}.</span>
              <span className="min-w-0 flex-1">
                <span className="text-ink">{o.label}</span>
                {o.detail ? <span className="ml-1.5 text-meta text-ink-3">{o.detail}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== o.id))}
                aria-label={zh ? `移除 ${o.label}` : `Remove ${o.label}`}
                className="shrink-0 px-1 text-ink-3 opacity-60 group-hover:opacity-100 hover:text-brick-ink focus-visible:opacity-100"
              >
                ×
              </button>
            </li>
          ))
        ) : (
          <li className="border-b border-rule py-1.5 text-small text-ink-3 italic">{empty}</li>
        )}
      </ol>
      <div className="relative mt-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && matches[0]) {
              event.preventDefault();
              onChange([...values, matches[0].id]);
              setQuery("");
            }
          }}
          placeholder={zh ? "＋ 输入以查找并添加" : "+ type to find and add"}
          aria-label={zh ? `添加${label}` : `Add to ${label}`}
          className="pw-field text-small"
        />
        {query.trim() ? (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xs border border-rule bg-paper-sheet py-1 shadow-lifted">
            {matches.length ? (
              matches.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange([...values, o.id]);
                      setQuery("");
                    }}
                    className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-small hover:bg-ink/5"
                  >
                    <span className="text-ink">{o.label}</span>
                    {o.detail ? <span className="text-meta text-ink-3">{o.detail}</span> : null}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-1.5 text-small text-ink-3 italic">
                {zh ? "没有匹配项；可在下方「待新增」里登记。" : "No match — note it under “to be added” below."}
              </li>
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** A choice among a few words, typed on a ruled line; the current one is underlined in ink. */
function Words({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="pw-label">{legend}</legend>
      <div className="pw-ink-under mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {options.map(([id, text]) => (
          <label key={id} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              className="peer sr-only"
              checked={value === id}
              onChange={() => onChange(id)}
            />
            <span className="text-small text-ink-3 underline-offset-4 peer-checked:text-ink peer-checked:underline peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-indigo hover:text-ink">
              {text}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function MetadataPanel({
  metadata,
  onChange,
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
  onInsert,
  speciesPlate,
  familyId,
}: {
  metadata: EntryMetadata;
  onChange: (next: EntryMetadata) => void;
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
  onUpload: (
    file: File,
    details: { altZh: string; altEn: string; credit: string; license: string },
  ) => Promise<Asset | null>;
  /** Insert Markdown at the writing cursor. */
  onInsert: (markdown: string) => void;
  speciesPlate: SpeciesPlateState;
  /** The family of the entry's genus, for its ink. */
  familyId?: string;
}) {
  const zh = lang === "zh";
  const update = (patch: Partial<EntryMetadata>) => onChange({ ...metadata, ...patch });
  const other: Lang = zh ? "en" : "zh";

  const sourceOptions = sources.map((s) => ({
    id: s.id,
    label: s.title,
    detail: s.year ? `${s.creators} · ${s.year}` : s.creators,
  }));
  const tagOptions = tags.map((t) => ({ id: t.id, label: t.label[lang], detail: t.label[other] }));
  const pendingSourceCount = newSources.split("\n").filter((l) => l.trim()).length;
  const pendingTagCount = newTags.split(",").filter((l) => l.trim()).length;

  return (
    <div data-phylum={familyId} className="flex flex-col gap-3">
      {/* ── 1 · Sources, tags and hands ─────────────────────────── */}
      <Sheet
        number="i."
        title={zh ? "来源、标签与执笔" : "Sources, tags & hands"}
        aside={`${metadata.sourceIds.length + pendingSourceCount} · ${metadata.tagIds.length + pendingTagCount} · ${metadata.contributorIds.length + 1}`}
      >
        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
          <Register
            label={zh ? "来源" : "Sources"}
            values={metadata.sourceIds}
            options={sourceOptions}
            onChange={(sourceIds) => update({ sourceIds })}
            lang={lang}
            empty={zh ? "尚未引用来源。" : "No sources cited yet."}
          />
          <Register
            label={zh ? "标签" : "Tags"}
            values={metadata.tagIds}
            options={tagOptions}
            onChange={(tagIds) => update({ tagIds })}
            lang={lang}
            empty={zh ? "尚未加标签。" : "No tags yet."}
          />
          <label className="flex flex-col gap-1.5">
            <span className="pw-label">{zh ? "待新增来源 · 每行一项" : "Sources to be added · one per line"}</span>
            <textarea
              value={newSources}
              onChange={(event) => onNewSourcesChange(event.target.value)}
              className="pw-lined min-h-24 resize-y text-small"
              placeholder={zh ? "作者，《标题》，年份，链接" : "Author, Title, year, URL"}
            />
            <span className="text-meta text-ink-3">
              {zh
                ? "随修订提交，发布时自动登记进来源库（同名或同链接的来源会复用）。最多 20 条。"
                : "Sent with the revision and entered in the register when it is published (an existing source with the same title or link is reused). Up to 20."}
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="pw-label">{zh ? "待新增标签 · 逗号分隔" : "Tags to be added · comma separated"}</span>
            <textarea
              value={newTags}
              onChange={(event) => onNewTagsChange(event.target.value)}
              className="pw-lined min-h-24 resize-y text-small"
              placeholder={zh ? "流式 / Streaming, 缓存 / Cache" : "流式 / Streaming, 缓存 / Cache"}
            />
            <span className="text-meta text-ink-3">
              {zh
                ? "写成“中文 / English”可同时给出两种语言的名称；发布时创建，已有同名标签会复用。"
                : "Write “中文 / English” to name both languages; created on publish, reusing a tag of the same name."}
            </span>
          </label>
          <fieldset className="lg:col-span-2">
            <legend className="pw-label">{zh ? "协作者 · 点选署名" : "Contributors · stamp to credit"}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {authors.map((a) => {
                const on = metadata.contributorIds.includes(a.id);
                return (
                  <label key={a.id} className="cursor-pointer">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={on}
                      onChange={() =>
                        update({
                          contributorIds: on
                            ? metadata.contributorIds.filter((id) => id !== a.id)
                            : [...metadata.contributorIds, a.id],
                        })
                      }
                    />
                    <span
                      className={cn(
                        "inline-block rounded-xs border px-2.5 py-1 font-display text-small transition-colors duration-(--dur-quick) peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-indigo",
                        on
                          ? "-rotate-1 border-brick-ink text-brick-ink"
                          : "border-dashed border-rule-strong text-ink-3 hover:border-ink hover:text-ink",
                      )}
                    >
                      {a.name[lang]}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      </Sheet>

      {/* ── 2 · Relations ───────────────────────────────────────── */}
      <Sheet
        number="ii."
        title={zh ? "关系" : "Relations"}
        aside={`${metadata.relationDrafts.length}`}
        open={metadata.relationDrafts.length > 0}
      >
        <RelationLedger metadata={metadata} update={update} entries={entries} lang={lang} />
      </Sheet>

      {/* ── 3 · Plates ──────────────────────────────────────────── */}
      <Sheet number="iii." title={zh ? "图版与插图" : "Plates & figures"}>
        <PlatesSheet lang={lang} speciesPlate={speciesPlate} assets={assets} onUpload={onUpload} onInsert={onInsert} />
      </Sheet>

      {/* ── 4 · First-edition fields, folded away ───────────────── */}
      <Sheet
        number="iv."
        title={zh ? "初版字段" : "First-edition fields"}
        aside={zh ? "旧版分类，保留以便回滚" : "older catalogue, kept for rollback"}
        open={false}
      >
        <p className="mb-4 max-w-prose text-small text-ink-3">
          {zh
            ? "这些是十门时期的分类与生物类比。新版由编目卡上的物种、内容层级与内容角色取代，读者页面不再显示；保留在这里只为兼容旧数据与回滚。"
            : "The scale, ecological role and biological analogue of the ten-phyla catalogue. The species, level and role on the catalogue card replace them and readers no longer see them; they stay for older data and rollbacks."}
        </p>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <Words
            legend={zh ? "尺度" : "Scale"}
            value={metadata.scale}
            options={SCALE_IDS.map((id) => [id, SCALES[id][lang]])}
            onChange={(scale) => update({ scale: scale as EntryMetadata["scale"] })}
          />
          <Words
            legend={zh ? "生态角色" : "Ecological role"}
            value={metadata.role}
            options={ROLE_IDS.map((id) => [id, ROLES[id][lang]])}
            onChange={(role) => update({ role: role as BioRole })}
          />
          {(["zh", "en"] as const).map((l) => (
            <label key={`name-${l}`} className="flex flex-col gap-1">
              <span className="pw-label">{l === "zh" ? "类比 · 中文名" : "Analogue · English name"}</span>
              <input
                value={metadata.analogue?.name[l] ?? ""}
                onChange={(event) =>
                  update({
                    analogue: {
                      name: { ...(metadata.analogue?.name ?? { zh: "", en: "" }), [l]: event.target.value },
                      note: metadata.analogue?.note,
                    },
                  })
                }
                lang={l === "zh" ? "zh-CN" : "en"}
                className="pw-field text-small"
              />
            </label>
          ))}
          {(["zh", "en"] as const).map((l) => (
            <label key={`note-${l}`} className="flex flex-col gap-1">
              <span className="pw-label">{l === "zh" ? "类比 · 中文说明" : "Analogue · English note"}</span>
              <textarea
                value={metadata.analogue?.note?.[l] ?? ""}
                onChange={(event) =>
                  update({
                    analogue: {
                      name: metadata.analogue?.name ?? { zh: "", en: "" },
                      note: { ...(metadata.analogue?.note ?? { zh: "", en: "" }), [l]: event.target.value },
                    },
                  })
                }
                lang={l === "zh" ? "zh-CN" : "en"}
                className="pw-field min-h-16 resize-y text-small"
              />
            </label>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

/** Relations as a ledger: each line reads «this entry — kind → other entry», with its weight. */
function RelationLedger({
  metadata,
  update,
  entries,
  lang,
}: {
  metadata: EntryMetadata;
  update: (patch: Partial<EntryMetadata>) => void;
  entries: EntrySummary[];
  lang: Lang;
}) {
  const zh = lang === "zh";
  const [query, setQuery] = useState("");
  const set = (index: number, patch: Partial<EntryMetadata["relationDrafts"][number]>) => {
    const relationDrafts = [...metadata.relationDrafts];
    relationDrafts[index] = { ...relationDrafts[index], ...patch };
    update({ relationDrafts });
  };
  const taken = new Set(metadata.relationDrafts.map((r) => `${r.to}:${r.kind}`));
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return entries
      .filter((e) => `${e.id} ${e.title.zh} ${e.title.en} ${e.species ?? ""}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [entries, query]);
  return (
    <div className="flex flex-col gap-4">
      {metadata.relationDrafts.length ? (
        <ol className="flex flex-col">
          {metadata.relationDrafts.map((relation, index) => {
            const target = entries.find((e) => e.id === relation.to);
            const duplicate =
              metadata.relationDrafts.findIndex((r) => r.to === relation.to && r.kind === relation.kind) !== index;
            return (
              <li
                key={`${relation.to}-${index}`}
                className="grid gap-x-4 gap-y-2 border-b border-rule py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
              >
                <p className="min-w-0 text-small">
                  <span className="text-ink-3">{zh ? "本条" : "This entry"}</span>
                  <span className={cn("mx-2", relationTone(relation.kind))}>
                    — {RELATION_KINDS[relation.kind].label[lang]} {RELATION_KINDS[relation.kind].symmetric ? "—" : "→"}
                  </span>
                  {target ? (
                    <span className="text-ink">
                      {target.title[lang]} <span className="font-mono text-meta text-ink-3">{target.id}</span>
                    </span>
                  ) : (
                    <span className="text-brick-ink">{zh ? "目标未选" : "No target"}</span>
                  )}
                  {duplicate ? (
                    <span className="ml-2 text-meta text-brick-ink">{zh ? "重复" : "duplicate"}</span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                  {RELATION_KIND_IDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => set(index, { kind: k as RelationKind })}
                      aria-pressed={relation.kind === k}
                      className={cn(
                        "text-meta underline-offset-4 hover:text-ink",
                        relation.kind === k ? cn("underline", relationTone(k)) : "text-ink-3",
                      )}
                    >
                      {RELATION_KINDS[k].label[lang]}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="sr-only">{zh ? "强度" : "Strength"}</span>
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set(index, { strength: n as 1 | 2 | 3 })}
                      aria-pressed={relation.strength === n}
                      aria-label={`${zh ? "强度" : "Strength"} ${n}`}
                      className="grid h-6 w-5 place-items-center"
                    >
                      <span
                        className={cn("block w-4 rounded-full", relation.strength >= n ? "bg-ink" : "bg-rule-strong")}
                        style={{ height: 0.8 + n * 0.7 }}
                      />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => update({ relationDrafts: metadata.relationDrafts.filter((_, at) => at !== index) })}
                    aria-label={zh ? "移除这条关系" : "Remove this relation"}
                    className="px-1 text-ink-3 hover:text-brick-ink"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-small text-ink-3 italic">
          {zh ? "还没有与其他标本的关系。" : "No ties to other specimens yet."}
        </p>
      )}
      <div className="relative max-w-md">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={zh ? "＋ 输入条目名、编号或学名，添加关系" : "+ type an entry, number or binomial to add a tie"}
          aria-label={zh ? "添加关系" : "Add a relation"}
          className="pw-field text-small"
        />
        {query.trim() ? (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xs border border-rule bg-paper-sheet py-1 shadow-lifted">
            {matches.length ? (
              matches.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={taken.has(`${e.id}:dependency`)}
                    onClick={() => {
                      update({
                        relationDrafts: [...metadata.relationDrafts, { to: e.id, kind: "dependency", strength: 1 }],
                      });
                      setQuery("");
                    }}
                    className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-small hover:bg-ink/5 disabled:opacity-45"
                  >
                    <span className="font-mono text-meta text-ink-3">{e.id}</span>
                    <span className="text-ink">{e.title[lang]}</span>
                    {e.species ? <i className="text-meta text-ink-3">{e.species}</i> : null}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-1.5 text-small text-ink-3 italic">
                {zh ? "没有匹配的条目。" : "No entry matches."}
              </li>
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function relationTone(kind: RelationKind) {
  return {
    symbiosis: "text-moss-ink",
    source: "text-indigo",
    taxonomy: "text-ink",
    contrast: "text-ink-2",
    dependency: "text-indigo",
    dispute: "text-brick-ink",
  }[kind];
}

/**
 * Plates: the species plate is the curators' (shown as accessioned, or as a
 * plate still being engraved); below, figures for the body — uploaded here,
 * reviewed with the revision, and placed in the text with one click.
 */
function PlatesSheet({
  lang,
  speciesPlate,
  assets,
  onUpload,
  onInsert,
}: {
  lang: Lang;
  speciesPlate: SpeciesPlateState;
  assets: Asset[];
  onUpload: (
    file: File,
    details: { altZh: string; altEn: string; credit: string; license: string },
  ) => Promise<Asset | null>;
  onInsert: (markdown: string) => void;
}) {
  const zh = lang === "zh";
  const [altZh, setAltZh] = useState("");
  const [altEn, setAltEn] = useState("");
  const [credit, setCredit] = useState("");
  const [license, setLicense] = useState("CC BY 4.0");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileId = useId();
  const plate = speciesPlate.plate;
  const ready = Boolean(file && altZh.trim() && altEn.trim() && credit.trim() && license.trim());

  return (
    <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {/* The species plate, as the curators keep it. */}
      <div className="min-w-0">
        <p className="pw-label">{zh ? "物种图版 · 由策展审定" : "Species plate · set by the curators"}</p>
        <div className="mt-2 flex gap-4">
          <div
            className={cn(
              "grid aspect-[4/3] w-32 shrink-0 place-items-center",
              plate ? "pw-print" : "pw-plate-pending [&>span]:!bg-transparent [&>span]:!p-0 [&>span]:!text-[0.625rem]",
            )}
          >
            {plate ? (
              // eslint-disable-next-line @next/next/no-img-element -- a small preview of an accessioned plate
              <img src={plate.src} alt={plate.alt} className="max-h-full max-w-full object-contain" />
            ) : (
              <span aria-hidden="true">{zh ? "待刻" : "pending"}</span>
            )}
          </div>
          <div className="min-w-0 text-small">
            {speciesPlate.species ? (
              <p className="font-display text-lead text-phylum-ink italic">{speciesPlate.species}</p>
            ) : (
              <p className="text-ink-3 italic">
                {zh ? "编目卡上尚未填物种。" : "No species on the catalogue card yet."}
              </p>
            )}
            <p className="mt-1 text-ink-2">
              {plate
                ? zh
                  ? "已入藏：读者在条目页看到这幅图版。"
                  : "Accessioned: readers see this plate on the entry page."
                : zh
                  ? "图版仍在绘制或审校中；通过后会自动出现在条目页。"
                  : "The plate is still being drawn or reviewed; it appears on the entry once it passes."}
            </p>
          </div>
        </div>
      </div>

      {/* Figures for the body. */}
      <div className="min-w-0">
        <p className="pw-label">{zh ? "正文插图 · 随版本审核" : "Figures in the text · reviewed with the revision"}</p>
        <div className="mt-2 grid gap-x-5 gap-y-3 sm:grid-cols-2">
          <label
            htmlFor={fileId}
            className="flex cursor-pointer items-center gap-3 rounded-xs border border-dashed border-rule-strong px-3 py-2.5 text-small text-ink-2 hover:border-ink hover:text-ink sm:col-span-2"
          >
            <span aria-hidden="true" className="font-display text-h4 leading-none text-ink-3">
              ⊕
            </span>
            <span className="min-w-0 truncate">
              {file
                ? file.name
                : zh
                  ? "选择一幅图（JPEG、PNG、WebP、AVIF）"
                  : "Choose an image (JPEG, PNG, WebP, AVIF)"}
            </span>
            <input
              id={fileId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="pw-label">{zh ? "图注 · 中文" : "Alt text · Chinese"}</span>
            <input
              value={altZh}
              onChange={(e) => setAltZh(e.target.value)}
              lang="zh-CN"
              className="pw-field text-small"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="pw-label">{zh ? "图注 · 英文" : "Alt text · English"}</span>
            <input value={altEn} onChange={(e) => setAltEn(e.target.value)} lang="en" className="pw-field text-small" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="pw-label">{zh ? "署名" : "Credit"}</span>
            <input value={credit} onChange={(e) => setCredit(e.target.value)} className="pw-field text-small" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="pw-label">{zh ? "许可" : "Licence"}</span>
            <input value={license} onChange={(e) => setLicense(e.target.value)} className="pw-field text-small" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={!ready || busy}
            onClick={async () => {
              if (!file) return;
              setBusy(true);
              try {
                const asset = await onUpload(file, { altZh, altEn, credit, license });
                if (asset) {
                  onInsert(`\n![${zh ? altZh : altEn}](asset:${asset.id})\n`);
                  setFile(null);
                  setAltZh("");
                  setAltEn("");
                }
              } finally {
                setBusy(false);
              }
            }}
            className="pw-stamp-button text-small [--draft:var(--phylum-ink)] disabled:opacity-40"
          >
            {zh ? "上传并插入 · INSERT" : "Upload & insert · 插入"}
          </button>
          <span className="text-meta text-ink-3">
            {ready
              ? zh
                ? "插入在正文光标处；新图标为待审，随版本一起审阅许可与署名。"
                : "Placed at the writing cursor; new figures stay pending and are reviewed with the revision."
              : zh
                ? "图注（中英）、署名与许可都要填写。"
                : "Both alt texts, a credit and a licence are required."}
          </span>
        </div>
        {assets.length ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-small text-ink-2 hover:text-ink">
              {zh ? `已有插图 · ${assets.length}` : `Figures on file · ${assets.length}`}
            </summary>
            <ul className="mt-2 grid max-h-64 gap-x-4 gap-y-1 overflow-y-auto sm:grid-cols-2">
              {assets.map((a) => (
                <li key={a.id} className="flex items-baseline gap-2 border-b border-rule py-1 text-small">
                  <span className="min-w-0 flex-1 truncate text-ink-2">{a.alt[lang] || a.id}</span>
                  <button
                    type="button"
                    onClick={() => onInsert(`\n![${a.alt[lang]}](asset:${a.id})\n`)}
                    className="shrink-0 text-meta text-phylum-ink hover:underline"
                  >
                    {zh ? "插入" : "Insert"}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}
