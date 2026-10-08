import Link from "next/link";
import type { EditorialEntry, Page } from "@/lib/model/types";
import { StatusBadge } from "@/components/archive/StatusBadge";
import { CellLabel, EmptyDrawer, formatWhen, Ledger, LedgerRow, StateTag, tr } from "./desk";
import { EntryAdminActions } from "./EntryActions";

type Lang = "zh" | "en";

/**
 * Entries as their editors see them: the latest revision's title, where it is
 * in the workflow, what readers see now, and what to do next. Shared by the
 * office's register (all entries) and an author's own list.
 */
export function EntryRegister({
  lang,
  page,
  admin,
  empty,
}: {
  lang: Lang;
  page: Page<EditorialEntry>;
  admin: boolean;
  empty: React.ReactNode;
}) {
  if (!page.rows.length) return <>{empty}</>;
  return (
    <Ledger label={tr(lang, "条目登记簿", "Entry register")}>
      <li aria-hidden="true" className="hidden grid-cols-[minmax(0,2.4fr)_8rem_9rem_9rem_minmax(10rem,1.2fr)] gap-x-6 px-6 py-2 md:grid">
        {[
          tr(lang, "条目", "Entry"),
          tr(lang, "状态", "State"),
          tr(lang, "公开版本", "Public"),
          tr(lang, "最近编辑", "Edited"),
          tr(lang, "操作", "Actions"),
        ].map((heading) => (
          <span key={heading} className="pw-label">
            {heading}
          </span>
        ))}
      </li>
      {page.rows.map((entry) => {
        const title = entry.title[lang] || entry.title.zh || entry.title.en || entry.id;
        const other = lang === "zh" ? entry.title.en : entry.title.zh;
        return (
          <LedgerRow
            key={entry.id}
            muted={Boolean(entry.archivedAt)}
            className="md:grid-cols-[minmax(0,2.4fr)_8rem_9rem_9rem_minmax(10rem,1.2fr)] md:items-start"
          >
            <div className="min-w-0">
              <p className="font-mono text-meta text-ink-3">
                {entry.id}
                {admin ? ` · ${entry.authorName[lang] || entry.authorId}` : ""}
              </p>
              <p className="mt-0.5 font-display text-h4 leading-snug break-words text-ink">{title}</p>
              {other && other !== title ? <p className="text-small break-words text-ink-3">{other}</p> : null}
              {entry.returnNote && entry.status === "draft" ? (
                <p className="mt-2 border-l-2 border-brick pl-3 text-small text-ink-2">
                  <span className="font-medium text-brick-ink">{tr(lang, "已退回：", "Returned: ")}</span>
                  {entry.returnNote}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <CellLabel>{tr(lang, "状态", "State")}</CellLabel>
              <StatusBadge state={entry.status} lang={lang} />
              {entry.archivedAt ? <StateTag tone="quiet">{tr(lang, "已归档", "Archived")}</StateTag> : null}
              {entry.returnNote && entry.status === "draft" ? (
                <StateTag tone="danger">{tr(lang, "退回", "Returned")}</StateTag>
              ) : null}
            </div>
            <div className="text-small text-ink-2">
              <CellLabel>{tr(lang, "公开版本", "Public")}</CellLabel>
              {entry.publishedRevision ? (
                <>
                  <span className="font-mono">r{entry.publishedRevision}</span>
                  {entry.latestRevision > entry.publishedRevision ? (
                    <span className="ml-1 text-meta text-gold-ink">
                      {tr(lang, `· 有 ${entry.latestRevision - entry.publishedRevision} 个后续修订`, `· ${entry.latestRevision - entry.publishedRevision} newer`)}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-ink-3">{tr(lang, "尚未发布", "Never published")}</span>
              )}
            </div>
            <div className="text-small text-ink-2">
              <CellLabel>{tr(lang, "最近编辑", "Edited")}</CellLabel>
              <time dateTime={entry.editedAt}>{formatWhen(entry.editedAt, lang)}</time>
            </div>
            <div className="flex flex-col gap-1 text-small">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {!entry.archivedAt ? (
                  <Link href={`/editor/${entry.slug}`} className="pw-link min-h-8 text-ink">
                    {tr(lang, "编辑", "Edit")}
                  </Link>
                ) : null}
                {admin && entry.status === "in_review" && !entry.archivedAt ? (
                  <Link href={`/admin/review/${entry.id}`} className="pw-link min-h-8 text-indigo">
                    {tr(lang, "审核", "Review")}
                  </Link>
                ) : null}
                {entry.publishedRevision && !entry.archivedAt ? (
                  <Link href={`/entries/${entry.slug}`} className="pw-link min-h-8 text-ink-2">
                    {tr(lang, "公开页", "Public page")}
                  </Link>
                ) : null}
                {entry.publishedRevision ? (
                  <Link href={`/entries/${entry.slug}/history`} className="pw-link min-h-8 text-ink-2">
                    {tr(lang, "历史", "History")}
                  </Link>
                ) : null}
              </div>
              {admin ? <EntryAdminActions entry={entry} /> : null}
            </div>
          </LedgerRow>
        );
      })}
    </Ledger>
  );
}

export function NoEntries({ lang, filtered, children }: { lang: Lang; filtered: boolean; children?: React.ReactNode }) {
  return (
    <EmptyDrawer title={filtered ? tr(lang, "没有符合筛选条件的条目。", "No entries match these filters.") : tr(lang, "这里还没有条目。", "There are no entries here yet.")}>
      {children}
    </EmptyDrawer>
  );
}
