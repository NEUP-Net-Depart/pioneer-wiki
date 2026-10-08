import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import { toRoman } from "@/lib/roman";
import type { AdminTodo } from "@/lib/services/contracts";
import { DeskHead, tr } from "@/components/admin/desk";
import { ADMIN_GROUPS } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: "总览 Overview" };

const NOTES: Record<string, { zh: string; en: string }> = {
  "/admin/review": { zh: "逐行比对正文与元数据，发布、退回或回滚。", en: "Compare body and metadata, then publish, return or roll back." },
  "/admin/entries": { zh: "全部文章：草稿、待审、已发布与归档。", en: "Every entry: drafts, submissions, published and archived." },
  "/admin/assets": { zh: "批准或拒绝上传的插图，核对替代文本与许可。", en: "Approve or reject uploaded figures; check alt text and licence." },
  "/admin/taxonomy": { zh: "科与属的编目，保存即公开，每次修改留版。", en: "Families and genera; saved at once, every change versioned." },
  "/admin/applications": { zh: "读者申请作者资格或成员主页。", en: "Readers asking for author status or a member page." },
  "/admin/accounts": { zh: "角色、停用、身份绑定与注销处理。", en: "Roles, suspension, identity bindings and closures." },
  "/admin/members": { zh: "建立、编辑、归档成员主页。", en: "Create, edit and archive member pages." },
  "/admin/links": { zh: "维护友链目录与地图上的领地。", en: "Keep the friend-link gazetteer and its chart." },
  "/admin/chronicles": { zh: "纪行编年册的新增、修改与归档。", en: "Add, edit and archive the annals." },
  "/admin/forum": { zh: "隐藏或恢复违规内容，锁定主题。", en: "Hide or restore posts, lock threads." },
  "/admin/trash": { zh: "已归档或隐藏的内容，可随时恢复。", en: "Everything archived or hidden, ready to restore." },
  "/admin/audit": { zh: "谁在何时对什么做了什么。", en: "Who did what to which record, and when." },
};

/**
 * 总览 — set like a book's table of contents: what is waiting first, then
 * every room of the office with one line on what is done there.
 */
export default async function AdminOverview() {
  const lang = await getLang();
  const todo = await getServices()
    .accounts.todo()
    .catch(() => null);
  const waiting: Array<{ href: string; label: string; count: number }> = todo
    ? (
        [
          ["/admin/review", tr(lang, "篇文章等待审核", "entries waiting for review"), "reviews"],
          ["/admin/applications", tr(lang, "份资格申请等待处理", "applications to decide"), "applications"],
          ["/admin/assets", tr(lang, "张图片等待审核", "images waiting for review"), "assets"],
          ["/admin/accounts?flag=closure", tr(lang, "个账号申请注销", "accounts asking to close"), "closures"],
        ] as Array<[string, string, keyof AdminTodo]>
      ).map(([href, label, key]) => ({ href, label, count: todo[key] }))
    : [];
  const open = waiting.filter((item) => item.count > 0);
  // Rooms are numbered straight through the contents, across groups.
  const groups = ADMIN_GROUPS.slice(1);
  const firstOf = groups.map((_, index) => groups.slice(0, index).reduce((n, g) => n + g.items.length, 0));
  return (
    <>
      <DeskHead
        kicker="Editorial office"
        title={tr(lang, "编辑室", "The editorial office")}
        lede={tr(
          lang,
          "这里是先锋维基的日常运营入口：文章的审核与发布、账号与成员、友链、纪行与论坛。所有删除都是归档，可以在回收站恢复；每一次修改都记录在审计中。",
          "Where Pioneer Wiki is run day to day: reviewing and publishing entries, accounts and members, links, chronicles and the forum. Nothing is deleted, only archived and restorable; every change is in the audit log.",
        )}
      />
      <section aria-labelledby="waiting" className="flex flex-col gap-4">
        <h2 id="waiting" className="pw-double-rule font-display text-h3">
          {tr(lang, "待办", "Waiting")}
        </h2>
        {todo === null ? (
          <p role="alert" className="text-small text-brick-ink">
            {tr(lang, "待办计数暂时无法读取；各项工作仍可从下方进入。", "The counts could not be read; every room below still opens.")}
          </p>
        ) : open.length ? (
          <ul className="flex flex-col">
            {open.map((item) => (
              <li key={item.href} className="pw-ink-under">
                <Link href={item.href} className="group flex min-h-12 items-baseline gap-4 py-2 no-underline">
                  <span className="w-12 shrink-0 text-right font-display text-h3 text-brick-ink tabular-nums">{item.count}</span>
                  <span className="text-body text-ink group-hover:underline">{item.label}</span>
                  <span aria-hidden="true" className="ml-auto text-ink-3">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-ink-2">{tr(lang, "暂时没有等待处理的工作。", "Nothing is waiting right now.")}</p>
        )}
      </section>
      <section aria-labelledby="contents" className="flex flex-col gap-6">
        <h2 id="contents" className="pw-double-rule font-display text-h3">
          {tr(lang, "目录", "Contents")}
        </h2>
        <div className="grid gap-x-(--space-block) gap-y-8 md:grid-cols-2">
          {groups.map((group, groupIndex) => (
            <section key={group.en} aria-label={lang === "zh" ? group.zh : group.en}>
              <h3 className="pw-smallcaps text-small text-ink-3">{lang === "zh" ? group.zh : group.en}</h3>
              <ol className="mt-2 flex flex-col">
                {group.items.map((item, itemIndex) => {
                  const numeral = firstOf[groupIndex] + itemIndex + 1;
                  return (
                    <li key={item.href} className="pw-ink-under">
                      <Link href={item.href} className="group grid min-h-14 grid-cols-[2.5rem_1fr] gap-x-3 py-2.5 no-underline">
                        <span className="font-letterpress text-small text-ink-3">{toRoman(numeral)}</span>
                        <span>
                          <span className="font-display text-h4 text-ink group-hover:underline">
                            {lang === "zh" ? item.zh : item.en}
                          </span>
                          <span className="mt-0.5 block text-small text-ink-2">{NOTES[item.href]?.[lang]}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      </section>
    </>
  );
}
