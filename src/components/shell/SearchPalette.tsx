"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Dialog } from "radix-ui";
import type { SearchHit, SearchResult } from "@/lib/services/contracts";
import { DOMAINS } from "@/lib/model/vocab";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export const OPEN_SEARCH_EVENT = "pw:search";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

function Highlighted({ text, ranges }: { text: string; ranges: Array<[number, number]> }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [a, b] of [...ranges].sort((x, y) => x[0] - y[0])) {
    if (a < at) continue;
    parts.push(text.slice(at, a), <mark key={a}>{text.slice(a, b)}</mark>);
    at = b;
  }
  parts.push(text.slice(at));
  return <>{parts}</>;
}

/**
 * The search palette: ⌘K / Ctrl-K or `/` from anywhere. A ledger line to write
 * in, live results from GET /api/search, ↑↓ to move, Enter to open, Esc to
 * close. The full /search page remains the no-JS route.
 */
export function SearchPalette() {
  const router = useRouter();
  const { lang } = useI18n();
  const zh = lang === "zh";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);
  const [round, setRound] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const combo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const slash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target);
      if (combo || slash) {
        e.preventDefault();
        setOpen((o) => (combo ? !o : true));
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&limit=7`, { signal: ctl.signal });
        const data = (await res.json()) as SearchResult;
        setHits(data.hits);
        setTotal(data.total);
        setActive(0);
        setRound((r) => r + 1);
      } catch {
        /* aborted or offline: keep the last results */
      }
    }, 110);
    return () => {
      ctl.abort();
      window.clearTimeout(id);
    };
  }, [q, open]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const searchHref = useMemo(() => `/search${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`, [q]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="pw-palette-veil fixed inset-0 z-(--z-overlay) bg-ink/28 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="pw-palette fixed top-[12vh] left-1/2 z-(--z-overlay) w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 rounded-sm border border-rule-strong bg-paper-sheet shadow-lifted outline-none"
        >
          <Dialog.Title className="sr-only">{zh ? "检索档案" : "Search the archive"}</Dialog.Title>
          <Image
            src="/vignettes/web/kingfisher.webp"
            alt=""
            width={1536}
            height={1024}
            aria-hidden="true"
            className="pw-palette-bird pointer-events-none absolute -top-16 right-4 w-32 -scale-x-100"
          />
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const hit = hits[active];
              go(hit ? `/entries/${hit.entry.slug}` : searchHref);
            }}
            className="px-6 pt-6"
          >
            <label htmlFor="pw-palette-q" className="pw-smallcaps text-meta text-ink-3">
              {zh ? "检索 · Search" : "Search · 检索"}
            </label>
            <input
              id="pw-palette-q"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                }
              }}
              placeholder={zh ? "标题、正文、标签、作者或编号……" : "Titles, text, tags, authors or IDs…"}
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={hits.length > 0}
              aria-controls="pw-palette-results"
              aria-activedescendant={hits[active] ? `pw-hit-${hits[active].entry.id}` : undefined}
              className="mt-1 w-full border-0 border-b border-ink/40 bg-transparent pb-2 font-display text-[clamp(1.5rem,3vw,2rem)] text-ink outline-none placeholder:text-ink-3/60 focus:border-ink"
            />
          </form>
          <ol
            key={round}
            id="pw-palette-results"
            ref={listRef}
            role="listbox"
            className="max-h-[52vh] overflow-y-auto px-3 py-3"
          >
            {hits.map((h, i) => (
              <li
                key={h.entry.id}
                id={`pw-hit-${h.entry.id}`}
                role="option"
                aria-selected={i === active}
                data-index={i}
                data-phylum={h.entry.domain}
                style={{ "--i": i } as React.CSSProperties}
                onMouseMove={() => setActive(i)}
                onClick={() => go(`/entries/${h.entry.slug}`)}
                className={cn(
                  "pw-palette-hit grid cursor-pointer grid-cols-[4.5rem_1fr] gap-x-4 rounded-xs px-3 py-2.5 transition-colors duration-(--dur-quick)",
                  i === active && "bg-ink/5",
                )}
              >
                <span className="pt-1.5 font-mono text-[0.6875rem] text-ink-3">{h.entry.id}</span>
                <span className="min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "font-display text-lead text-ink transition-transform duration-(--dur-quick)",
                        i === active && "translate-x-1",
                      )}
                    >
                      {h.entry.title[lang]}
                    </span>
                    <span className="truncate text-meta text-ink-3">{h.entry.title[zh ? "en" : "zh"]}</span>
                    <span className="ml-auto shrink-0 text-meta text-phylum-ink">{DOMAINS[h.entry.domain][lang]}</span>
                  </span>
                  {h.snippet ? (
                    <span className="mt-0.5 line-clamp-1 block text-small text-ink-2 [&_mark]:bg-mark [&_mark]:text-ink">
                      <Highlighted text={h.snippet.text} ranges={h.snippet.highlights} />
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
            {hits.length === 0 ? (
              <li className="px-3 py-6 text-small text-ink-3">
                {zh ? "没有找到匹配的标本。" : "No specimen matches."}
              </li>
            ) : null}
          </ol>
          <div className="flex items-center gap-4 border-t border-rule px-6 py-2.5 font-mono text-[0.6875rem] text-ink-3">
            <span>↑↓ {zh ? "移动" : "move"}</span>
            <span>↵ {zh ? "打开" : "open"}</span>
            <span>esc {zh ? "关闭" : "close"}</span>
            <button type="button" onClick={() => go(searchHref)} className="pw-link ml-auto text-ink-2">
              {zh ? `全部 ${total} 条结果` : `All ${total} results`} <span className="pw-nudge">→</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
