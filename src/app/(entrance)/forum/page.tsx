import type { Metadata } from "next";
import Link from "next/link";
import type { ForumCategory } from "@/lib/model/types";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { Vignette } from "@/components/book/Vignette";
import { FORUM_CATEGORIES, categoryOf } from "@/components/forum/categories";
import { NewThreadForm } from "@/components/forum/NewThreadForm";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "交流 Forum" };

/**
 * Part IV · 交流 Forum — the register of a drawing office. Each thread is a
 * sheet with its number, title, category emblem, author, replies and last
 * activity; a new sheet is filed at the foot of the register.
 */
export default async function ForumPart({ searchParams }: PageProps<"/forum">) {
  const { lang } = await getT();
  const zh = lang === "zh";
  const q = await searchParams;
  const category = FORUM_CATEGORIES.some((c) => c.id === q.category) ? (q.category as ForumCategory) : undefined;
  const { community } = getServices();
  const [threads, everything] = await Promise.all([community.listThreads({ category }), community.listThreads()]);
  const nextNumber = Math.max(0, ...everything.map((t) => t.number)) + 1;

  return (
    <div data-part="forum" className="mt-(--space-block) flex flex-col">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b-2 border-part pb-4">
        <div>
          <p className="font-mono text-meta tracking-[0.18em] text-part-ink uppercase">
            {zh ? "图纸登记簿" : "Drawing register"}
          </p>
          <h2 className="mt-2 font-display text-[clamp(2.5rem,5vw,4.5rem)] leading-none tracking-[-0.03em]">
            {zh ? "登记簿" : "Register"}
          </h2>
        </div>
        <nav aria-label={zh ? "分类" : "Categories"} className="flex flex-wrap gap-x-5 gap-y-2 text-small">
          {[{ id: undefined, label: { zh: "全部", en: "All" } }, ...FORUM_CATEGORIES].map((c) => (
            <Link
              key={c.id ?? "all"}
              href={c.id ? `/forum?category=${c.id}` : "/forum"}
              scroll={false}
              aria-current={c.id === category ? "page" : undefined}
              className={cn(
                "pw-link text-ink-3 hover:text-ink",
                c.id === category && "text-part-ink [background-size:100%_1px]",
              )}
            >
              {c.label[lang]}
            </Link>
          ))}
        </nav>
      </header>

      <ol className="pw-blueprint-grid border-x border-part/30">
        {threads.map((th, i) => {
          const cat = categoryOf(th.category);
          return (
            <li
              key={th.id}
              data-reveal="rise"
              style={{ "--i": i % 6 } as React.CSSProperties}
              className="border-b border-part/30"
            >
              <Link
                href={`/forum/${th.id}`}
                className="group grid grid-cols-[4.5rem_1fr] items-center gap-4 px-4 py-5 no-underline transition-colors duration-(--dur-quick) hover:bg-part-wash sm:grid-cols-[4.5rem_3.5rem_1fr_9rem] sm:gap-6"
              >
                <span className="font-mono text-meta text-part-ink">
                  {zh ? "第" : "Sht."} {String(th.number).padStart(3, "0")}
                  {zh ? "号" : ""}
                </span>
                <Vignette name={cat.emblem} className="pw-lift hidden w-14 sm:block" sizes="56px" />
                <span className="min-w-0">
                  <span className="block font-display text-h4 leading-snug text-ink">
                    <span className="pw-link">{th.title}</span>
                  </span>
                  <span className="mt-1 block truncate text-small text-ink-3">{th.excerpt}</span>
                </span>
                <span className="col-start-2 flex flex-col gap-0.5 font-mono text-[0.6875rem] text-ink-3 sm:col-start-auto sm:text-right">
                  <span className="text-part-ink uppercase">{cat.label[lang]}</span>
                  <span>
                    {th.authorName} · {th.postCount} {zh ? "帖" : th.postCount === 1 ? "post" : "posts"}
                  </span>
                  <time dateTime={th.lastActivityAt}>{formatDate(th.lastActivityAt, lang)}</time>
                </span>
              </Link>
            </li>
          );
        })}
        {threads.length === 0 ? (
          <li className="px-4 py-10 text-center text-small text-ink-3">
            {zh ? "这个分类还没有图纸。" : "No sheets in this category yet."}
          </li>
        ) : null}
      </ol>

      <section aria-labelledby="new-sheet" className="mt-(--space-block) flex flex-col gap-8">
        <div className="flex items-end gap-6">
          <Vignette name="bp-pulley" className="hidden w-16 shrink-0 sm:block" sizes="64px" />
          <div>
            <h3 id="new-sheet" className="font-display text-h2 leading-tight">
              {zh ? "登记新图纸" : "File a new sheet"}
            </h3>
            <p className="mt-2 max-w-[44em] text-small leading-relaxed text-ink-3">
              {zh
                ? "提问、分享你做的东西、对某个条目提意见，或申请互换友链。讨论条目时请写上编号，例如 PW-0001。"
                : "Ask, show what you made, comment on an entry, or ask to exchange links. Mention an entry by its number, e.g. PW-0001."}
            </p>
          </div>
        </div>
        <NewThreadForm nextNumber={nextNumber} today={formatDate(new Date().toISOString(), lang)} />
      </section>
    </div>
  );
}
