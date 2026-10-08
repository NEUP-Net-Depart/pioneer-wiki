"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReviewState } from "@/lib/model/types";
import type { DiffChunk } from "@/lib/entries/diff";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { api, ConfirmAction, NoticeLine, useAction } from "./actions";

/** Line-level body changes; long unchanged runs fold, and open on request. */
export function BodyDiff({ chunks, lang }: { chunks: DiffChunk[]; lang: "zh" | "en" }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const changed = chunks.some((chunk) => chunk.kind !== "context");
  if (!changed)
    return <p className="pw-well p-4 text-small text-ink-3">{lang === "zh" ? "正文没有变化。" : "The body is unchanged."}</p>;
  return (
    <div className="pw-well max-h-[40rem] overflow-auto py-2 font-mono text-[0.8125rem] leading-relaxed" tabIndex={0}>
      {chunks.map((chunk, index) => {
        if (chunk.kind === "context" && chunk.lines.length > 6 && !open.has(index))
          return (
            <button
              key={index}
              type="button"
              onClick={() => setOpen((current) => new Set(current).add(index))}
              className="my-1 block w-full border-y border-rule px-4 py-1 text-left text-meta text-ink-3 italic hover:bg-ink/5"
            >
              … {chunk.lines.length} {lang === "zh" ? "行未变，点击展开" : "unchanged lines — show"}
            </button>
          );
        return chunk.lines.map((line, lineIndex) => (
          <div
            key={`${index}-${lineIndex}`}
            className={cn(
              "flex px-2",
              chunk.kind === "added" && "bg-moss/12 text-ink",
              chunk.kind === "removed" && "bg-brick/10 text-ink-2 line-through decoration-brick/50",
              chunk.kind === "context" && "text-ink-3",
            )}
          >
            <span aria-hidden="true" className="inline-block w-6 shrink-0 text-center select-none">
              {chunk.kind === "added" ? "+" : chunk.kind === "removed" ? "−" : " "}
            </span>
            <span className="sr-only">
              {chunk.kind === "added" ? (lang === "zh" ? "新增：" : "Added: ") : chunk.kind === "removed" ? (lang === "zh" ? "删除：" : "Removed: ") : ""}
            </span>
            <span className="whitespace-pre-wrap break-words">{line || " "}</span>
          </div>
        ));
      })}
    </div>
  );
}

interface Target {
  id: string;
  number: number;
  note: string;
  createdAt: string;
}

/**
 * The decisions on one submission. Publish and return name the revision on
 * screen; anything saved since is refused by the database and reported here.
 */
