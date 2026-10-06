import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Asset, EntrySummary, Lang } from "@/lib/model/types";
import { DOMAINS, INKS } from "@/lib/model/vocab";
import { pick } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { publicRepos } from "@/lib/members/github";
import { Markdown } from "@/components/markdown/Markdown";
import { Bookplate } from "@/components/members/Bookplate";
import { BookplateDownload } from "@/components/members/BookplateDownload";
import { Frontispiece } from "@/components/members/Frontispiece";

export async function generateMetadata({ params }: PageProps<"/members/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const m = await getServices().community.getMember(handle);
  return m ? { title: `${m.name.zh} ${m.name.en} · 成员 Members`, description: m.bio.en } : {};
}

function SectionTitle({ zh, en, lang, count }: { zh: string; en: string; lang: Lang; count?: string }) {
  return (
    <h2 className="pw-ink-under mb-5 flex items-baseline justify-between gap-4 pb-2">
      <span className="font-display text-h3">
        {lang === "zh" ? zh : en} <span className="ml-1 text-h4 text-ink-3">{lang === "zh" ? en : zh}</span>
      </span>
      {count ? <span className="font-mono text-meta text-ink-3">{count}</span> : null}
    </h2>
  );
}

/**
 * A member's own page, set as their own book: the frontispiece (their large
 * image) across the top, their bookplate pasted onto it, then the book itself —
 * what they say about themselves, the entries and letters they have written,
 * where else to find them, and their workshop on GitHub.
 */
