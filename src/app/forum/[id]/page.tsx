import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, MessageSquare } from "lucide-react";
import type { Member } from "@/lib/model/types";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { RunningHead } from "@/components/book/RunningHead";
import { Vignette } from "@/components/book/Vignette";
import { categoryOf } from "@/components/forum/categories";
import { ReplyForm } from "@/components/forum/ReplyForm";
import { ForumBody } from "@/components/forum/ForumBody";
import { Bookplate } from "@/components/members/Bookplate";
import { AuthorSigil } from "@/components/archive/AuthorSigil";
import { PostModeration, ThreadModeration } from "@/components/admin/ForumModeration";

export async function generateMetadata({ params }: PageProps<"/forum/[id]">): Promise<Metadata> {
  const { id } = await params;
  const found = await getServices()
    .community.getThread(id)
    .catch(() => null);
  return found ? { title: `${found.thread.title} · 交流 Forum` } : {};
}

function Avatar({ member, name, lang }: { member?: Member; name: string; lang: "zh" | "en" }) {
  return member ? (
    <Bookplate plate={member.plate} name={member.name} lang={lang} mini className="w-9 shadow-sheet" />
  ) : (
    <AuthorSigil seed={`forum:${name}`} className="size-9" />
  );
}

/**
 * One discussion, laid out as a forge's timeline: the opening post and each
 * reply as a dated card with its author, the discussion's facts in the
 * margin, and the reply box (or why there is none) at the foot.
 * Administrators also see hidden replies, folded, with a way back.
 */
