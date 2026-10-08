import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import { DeskHead, EmptyDrawer, formatWhen, Ledger, LedgerRow, tr } from "@/components/admin/desk";
import { EntryAdminActions } from "@/components/admin/EntryActions";
import { ChronicleRowActions, LinkRowActions, MemberRowActions } from "@/components/admin/CommunityActions";
import { ThreadModeration } from "@/components/admin/ForumModeration";

export const metadata: Metadata = { title: "回收站 Archive bin" };

function Section({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  return count ? (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="pw-double-rule font-display text-h3">
        {title} <span className="font-mono text-meta text-ink-3">{count}</span>
      </h2>
      {children}
    </section>
  ) : null;
}

/**
 * 回收站 — everything archived or hidden, by kind, each with its way back.
 * Nothing in here is ever deleted: history, versions and audit stay.
 */
export default async function AdminTrash() {
  const lang = await getLang();
  const { entries, community, chronicles } = getServices();
  const [archivedEntries, members, links, records, threads] = await Promise.all([
    entries.listEditorial({ scope: "all", view: "archived", limit: 100 }).catch(() => ({ rows: [], total: 0 })),
    community.listMembers({ view: "archived" }).catch(() => []),
    community.listLinks({ view: "archived" }).catch(() => []),
    chronicles.listForAdmin({ view: "archived", limit: 100 }).catch(() => ({ rows: [], total: 0 })),
    community.listThreads({ view: "hidden", limit: 100 }).catch(() => []),
  ]);
  const memberOptions = (await community.listMembers({ view: "all" }).catch(() => [])).map((m) => ({ id: m.id, label: m.name[lang] }));
  const empty = !archivedEntries.total && !members.length && !links.length && !records.total && !threads.length;
  return (
    <>
      <DeskHead
        kicker="Archive bin"
        title={tr(lang, "回收站", "Archive bin")}
        lede={tr(
          lang,
          "这里没有永久删除：归档的文章、主页、友链、纪行与隐藏的论坛主题都保留全部历史，可以逐项恢复。",
          "There is no permanent delete here: archived entries, pages, links, records and hidden threads keep their whole history and can be restored one by one.",
        )}
      />
      {empty ? (
        <EmptyDrawer title={tr(lang, "回收站是空的。", "The archive bin is empty.")}>
          {tr(lang, "归档或隐藏的内容会出现在这里。", "Anything archived or hidden appears here.")}
        </EmptyDrawer>
      ) : null}
      <Section id="t-entries" title={tr(lang, "文章", "Entries")} count={archivedEntries.total}>
        <Ledger label={tr(lang, "已归档的文章", "Archived entries")}>
          {archivedEntries.rows.map((entry) => (
            <LedgerRow key={entry.id} muted className="md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="font-mono text-meta text-ink-3">
                  {entry.id} · {tr(lang, "归档于", "Archived")} {formatWhen(entry.archivedAt, lang)}
                </p>
                <p className="font-display text-h4 break-words">{entry.title[lang] || entry.title.zh}</p>
              </div>
              <EntryAdminActions entry={entry} />
            </LedgerRow>
          ))}
        </Ledger>
      </Section>
      <Section id="t-members" title={tr(lang, "成员主页", "Member pages")} count={members.length}>
        <Ledger label={tr(lang, "已归档的主页", "Archived pages")}>
          {members.map((member) => (
            <LedgerRow key={member.id} muted className="md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div>
                <p className="font-display text-h4">{member.name[lang]}</p>
                <p className="font-mono text-meta text-ink-3">/members/{member.handle}</p>
              </div>
              <MemberRowActions member={member} />
            </LedgerRow>
          ))}
        </Ledger>
      </Section>
      <Section id="t-links" title={tr(lang, "友链", "Links")} count={links.length}>
        <Ledger label={tr(lang, "已归档的友链", "Archived links")}>
          {links.map((link) => (
            <LedgerRow key={link.id} muted className="md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="font-display text-h4">{link.name[lang]}</p>
                <p className="font-mono text-meta break-all text-ink-3">{link.url}</p>
              </div>
              <LinkRowActions link={link} />
            </LedgerRow>
          ))}
        </Ledger>
      </Section>
      <Section id="t-chronicles" title={tr(lang, "纪行", "Chronicles")} count={records.total}>
        <Ledger label={tr(lang, "已归档的纪行", "Archived records")}>
          {records.rows.map((record) => (
            <LedgerRow key={record.id} muted className="md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div>
                <p className="font-mono text-meta text-ink-3">
                  No. {String(record.number).padStart(3, "0")} · {record.date.slice(0, 10)}
                </p>
                <p className="font-display text-h4">{record.title[lang]}</p>
              </div>
              <ChronicleRowActions record={record} members={memberOptions} />
            </LedgerRow>
          ))}
        </Ledger>
      </Section>
      <Section id="t-threads" title={tr(lang, "隐藏的主题", "Hidden threads")} count={threads.length}>
        <Ledger label={tr(lang, "隐藏的主题", "Hidden threads")}>
          {threads.map((thread) => (
            <LedgerRow key={thread.id} muted className="md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="font-mono text-meta text-ink-3">
                  #{thread.number} · {thread.moderationNote ?? ""}
                </p>
                <Link href={`/forum/${thread.id}`} className="pw-link font-display text-h4 break-words">
                  {thread.title}
                </Link>
              </div>
              <ThreadModeration thread={thread} />
            </LedgerRow>
          ))}
        </Ledger>
      </Section>
    </>
  );
}
