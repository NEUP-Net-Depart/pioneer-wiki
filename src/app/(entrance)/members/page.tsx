import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { Emblem } from "@/components/members/Bookplate";

export const metadata: Metadata = { title: "成员 Members" };

/**
 * Part III · 成员 Members — the cast list of the frieze: dramatis personae.
 * Each member: their bookplate emblem in their own ink, the name (leading to
 * their own page), a dotted leader to their part in the work, a line about
 * them, and when they joined the cast.
 */
export default async function MembersPart() {
  const { lang } = await getT();
  const zh = lang === "zh";
  const { community, entries } = getServices();
  const [members, all] = await Promise.all([community.listMembers(), entries.listEntries()]);
  const other = zh ? "en" : "zh";

  return (
    <div data-part="members" className="mt-(--space-block) flex flex-col">
      <header className="mb-14 text-center">
        <p className="pw-smallcaps text-small text-part-ink">{zh ? "群像" : "The frieze · the cast"}</p>
        <h2 className="mt-4 font-display text-[clamp(2.75rem,6vw,5.25rem)] leading-none tracking-[-0.03em] italic">
          {zh ? "登场人物" : "Dramatis personae"}
        </h2>
        <div aria-hidden="true" className="pw-ornament mx-auto mt-6 max-w-xs">
          <span>❦</span>
        </div>
      </header>

      <ol className="mx-auto flex w-full max-w-4xl flex-col gap-12">
        {members.map((m, i) => {
          const written = m.authorId ? all.filter((e) => e.authorId === m.authorId).length : 0;
          return (
            <li
              key={m.id}
              data-reveal="rise"
              style={{ "--i": i % 4 } as React.CSSProperties}
              className="group grid grid-cols-[5rem_1fr] items-start gap-6 sm:grid-cols-[7rem_1fr] sm:gap-10"
            >
              <Link href={`/members/${m.handle}`} aria-hidden="true" tabIndex={-1} className="block">
                <Emblem emblem={m.plate.emblem} ink={m.plate.ink} className="pw-lift w-20 sm:w-28" />
              </Link>
              <div className="min-w-0">
                <p className="flex items-baseline gap-3">
                  <Link
                    href={`/members/${m.handle}`}
                    className="font-display text-h2 leading-tight text-ink no-underline"
                  >
                    <span className="pw-link">{m.name[lang]}</span>
                  </Link>
                  {m.name[other] !== m.name[lang] ? (
                    <span className="hidden text-h4 text-ink-3 sm:inline">{m.name[other]}</span>
                  ) : null}
                  <span aria-hidden="true" className="pw-leader" />
                  <span className="font-display text-lead text-part-ink italic">{m.role[lang]}</span>
                </p>
                <p className="mt-2 max-w-[36em] text-small leading-relaxed text-ink-2">{m.bio[lang]}</p>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[0.6875rem] tracking-[0.12em] text-ink-3 uppercase">
                  <span className="normal-case">@{m.handle}</span>
                  <span>
                    {zh ? "入团" : "Joined"} {formatDate(m.joined, lang)}
                  </span>
                  {written ? (
                    <Link href={`/search?author=${m.authorId}`} className="pw-link normal-case text-part-ink">
                      {zh ? `${written} 篇条目` : `${written} entries`} →
                    </Link>
                  ) : null}
                  {m.sample ? <span className="pw-stamp normal-case">{zh ? "示例" : "sample"}</span> : null}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="pw-ink-over mx-auto mt-(--space-block) w-full max-w-4xl pt-6 text-center text-small text-ink-3">
        {zh
          ? "想加入这台戏？在交流区自我介绍，或直接撰写一篇新条目。"
          : "Want a part in the play? Introduce yourself in the forum, or simply write a new entry."}{" "}
        <Link href="/editor/new" className="pw-link text-part-ink">
          {zh ? "撰写新条目" : "Write an entry"} →
        </Link>
      </p>
    </div>
  );
}
