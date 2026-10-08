"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Code2, Heading2, Languages, Link2, Quote, Sigma } from "lucide-react";
import type {
  Asset,
  Author,
  Category,
  EntryMetadata,
  EntrySummary,
  Family,
  Localized,
  ReviewState,
  Revision,
  Source,
  Tag,
} from "@/lib/model/types";
import type { WorkingDraft, WorkingDraftResult } from "@/lib/services/contracts";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown/Markdown";
import { MetadataPanel, type SpeciesPlateState } from "@/components/editor/MetadataPanel";
import { FilingCard } from "@/components/editor/FilingCard";
import { StatusBadge } from "@/components/archive/StatusBadge";
import { KeyboardHint } from "@/components/archive/KeyboardHint";
import { NotebookSheet } from "@/components/writing/NotebookSheet";
import { api, ApiError, failureText, useLeaveGuard } from "@/components/admin/actions";

export interface EditorOptions {
  sources: Source[];
  tags: Tag[];
  authors: Author[];
  entries: EntrySummary[];
  assets: Asset[];
  /** The catalogue to file the entry in (active taxa only). */
  families: Family[];
  categories: Category[];
  /** Accessioned species plates by entry slug (public/catalogue/plates.json). */
  speciesPlates?: Record<string, { src: string; width: number; height: number; alt: Localized }>;
}
export interface EditorInitial {
  title: Localized;
  summary: Localized;
  body: string;
  state: ReviewState;
  /** The catalogue place travels inside metadata, with the rest of the draft contract. */
  metadata?: Partial<EntryMetadata>;
}
/** Where the entry is in its workflow when the editor opens. */
export interface EditorWorkflow {
  status: ReviewState;
  latestRevision: number;
  publishedRevision?: number;
  returnNote?: string;
  archived: boolean;
  /** The older revision this session started from, when opened from the history. */
  startedFrom?: number;
}

interface MarkdownEditorProps {
  initial: EditorInitial;
  /** Local recovery copies belong to one account and never surface for another. */
  accountId: string;
  admin?: boolean;
  entryId?: string;
  /** The entry's slug, for its species plate; absent for a new entry. */
  slug?: string;
  baseRevision?: number;
  workflow?: EditorWorkflow;
  /** This account's autosaved working copy on the server, for recovery on another device. */
  serverDraft?: WorkingDraft | null;
  options?: EditorOptions;
}

type Feedback = { kind: "ok" | "error"; text: string } | null;
type Sync =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; at: string }
  | { state: "local"; reason: "offline" | "expired" | "forbidden" | "error"; detail?: string }
  | { state: "quota" };

interface Payload {
  title: Localized;
  summary: Localized;
  body: string;
  metadata: EntryMetadata;
  note?: string;
}
type Candidate = { source: "local" | "server"; savedAt: string; payload: Payload };
type FieldKey = "titleZh" | "titleEn" | "summaryZh" | "summaryEn" | "body" | "genus" | "relations";

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
  level: "concept",
  contentRole: "foundation",
};
const FIELD_ID: Record<FieldKey, string> = {
  titleZh: "ed-title-zh",
  titleEn: "ed-title-en",
  summaryZh: "ed-summary-zh",
  summaryEn: "ed-summary-en",
  body: "ed-body",
  genus: "ed-filing",
  relations: "ed-metadata",
};

const normalize = (metadata: Partial<EntryMetadata> | undefined): EntryMetadata => ({
  ...EMPTY_METADATA,
  ...metadata,
  contributorIds: metadata?.contributorIds ?? [],
  sourceIds: metadata?.sourceIds ?? [],
  tagIds: metadata?.tagIds ?? [],
  relationDrafts: metadata?.relationDrafts ?? [],
  pendingSources: metadata?.pendingSources ?? [],
  pendingTags: metadata?.pendingTags ?? [],
  auxiliaryCategoryIds: metadata?.auxiliaryCategoryIds ?? [],
});
const lines = (value: string, split: RegExp) =>
  value
    .split(split)
    .map((item) => item.trim())
    .filter(Boolean);
const readPayload = (value: unknown): Payload | null => {
  const p = value as Partial<Payload> | null;
  if (!p || typeof p !== "object" || typeof p.body !== "string" || !p.title || !p.summary) return null;
  return { title: p.title, summary: p.summary, body: p.body, metadata: normalize(p.metadata), note: p.note };
};

function ToolButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-sm text-ink-2 hover:bg-ink/8 hover:text-ink"
    >
      {children}
    </button>
  );
}

function SectionHead({ id, number, title, hint }: { id: string; number: string; title: string; hint?: string }) {
  return (
    <div id={id} className="pw-double-rule flex scroll-mt-[calc(var(--shell-header)+1rem)] flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="font-letterpress text-h4 text-brick-ink">{number}</span>
      <h2 className="font-display text-h3 text-ink">{title}</h2>
      {hint ? <p className="w-full text-small text-ink-3 sm:ml-auto sm:w-auto">{hint}</p> : null}
    </div>
  );
}

