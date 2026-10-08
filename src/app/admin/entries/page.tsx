import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import type { EditorialQuery } from "@/lib/services/contracts";
import { DeskHead, Pager, ReadFailure, tr } from "@/components/admin/desk";
import { DeskFilters } from "@/components/admin/DeskFilters";
import { EntryRegister, NoEntries } from "@/components/admin/EntryRegister";

export const metadata: Metadata = { title: "文章 Entries" };

const LIMIT = 25;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

/** Every entry in the archive: drafts, submissions, published and archived ones, searchable and paged. */
export default async function AdminEntries({ searchParams }: PageProps<"/admin/entries">) {
  const lang = await getLang();
  const params = await searchParams;
  const q = one(params.q);
  const status = one(params.status);
  const view = (
    ["active", "archived", "all"].includes(one(params.view)) ? one(params.view) : "active"
  ) as EditorialQuery["view"];
  const offset = Math.max(0, Number(one(params.offset)) || 0);
  const page = await getServices()
    .entries.listEditorial({
      scope: "all",
      text: q,
      status: status ? [status as NonNullable<EditorialQuery["status"]>[number]] : [],
      view,
      limit: LIMIT,
      offset,
    })
    .catch(() => null);
  return (
    <>
      <DeskHead
        kicker="Register of entries"
        title={tr(lang, "文章", "Entries")}
        lede={tr(
          lang,
          "这里列出全部条目及其最新修订。读者只会看到“公开版本”一栏中的修订；草稿与待审内容不会出现在任何公开页面。",
          "Every entry with its latest revision. Readers only ever see the revision in the Public column; drafts and submissions appear on no public page.",
        )}
        actions={
          <Link href="/editor/new" className="pw-stamp-button [--draft:var(--color-ink)]">
            {tr(lang, "新建条目", "New entry")}
          </Link>
        }
      />
      <DeskFilters
        text={{ value: q, placeholder: tr(lang, "编号、标题或地址", "Number, title or address") }}
        filters={[
          {
            name: "status",
            label: tr(lang, "状态", "State"),
            value: status,
            options: [
              ["", tr(lang, "全部", "All")],
              ["draft", tr(lang, "草稿", "Draft")],
              ["in_review", tr(lang, "待审核", "In review")],
              ["returned", tr(lang, "已退回", "Returned")],
              ["published", tr(lang, "已发布", "Published")],
              ["unpublished", tr(lang, "从未发布", "Never published")],
            ],
          },
          {
            name: "view",
            label: tr(lang, "范围", "Showing"),
            value: view === "active" ? "" : (view ?? ""),
            options: [
              ["", tr(lang, "在用", "In use")],
              ["archived", tr(lang, "已归档", "Archived")],
              ["all", tr(lang, "全部", "Everything")],
            ],
          },
        ]}
      />
      {page ? (
        <>
          <EntryRegister
            lang={lang}
            page={page}
            admin
            empty={<NoEntries lang={lang} filtered={Boolean(q || status || view !== "active")} />}
          />
          <Pager
            lang={lang}
            path="/admin/entries"
            params={{ q, status, view: view === "active" ? undefined : view }}
            offset={offset}
            limit={LIMIT}
            total={page.total}
          />
        </>
      ) : (
        <ReadFailure lang={lang} />
      )}
    </>
  );
}
