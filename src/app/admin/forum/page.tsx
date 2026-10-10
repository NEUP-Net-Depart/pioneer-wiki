import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import { categoryOf } from "@/components/forum/categories";
import {
  DeskHead,
  EmptyDrawer,
  formatWhen,
  Ledger,
  LedgerRow,
  Pager,
  ReadFailure,
  StateTag,
  tr,
} from "@/components/admin/desk";
import { DeskFilters } from "@/components/admin/DeskFilters";
import { ThreadModeration } from "@/components/admin/ForumModeration";

export const metadata: Metadata = { title: "论坛 Forum" };

const LIMIT = 30;
type View = "all" | "hidden" | "locked";

/** Every thread, hidden and locked ones included; replies are moderated on the thread page itself. */
export default async function AdminForum({ searchParams }: PageProps<"/admin/forum">) {
  const lang = await getLang();
  const params = await searchParams;
  const view: View = params.view === "hidden" || params.view === "locked" ? params.view : "all";
  const offset = Math.max(0, Number(typeof params.offset === "string" ? params.offset : 0) || 0);
  const threads = await getServices()
    .community.listThreads({ view, limit: LIMIT + 1, offset })
    .catch(() => null);
  const more = (threads?.length ?? 0) > LIMIT;
  return (
    <>
      <DeskHead
        kicker="Forum moderation"
        title={tr(lang, "论坛治理", "Forum moderation")}
        lede={tr(
          lang,
          "归档会让主题与回复从公开页面移出但保留内容，可在回收站恢复；锁定的主题仍然可读，只是不能再回复。逐条回复的处理在主题页内进行。",
          "Archiving removes a thread and its replies from public pages but keeps them in the archive bin; a locked thread stays readable and takes no replies. Moderate single replies on the thread page.",
        )}
      />
      <DeskFilters
        filters={[
          {
            name: "view",
            label: tr(lang, "范围", "Showing"),
            value: view === "all" ? "" : view,
            options: [
              ["", tr(lang, "全部主题", "All threads")],
              ["hidden", tr(lang, "已归档", "Archived")],
              ["locked", tr(lang, "已锁定", "Locked")],
            ],
          },
        ]}
      />
      {!threads ? (
        <ReadFailure lang={lang} />
      ) : threads.length === 0 ? (
        <EmptyDrawer title={tr(lang, "没有符合条件的主题。", "No threads match.")} />
      ) : (
        <>
          <Ledger label={tr(lang, "主题列表", "Threads")}>
            {threads.slice(0, LIMIT).map((thread) => (
              <LedgerRow
                key={thread.id}
                muted={Boolean(thread.hiddenAt)}
                className="md:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] md:items-start"
              >
                <div className="min-w-0">
                  <p className="font-mono text-meta text-ink-3">
                    #{thread.number} · {categoryOf(thread.category).label[lang]} · {thread.authorName} ·{" "}
                    {formatWhen(thread.lastActivityAt, lang)}
                  </p>
                  <Link
                    href={`/forum/${thread.id}`}
                    className="pw-link mt-0.5 block font-display text-h4 break-words text-ink"
                  >
                    {thread.title}
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StateTag>{tr(lang, `${thread.postCount} 条`, `${thread.postCount} posts`)}</StateTag>
                    {thread.hiddenAt ? <StateTag tone="quiet">{tr(lang, "已归档", "Archived")}</StateTag> : null}
                    {thread.lockedAt ? <StateTag tone="warn">{tr(lang, "已锁定", "Locked")}</StateTag> : null}
                    {thread.hiddenPosts ? (
                      <StateTag tone="quiet">
                        {tr(lang, `${thread.hiddenPosts} 条回复已隐藏`, `${thread.hiddenPosts} hidden replies`)}
                      </StateTag>
                    ) : null}
                  </div>
                  {thread.moderationNote ? <p className="mt-1 text-meta text-ink-3">{thread.moderationNote}</p> : null}
                </div>
                <ThreadModeration thread={thread} />
              </LedgerRow>
            ))}
          </Ledger>
          <Pager
            lang={lang}
            path="/admin/forum"
            params={{ view: view === "all" ? undefined : view }}
            offset={offset}
            limit={LIMIT}
            total={offset + Math.min(threads.length, LIMIT) + (more ? 1 : 0)}
          />
        </>
      )}
    </>
  );
}
