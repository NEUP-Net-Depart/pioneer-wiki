import type { Metadata } from "next";
import Link from "next/link";
import { Lock, MessageSquare } from "lucide-react";
import type { ForumCategory } from "@/lib/model/types";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { Vignette } from "@/components/book/Vignette";
import { FORUM_CATEGORIES, categoryOf } from "@/components/forum/categories";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "交流 Forum" };

const LIMIT = 30;

/**
 * Part IV · 交流 — discussions, listed the way a code forge lists them: the
 * category's emblem, the title, who started it and when, how many replies and
 * how recently; a locked discussion says so. Starting one has its own page.
 */
export default async function ForumPart({ searchParams }: PageProps<"/forum">) {
  const { lang } = await getT();
  const zh = lang === "zh";
  const q = await searchParams;
  const category = FORUM_CATEGORIES.some((c) => c.id === q.category) ? (q.category as ForumCategory) : undefined;
  const offset = Math.max(0, Number(typeof q.offset === "string" ? q.offset : 0) || 0);
  const { community, auth } = getServices();
  const [threads, account] = await Promise.all([
    community.listThreads({ category, limit: LIMIT + 1, offset }).catch(() => null),
    auth.getCurrentAccount(),
  ]);
  const page = threads?.slice(0, LIMIT) ?? [];
  const more = (threads?.length ?? 0) > LIMIT;
  const href = (next: number) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (next) params.set("offset", String(next));
    const search = params.toString();
    return search ? `/forum?${search}` : "/forum";
  };

  return (
    <div data-part="forum" className="mt-(--space-block) flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-part pb-4">
        <div>
          <p className="font-mono text-meta tracking-[0.18em] text-part-ink uppercase">{zh ? "交流 · 讨论区" : "Forum · Discussions"}</p>
          <h2 className="mt-2 font-display text-[clamp(2.5rem,5vw,4.5rem)] leading-none tracking-[-0.03em]">{zh ? "讨论" : "Discussions"}</h2>
          <p className="mt-3 max-w-prose text-small text-ink-2">
            {zh ? "提问、分享作品、讨论条目或站务。讨论条目时写上编号，例如 PW-0001。" : "Ask, show your work, discuss entries or the site. Cite entries by number, e.g. PW-0001."}
          </p>
        </div>
        <Link href="/forum/new" className="pw-stamp-button">
          {zh ? "发起讨论" : "New discussion"}
        </Link>
      </header>

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label={zh ? "分类" : "Categories"} className="lg:sticky lg:top-[calc(var(--shell-header)+1.5rem)] lg:self-start">
          <p className="pw-smallcaps mb-2 hidden text-meta text-ink-3 lg:block">{zh ? "分类" : "Categories"}</p>
          <ul className="flex gap-x-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5">
            {[{ id: undefined, label: { zh: "全部讨论", en: "All discussions" }, emblem: "bp-gears" }, ...FORUM_CATEGORIES].map((c) => {
              const current = c.id === category;
              return (
                <li key={c.id ?? "all"} className="shrink-0">
                  <Link
                    href={c.id ? `/forum?category=${c.id}` : "/forum"}
                    scroll={false}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-sm px-3 text-small whitespace-nowrap no-underline",
                      current ? "bg-part-wash text-part-ink" : "text-ink-2 hover:bg-ink/5 hover:text-ink",
                    )}
                  >
                    {c.id ? <Vignette name={c.emblem} className="w-6" sizes="24px" /> : null}
                    {c.label[lang]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <section aria-label={zh ? "讨论列表" : "Discussion list"} className="min-w-0">
          {threads === null ? (
            <p role="alert" className="pw-sheet p-6 text-small text-brick-ink">
              {zh ? "讨论列表暂时无法读取，请稍后刷新。" : "The discussions could not be read; refresh in a moment."}
            </p>
          ) : page.length === 0 ? (
            <div className="pw-sheet flex flex-col items-start gap-3 p-8 text-small text-ink-2">
              <p className="font-display text-h4 text-ink">{zh ? "这里还没有讨论。" : "No discussions here yet."}</p>
              <Link href="/forum/new" className="pw-link text-part-ink">
                {zh ? "发起第一个讨论" : "Start the first one"} →
              </Link>
            </div>
          ) : (
            <ol className="pw-sheet divide-y divide-rule overflow-hidden">
              {page.map((th) => {
                const cat = categoryOf(th.category);
                return (
                  <li key={th.id} className="group relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 px-4 py-4 hover:bg-part-wash sm:grid-cols-[2.5rem_minmax(0,1fr)_6rem] sm:px-5">
                    <Vignette name={cat.emblem} className="mt-0.5 w-10" sizes="40px" />
                    <div className="min-w-0">
                      <h3 className="font-display text-h4 leading-snug break-words text-ink">
                        <Link href={`/forum/${th.id}`} className="no-underline after:absolute after:inset-0 group-hover:underline">
                          {th.title}
                        </Link>
                        {th.lockedAt ? (
                          <span className="ml-2 inline-flex translate-y-[-1px] items-center gap-1 rounded-xs border border-rule-strong px-1.5 align-middle font-sans text-meta text-ink-3">
                            <Lock aria-hidden="true" className="size-3" />
                            {zh ? "已锁定" : "Locked"}
                          </span>
                        ) : null}
                      </h3>
                      <p className="mt-1 text-small break-words text-ink-3">{th.excerpt}</p>
                      <p className="mt-1.5 font-mono text-meta text-ink-3">
                        #{th.number} · <span className="text-part-ink">{cat.label[lang]}</span> · {th.authorName}{" "}
                        {zh ? "发起于" : "started"} <time dateTime={th.createdAt}>{formatDate(th.createdAt, lang)}</time>
                      </p>
                    </div>
                    <div className="col-start-2 mt-2 flex items-center gap-3 font-mono text-meta text-ink-3 sm:col-start-auto sm:mt-0 sm:flex-col sm:items-end sm:justify-center sm:gap-1">
                      <span className="inline-flex items-center gap-1" title={zh ? "回复数" : "Replies"}>
                        <MessageSquare aria-hidden="true" className="size-3.5" />
                        {Math.max(0, th.postCount - 1)}
                        <span className="sr-only">{zh ? "条回复" : " replies"}</span>
                      </span>
                      <time dateTime={th.lastActivityAt} title={zh ? "最近活动" : "Last activity"}>
                        {formatDate(th.lastActivityAt, lang)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {offset > 0 || more ? (
            <nav aria-label={zh ? "分页" : "Pages"} className="mt-4 flex justify-between text-small">
              {offset > 0 ? (
                <Link href={href(Math.max(0, offset - LIMIT))} className="pw-link min-h-11 py-3">
                  ← {zh ? "较新的讨论" : "Newer"}
                </Link>
              ) : (
                <span />
              )}
              {more ? (
                <Link href={href(offset + LIMIT)} className="pw-link min-h-11 py-3">
                  {zh ? "更早的讨论" : "Older"} →
                </Link>
              ) : null}
            </nav>
          ) : null}
          {!account ? (
            <p className="mt-6 text-small text-ink-3">
              {zh ? "登录并验证邮箱后可以发起讨论和回复。" : "Sign in with a verified email to start discussions and reply."}{" "}
              <Link href="/login?next=/forum" className="pw-link text-ink">
                {zh ? "登录" : "Sign in"}
              </Link>
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
