import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import type { EditorialQuery } from "@/lib/services/contracts";
import { Pager, ReadFailure, tr } from "@/components/admin/desk";
import { DeskFilters } from "@/components/admin/DeskFilters";
import { EntryRegister, NoEntries } from "@/components/admin/EntryRegister";
import { AccessGate, gateReason } from "@/components/states/AccessGate";

export const metadata: Metadata = { title: "我的文章 My entries" };

const LIMIT = 20;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

/** An author's own entries: drafts, submissions, returned ones with their reasons, and what is public. */
export default async function MyEntries({ searchParams }: PageProps<"/account/entries">) {
  const lang = await getLang();
  const params = await searchParams;
  const { auth, entries } = getServices();
  const account = await auth.getCurrentAccount();
  const refused = gateReason(account, "author");
  if (refused) return <AccessGate reason={refused} lang={lang} next="/account/entries" />;
  const q = one(params.q);
  const status = one(params.status);
  const offset = Math.max(0, Number(one(params.offset)) || 0);
  const page = await entries
    .listEditorial({
      scope: "mine",
      text: q,
      status: status ? [status as NonNullable<EditorialQuery["status"]>[number]] : [],
      view: "all",
      limit: LIMIT,
      offset,
    })
    .catch(() => null);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-prose text-small leading-relaxed text-ink-2">
          {tr(
            lang,
            "你的条目在这里，包括从未发布的草稿。草稿和待审内容只有你和管理员能看到；读者看到的是“公开版本”一栏的修订。",
            "Your entries, including drafts never published. Drafts and submissions are seen only by you and administrators; readers see the Public revision.",
          )}
        </p>
        <Link href="/editor/new" className="pw-stamp-button [--draft:var(--color-ink)]">
          {tr(lang, "新建条目", "New entry")}
        </Link>
      </div>
      <DeskFilters
        text={{ value: q, placeholder: tr(lang, "编号或标题", "Number or title") }}
        filters={[
          {
            name: "status",
            label: tr(lang, "状态", "State"),
            value: status,
            options: [
              ["", tr(lang, "全部", "All")],
              ["draft", tr(lang, "草稿", "Draft")],
              ["returned", tr(lang, "已退回", "Returned")],
              ["in_review", tr(lang, "待审核", "In review")],
              ["published", tr(lang, "已发布", "Published")],
            ],
          },
        ]}
      />
      {page ? (
        <>
          <EntryRegister
            lang={lang}
            page={page}
            admin={false}
            empty={
              <NoEntries lang={lang} filtered={Boolean(q || status)}>
                {!q && !status ? (
                  <Link href="/editor/new" className="pw-link text-ink">
                    {tr(lang, "写第一篇条目", "Write your first entry")} →
                  </Link>
                ) : null}
              </NoEntries>
            }
          />
          <Pager lang={lang} path="/account/entries" params={{ q, status }} offset={offset} limit={LIMIT} total={page.total} />
        </>
      ) : (
        <ReadFailure lang={lang} />
      )}
    </>
  );
}