export function ReviewActions({
  entryId,
  title,
  status,
  archived,
  expectedRevision,
  blockedImages,
  rollbackTargets,
  publishedRevision,
}: {
  entryId: string;
  title: string;
  status: ReviewState;
  archived: boolean;
  expectedRevision: number;
  blockedImages: string[];
  rollbackTargets: Target[];
  publishedRevision?: number;
}) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const router = useRouter();
  const { notice, succeed } = useAction();
  const [target, setTarget] = useState(rollbackTargets.find((t) => t.number !== publishedRevision)?.id ?? rollbackTargets[0]?.id ?? "");
  const reviewing = status === "in_review" && !archived;
  const chosen = rollbackTargets.find((t) => t.id === target);
  return (
    <section aria-labelledby="decide" className="pw-sheet sticky bottom-3 z-10 flex flex-col gap-4 p-5 shadow-lifted sm:p-6">
      <h2 id="decide" className="font-display text-h4">
        {zh ? "审核决定" : "Decision"}
      </h2>
      {!reviewing ? (
        <p className="text-small text-ink-2">
          {archived
            ? zh
              ? "条目已归档，恢复后才能发布。"
              : "The entry is archived; restore it before publishing."
            : zh
              ? "这个条目当前没有等待审核的提交（可能已被作者撤回或已处理）。"
              : "Nothing is waiting for review on this entry (withdrawn by the author or already decided)."}
        </p>
      ) : null}
      {reviewing && blockedImages.length ? (
        <p role="note" className="text-small text-brick-ink">
          {zh
            ? `还有 ${blockedImages.length} 张引用图片未批准，发布会被拒绝。`
            : `${blockedImages.length} image(s) used here are not approved; publishing will be refused.`}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <ConfirmAction
          disabled={!reviewing}
          trigger={<span className="pw-stamp-button [--draft:var(--color-moss-ink)]">{zh ? `发布 r${expectedRevision}` : `Publish r${expectedRevision}`}</span>}
          plainTrigger
          title={zh ? `发布《${title}》r${expectedRevision}？` : `Publish r${expectedRevision} of “${title}”?`}
          description={
            zh
              ? "发布后，标题、摘要、正文、分类、来源、标签、贡献者、关系与封面会作为一个整体替换当前公开版本，首页、检索与图谱同时更新。若作者在此期间保存过新修订，发布会被拒绝。"
              : "Title, summary, body, catalogue place, sources, tags, contributors, relations and cover replace the public version together; the home page, search and graph update at once. If the author saved a newer revision meanwhile, publishing is refused."
          }
          confirmLabel={zh ? "发布这个修订" : "Publish this revision"}
          onConfirm={async () => {
            await api(`/api/entries/${entryId}/transition`, "POST", { action: "publish", expectedRevision });
            router.push("/admin/review?done=published");
          }}
        />
        <ConfirmAction
          disabled={!reviewing}
          tone="danger"
          trigger={zh ? "退回修改" : "Return for changes"}
          title={zh ? `退回《${title}》？` : `Return “${title}”?`}
          description={
            zh
              ? "条目回到草稿状态，公开版本不变。作者会在编辑器和“我的文章”中看到退回原因，修改后可再次提交。"
              : "The entry goes back to draft; the public version is unchanged. The author sees your reason in the editor and in their list, and can resubmit."
          }
          reason={{ label: zh ? "退回原因（作者可见）" : "Reason (shown to the author)", required: true }}
          confirmLabel={zh ? "退回给作者" : "Return to the author"}
          onConfirm={async (reason) => {
            await api(`/api/entries/${entryId}/transition`, "POST", { action: "return", expectedRevision, note: reason });
            router.push("/admin/review?done=returned");
          }}
        />
        <a href={`/editor/${entryId}`} className="pw-link min-h-11 py-3 text-small text-ink-2">
          {zh ? "在编辑器中查看" : "Open in the editor"}
        </a>
      </div>
      {rollbackTargets.length > 1 || (rollbackTargets.length === 1 && rollbackTargets[0].number !== publishedRevision) ? (
        <div className="pw-ink-over flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="flex min-w-60 flex-1 flex-col gap-1">
            <span className="pw-label">{zh ? "回滚到曾公开的修订" : "Roll back to a once-public revision"}</span>
            <select value={target} onChange={(event) => setTarget(event.target.value)} className="pw-field text-small">
              {rollbackTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  r{t.number} · {t.note}
                  {t.number === publishedRevision ? (zh ? "（当前公开）" : " (public now)") : ""}
                </option>
              ))}
            </select>
          </label>
          <ConfirmAction
            disabled={status === "in_review" || archived || !chosen || chosen.number === publishedRevision}
            tone="danger"
            trigger={zh ? "回滚" : "Roll back"}
            title={zh ? `回滚到 r${chosen?.number ?? ""}？` : `Roll back to r${chosen?.number ?? ""}?`}
            description={
              zh
                ? "所选修订的完整内容会作为一个新修订重新公开；现有历史一个不删。待审核期间不能回滚，请先发布或退回。"
                : "The chosen revision's whole content is published again as a new revision; no history is removed. Not possible while a submission waits — publish or return it first."
            }
            confirmLabel={zh ? "回滚并公开" : "Roll back and publish"}
            onConfirm={async () => {
              await api(`/api/entries/${entryId}/transition`, "POST", { action: "rollback", targetRevisionId: target });
              succeed(zh ? "已回滚，读者现在看到所选修订的内容。" : "Rolled back; readers now see the chosen revision.");
            }}
          />
        </div>
      ) : null}
      <NoticeLine notice={notice} />
    </section>
  );
}
