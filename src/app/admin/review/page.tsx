import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import { DeskHead, EmptyDrawer, formatWhen, Ledger, LedgerRow, Pager, ReadFailure, tr } from "@/components/admin/desk";

export const metadata: Metadata = { title: "审核 Review" };

const LIMIT = 25;

/** Submissions waiting for an administrator, oldest edit last; each opens its own review sheet. */
export default async function ReviewQueuePage({ searchParams }: PageProps<"/admin/review">) {
  const lang = await getLang();
  const params = await searchParams;
  const offset = Math.max(0, Number(typeof params.offset === "string" ? params.offset : 0) || 0);
  const done = typeof params.done === "string" ? params.done : "";
  const page = await getServices()
    .entries.listEditorial({ scope: "all", status: ["in_review"], limit: LIMIT, offset })
    .catch(() => null);
  return (
    <>
      <DeskHead
        kicker="Review desk"
        title={tr(lang, "审核", "Review")}
        lede={tr(
          lang,
          "每一份提交都对应一个确定的修订。打开后可以同时比对正文与元数据；作者在审核期间再次保存会自动撤回提交，旧修订无法被误发布。",
          "Each submission is one exact revision. Open it to compare body and metadata side by side; if the author saves again meanwhile, the submission is withdrawn and the old revision cannot be published by mistake.",
        )}
      />
      {done ? (
        <p role="status" className="pw-sheet border-moss/40 px-5 py-3 text-small text-moss-ink">
          ✓{" "}
          {done === "published"
            ? tr(
                lang,
                "已发布。读者现在看到的是你审阅的版本。",
                "Published. Readers now see the revision you reviewed.",
              )
            : tr(
                lang,
                "已退回作者，退回原因会显示在作者的编辑器和文章列表中。",
                "Returned. The author sees your reason in the editor and in their list.",
              )}
        </p>
      ) : null}
      {!page ? (
        <ReadFailure lang={lang} />
      ) : page.rows.length === 0 ? (
        <EmptyDrawer title={tr(lang, "当前没有待审核的条目。", "Nothing is waiting for review.")}>
          {tr(lang, "作者提交后会出现在这里。", "Submissions appear here when authors send them.")}
        </EmptyDrawer>
      ) : (
        <>
          <Ledger label={tr(lang, "审核队列", "Review queue")}>
            {page.rows.map((entry) => (
              <LedgerRow key={entry.id} className="md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="font-mono text-meta text-ink-3">
                    {entry.id} · r{entry.latestRevision} · {entry.authorName[lang] || entry.authorId}
                  </p>
                  <p className="mt-0.5 font-display text-h4 break-words text-ink">
                    {entry.title[lang] || entry.title.zh}
                  </p>
                  <p className="mt-1 text-small text-ink-2">
                    {entry.publishedRevision
                      ? tr(
                          lang,
                          `修订已公开的 r${entry.publishedRevision}`,
                          `Revises public r${entry.publishedRevision}`,
                        )
                      : tr(lang, "首次发布", "First publication")}
                    {" · "}
                    {tr(lang, "提交于", "Submitted")}{" "}
                    <time dateTime={entry.editedAt}>{formatWhen(entry.editedAt, lang)}</time>
                  </p>
                </div>
                <Link href={`/admin/review/${entry.id}`} className="pw-link min-h-11 py-3 text-small text-indigo">
                  {tr(lang, "打开审核单", "Open review")} →
                </Link>
              </LedgerRow>
            ))}
          </Ledger>
          <Pager lang={lang} path="/admin/review" params={{}} offset={offset} limit={LIMIT} total={page.total} />
        </>
      )}
    </>
  );
}
