"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Code2, Heading2, Languages, Link2, Quote, Sigma } from "lucide-react";
import type {
  Asset,
  Author,
  DomainId,
  EntryMetadata,
  EntrySummary,
  Localized,
  ReviewState,
  Revision,
  Source,
  Tag,
} from "@/lib/model/types";
import { DOMAINS } from "@/lib/model/vocab";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown/Markdown";
import { MetadataPanel } from "@/components/editor/MetadataPanel";
import { StatusBadge } from "@/components/archive/StatusBadge";
import { KeyboardHint } from "@/components/archive/KeyboardHint";
import { NotebookSheet } from "@/components/writing/NotebookSheet";

export interface EditorOptions {
  sources: Source[];
  tags: Tag[];
  authors: Author[];
  entries: EntrySummary[];
  assets: Asset[];
}
export interface EditorInitial {
  title: Localized;
  summary: Localized;
  body: string;
  state: ReviewState;
  domain?: DomainId;
  metadata?: Partial<EntryMetadata>;
}

interface MarkdownEditorProps {
  initial: EditorInitial;
  entryId?: string;
  baseRevision?: number;
  options?: EditorOptions;
}
type Feedback = { kind: "ok" | "error"; text: string } | null;
type SyncState = "idle" | "saving" | "saved" | "offline" | "error";

const EMPTY_METADATA: EntryMetadata = {
  scale: "micro",
  role: "observer",
  contributorIds: [],
  sourceIds: [],
  tagIds: [],
  relationDrafts: [],
  pendingSources: [],
  pendingTags: [],
};

async function post<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error?.message ?? `HTTP ${response.status}`);
  return json as T;
}

function ToolButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-sm text-ink-2 hover:bg-ink/8 hover:text-ink"
    >
      {children}
    </button>
  );
}