export function MarkdownEditor({
  initial,
  accountId,
  admin = false,
  entryId: initialEntryId,
  slug: initialSlug,
  baseRevision,
  workflow,
  serverDraft,
  options = { sources: [], tags: [], authors: [], entries: [], assets: [], families: [], categories: [], speciesPlates: {} },
}: MarkdownEditorProps) {
  const { t, lang } = useI18n();
  const zh = lang === "zh";
  const [titleEn, setTitleEn] = useState(initial.title.en);
  const [titleZh, setTitleZh] = useState(initial.title.zh);
  const [summaryEn, setSummaryEn] = useState(initial.summary.en);
  const [summaryZh, setSummaryZh] = useState(initial.summary.zh);
  const [body, setBody] = useState(initial.body);
  const [metadata, setMetadata] = useState<EntryMetadata>(normalize(initial.metadata));
  const [newSources, setNewSources] = useState((initial.metadata?.pendingSources ?? []).join("\n"));
  const [newTags, setNewTags] = useState((initial.metadata?.pendingTags ?? []).join(", "));
  const [note, setNote] = useState("");
  const [pane, setPane] = useState<"write" | "preview">("write");
  const [previewMode, setPreviewMode] = useState<"zh" | "en" | "both">("both");
  const [entryId, setEntryId] = useState(initialEntryId);
  const [slug, setSlug] = useState(initialSlug);
  const [state, setState] = useState<ReviewState>(workflow?.status ?? initial.state);
  const [returnNote, setReturnNote] = useState(workflow?.returnNote);
  const [revision, setRevision] = useState(baseRevision);
  const [busy, setBusy] = useState<"save" | "submit" | "withdraw" | "upload" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [sync, setSync] = useState<Sync>({ state: "idle" });
  const [recovery, setRecovery] = useState<Candidate | null>(null);
  const [conflict, setConflict] = useState<{ savedAt: string; version: number; payload: Payload } | null>(null);
  const [otherTab, setOtherTab] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [uploadedAssets, setUploadedAssets] = useState<Asset[]>([]);
  const [ready, setReady] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const draftId = useRef<string | undefined>(serverDraft?.id);
  const draftVersion = useRef<number | undefined>(serverDraft?.version);
  const inflight = useRef(false);
  const again = useRef(false);
  const tabId = useRef(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()));
  const channel = useRef<BroadcastChannel | null>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const archived = Boolean(workflow?.archived);
  const storageKey = `pioneer-wiki:draft:${accountId}:${initialEntryId ?? "new"}`;

  const payload: Payload = useMemo(
    () => ({
      title: { zh: titleZh, en: titleEn },
      summary: { zh: summaryZh, en: summaryEn },
      body,
      metadata: { ...metadata, pendingSources: lines(newSources, /\n/), pendingTags: lines(newTags, /[,，]/) },
      note,
    }),
    [body, metadata, newSources, newTags, note, summaryEn, summaryZh, titleEn, titleZh],
  );
  const serialized = useMemo(() => JSON.stringify({ ...payload, note: undefined }), [payload]);
  const initialSerialized = useMemo(
    () =>
      JSON.stringify({
        title: initial.title,
        summary: initial.summary,
        body: initial.body,
        metadata: normalize(initial.metadata),
      }),
    [initial],
  );
  /** What the last saved revision holds, and what the server's working copy holds. */
  const savedRef = useRef(initialSerialized);
  const syncedRef = useRef(initialSerialized);

  const apply = useCallback((value: Payload) => {
    setTitleZh(value.title.zh);
    setTitleEn(value.title.en);
    setSummaryZh(value.summary.zh);
    setSummaryEn(value.summary.en);
    setBody(value.body);
    setMetadata(normalize(value.metadata));
    setNewSources(value.metadata.pendingSources.join("\n"));
    setNewTags(value.metadata.pendingTags.join(", "));
  }, []);

  // ── Recovery: the newest copy that differs from what the page opened with ──
  useEffect(() => {
    const candidates: Candidate[] = [];
    try {
      const cached = JSON.parse(localStorage.getItem(storageKey) ?? "null") as { savedAt?: string; payload?: unknown } | null;
      const local = readPayload(cached?.payload);
      if (local && cached?.savedAt) candidates.push({ source: "local", savedAt: cached.savedAt, payload: local });
    } catch {
      // A private window, blocked storage or a malformed copy: nothing to recover locally.
    }
    const server = readPayload(serverDraft?.payload);
    if (server && serverDraft) candidates.push({ source: "server", savedAt: serverDraft.savedAt, payload: server });
    const differs = (c: Candidate) =>
      JSON.stringify({ title: c.payload.title, summary: c.payload.summary, body: c.payload.body, metadata: c.payload.metadata }) !==
      initialSerialized;
    const newest = candidates.filter(differs).sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
    if (newest && !archived) window.setTimeout(() => setRecovery(newest), 0);
    window.setTimeout(() => setReady(true), 0);
  }, [archived, initialSerialized, serverDraft, storageKey]);

  // ── Other tabs editing the same entry ──
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(`pioneer-wiki:${storageKey}`);
    bc.onmessage = (event) => {
      if (event.data?.tab && event.data.tab !== tabId.current) setOtherTab(true);
    };
    channel.current = bc;
    return () => bc.close();
  }, [storageKey]);

  // ── Autosave: local copy at once, server copy after a pause, one request at a time ──
  const flush = useCallback(async () => {
    if (inflight.current) {
      again.current = true;
      return;
    }
    const sending = serialized;
    if (sending === syncedRef.current) return;
    inflight.current = true;
    setSync({ state: "saving" });
    try {
      const result = await api<WorkingDraftResult>("/api/drafts/working", "POST", {
        id: draftId.current,
        entryId,
        baseRevision: revision,
        payload: { ...payload, savedAt: new Date().toISOString() },
        knownVersion: draftVersion.current,
      });
      draftId.current = result.id;
      if (result.conflict) {
        const theirs = readPayload(result.payload);
        if (theirs) setConflict({ savedAt: result.savedAt, version: result.version, payload: theirs });
        setSync({ state: "idle" });
      } else {
        draftVersion.current = result.version;
        syncedRef.current = sending;
        setSync({ state: "saved", at: result.savedAt });
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setSync({ state: "local", reason: "expired" });
      else if (error instanceof ApiError && error.status === 403) setSync({ state: "local", reason: "forbidden", detail: error.message });
      else if (error instanceof ApiError && error.status === 0) setSync({ state: "local", reason: "offline" });
      else setSync({ state: "local", reason: "error", detail: failureText(error, lang) });
    } finally {
      inflight.current = false;
      if (again.current) {
        again.current = false;
        window.setTimeout(() => void flushRef.current(), 400);
      }
    }
  }, [entryId, lang, payload, revision, serialized]);
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    if (!ready || recovery || conflict || archived || serialized === syncedRef.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ savedAt: new Date().toISOString(), payload }));
      channel.current?.postMessage({ tab: tabId.current });
    } catch {
      window.setTimeout(() => setSync({ state: "quota" }), 0);
    }
    const timer = window.setTimeout(() => void flushRef.current(), 1500);
    return () => window.clearTimeout(timer);
  }, [archived, conflict, payload, ready, recovery, serialized, storageKey]);

  const unsynced = ready && serialized !== syncedRef.current && serialized !== savedRef.current;
  useLeaveGuard(
    unsynced,
    zh ? "还有内容没有同步到服务器（已保存在本机）。确定离开吗？" : "Some changes are not synced yet (they are kept on this device). Leave anyway?",
  );

  // ── Validation for submission ──
  const errors = useMemo(() => {
    const list: Array<{ field: FieldKey; text: string }> = [];
    if (!titleZh.trim()) list.push({ field: "titleZh", text: zh ? "缺少中文标题" : "The Chinese title is missing" });
    if (!titleEn.trim()) list.push({ field: "titleEn", text: zh ? "缺少英文标题" : "The English title is missing" });
    if (!summaryZh.trim()) list.push({ field: "summaryZh", text: zh ? "缺少中文摘要" : "The Chinese summary is missing" });
    if (!summaryEn.trim()) list.push({ field: "summaryEn", text: zh ? "缺少英文摘要" : "The English summary is missing" });
    if (!/(^|\n):::zh/.test(body)) list.push({ field: "body", text: zh ? "正文缺少 :::zh 中文块" : "The body has no :::zh block" });
    if (!/(^|\n):::en/.test(body)) list.push({ field: "body", text: zh ? "正文缺少 :::en 英文块" : "The body has no :::en block" });
    if (!metadata.categoryId) list.push({ field: "genus", text: zh ? "还没有选择门类" : "Choose the genus it is filed under" });
    const genus = options.categories.find((c) => c.id === metadata.categoryId);
    if (genus && metadata.species && !metadata.species.startsWith(`${genus.scientificName} `))
      list.push({ field: "genus", text: zh ? `物种学名须属于 ${genus.scientificName} 属` : `The species must belong to ${genus.scientificName}` });
    if (metadata.relationDrafts.some((relation) => !relation.to))
      list.push({ field: "relations", text: zh ? "有关系没有选择目标条目" : "A relation has no target" });
    return list;
  }, [body, metadata.categoryId, metadata.relationDrafts, metadata.species, options.categories, summaryEn, summaryZh, titleEn, titleZh, zh]);
  const invalid = (field: FieldKey) => showErrors && errors.some((e) => e.field === field);
  const goTo = (field: FieldKey) => {
    const target = field === "body" ? textareaRef.current : document.getElementById(FIELD_ID[field]);
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
    (target as HTMLElement | null)?.focus?.({ preventScroll: true });
  };

  // ── Explicit saves and lifecycle ──
  const saveRevision = useCallback(
    async (quiet = false): Promise<(Revision & { withdrewReview?: boolean; slug?: string }) | null> => {
      if (busy || archived) return null;
      if (!titleZh.trim() && !titleEn.trim()) {
        setShowErrors(true);
        setFeedback({ kind: "error", text: zh ? "保存前至少填写一个标题。" : "Give the entry a title before saving." });
        goTo("titleZh");
        return null;
      }
      setBusy("save");
      if (!quiet) setFeedback(null);
      const sending = serialized;
      try {
        const saved = await api<Revision & { withdrewReview?: boolean; slug?: string }>("/api/drafts", "POST", {
          entryId,
          title: payload.title,
          summary: payload.summary,
          body,
          note: note || (zh ? "保存修订" : "Save revision"),
          baseRevision: revision,
          metadata: payload.metadata,
        });
        savedRef.current = sending;
        syncedRef.current = sending;
        setEntryId(saved.entryId);
        setState("draft");
        setRevision(saved.number);
        setNote("");
        if (saved.slug && !slug) {
          setSlug(saved.slug);
          window.history.replaceState(null, "", `/editor/${saved.slug}`);
        }
        try {
          localStorage.removeItem(storageKey);
        } catch {
          // Nothing to clear.
        }
        if (draftId.current) void api(`/api/drafts/working/${draftId.current}`, "DELETE").catch(() => undefined);
        draftId.current = undefined;
        draftVersion.current = undefined;
        setSync({ state: "saved", at: new Date().toISOString() });
        if (!quiet)
          setFeedback({
            kind: "ok",
            text: saved.withdrewReview
              ? zh
                ? `已保存为 r${saved.number}。之前的审核提交已撤回，需要时请重新提交。`
                : `Saved as r${saved.number}. The earlier submission was withdrawn; submit again when ready.`
              : zh
                ? `已保存为草稿修订 r${saved.number}。读者看到的公开版本没有变化。`
                : `Saved as draft revision r${saved.number}. The public version is unchanged.`,
          });
        return saved;
      } catch (error) {
        if (error instanceof ApiError && error.reason === "revision_conflict")
          setFeedback({
            kind: "error",
            text: zh
              ? "这篇条目在你打开后有了新修订（可能来自另一个标签页或管理员）。你的内容仍在编辑器和本机，请先复制必要部分，再刷新页面。"
              : "A newer revision was saved since you opened this (another tab or an administrator). Your text is still here and on this device; copy what you need, then refresh.",
          });
        else setFeedback({ kind: "error", text: failureText(error, lang) });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [archived, body, busy, entryId, lang, note, payload, revision, serialized, slug, storageKey, titleEn, titleZh, zh],
  );

  const submit = useCallback(async () => {
    if (busy || archived) return;
    setShowErrors(true);
    if (errors.length) {
      setFeedback({ kind: "error", text: zh ? `提交前还有 ${errors.length} 处需要补齐（见下方清单）。` : `${errors.length} things to fix before submitting (listed below).` });
      goTo(errors[0].field);
      return;
    }
    const target = serialized !== savedRef.current || !entryId ? await saveRevision(true) : { entryId };
    if (!target) return;
    setBusy("submit");
    try {
      const submitted = await api<Revision>(`/api/entries/${encodeURIComponent(target.entryId!)}/transition`, "POST", {
        action: "submit",
        note: note || undefined,
      });
      setState("in_review");
      setReturnNote(undefined);
      setRevision(submitted.number);
      setFeedback({
        kind: "ok",
        text: zh ? `已提交审核（r${submitted.number}）。管理员发布前，公开页面保持不变。` : `Submitted for review (r${submitted.number}). Public pages stay as they are until an administrator publishes.`,
      });
    } catch (error) {
      setFeedback({ kind: "error", text: failureText(error, lang) });
    } finally {
      setBusy(null);
    }
  }, [archived, busy, entryId, errors, lang, note, saveRevision, serialized, zh]);

  const withdraw = useCallback(async () => {
    if (!entryId || busy) return;
    setBusy("withdraw");
    try {
      await api(`/api/entries/${encodeURIComponent(entryId)}/transition`, "POST", { action: "withdraw" });
      setState("draft");
      setFeedback({ kind: "ok", text: zh ? "已撤回审核提交，条目回到草稿。" : "Submission withdrawn; the entry is a draft again." });
    } catch (error) {
      setFeedback({ kind: "error", text: failureText(error, lang) });
    } finally {
      setBusy(null);
    }
  }, [busy, entryId, lang, zh]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveRevision();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveRevision]);

  // ── Writing helpers ──
  const insert = (before: string, after = "", placeholder = "") => {
    const area = textareaRef.current;
    if (!area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const selected = body.slice(start, end) || placeholder;
    setBody(`${body.slice(0, start)}${before}${selected}${after}${body.slice(end)}`);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };
  /** Put Markdown at the writing cursor (or at the end, when the notebook has not been focused). */
  const insertAtCursor = (markdown: string) => {
    const area = textareaRef.current;
    const at = area ? area.selectionStart : body.length;
    setBody(`${body.slice(0, at)}${markdown}${body.slice(at)}`);
    requestAnimationFrame(() => {
      if (!area) return;
      area.focus();
      area.setSelectionRange(at + markdown.length, at + markdown.length);
    });
  };
  const uploadAsset = async (file: File, details: { altZh: string; altEn: string; credit: string; license: string }): Promise<Asset | null> => {
    const form = new FormData();
    form.set("file", file);
    form.set("altZh", details.altZh);
    form.set("altEn", details.altEn);
    form.set("credit", details.credit);
    form.set("license", details.license);
    setBusy("upload");
    try {
      const { asset } = await api<{ asset: Asset }>("/api/assets/upload", "POST", form);
      setUploadedAssets((current) => [...current, asset]);
      setFeedback({
        kind: "ok",
        text: zh ? "插图已上传并插入正文。它在管理员批准之前只有你和管理员能看到；批准后条目才能发布。" : "Figure uploaded and placed. Until an administrator approves it, only you and administrators can see it, and the entry cannot be published.",
      });
      return asset;
    } catch (error) {
      setFeedback({ kind: "error", text: failureText(error, lang) });
      return null;
    } finally {
      setBusy(null);
    }
  };
  const speciesPlate: SpeciesPlateState = {
    species: metadata.species,
    plate: (() => {
      const p = slug ? options.speciesPlates?.[slug] : undefined;
      return p ? { src: p.src, width: p.width, height: p.height, alt: p.alt[lang] } : null;
    })(),
  };
  /** Figures the body may reference as asset:<id>, for the proof beside the notebook. */
  const figureMap = Object.fromEntries([...options.assets, ...uploadedAssets].map((a) => [a.id, a]));
  const words = body.replace(/:::(zh|en)?/g, "").replace(/\s+/g, " ").trim();

  const toolbar = (
    <div role="toolbar" aria-label={zh ? "Markdown 工具栏" : "Markdown toolbar"} className="flex flex-wrap items-center gap-1 border-b border-rule px-3 py-1.5">
      <ToolButton label={zh ? "插入二级标题" : "Insert heading"} onClick={() => insert("## ", "", zh ? "章节标题" : "Section heading")}>
        <Heading2 className="size-4" />
      </ToolButton>
      <ToolButton label={zh ? "插入链接" : "Insert link"} onClick={() => insert("[", "](https://)", zh ? "链接文字" : "link text")}>
        <Link2 className="size-4" />
      </ToolButton>
      <ToolButton label={zh ? "插入代码块" : "Insert code block"} onClick={() => insert("```\n", "\n```", "code")}>
        <Code2 className="size-4" />
      </ToolButton>
      <ToolButton label={zh ? "插入数学公式" : "Insert math"} onClick={() => insert("$", "$", "x")}>
        <Sigma className="size-4" />
      </ToolButton>
      <ToolButton label={zh ? "插入引用" : "Insert quote"} onClick={() => insert("> ", "", zh ? "引用" : "quote")}>
        <Quote className="size-4" />
      </ToolButton>
      <ToolButton label={zh ? "插入中英双语块" : "Insert a bilingual block"} onClick={() => insert(":::zh\n", "\n:::\n\n:::en\nEnglish text\n:::", zh ? "中文文本" : "Chinese text")}>
        <Languages className="size-4" />
      </ToolButton>
      <span className="ml-auto font-mono text-meta text-ink-3">
        {words.length.toLocaleString()} {zh ? "字符" : "chars"}
      </span>
    </div>
  );

  const syncLine = (() => {
    switch (sync.state) {
      case "saving":
        return { tone: "text-ink-3", text: zh ? "正在同步工作区…" : "Syncing the workspace…" };
      case "saved":
        return { tone: "text-moss-ink", text: `${zh ? "工作区已同步" : "Workspace synced"} · ${new Date(sync.at).toLocaleTimeString(zh ? "zh-CN" : "en-GB", { hour: "2-digit", minute: "2-digit" })}` };
      case "quota":
        return { tone: "text-brick-ink", text: zh ? "本机存储已满，无法保留恢复副本；请尽快保存修订。" : "This device's storage is full; no recovery copy is kept. Save a revision soon." };
      case "local":
        return {
          tone: "text-brick-ink",
          text:
            sync.reason === "expired"
              ? zh
                ? "登录已过期 · 内容保存在本机"
                : "Signed out · kept on this device"
              : sync.reason === "offline"
                ? zh
                  ? "离线 · 内容保存在本机，联网后自动同步"
                  : "Offline · kept on this device; syncs when back online"
                : (sync.detail ?? (zh ? "同步失败 · 内容保存在本机" : "Sync failed · kept on this device")),
        };
      default:
        return null;
    }
  })();

  const banner = archived ? (
    <p role="note" className="pw-sheet border-rule-strong px-5 py-4 text-small text-ink-2">
      {zh ? "这篇条目已归档，读者看不到它。管理员在回收站恢复后才能继续编辑。" : "This entry is archived and hidden from readers. An administrator must restore it before it can be edited."}
    </p>
  ) : state === "in_review" ? (
    <div role="note" className="pw-sheet flex flex-wrap items-center gap-x-6 gap-y-2 border-indigo/40 px-5 py-4 text-small text-ink-2">
      <p className="min-w-0 flex-1">
        <span className="font-medium text-indigo">{zh ? "正在审核：" : "In review: "}</span>
        {zh
          ? `r${revision ?? ""} 已提交，等待管理员审阅。此时保存新修订会自动撤回这次提交。`
          : `r${revision ?? ""} is waiting for an administrator. Saving a new revision now withdraws this submission.`}
      </p>
      {admin && entryId ? (
        <Link href={`/admin/review/${entryId}`} className="pw-link text-indigo">
          {zh ? "打开审核单" : "Open the review sheet"} →
        </Link>
      ) : null}
      <button type="button" disabled={Boolean(busy)} onClick={() => void withdraw()} className="pw-link min-h-9 text-ink disabled:opacity-45">
        {busy === "withdraw" ? (zh ? "撤回中…" : "Withdrawing…") : zh ? "撤回提交" : "Withdraw submission"}
      </button>
    </div>
  ) : returnNote ? (
    <div role="note" className="pw-sheet border-brick/40 px-5 py-4 text-small text-ink-2">
      <p className="font-medium text-brick-ink">{zh ? "管理员退回了上一次提交：" : "An administrator returned the last submission:"}</p>
      <p className="mt-1 whitespace-pre-wrap">{returnNote}</p>
      <p className="mt-2 text-meta text-ink-3">{zh ? "修改后重新提交即可，退回说明会在重新提交时清除。" : "Revise and submit again; the note clears on resubmission."}</p>
    </div>
  ) : workflow?.publishedRevision && (revision ?? 0) > workflow.publishedRevision ? (
    <p role="note" className="pw-sheet px-5 py-3 text-small text-ink-2">
      {zh
        ? `读者目前看到的是 r${workflow.publishedRevision}。这里显示的是最新修订 r${revision}，发布后才会公开。`
        : `Readers see r${workflow.publishedRevision}. This is the latest revision, r${revision}, public only once published.`}
    </p>
  ) : null;

  return (
    <div className="flex flex-col gap-(--space-block)">
      {/* Section index: the form is one page; these are its chapters. */}
      <nav aria-label={zh ? "编辑器分节" : "Editor sections"} className="flex flex-wrap gap-x-6 gap-y-1 text-small text-ink-2">
        {[
          ["#ed-titles", zh ? "一 · 标题与摘要" : "I · Titles"],
          ["#ed-filing", zh ? "二 · 编目" : "II · Catalogue"],
          ["#ed-metadata", zh ? "三 · 来源与关系" : "III · Sources & relations"],
          ["#ed-writing", zh ? "四 · 正文" : "IV · Body"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="pw-link min-h-9 py-2">
            {label}
          </a>
        ))}
      </nav>

      {banner}
      {workflow?.startedFrom ? (
        <p role="note" className="text-small text-gold-ink">
          {zh
            ? `内容取自历史修订 r${workflow.startedFrom}。保存后会成为最新修订 r${(revision ?? 0) + 1}，旧历史保持不变。`
            : `Started from history revision r${workflow.startedFrom}. Saving makes it the newest revision, r${(revision ?? 0) + 1}; history is untouched.`}
        </p>
      ) : null}
      {recovery ? (
        <div role="alert" className="pw-sheet flex flex-wrap items-center gap-x-6 gap-y-2 border-gold/60 px-5 py-4 text-small">
          <p className="min-w-0 flex-1 text-ink">
            {zh
              ? `发现${recovery.source === "local" ? "本机" : "其他设备或之前会话"}在 ${new Date(recovery.savedAt).toLocaleString("zh-CN")} 自动保存、但还没有保存为修订的内容。`
              : `Found work autosaved ${recovery.source === "local" ? "on this device" : "on another device or session"} at ${new Date(recovery.savedAt).toLocaleString("en-GB")} that was never saved as a revision.`}
          </p>
          <button
            type="button"
            className="pw-link min-h-9 text-moss-ink"
            onClick={() => {
              apply(recovery.payload);
              setRecovery(null);
            }}
          >
            {zh ? "恢复这份内容" : "Restore it"}
          </button>
          <button
            type="button"
            className="pw-link min-h-9 text-ink-3"
            onClick={() => {
              setRecovery(null);
              try {
                localStorage.removeItem(storageKey);
              } catch {
                // Nothing to clear.
              }
            }}
          >
            {zh ? "丢弃，使用当前修订" : "Discard; keep this revision"}
          </button>
        </div>
      ) : null}
      {conflict ? (
        <div role="alert" className="pw-sheet flex flex-wrap items-center gap-x-6 gap-y-2 border-brick/40 px-5 py-4 text-small">
          <p className="min-w-0 flex-1 text-ink">
            {zh
              ? `另一个标签页或设备在 ${new Date(conflict.savedAt).toLocaleTimeString("zh-CN")} 保存了更新的工作区内容。为避免覆盖，自动同步已暂停。`
              : `Another tab or device saved newer work at ${new Date(conflict.savedAt).toLocaleTimeString("en-GB")}. Autosync is paused so nothing is overwritten.`}
          </p>
          <button
            type="button"
            className="pw-link min-h-9 text-ink"
            onClick={() => {
              apply(conflict.payload);
              draftVersion.current = conflict.version;
              syncedRef.current = JSON.stringify({ ...conflict.payload, note: undefined });
              setConflict(null);
            }}
          >
            {zh ? "载入那份内容" : "Load that version"}
          </button>
          <button
            type="button"
            className="pw-link min-h-9 text-brick-ink"
            onClick={() => {
              draftVersion.current = conflict.version;
              setConflict(null);
              window.setTimeout(() => void flushRef.current(), 0);
            }}
          >
            {zh ? "保留我的并覆盖" : "Keep mine and overwrite"}
          </button>
        </div>
      ) : null}
      {otherTab && !conflict ? (
        <p role="status" className="text-small text-gold-ink">
          {zh ? "这篇条目也在另一个标签页中被编辑。请只在一个标签页中保存，以免互相覆盖。" : "This entry is also being edited in another tab. Save from one tab only."}
        </p>
      ) : null}

      <fieldset disabled={archived} className="flex min-w-0 flex-col gap-(--space-block) disabled:opacity-70">
        {/* ── I · Titles and summaries ── */}
        <section className="flex flex-col gap-5">
          <SectionHead
            id="ed-titles"
            number="I"
            title={zh ? "标题与摘要" : "Titles and summaries"}
            hint={zh ? "提交审核需要中英文都填写。" : "Both languages are needed to submit."}
          />
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="pw-label">
                {t("editor.title.zh")} <span className="text-brick-ink">*</span>
              </span>
              <input
                id={FIELD_ID.titleZh}
                value={titleZh}
                onChange={(event) => setTitleZh(event.target.value)}
                lang="zh-CN"
                maxLength={200}
                placeholder="流言协议"
                aria-invalid={invalid("titleZh") || undefined}
                className="pw-field min-h-16 font-display text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="pw-label">
                {t("editor.title.en")} <span className="text-brick-ink">*</span>
              </span>
              <input
                id={FIELD_ID.titleEn}
                value={titleEn}
                onChange={(event) => setTitleEn(event.target.value)}
                lang="en"
                maxLength={200}
                placeholder="Gossip protocol"
                aria-invalid={invalid("titleEn") || undefined}
                className="pw-field min-h-16 font-display text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight tracking-[-0.01em]"
              />
              {!entryId ? (
                <span className="text-meta text-ink-3">
                  {zh ? "条目地址由英文标题生成，之后修改标题不会改变地址。" : "The address is made from the English title once; later title changes keep it."}
                </span>
              ) : null}
            </label>
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {(
              [
                ["summaryZh", summaryZh, setSummaryZh, zh ? "中文摘要" : "Chinese summary", "zh-CN"],
                ["summaryEn", summaryEn, setSummaryEn, zh ? "英文摘要" : "English summary", "en"],
              ] as const
            ).map(([field, value, set, label, language]) => (
              <label key={field} className="flex flex-col gap-1.5">
                <span className="pw-label flex justify-between gap-3">
                  <span>
                    {label} <span className="text-brick-ink">*</span>
                  </span>
                  <span className="font-mono normal-case tracking-normal">{value.length}/2000</span>
                </span>
                <textarea
                  id={FIELD_ID[field]}
                  value={value}
                  onChange={(event) => set(event.target.value)}
                  lang={language}
                  maxLength={2000}
                  rows={3}
                  aria-invalid={invalid(field) || undefined}
                  className="pw-lined min-h-28 resize-y text-body"
                />
              </label>
            ))}
          </div>
        </section>

        {/* ── II · Catalogue ── */}
        <section className="flex flex-col gap-5">
          <SectionHead id="ed-filing" number="II" title={zh ? "编目" : "Catalogue"} hint={zh ? "门类、物种、层级与用途；发布后才改变公开位置。" : "Genus, species, level and purpose; the public place moves only on publication."} />
          <div aria-invalid={invalid("genus") || undefined} tabIndex={-1} className={cn(invalid("genus") && "rounded-sm outline-2 outline-offset-4 outline-brick-ink")}>
            <FilingCard
              value={{
                categoryId: metadata.categoryId,
                auxiliaryCategoryIds: metadata.auxiliaryCategoryIds ?? [],
                species: metadata.species,
                level: metadata.level,
                contentRole: metadata.contentRole,
              }}
              onChange={(filing) => setMetadata((current) => ({ ...current, ...filing }))}
              families={options.families}
              categories={options.categories}
              lang={lang}
            />
          </div>
        </section>

        {/* ── III · Sources, relations, figures ── */}
        <section className="flex flex-col gap-5">
          <SectionHead id="ed-metadata" number="III" title={zh ? "来源、关系与插图" : "Sources, relations and figures"} />
          <MetadataPanel
            metadata={metadata}
            onChange={setMetadata}
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
            onInsert={insertAtCursor}
            speciesPlate={speciesPlate}
            familyId={options.categories.find((c) => c.id === metadata.categoryId)?.familyId}
          />
        </section>

        {/* ── IV · Body ── */}
        <section className="flex flex-col gap-5">
          <SectionHead
            id="ed-writing"
            number="IV"
            title={zh ? "正文" : "Body"}
            hint={zh ? "Markdown；用 :::zh 与 :::en 分别写中英文段落。右侧校样即读者看到的排版。" : "Markdown; write :::zh and :::en blocks. The proof on the right is set as readers will see it."}
          />
          <div role="tablist" aria-label={`${t("editor.write")} / ${t("editor.preview")}`} className="flex gap-5 border-b border-rule lg:hidden">
            {(["write", "preview"] as const).map((value) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={pane === value}
                onClick={() => setPane(value)}
                className={cn("-mb-px min-h-11 border-b-2 py-2 text-small", pane === value ? "border-brick text-ink" : "border-transparent text-ink-3")}
              >
                {t(value === "write" ? "editor.write" : "editor.preview")}
              </button>
            ))}
          </div>
          <div className="grid gap-(--space-block) lg:grid-cols-2">
            <section aria-label={t("editor.write")} className={cn("min-w-0", pane !== "write" && "max-lg:hidden")}>
              <div className={cn("pw-notebook overflow-hidden", invalid("body") && "outline-2 outline-offset-4 outline-brick-ink")}>
                <div className="pw-notebook-sheet">
                  {toolbar}
                  <NotebookSheet
                    value={body}
                    onChange={setBody}
                    lang={lang}
                    mono
                    label={zh ? "田野笔记 · 撰写" : "Field notes · Writing"}
                    head={[
                      [zh ? "编号" : "No.", entryId ?? (zh ? "新条目" : "new")],
                      [zh ? "属" : "Genus", options.categories.find((c) => c.id === metadata.categoryId)?.scientificName ?? "—"],
                      [zh ? "年轮" : "Ring", revision ? `r${revision}` : "r1"],
                      [zh ? "日期" : "Date", today],
                    ]}
                    hint={zh ? "Markdown · 双语块 :::zh / :::en · Ctrl/⌘-S 保存修订" : "Markdown · bilingual blocks :::zh / :::en · Ctrl/⌘-S saves a revision"}
                    textareaRef={textareaRef}
                    className="min-h-[64vh]"
                  />
                </div>
              </div>
            </section>
            <section aria-label={t("editor.preview")} className={cn("relative min-w-0", pane !== "preview" && "max-lg:hidden")}>
              <div className="mb-3 flex items-center gap-4 border-b border-rule text-small">
                {(["zh", "en", "both"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPreviewMode(value)}
                    aria-pressed={previewMode === value}
                    className={cn("-mb-px min-h-11 border-b-2 py-2", previewMode === value ? "border-brick text-ink" : "border-transparent text-ink-3")}
                  >
                    {value === "zh" ? "中文" : value === "en" ? "English" : zh ? "双语" : "Both"}
                  </button>
                ))}
              </div>
              <div className={cn("pw-proof min-h-[64vh] px-6 pt-14 pb-10 sm:px-10", previewMode === "both" && "grid gap-10 xl:grid-cols-2")}>
                {previewMode !== "en" ? (
                  <article lang="zh-CN" className="min-w-0">
                    <p className="mb-6 font-mono text-meta text-ink-3">{zh ? "校样 · 中文" : "Proof · Chinese"}</p>
                    <h2 className="mb-3 font-display text-h1 leading-tight font-[480] break-words">{titleZh || (zh ? "（中文标题）" : "(Chinese title)")}</h2>
                    {summaryZh ? <p className="mb-8 text-lead leading-relaxed text-ink-2">{summaryZh}</p> : null}
                    <Markdown lang="zh" assets={figureMap}>
                        {body}
                      </Markdown>
                  </article>
                ) : null}
                {previewMode !== "zh" ? (
                  <article lang="en" className="min-w-0">
                    <p className="mb-6 font-mono text-meta text-ink-3">Proof · English</p>
                    <h2 className="mb-3 font-display text-h1 leading-tight font-[480] break-words">{titleEn || "(English title)"}</h2>
                    {summaryEn ? <p className="mb-8 text-lead leading-relaxed text-ink-2">{summaryEn}</p> : null}
                    <Markdown lang="en" assets={figureMap}>
                        {body}
                      </Markdown>
                  </article>
                ) : null}
              </div>
            </section>
          </div>
        </section>
      </fieldset>

      {showErrors && errors.length ? (
        <section aria-labelledby="ed-errors" className="pw-sheet border-brick/40 p-5 text-small">
          <h2 id="ed-errors" className="font-medium text-brick-ink">
            {zh ? "提交审核前需要补齐：" : "Before submitting:"}
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {errors.map((error, index) => (
              <li key={`${error.field}-${index}`}>
                <button type="button" onClick={() => goTo(error.field)} className="pw-link min-h-8 text-left text-ink">
                  {error.text} →
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div aria-busy={Boolean(busy) || undefined} className="pw-ink-over sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 bg-paper/95 px-4 pb-4 backdrop-blur-[2px] sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusBadge state={state} lang={lang} showForm />
          {revision ? <span className="font-mono text-meta text-ink-3">r{revision}</span> : null}
          <span className={cn("text-meta", syncLine?.tone ?? "text-ink-3")} aria-live="polite">
            {syncLine?.text ?? (zh ? "编辑时自动保存到工作区" : "Autosaves to your workspace as you edit")}
            {sync.state === "local" && sync.reason === "expired" ? (
              <>
                {" · "}
                <a href={`/login?next=${encodeURIComponent(slug ? `/editor/${slug}` : "/editor/new")}`} className="pw-link text-ink" target="_blank" rel="noopener">
                  {zh ? "在新标签页重新登录" : "Sign in again in a new tab"}
                </a>
              </>
            ) : null}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <label className="flex min-w-48 flex-1 flex-col gap-1">
            <span className="sr-only">{t("editor.note")}</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              placeholder={t("editor.notePlaceholder")}
              disabled={archived}
              className="pw-field h-10 text-small"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={Boolean(busy) || state === "in_review" || archived}
              className="inline-flex h-10 items-center rounded-sm border border-rule-strong px-4 text-small text-ink hover:bg-ink/5 disabled:opacity-45"
            >
              {busy === "submit" ? (zh ? "提交中…" : "Submitting…") : t("editor.submit")}
            </button>
            <button
              type="button"
              onClick={() => void saveRevision()}
              disabled={Boolean(busy) || archived}
              className="inline-flex h-10 items-center rounded-sm bg-ink px-4 text-small text-paper-sheet hover:bg-ink-2 disabled:opacity-45"
            >
              {busy === "save" ? (zh ? "保存中…" : "Saving…") : t("editor.saveDraft")}
            </button>
            <KeyboardHint keys={["Ctrl", "S"]} className="hidden sm:inline-flex" />
          </div>
        </div>
        <p role={feedback?.kind === "error" ? "alert" : "status"} className={cn("min-h-5 text-small", feedback?.kind === "error" ? "text-brick-ink" : "text-moss-ink")}>
          {feedback?.text ?? ""}
        </p>
      </div>
    </div>
  );
}