export default async function MemberPage({ params }: PageProps<"/members/[handle]">) {
  const { handle } = await params;
  const { community, entries, references, auth } = getServices();
  const member = await community.getMember(handle);
  if (!member) notFound();
  const { lang } = await getT();
  const zh = lang === "zh";
  const other: Lang = zh ? "en" : "zh";
  const ink = INKS[member.plate.ink].hex;

  const [user, all, posts, repos] = await Promise.all([
    auth.getCurrentUser(),
    entries.listEntries(),
    community.listPostsBy(member.id),
    member.github ? publicRepos(member.github) : Promise.resolve([]),
  ]);
  const own = Boolean(user && member.authorId === user.id);
  const written: EntrySummary[] = member.authorId ? all.filter((e) => e.authorId === member.authorId) : [];
  const plates = new Map<string, Asset>();
  await Promise.all(
    written.slice(0, 6).map(async (e) => {
      const a = e.heroAssetId ? await references.getAsset(e.heroAssetId) : null;
      if (a) plates.set(e.id, a);
    }),
  );

  return (
    <article className="flex flex-col" style={{ "--plate-ink": ink } as React.CSSProperties}>
      {/* Frontispiece */}
      <div className="relative -mt-8 ml-[calc(50%-50vw)] w-screen sm:-mt-10">
        <Frontispiece
          cover={member.cover}
          ink={member.plate.ink}
          alt={zh ? `${member.name.zh}的主页大图` : `${member.name.en}'s page image`}
          className="h-[clamp(18rem,58vh,40rem)]"
        />
      </div>

      {/* Bookplate pasted on the endpaper, and the title page beside it */}
      <header className="relative grid gap-x-(--space-block) gap-y-6 lg:grid-cols-12">
        <div className="relative z-10 mx-auto -mt-36 w-52 sm:w-60 lg:col-span-3 lg:mx-0 lg:-mt-56 lg:w-full lg:max-w-[16rem]">
          <Bookplate plate={member.plate} name={member.name} lang={lang} pasted />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-9 lg:pt-8">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-meta tracking-[0.14em] text-ink-3 uppercase">
            <Link href="/members" transitionTypes={["nav-back"]} className="pw-link normal-case">
              ← {zh ? "成员" : "Members"}
            </Link>
            <span>Ex libris No. {String(member.plate.number).padStart(3, "0")}</span>
            {member.sample ? <span className="pw-stamp normal-case">{zh ? "示例" : "sample"}</span> : null}
          </p>
          <h1 className="font-display leading-[0.95] tracking-[-0.02em]">
            <span lang={zh ? "zh-CN" : "en"} className="block text-[clamp(2.75rem,6vw,5rem)] font-[480]">
              {member.name[lang]}
            </span>
            {member.name[other] !== member.name[lang] ? (
              <span className="mt-1 block text-h3 text-ink-3 italic">{member.name[other]}</span>
            ) : null}
          </h1>
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-small">
            <span className="font-display text-lead italic" style={{ color: ink }}>
              {member.role[lang]}
            </span>
            <span className="font-mono text-meta text-ink-3">@{member.handle}</span>
            <span className="font-mono text-meta text-ink-3">
              {zh ? "入团" : "Joined"} {formatDate(member.joined, lang)}
            </span>
          </p>
          <p className="max-w-[40em] text-lead text-ink-2">{member.bio[lang]}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
            {own ? (
              <Link
                href={`/members/${member.handle}/edit`}
                className="inline-flex h-9 items-center rounded-sm px-4 text-small text-paper-sheet no-underline transition-opacity duration-(--dur-quick) hover:opacity-90"
                style={{ background: ink }}
              >
                {zh ? "编辑我的主页" : "Edit my page"}
              </Link>
            ) : null}
            <BookplateDownload plate={member.plate} name={member.name} handle={member.handle} lang={lang} />
          </div>
        </div>
      </header>

      <div className="mt-(--space-section) grid gap-x-(--space-block) gap-y-16 lg:grid-cols-12">
        {/* About */}
        <section aria-label={zh ? "自述" : "About"} className="min-w-0 lg:col-span-7">
          <SectionTitle zh="自述" en="About" lang={lang} />
          <Markdown lang={lang}>{member.about}</Markdown>
        </section>

        <aside className="flex min-w-0 flex-col gap-14 lg:col-span-5">
          {/* Links */}
          {member.links.length ? (
            <section>
              <SectionTitle zh="别处" en="Elsewhere" lang={lang} />
              <ul className="flex flex-col gap-3">
                {member.links.map((l) => (
                  <li key={l.url}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-baseline justify-between gap-4 no-underline"
                    >
                      <span className="font-display text-lead text-ink">
                        <span className="pw-link">{l.label}</span>
                      </span>
                      <span className="truncate font-mono text-meta" style={{ color: ink }}>
                        {l.url.replace(/^(https?:\/\/|mailto:)/, "")} <span className="pw-nudge">↗</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Library: entries written */}
          {written.length ? (
            <section>
              <SectionTitle
                zh="藏书"
                en="Library"
                lang={lang}
                count={zh ? `${written.length} 篇条目` : `${written.length} entries`}
              />
              <ol className="flex flex-col">
                {written.slice(0, 8).map((e) => (
                  <li key={e.id} className="border-b border-rule">
                    <Link
                      href={`/entries/${e.slug}`}
                      className="group grid grid-cols-[4.75rem_1fr] items-baseline gap-3 py-2.5 no-underline"
                    >
                      <span className="font-mono text-meta text-ink-3">{e.id}</span>
                      <span className="min-w-0">
                        <span className="font-display text-lead text-ink">
                          <span className="pw-link">{pick(e.title, lang)}</span>
                        </span>
                        <span className="ml-2 text-meta text-ink-3">{DOMAINS[e.domain][lang]}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
              {written.length > 8 ? (
                <Link
                  href={`/search?author=${member.authorId}`}
                  className="pw-link mt-3 inline-block text-small"
                  style={{ color: ink }}
                >
                  {zh ? `全部 ${written.length} 篇` : `All ${written.length}`} →
                </Link>
              ) : null}
            </section>
          ) : null}

          {/* Correspondence: forum posts */}
          <section>
            <SectionTitle
              zh="往来"
              en="Correspondence"
              lang={lang}
              count={zh ? `${posts.length} 帖` : `${posts.length} posts`}
            />
            {posts.length ? (
              <ol className="flex flex-col gap-4">
                {posts.slice(0, 5).map(({ post, thread }) => (
                  <li key={post.id}>
                    <Link href={`/forum/${thread.id}`} className="group block no-underline">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-display text-body text-ink">
                          <span className="pw-link">{thread.title}</span>
                        </span>
                        <time dateTime={post.createdAt} className="shrink-0 font-mono text-meta text-ink-3">
                          {formatDate(post.createdAt, lang)}
                        </time>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-small text-ink-3">{post.body}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-small text-ink-3">{zh ? "还没有在交流区留下文字。" : "Nothing in the forum yet."}</p>
            )}
          </section>
        </aside>
      </div>

      {/* Workshop: public GitHub repositories */}
      {member.github ? (
        <section className="mt-(--space-section)">
          <SectionTitle zh="工坊" en="Workshop" lang={lang} count={`GitHub · @${member.github}`} />
          {repos.length ? (
            <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {repos.map((r, i) => (
                <li key={r.url} data-reveal="rise" style={{ "--i": i } as React.CSSProperties}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="pw-card group flex h-full flex-col gap-2 px-5 pb-5 no-underline"
                  >
                    <span className="pw-label flex h-11 items-center justify-between">
                      <span>{zh ? "仓库" : "Repository"}</span>
                      <span className="font-mono normal-case">No. {String(i + 1).padStart(2, "0")}</span>
                    </span>
                    <span className="mt-2 font-display text-h4 text-ink">
                      <span className="pw-link">{r.name}</span> <span className="pw-nudge text-ink-3">↗</span>
                    </span>
                    <span className="line-clamp-3 flex-1 text-small text-ink-2">
                      {r.description ?? (zh ? "（没有描述）" : "(no description)")}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-4 font-mono text-meta text-ink-3">
                      {r.language ? <span style={{ color: ink }}>{r.language}</span> : null}
                      <span>★ {r.stars}</span>
                      <time dateTime={r.updatedAt}>{formatDate(r.updatedAt, lang)}</time>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-small text-ink-3">
              {zh ? "暂时无法读取 GitHub 上的仓库。" : "GitHub could not be reached just now."}{" "}
              <a
                href={`https://github.com/${member.github}`}
                target="_blank"
                rel="noreferrer"
                className="pw-link"
                style={{ color: ink }}
              >
                github.com/{member.github} ↗
              </a>
            </p>
          )}
        </section>
      ) : null}
    </article>
  );
}
