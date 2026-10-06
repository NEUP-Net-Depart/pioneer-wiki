import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { Vignette } from "@/components/book/Vignette";

export const metadata: Metadata = { title: "友链 Links" };

/**
 * Part II · 友链 Links — an atlas gazetteer. Every friend site is a harbour on
 * the chart: its emblem, its name, where it lies (the address), what it keeps,
 * and since when our routes have touched.
 */
export default async function LinksPart() {
  const { lang } = await getT();
  const zh = lang === "zh";
  const links = await getServices().community.listLinks();
  const other = zh ? "en" : "zh";

  return (
    <div data-part="links" className="mt-(--space-block) flex flex-col">
      <header className="pw-double-rule mb-12 flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-display text-[clamp(2.5rem,5vw,4.5rem)] leading-none tracking-[-0.03em]">
          {zh ? "港口名录" : "Gazetteer"}{" "}
          <span lang={zh ? "en" : "zh-CN"} className="ml-2 align-middle text-h3 font-normal text-ink-3">
            {zh ? "Gazetteer" : "港口名录"}
          </span>
        </h2>
        <p className="font-mono text-meta tracking-[0.14em] text-ink-3 uppercase">
          {links.length} {zh ? "处港口" : "harbours"}
        </p>
      </header>

      <ol className="grid gap-x-(--space-block) gap-y-14 md:grid-cols-2">
        {links.map((l, i) => (
          <li key={l.id} data-reveal="rise" style={{ "--i": i % 4 } as React.CSSProperties}>
            <a
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="group grid grid-cols-[5.5rem_1fr] gap-5 no-underline"
            >
              <span className="relative pt-1">
                <Vignette name={l.emblem} className="pw-lift w-[5.5rem]" sizes="88px" />
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-3 font-mono text-[0.6875rem] tracking-[0.14em] text-ink-3 uppercase">
                  <span>No. {String(i + 1).padStart(2, "0")}</span>
                  <span>
                    {zh ? "通航" : "Route since"} {formatDate(l.since, lang)}
                  </span>
                  {l.sample ? <span className="pw-stamp normal-case">{zh ? "示例" : "sample"}</span> : null}
                </span>
                <span className="mt-2 block font-display text-h2 leading-tight text-ink">
                  <span className="pw-link">{l.name[lang]}</span>
                  {l.name[other] !== l.name[lang] ? (
                    <span className="ml-3 text-h4 text-ink-3">{l.name[other]}</span>
                  ) : null}
                </span>
                <span className="mt-1 block truncate font-mono text-meta text-part-ink">
                  {l.url.replace(/^https?:\/\//, "")} <span className="pw-nudge">↗</span>
                </span>
                <span className="mt-3 block max-w-[30em] text-small leading-relaxed text-ink-2">
                  {l.description[lang]}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>

      <aside className="pw-ink-over mt-(--space-block) flex flex-wrap items-center justify-between gap-6 pt-6">
        <p className="max-w-[36em] text-small text-ink-2">
          {zh
            ? "想与先锋维基互换友链？在交流区留下站点名称、地址与一句介绍，我们会在下一次修订时把你画进地图。"
            : "Want to exchange links with Pioneer Wiki? Leave your site's name, address and one line about it in the forum — we will chart you in the next revision."}
        </p>
        <Link href="/forum" scroll={false} className="pw-link text-small text-part-ink">
          {zh ? "去交流区" : "To the forum"} <span className="pw-nudge">→</span>
        </Link>
      </aside>
    </div>
  );
}