export function MarkdownEditor({
  initial,
  entryId: initialEntryId,
  baseRevision,
  options = { sources: [], tags: [], authors: [], entries: [], assets: [] },
}: MarkdownEditorProps) {
  const { t, lang } = useI18n();
  const [titleEn, setTitleEn] = useState(initial.title.en);
  const [titleZh, setTitleZh] = useState(initial.title.zh);
  const [summaryEn, setSummaryEn] = useState(initial.summary.en);
  const [summaryZh, setSummaryZh] = useState(initial.summary.zh);
  const [body, setBody] = useState(initial.body);
  const [metadata, setMetadata] = useState<EntryMetadata>({
    ...EMPTY_METADATA,
    ...initial.metadata,
    contributorIds: initial.metadata?.contributorIds ?? [],
    sourceIds: initial.metadata?.sourceIds ?? [],
    tagIds: initial.metadata?.tagIds ?? [],
    relationDrafts: initial.metadata?.relationDrafts ?? [],
    pendingSources: initial.metadata?.pendingSources ?? [],
    pendingTags: initial.metadata?.pendingTags ?? [],
  });
  const [newSources, setNewSources] = useState("");
  const [newTags, setNewTags] = useState("");
  const [note, setNote] = useState("");
  const [pane, setPane] = useState<"write" | "preview">("write");
  const [previewMode, setPreviewMode] = useState<"zh" | "en" | "both">("both");
  const [entryId, setEntryId] = useState(initialEntryId);
  const [domain, setDomain] = useState<DomainId>(initial.domain ?? "algorithms");
  const [state, setState] = useState<ReviewState>(initial.state);
  const [revision, setRevision] = useState(baseRevision);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [uploadedAssets, setUploadedAssets] = useState<Asset[]>([]);
  const [ready, setReady] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const storageKey = `pioneer-wiki:working-draft:${initialEntryId ?? "new"}`;

  const snapshot = useMemo(
    () => ({
      entryId,
      title: { zh: titleZh, en: titleEn },
      summary: { zh: summaryZh, en: summaryEn },
      body,
      domain,
      metadata: {
        ...metadata,
        pendingSources: newSources
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        pendingTags: newTags
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      },
      baseRevision: revision,
    }),
    [body, domain, entryId, metadata, newSources, newTags, revision, summaryEn, summaryZh, titleEn, titleZh],
  );

  useEffect(() => {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const value = JSON.parse(cached) as typeof snapshot & { draftId?: string };
        if (
          value.body !== initial.body ||
          value.title?.zh !== initial.title.zh ||
          value.title?.en !== initial.title.en
        ) {
          const restore = window.confirm(
            lang === "zh" ? "发现尚未同步的本地草稿，是否恢复？" : "An unsynced local draft was found. Restore it?",
          );
          if (restore)
            window.setTimeout(() => {
              setTitleZh(value.title.zh);
              setTitleEn(value.title.en);
              setSummaryZh(value.summary.zh);
              setSummaryEn(value.summary.en);
              setBody(value.body);
              setDomain(value.domain);
              setMetadata({ ...EMPTY_METADATA, ...value.metadata });
              setNewSources(value.metadata.pendingSources.join("\n"));
              setNewTags(value.metadata.pendingTags.join(", "));
            }, 0);
        }
        if (value.draftId) window.setTimeout(() => setDraftId(value.draftId ?? null), 0);
      }
    } catch {
      /* Ignore malformed local recovery data. */
    }
    window.setTimeout(() => setReady(true), 0);
  }, [initial.body, initial.title.en, initial.title.zh, lang, storageKey]);

  useEffect(() => {
    if (!ready) return;
    const timeout = window.setTimeout(async () => {
      const next = { ...snapshot, savedAt: new Date().toISOString() };
      localStorage.setItem(storageKey, JSON.stringify({ ...next, draftId }));
      setSyncState("saving");
      try {
        const saved = await post<{ draftId?: string; savedAt?: string }>("/api/drafts/working", {
          id: draftId,
          entryId,
          baseRevision: revision,
          payload: next,
        });
        if (saved.draftId) {
          setDraftId(saved.draftId);
          localStorage.setItem(storageKey, JSON.stringify({ ...next, draftId: saved.draftId }));
        }
        setLastSavedAt(saved.savedAt ?? next.savedAt);
        setSyncState("saved");
      } catch {
        setSyncState("offline");
      }
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [
    body,
    domain,
    draftId,
    entryId,
    metadata,
    newSources,
    newTags,
    ready,
    revision,
    snapshot,
    storageKey,
    summaryEn,
    summaryZh,
    titleEn,
    titleZh,
  ]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!titleZh.trim()) errors.push(lang === "zh" ? "缺少中文标题" : "Chinese title is required");
    if (!titleEn.trim()) errors.push(lang === "zh" ? "缺少英文标题" : "English title is required");
    if (!summaryZh.trim()) errors.push(lang === "zh" ? "缺少中文摘要" : "Chinese summary is required");
    if (!summaryEn.trim()) errors.push(lang === "zh" ? "缺少英文摘要" : "English summary is required");
    if (!body.includes(":::zh")) errors.push(lang === "zh" ? "正文缺少 :::zh 双语块" : "Body is missing a :::zh block");
    if (!body.includes(":::en")) errors.push(lang === "zh" ? "正文缺少 :::en 双语块" : "Body is missing a :::en block");
    if (metadata.relationDrafts.some((relation) => !relation.to))
      errors.push(lang === "zh" ? "关系中存在未选择的目标" : "A relation is missing its target");
    return errors;
  }, [body, lang, metadata.relationDrafts, summaryEn, summaryZh, titleEn, titleZh]);

  const saveDraft = useCallback(
    async (quiet = false) => {
      if (busy) return null;
      setBusy(true);
      if (!quiet) setFeedback(null);
      try {
        const rev = await post<Revision>("/api/drafts", {
          entryId,
          domain: entryId ? undefined : domain,
          title: { zh: titleZh, en: titleEn },
          summary: { zh: summaryZh, en: summaryEn },
          body,
          note: note || (lang === "zh" ? "保存版本" : "Save revision"),
          baseRevision: revision,
          metadata,
        });
        setEntryId(rev.entryId);
        setState(rev.state);
        setRevision(rev.number);
        setNote("");
        setLastSavedAt(new Date().toISOString());
        setSyncState("saved");
        localStorage.removeItem(storageKey);
        if (!quiet) setFeedback({ kind: "ok", text: `${t("editor.saveDraft")} · r${rev.number}` });
        return rev;
      } catch (error) {
        if (!quiet) setFeedback({ kind: "error", text: error instanceof Error ? error.message : String(error) });
        return null;
      } finally {
        setBusy(false);
      }
    },
    [
      body,
      busy,
      domain,
      entryId,
      lang,
      metadata,
      note,
      revision,
      storageKey,
      summaryEn,
      summaryZh,
      t,
      titleEn,
      titleZh,
    ],
  );

  const submit = useCallback(async () => {
    if (busy || validationErrors.length) {
      setFeedback({ kind: "error", text: validationErrors.join(" · ") });
      return;
    }
    const saved = await saveDraft(true);
    if (!saved) {
      setFeedback({
        kind: "error",
        text:
          lang === "zh" ? "版本保存失败，未提交审核。" : "The revision could not be saved, so it was not submitted.",
      });
      return;
    }
    const target = saved.entryId;
    setBusy(true);
    setFeedback(null);
    try {
      const rev = await post<Revision>(`/api/entries/${encodeURIComponent(target)}/transition`, {
        action: "submit",
        note: note || undefined,
      });
      setState(rev.state);
      setRevision(rev.number);
      setFeedback({ kind: "ok", text: `${t("editor.submit")} · r${rev.number}` });
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }, [busy, entryId, lang, note, saveDraft, t, validationErrors]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveDraft();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveDraft]);

  const insert = (before: string, after = "", placeholder = "") => {
    const area = textareaRef.current;
    if (!area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const selected = body.slice(start, end) || placeholder;
    const next = `${body.slice(0, start)}${before}${selected}${after}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      area.focus();
      const cursor = start + before.length + selected.length + after.length;
      area.setSelectionRange(cursor, cursor);
    });
  };
  const uploadAsset = async (
    file: File,
    details: { altZh: string; altEn: string; credit: string; license: string },
  ) => {
    const form = new FormData();
    form.set("file", file);
    form.set("altZh", details.altZh);
    form.set("altEn", details.altEn);
    form.set("credit", details.credit);
    form.set("license", details.license);
    setSyncState("saving");
    try {
      const response = await fetch("/api/assets/upload", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
      const asset = payload.asset as Asset;
      setUploadedAssets((current) => [...current, asset]);
      setMetadata((current) => ({ ...current, heroAssetId: asset.id }));
      setFeedback({
        kind: "ok",
        text: lang === "zh" ? "插图已上传，等待审核。" : "Illustration uploaded and awaiting review.",
      });
      setSyncState("saved");
    } catch (error) {
      setSyncState("offline");
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    }
  };
  const toolbar = (
    <div className="flex flex-wrap items-center gap-1 border-b border-rule px-3 py-2">
      <ToolButton
        label={lang === "zh" ? "插入二级标题" : "Insert heading"}
        onClick={() => insert("## ", "", lang === "zh" ? "章节标题" : "Section heading")}
      >
        <Heading2 className="size-4" />
      </ToolButton>
      <ToolButton
        label={lang === "zh" ? "插入链接" : "Insert link"}
        onClick={() => insert("[", "](https://)", lang === "zh" ? "链接文字" : "link text")}
      >
        <Link2 className="size-4" />
      </ToolButton>
      <ToolButton label={lang === "zh" ? "插入代码" : "Insert code"} onClick={() => insert("```\n", "\n```", "code")}>
        <Code2 className="size-4" />
      </ToolButton>
      <ToolButton label={lang === "zh" ? "插入数学公式" : "Insert math"} onClick={() => insert("$", "$", "x")}>
        <Sigma className="size-4" />
      </ToolButton>
      <ToolButton
        label={lang === "zh" ? "插入引用" : "Insert quote"}
        onClick={() => insert("> ", "", lang === "zh" ? "引用" : "quote")}
      >
        <Quote className="size-4" />
      </ToolButton>
      <ToolButton
        label={lang === "zh" ? "插入双语块" : "Insert bilingual block"}
        onClick={() =>
          insert(":::zh\n", "\n:::\n\n:::en\nEnglish text\n:::", lang === "zh" ? "中文文本" : "Chinese text")
        }
      >
        <Languages className="size-4" />
      </ToolButton>
      <span className="ml-auto text-meta text-ink-3">{lang === "zh" ? "工具栏 · Markdown" : "Toolbar · Markdown"}</span>
    </div>
  );
  const syncLabel =
    syncState === "saving"
      ? lang === "zh"
        ? "同步中…"
        : "Syncing…"
      : syncState === "saved"
        ? lang === "zh"
          ? `已同步${lastSavedAt ? ` · ${new Date(lastSavedAt).toLocaleTimeString()}` : ""}`
          : "Saved"
        : syncState === "offline"
          ? lang === "zh"
            ? "离线 · 已保存在本机"
            : "Offline · saved locally"
          : "";
  return (
    <div className="flex flex-col gap-(--space-block)">
      <div className="flex flex-col gap-5">
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <label className="flex min-h-28 flex-col gap-1.5">
            <span className="font-mono text-small tracking-[0.14em] text-ink-2 uppercase">{t("editor.title.en")}</span>
            <input
              value={titleEn}
              onChange={(event) => setTitleEn(event.target.value)}
              lang="en"
              placeholder="Gossip protocol"
              className="pw-field h-20 font-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-tight tracking-[-0.02em]"
            />
          </label>
          <label className="flex min-h-28 flex-col gap-1.5">
            <span className="font-mono text-small tracking-[0.14em] text-ink-2">{t("editor.title.zh")}</span>
            <input
              value={titleZh}
              onChange={(event) => setTitleZh(event.target.value)}
              lang="zh-CN"
              placeholder="流言协议"
              className="pw-field h-20 font-display text-h3"
            />
          </label>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <label className="flex min-h-32 flex-col gap-1.5">
            <span className="text-meta text-ink-3">{lang === "zh" ? "中文摘要" : "Chinese summary"}</span>
            <textarea
              value={summaryZh}
              onChange={(event) => setSummaryZh(event.target.value)}
              className="pw-field h-24 resize-y"
            />
          </label>
          <label className="flex min-h-32 flex-col gap-1.5">
            <span className="text-meta text-ink-3">English summary</span>
            <textarea
              value={summaryEn}
              onChange={(event) => setSummaryEn(event.target.value)}
              className="pw-field h-24 resize-y"
            />
          </label>
        </div>
      </div>
      <MetadataPanel
        metadata={metadata}
        onChange={setMetadata}
        domain={domain}
        onDomainChange={setDomain}
        lang={lang}
        sources={options.sources}
        tags={options.tags}
        authors={options.authors}
        entries={options.entries}
        assets={[...options.assets, ...uploadedAssets]}
        newSources={newSources}
        newTags={newTags}
        onNewSourcesChange={setNewSources}
        onNewTagsChange={setNewTags}
        onUpload={uploadAsset}
      />
      <div
        role="tablist"
        aria-label={`${t("editor.write")} / ${t("editor.preview")}`}
        className="flex gap-5 border-b border-rule lg:hidden"
      >
        {(["write", "preview"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={pane === value}
            onClick={() => setPane(value)}
            className={cn(
              "-mb-px border-b py-2 text-small",
              pane === value ? "border-brick text-ink" : "border-transparent text-ink-3",
            )}
          >
            {t(value === "write" ? "editor.write" : "editor.preview")}
          </button>
        ))}
      </div>
      <div className="grid gap-(--space-block) lg:grid-cols-2">
        <section className={cn("min-w-0", pane !== "write" && "max-lg:hidden")}>
          <div className="pw-notebook overflow-hidden">
            <div className="pw-notebook-sheet">
              {toolbar}
              <NotebookSheet
                value={body}
                onChange={setBody}
                lang={lang}
                mono
                label={lang === "zh" ? "田野笔记 · 撰写" : "Field notes · Writing"}
                head={[
                  [lang === "zh" ? "编号" : "No.", entryId ?? (lang === "zh" ? "新条目" : "new")],
                  ...(entryId
                    ? []
                    : ([[lang === "zh" ? "门" : "Phylum", DOMAINS[domain][lang]]] as [string, string][])),
                  [lang === "zh" ? "年轮" : "Ring", revision ? `r${revision}` : "r1"],
                  [lang === "zh" ? "日期" : "Date", today],
                ]}
                hint={
                  lang === "zh"
                    ? "Markdown · 双语块 :::zh / :::en · Ctrl/⌘-S 保存版本"
                    : "Markdown · bilingual blocks :::zh / :::en · Ctrl/⌘-S saves"
                }
                textareaRef={textareaRef}
                className="min-h-[64vh]"
              />
            </div>
          </div>
        </section>
        <section aria-label={t("editor.preview")} className={cn("relative", pane !== "preview" && "max-lg:hidden")}>
          <div className="mb-3 flex items-center gap-4 border-b border-rule text-small">
            {(["zh", "en", "both"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPreviewMode(value)}
                aria-current={previewMode === value ? "page" : undefined}
                className={cn(
                  "-mb-px border-b py-2",
                  previewMode === value ? "border-brick text-ink" : "border-transparent text-ink-3",
                )}
              >
                {value === "zh" ? "中文" : value === "en" ? "English" : lang === "zh" ? "双语" : "Both"}
              </button>
            ))}
          </div>
          <div
            className={cn(
              "pw-proof min-h-[64vh] px-6 pt-14 pb-10 sm:px-12",
              previewMode === "both" && "grid gap-8 lg:grid-cols-2",
            )}
          >
            {previewMode !== "en" ? (
              <div>
                <p className="mb-8 font-mono text-meta text-ink-3">
                  {lang === "zh" ? "校样 · 中文" : "Proof · Chinese"}
                </p>
                <h2 className="mb-8 font-display">
                  <span className="block text-h1 leading-none font-[480]">{titleZh}</span>
                </h2>
                <Markdown lang="zh">{body}</Markdown>
              </div>
            ) : null}
            {previewMode !== "zh" ? (
              <div>
                <p className="mb-8 font-mono text-meta text-ink-3">Proof · English</p>
                <h2 className="mb-8 font-display">
                  <span className="block text-h1 leading-none font-[480]">{titleEn}</span>
                </h2>
                <Markdown lang="en">{body}</Markdown>
              </div>
            ) : null}
          </div>
        </section>
      </div>
      {validationErrors.length ? (
        <div className="pw-sheet border-brick/40 p-4 text-small text-brick-ink">
          <p className="font-medium">{lang === "zh" ? "提交前需要补齐：" : "Before submitting:"}</p>
          <ul className="mt-2 list-disc pl-5">
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div
        aria-busy={busy || undefined}
        className="pw-ink-over sticky bottom-0 z-10 -mx-4 flex flex-wrap items-end gap-4 bg-paper/95 px-4 pb-4 sm:-mx-6 sm:px-6"
      >
        <StatusBadge state={state} lang={lang} showForm />
        {revision ? <span className="font-mono text-meta text-ink-3">r{revision}</span> : null}
        <span className="text-meta text-ink-3" aria-live="polite">
          {syncLabel}
        </span>
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="sr-only">{t("editor.note")}</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("editor.notePlaceholder")}
            className="pw-field h-9 text-small"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || state !== "draft"}
            className="h-9 rounded-sm border border-rule-strong px-3 text-small text-ink hover:bg-ink/5 disabled:opacity-45"
          >
            {t("editor.submit")}
          </button>
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={busy}
            className="h-9 rounded-sm bg-ink px-4 text-paper-sheet hover:bg-ink-2 disabled:opacity-45"
          >
            {t("editor.saveDraft")}
          </button>
          <KeyboardHint keys={["Ctrl", "S"]} className="hidden sm:inline-flex" />
        </div>
        <p
          role={feedback?.kind === "error" ? "alert" : "status"}
          className={cn("w-full text-meta", feedback?.kind === "error" ? "text-brick-ink" : "text-ink-3")}
        >
          {feedback?.text ?? ""}
        </p>
      </div>
    </div>
  );
}