export default async function ThreadPage({ params }: PageProps<"/forum/[id]">) {
  const { id } = await params;
  const { community, auth } = getServices();
  const account = await auth.getCurrentAccount();
  const admin = account?.role === "admin";
  const found = await community.getThread(id, { includeHidden: admin });
  if (!found) notFound();
  const { thread, posts } = found;
  const { lang } = await getT();
  const zh = lang === "zh";
  const cat = categoryOf(thread.category);
  const memberIds = [...new Set(posts.map((p) => p.memberId).filter((m): m is string => Boolean(m)))];
  const members = new Map(
    (await Promise.all(memberIds.map((m) => community.getMember(m).catch(() => null)))).flatMap((m) =>
      m ? [[m.id, m] as const] : [],
    ),
  );
  const opening = posts[0];
  const visible = posts.filter((p) => !p.hiddenAt);
  const participants = [...new Map(visible.map((p) => [p.memberId ?? `name:${p.authorName}`, p])).values()];
  const mine = account?.memberId ? await community.getMember(account.memberId).catch(() => null) : null;
  const canReply = account && account.status !== "suspended" && account.emailVerified;

  return (
    <article data-part="forum" className="flex flex-col gap-8">
      <RunningHead
        left={
          <Link href="/forum" transitionTypes={["nav-back"]} className="no-underline hover:text-ink">
            ← {zh ? "交流 · 讨论区" : "Forum · Discussions"}
          </Link>
        }
        right={`#${thread.number}`}
      />

      <header className="flex flex-col gap-3 border-b border-rule pb-6">
        <h1 className="font-display text-[clamp(2rem,4vw,3rem)] leading-tight tracking-[-0.02em] text-balance break-words">
          {thread.title} <span className="font-normal text-ink-3">#{thread.number}</span>
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-small text-ink-2">
          {thread.lockedAt ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rule-strong px-3 py-1 text-meta text-ink-2">
              <Lock aria-hidden="true" className="size-3.5" />
              {zh ? "已锁定" : "Locked"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-part px-3 py-1 text-meta text-paper-sheet">
              <MessageSquare aria-hidden="true" className="size-3.5" />
              {zh ? "讨论中" : "Open"}
            </span>
          )}
          {thread.hiddenAt ? (
            <span className="rounded-full border border-brick/50 px-3 py-1 text-meta text-brick-ink">
              {zh ? "已隐藏" : "Hidden"}
            </span>
          ) : null}
          <span>
            <span className="text-ink">{thread.authorName}</span> {zh ? "发起于" : "started this on"}{" "}
            <time dateTime={thread.createdAt}>{formatDate(thread.createdAt, lang)}</time> ·{" "}
            {zh ? `${Math.max(0, visible.length - 1)} 条回复` : `${Math.max(0, visible.length - 1)} replies`}
          </span>
        </p>
      </header>

      <div className="grid gap-x-(--space-block) gap-y-8 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <ol className="relative flex min-w-0 flex-col gap-6 before:absolute before:top-4 before:bottom-4 before:left-[1.125rem] before:w-px before:bg-rule">
          {posts.map((p) => {
            const member = p.memberId ? members.get(p.memberId) : undefined;
            const isOpening = p.id === opening?.id;
            if (p.hiddenAt)
              return (
                <li key={p.id} id={p.id} className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
                  <span
                    aria-hidden="true"
                    className="relative z-10 mt-2 size-9 rounded-full border border-dashed border-rule-strong bg-paper"
                  />
                  <div className="rounded-sm border border-dashed border-rule-strong px-4 py-3 text-small text-ink-3">
                    <p>
                      {zh ? "这条回复已被管理员隐藏" : "An administrator hid this reply"}
                      {p.moderationNote ? `：${p.moderationNote}` : "."}
                    </p>
                    <details className="mt-1">
                      <summary className="pw-link min-h-8 cursor-pointer">{zh ? "查看内容" : "Show it"}</summary>
                      <div className="mt-2 text-ink-2">
                        <ForumBody body={p.body} lang={lang} />
                      </div>
                    </details>
                    {admin ? <PostModeration post={p} opening={false} /> : null}
                  </div>
                </li>
              );
            return (
              <li
                key={p.id}
                id={p.id}
                className="relative grid scroll-mt-[calc(var(--shell-header)+1rem)] grid-cols-[2.25rem_minmax(0,1fr)] gap-3"
              >
                <span className="relative z-10 mt-1.5">
                  <Avatar member={member} name={p.authorName} lang={lang} />
                </span>
                <div className={`pw-sheet min-w-0 overflow-hidden ${isOpening ? "border-part/40" : ""}`}>
                  <div
                    className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule px-4 py-2 text-small ${isOpening ? "bg-part-wash" : "bg-paper-deep/40"}`}
                  >
                    {member ? (
                      <Link href={`/members/${member.handle}`} className="pw-link font-medium text-ink">
                        {p.authorName}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{p.authorName}</span>
                    )}
                    {member ? <span className="text-meta text-ink-3">{member.role[lang]}</span> : null}
                    <a href={`#${p.id}`} className="pw-link text-meta text-ink-3">
                      <time dateTime={p.createdAt}>{formatDate(p.createdAt, lang)}</time>
                    </a>
                    <span className="ml-auto flex items-center gap-3">
                      {p.authorName === thread.authorName && !isOpening ? (
                        <span className="rounded-xs border border-rule-strong px-1.5 text-meta text-ink-3">
                          {zh ? "发起人" : "Author"}
                        </span>
                      ) : null}
                      {admin ? <PostModeration post={p} opening={isOpening} /> : null}
                    </span>
                  </div>
                  <div className="px-4 py-4 text-body leading-relaxed text-ink">
                    <ForumBody body={p.body} lang={lang} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <aside
          aria-label={zh ? "讨论信息" : "About this discussion"}
          className="flex flex-col gap-6 text-small lg:sticky lg:top-[calc(var(--shell-header)+1.5rem)] lg:self-start"
        >
          <div>
            <p className="pw-label">{zh ? "分类" : "Category"}</p>
            <Link href={`/forum?category=${cat.id}`} className="mt-2 flex items-center gap-2 no-underline">
              <Vignette name={cat.emblem} className="w-8" sizes="32px" />
              <span className="pw-link text-part-ink">{cat.label[lang]}</span>
            </Link>
          </div>
          <div>
            <p className="pw-label">
              {zh ? `参与者 · ${participants.length}` : `Participants · ${participants.length}`}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {participants.map((p) => (
                <li key={p.id} title={p.authorName}>
                  <Avatar member={p.memberId ? members.get(p.memberId) : undefined} name={p.authorName} lang={lang} />
                  <span className="sr-only">{p.authorName}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="pw-label">{zh ? "最近活动" : "Last activity"}</p>
            <p className="mt-1 text-ink-2">{formatDate(thread.lastActivityAt, lang)}</p>
          </div>
          {admin ? (
            <div>
              <p className="pw-label">{zh ? "管理" : "Moderation"}</p>
              <div className="mt-2">
                <ThreadModeration thread={thread} />
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <section aria-label={zh ? "回复" : "Reply"} className="max-w-4xl border-t border-rule pt-8 lg:pl-12">
        {thread.lockedAt ? (
          <p className="flex items-center gap-2 text-small text-ink-2">
            <Lock aria-hidden="true" className="size-4" />
            {zh ? "这个讨论已被锁定，不能再回复。" : "This discussion is locked; it takes no new replies."}
            {thread.moderationNote ? <span className="text-ink-3">（{thread.moderationNote}）</span> : null}
          </p>
        ) : !account ? (
          <p className="text-small text-ink-2">
            <Link href={`/login?next=/forum/${thread.id}`} className="pw-link text-ink">
              {zh ? "登录" : "Sign in"}
            </Link>{" "}
            {zh ? "后参与讨论。" : "to join the discussion."}
          </p>
        ) : !canReply ? (
          <p className="text-small text-ink-2">
            {account.status === "suspended"
              ? zh
                ? "账号已停用，不能回复。"
                : "This account is suspended and cannot reply."
              : zh
                ? "验证邮箱后才能回复。"
                : "Verify your email to reply."}
          </p>
        ) : (
          <ReplyForm
            threadId={thread.id}
            accountId={account.id}
            signature={mine ? mine.name[lang] : account.name[lang]}
          />
        )}
      </section>
    </article>
  );
}
