"use client";

import { useState } from "react";
import type { EntrySummary, Revision } from "@/lib/model/types";

type DiffChunk = { kind: "added" | "removed" | "context"; lines: string[] };
type Item = {
  entry: EntrySummary;
  revisions: Revision[];
  pendingRevision: number;
  publishedRevision: number | null;
  changes: DiffChunk[];
};

export function ReviewQueue({ items, lang }: { items: Item[]; lang: "zh" | "en" }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState<string | null>(items[0]?.entry.id ?? null);
  const [rollbackTarget, setRollbackTarget] = useState<Record<string, string>>({});

  async function transition(entryId: string, action: "publish" | "rollback", targetRevisionId?: string) {
    setBusy(`${entryId}:${action}`);
    setMessage("");
    try {
      const response = await fetch(`/api/entries/${encodeURIComponent(entryId)}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetRevisionId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
      setMessage(
        action === "publish"
          ? lang === "zh"
            ? "已发布。"
            : "Published."
          : lang === "zh"
            ? "已回滚。"
            : "Rolled back.",
      );
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  function renderDiff(changes: DiffChunk[]) {
    if (!changes.length)
      return <p className="p-4 text-small text-ink-3">{lang === "zh" ? "没有正文差异。" : "No body changes."}</p>;
    return changes.map((chunk, index) => {
      if (chunk.kind === "context" && chunk.lines.length > 8)
        return (
          <p key={index} className="border-y border-rule px-4 py-1 text-meta text-ink-3 italic">
            … {chunk.lines.length} {lang === "zh" ? "行未变" : "unchanged lines"}
          </p>
        );
      return chunk.lines.map((line, lineIndex) => (
        <div
          key={`${index}-${lineIndex}`}
          className={
            chunk.kind === "added"
              ? "bg-moss/12 text-ink"
              : chunk.kind === "removed"
                ? "bg-brick/10 text-ink-2 line-through decoration-brick/50"
                : "text-ink-3"
          }
        >
          <span aria-hidden="true" className="inline-block w-6 text-center select-none">
            {chunk.kind === "added" ? "+" : chunk.kind === "removed" ? "−" : " "}
          </span>
          <span className="whitespace-pre-wrap">{line || " "}</span>
        </div>
      ));
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {items.length === 0 ? (
        <p className="pw-sheet p-6 text-small text-ink-3">
          {lang === "zh" ? "当前没有待审核条目。" : "There are no entries waiting for review."}
        </p>
      ) : null}
      {items.map(({ entry, revisions, pendingRevision, publishedRevision, changes }) => {
        const published = revisions.filter((revision) => revision.state === "published");
        const selectedTarget = rollbackTarget[entry.id] ?? published[0]?.id ?? "";
        const selectedRevision = revisions.find((revision) => revision.id === selectedTarget);
        const additions = changes.reduce(
          (count, chunk) => count + (chunk.kind === "added" ? chunk.lines.length : 0),
          0,
        );
        const removals = changes.reduce(
          (count, chunk) => count + (chunk.kind === "removed" ? chunk.lines.length : 0),
          0,
        );
        return (
          <article key={entry.id} className="pw-sheet overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(open === entry.id ? null : entry.id)}
              aria-expanded={open === entry.id}
              className="flex w-full flex-col gap-3 p-5 text-left hover:bg-ink/5"
            >
              <span className="font-mono text-meta text-ink-3">
                {entry.id} · {entry.slug}
              </span>
              <span className="font-display text-h3">
                {entry.title.zh} <span className="text-ink-3">· {entry.title.en}</span>
              </span>
              <span className="text-small text-ink-2">{entry.summary.zh}</span>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-meta text-ink-3">
                <span>
                  r{pendingRevision} {lang === "zh" ? "提交" : "submitted"}
                </span>
                <span>
                  {publishedRevision
                    ? `r${publishedRevision} ${lang === "zh" ? "公开" : "published"}`
                    : lang === "zh"
                      ? "首次发布"
                      : "first publication"}
                </span>
                <span>
                  {additions}+ / {removals}−
                </span>
              </span>
            </button>
            {open === entry.id ? (
              <div className="border-t border-rule p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-small text-ink-2">
                    {revisions.find((revision) => revision.number === pendingRevision)?.note}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void transition(entry.id, "publish")}
                      className="rounded-sm bg-ink px-3 py-2 text-small text-paper-sheet disabled:opacity-50"
                    >
                      {busy === `${entry.id}:publish`
                        ? lang === "zh"
                          ? "发布中…"
                          : "Publishing…"
                        : lang === "zh"
                          ? "发布此版本"
                          : "Publish revision"}
                    </button>
                    {published.length ? (
                      <>
                        <select
                          aria-label={lang === "zh" ? "回滚目标版本" : "Rollback target"}
                          value={selectedTarget}
                          onChange={(event) =>
                            setRollbackTarget((current) => ({ ...current, [entry.id]: event.target.value }))
                          }
                          className="h-9 rounded-sm border border-rule-strong bg-paper px-2 text-small"
                        >
                          {published.map((revision) => (
                            <option key={revision.id} value={revision.id}>
                              r{revision.number} · {revision.note}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={Boolean(busy) || !selectedRevision}
                          onClick={() => void transition(entry.id, "rollback", selectedRevision?.id)}
                          className="rounded-sm border border-rule-strong px-3 py-2 text-small disabled:opacity-50"
                        >
                          {busy === `${entry.id}:rollback`
                            ? lang === "zh"
                              ? "回滚中…"
                              : "Rolling back…"
                            : lang === "zh"
                              ? "回滚"
                              : "Rollback"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="pw-well max-h-[32rem] overflow-auto font-mono text-[0.8125rem] leading-relaxed">
                  {renderDiff(changes)}
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
      {message ? (
        <p role="status" className="text-small text-ink-2">
          {message}
        </p>
      ) : null}
    </div>
  );
}
