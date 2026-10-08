"use client";

import type { ForumPost, ForumThread } from "@/lib/model/types";
import { useI18n } from "@/lib/i18n/client";
import { api, ConfirmAction, NoticeLine, useAction } from "./actions";

/** Hide / restore and lock / unlock one thread. */
export function ThreadModeration({ thread }: { thread: ForumThread }) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const { notice, succeed } = useAction();
  const call = (action: string, reason?: string) =>
    api(`/api/admin/forum/threads/${thread.id}`, "POST", { action, reason });
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {thread.lockedAt ? (
          <ConfirmAction
            trigger={zh ? "解锁" : "Unlock"}
            title={zh ? `解锁主题 #${thread.number}？` : `Unlock thread #${thread.number}?`}
            description={zh ? "读者可以重新回复。" : "Readers can reply again."}
            confirmLabel={zh ? "解锁主题" : "Unlock thread"}
            onConfirm={async () => {
              await call("unlock");
              succeed(zh ? "已解锁。" : "Unlocked.");
            }}
          />
        ) : (
          <ConfirmAction
            trigger={zh ? "锁定" : "Lock"}
            title={zh ? `锁定主题 #${thread.number}？` : `Lock thread #${thread.number}?`}
            description={
              zh
                ? "主题与回复保持可见，但不再接受新回复（包括直接调用数据库）。"
                : "The thread and its replies stay visible but take no new replies (direct database calls included)."
            }
            reason={{ label: zh ? "锁定说明（公开显示）" : "Note (shown publicly)" }}
            confirmLabel={zh ? "锁定主题" : "Lock thread"}
            onConfirm={async (reason) => {
              await call("lock", reason);
              succeed(zh ? "已锁定。" : "Locked.");
            }}
          />
        )}
        {thread.hiddenAt ? (
          <ConfirmAction
            trigger={zh ? "恢复显示" : "Restore"}
            title={zh ? `恢复主题 #${thread.number}？` : `Restore thread #${thread.number}?`}
            description={
              zh
                ? "主题和其中未被单独隐藏的回复重新公开。"
                : "The thread and its replies (except individually hidden ones) become public again."
            }
            confirmLabel={zh ? "恢复主题" : "Restore thread"}
            onConfirm={async () => {
              await call("restore");
              succeed(zh ? "已恢复。" : "Restored.");
            }}
          />
        ) : (
          <ConfirmAction
            tone="danger"
            trigger={zh ? "隐藏" : "Hide"}
            title={zh ? `隐藏主题 #${thread.number}？` : `Hide thread #${thread.number}?`}
            description={
              zh
                ? "主题与全部回复从公开讨论区和成员页中隐藏，内容保留，可在回收站恢复。"
                : "The thread and all replies leave the forum and member pages; the content is kept and can be restored from the archive bin."
            }
            reason={{ label: zh ? "隐藏原因（记入审计）" : "Reason (audit log)", required: true }}
            confirmLabel={zh ? "隐藏主题" : "Hide thread"}
            onConfirm={async (reason) => {
              await call("hide", reason);
              succeed(zh ? "已隐藏。" : "Hidden.");
            }}
          />
        )}
      </div>
      <NoticeLine notice={notice} className="text-meta" />
    </div>
  );
}

/** Hide or restore one reply (the opening post goes with its thread). */
export function PostModeration({ post, opening }: { post: ForumPost; opening: boolean }) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const { notice, succeed } = useAction();
  if (opening) return null;
  return (
    <span className="inline-flex flex-col">
      {post.hiddenAt ? (
        <ConfirmAction
          trigger={zh ? "恢复" : "Restore"}
          title={zh ? "恢复这条回复？" : "Restore this reply?"}
          description={zh ? "回复重新公开显示。" : "The reply becomes public again."}
          confirmLabel={zh ? "恢复回复" : "Restore reply"}
          onConfirm={async () => {
            await api(`/api/admin/forum/posts/${post.id}`, "POST", { action: "restore" });
            succeed(zh ? "已恢复。" : "Restored.");
          }}
        />
      ) : (
        <ConfirmAction
          tone="danger"
          trigger={zh ? "隐藏" : "Hide"}
          title={zh ? "隐藏这条回复？" : "Hide this reply?"}
          description={
            zh
              ? "回复从公开页面隐藏，内容保留，管理员可恢复。"
              : "The reply is hidden from public pages; the content is kept and administrators can restore it."
          }
          reason={{ label: zh ? "隐藏原因（记入审计）" : "Reason (audit log)", required: true }}
          confirmLabel={zh ? "隐藏回复" : "Hide reply"}
          onConfirm={async (reason) => {
            await api(`/api/admin/forum/posts/${post.id}`, "POST", { action: "hide", reason });
            succeed(zh ? "已隐藏。" : "Hidden.");
          }}
        />
      )}
      <NoticeLine notice={notice} className="text-meta" />
    </span>
  );
}
