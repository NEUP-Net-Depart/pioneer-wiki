import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { RunningHead } from "@/components/book/RunningHead";
import { Vignette } from "@/components/book/Vignette";
import { categoryOf } from "@/components/forum/categories";
import { ReplyForm } from "@/components/forum/ReplyForm";
import { Bookplate } from "@/components/members/Bookplate";

export async function generateMetadata({ params }: PageProps<"/forum/[id]">): Promise<Metadata> {
  const { id } = await params;
  const found = await getServices().community.getThread(id);
  return found ? { title: `${found.thread.title} · 交流 Forum` } : {};
}

/**
 * One sheet of the register: the thread title as a drawing title block, the
 * posts as numbered notes on the sheet, and a reply form at the foot.
 */
export default async function ThreadPage({ params }: PageProps<"/forum/[id]">) {
  const { id } = await params;
  const { community } = getServices();
  const found = await community.getThread(id);
  if (!found) notFound();
  const { thread, posts } = found;
  const { lang } = await getT();
  const zh = lang === "zh";
  const cat = categoryOf(thread.category);
  const members = await community.listMembers();
  const byId = new Map(members.map((m) => [m.id, m]));

  return (
    <article data-part="forum" className="flex flex-col">
      <RunningHead
        left={
          <Link href="/forum" transitionTypes={["nav-back"]} className="no-underline hover:text-ink">
            ← {zh ? "交流 · 图纸登记簿" : "Forum · Register"}
          </Link>
        }
        right={`${zh ? "第" : "Sht."} ${String(thread.number).padStart(3, "0")}${zh ? "号" : ""}`}
      />

      <header className="pw-blueprint-grid mt-(--space-block) grid gap-6 border-2 border-part p-6 sm:grid-cols-[1fr_auto] sm:p-8">
        <div>
          <p className="font-mono text-meta tracking-[0.16em] text-part-ink uppercase">
            {cat.label[lang]} · {formatDate(thread.createdAt, lang)}
          </p>
          <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3.25rem)] leading-tight tracking-[-0.02em] text-balance">
            {thread.title}
          </h1>
          <p className="mt-3 text-small text-ink-3">
            {thread.authorName} · {posts.length} {zh ? "帖" : posts.length === 1 ? "post" : "posts"}
          </p>
        </div>
        <Vignette name={cat.emblem} className="hidden w-28 sm:block" sizes="112px" />
      </header>

      <ol className="mx-auto mt-(--space-block) flex w-full max-w-(--measure) flex-col gap-10">
        {posts.map((p, i) => {
          const member = p.memberId ? byId.get(p.memberId) : undefined;
          return (
            <li
              key={p.id}
              data-reveal="rise"
              style={{ "--i": i % 5 } as React.CSSProperties}
              className="grid grid-cols-[2.5rem_1fr] gap-4"
            >
              <span className="pt-1 font-mono text-meta text-part-ink">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-3 text-small">
                  {member ? (
                    <Link href={`/members/${member.handle}`} className="group flex items-center gap-2 no-underline">
                      <Bookplate
                        plate={member.plate}
                        name={member.name}
                        lang={lang}
                        mini
                        className="w-7 shadow-sheet transition-transform duration-(--dur-quick) group-hover:-rotate-6"
                      />
                      <span className="font-display text-lead text-ink">
                        <span className="pw-link">{p.authorName}</span>
                      </span>
                    </Link>
                  ) : (
                    <span className="font-display text-lead text-ink">{p.authorName}</span>
                  )}
                  {member ? <span className="pw-smallcaps text-meta text-part-ink">{member.role[lang]}</span> : null}
                  <time dateTime={p.createdAt} className="font-mono text-meta text-ink-3">
                    {formatDate(p.createdAt, lang)}
                  </time>
                </p>
                <div className="mt-2 flex flex-col gap-3 text-body leading-relaxed text-ink-2">
                  {p.body.split(/\n{2,}/).map((para, k) => (
                    <p key={k} className="whitespace-pre-line">
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <section aria-label={zh ? "回复" : "Reply"} className="mx-auto mt-(--space-block) w-full max-w-4xl">
        <ReplyForm
          threadId={thread.id}
          sheetNumber={thread.number}
          nextPost={posts.length + 1}
          today={formatDate(new Date().toISOString(), lang)}
        />
      </section>
    </article>
  );
}
