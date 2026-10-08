"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Bold, Code2, Heading2, Italic, Link2, List, Quote } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { ForumBody } from "@/components/forum/ForumBody";

/**
 * A comment box in the editor's manner: Write and Preview tabs, a Markdown
 * toolbar, the proof set exactly as the post will read, and a local copy of
 * what is being written (per account and place) so a failed send or a closed
 * tab loses nothing. Ctrl/⌘-Enter sends.
 */
export function Composer({
  value,
  onChange,
  storageKey,
  label,
  placeholder,
  maxLength = 8000,
  minRows = 8,
  invalid,
  describedBy,
  onSubmitShortcut,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Local recovery copy; omit to keep none. */
  storageKey?: string;
  label: string;
  placeholder?: string;
  maxLength?: number;
  minRows?: number;
  invalid?: boolean;
  describedBy?: string;
  onSubmitShortcut?: () => void;
  disabled?: boolean;
}) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const [tab, setTab] = useState<"write" | "preview">("write");
  const area = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const restored = useRef(false);

  useEffect(() => {
    if (!storageKey || restored.current) return;
    restored.current = true;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && !value) onChange(saved);
    } catch {
      // No storage: nothing to restore.
    }
  }, [onChange, storageKey, value]);
  useEffect(() => {
    if (!storageKey) return;
    try {
      if (value) localStorage.setItem(storageKey, value);
      else localStorage.removeItem(storageKey);
    } catch {
      // Storage full or blocked; the text stays in the box.
    }
  }, [storageKey, value]);

  const wrap = (before: string, after = "", placeholderText = "") => {
    const el = area.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || placeholderText;
    onChange(`${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };
  const tools: Array<[string, React.ReactNode, () => void]> = [
    [zh ? "标题" : "Heading", <Heading2 key="h" className="size-4" />, () => wrap("### ", "", zh ? "小标题" : "Heading")],
    [zh ? "加粗" : "Bold", <Bold key="b" className="size-4" />, () => wrap("**", "**", zh ? "加粗文字" : "bold text")],
    [zh ? "斜体" : "Italic", <Italic key="i" className="size-4" />, () => wrap("_", "_", zh ? "斜体文字" : "italic text")],
    [zh ? "引用" : "Quote", <Quote key="q" className="size-4" />, () => wrap("> ", "", zh ? "引用" : "quote")],
    [zh ? "代码" : "Code", <Code2 key="c" className="size-4" />, () => wrap("`", "`", "code")],
    [zh ? "链接" : "Link", <Link2 key="l" className="size-4" />, () => wrap("[", "](https://)", zh ? "链接文字" : "link text")],
    [zh ? "列表" : "List", <List key="li" className="size-4" />, () => wrap("- ", "", zh ? "列表项" : "item")],
  ];

  return (
    <div className={cn("pw-sheet overflow-hidden", invalid && "outline-2 outline-offset-2 outline-brick-ink")}>
      <div className="flex flex-wrap items-center gap-x-1 border-b border-rule bg-paper-deep/40 px-2">
        <div role="tablist" aria-label={label} className="flex">
          {(["write", "preview"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`${id}-${value}`}
              aria-selected={tab === value}
              aria-controls={`${id}-panel`}
              onClick={() => setTab(value)}
              className={cn(
                "-mb-px min-h-11 border-b-2 px-3 text-small",
                tab === value ? "border-part bg-paper-sheet text-ink" : "border-transparent text-ink-3 hover:text-ink",
              )}
            >
              {value === "write" ? (zh ? "撰写" : "Write") : zh ? "预览" : "Preview"}
            </button>
          ))}
        </div>
        {tab === "write" ? (
          <div role="toolbar" aria-label={zh ? "格式" : "Formatting"} className="ml-auto flex flex-wrap">
            {tools.map(([name, icon, run]) => (
              <button
                key={name}
                type="button"
                title={name}
                aria-label={name}
                onClick={run}
                disabled={disabled}
                className="inline-flex size-9 items-center justify-center rounded-sm text-ink-2 hover:bg-ink/8 hover:text-ink"
              >
                {icon}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`}>
        {tab === "write" ? (
          <textarea
            ref={area}
            aria-label={label}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                onSubmitShortcut?.();
              }
            }}
            maxLength={maxLength}
            rows={minRows}
            disabled={disabled}
            placeholder={placeholder}
            className="block min-h-48 w-full resize-y bg-paper-sheet px-4 py-3 text-body leading-relaxed text-ink outline-none placeholder:text-ink-3 placeholder:italic focus-visible:bg-white/40"
          />
        ) : (
          <div className="min-h-48 px-5 py-4">
            {value.trim() ? (
              <ForumBody body={value} lang={lang} />
            ) : (
              <p className="text-small text-ink-3 italic">{zh ? "没有可预览的内容。" : "Nothing to preview."}</p>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-4 py-2 text-meta text-ink-3">
        <span>{zh ? "支持 Markdown · Ctrl/⌘-Enter 发送" : "Markdown supported · Ctrl/⌘-Enter sends"}</span>
        <span className={cn("font-mono", value.length > maxLength * 0.9 && "text-brick-ink")}>
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}
