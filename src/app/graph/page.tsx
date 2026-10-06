import type { Metadata } from "next";
import Link from "next/link";
import type { EntrySummary } from "@/lib/model/types";
import { otherLang, translate } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { cn } from "@/lib/utils";
import { RunningHead } from "@/components/book/RunningHead";
import { RelationList } from "@/components/entry/RelationList";
import { RelationLegend, RelationPlate } from "@/components/graph/RelationPlate";

export const metadata: Metadata = { title: "Relations 关系图" };

/**
 * 关系图 — one plate of all relations, with the list as its equal alternative.
 * ?view=list forces the list; small screens always get the list.
 */
export default async function GraphPage({ searchParams }: PageProps<"/graph">) {
  const { view } = await searchParams;
  const listOnly = view === "list";
  const { lang, t } = await getT();
  const { entries } = getServices();
  const [all, relations] = await Promise.all([entries.listEntries(), entries.listRelations()]);
  const byId = new Map<string, EntrySummary>(all.map((e) => [e.id, e]));

  const toggle = (
    <nav
      aria-label={`${t("graph.viewGraph")} / ${t("graph.viewList")}`}
      className="hidden gap-5 border-b border-rule md:flex"
    >
      {[
        { href: "/graph", label: t("graph.viewGraph"), on: !listOnly },
        { href: "/graph?view=list", label: t("graph.viewList"), on: listOnly },
      ].map((o) => (
        <Link
          key={o.href}
          href={o.href}
          scroll={false}
          aria-current={o.on ? "page" : undefined}
          className={cn(
            "-mb-px border-b py-2 text-small no-underline",
            o.on ? "border-brick text-ink" : "border-transparent text-ink-3 hover:text-ink",
          )}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex flex-col">
      <RunningHead
        left={`${t("site.name")} · ${t("graph.heading")}`}
        right={`${relations.length} ${lang === "zh" ? "条关系" : "relations"}`}
      />

      <header className="mt-(--space-block) grid gap-6 lg:grid-cols-12">
        <h1 className="font-display lg:col-span-7">
          <span className="block text-[clamp(3rem,6.5vw,5.75rem)] leading-[0.95] font-[480] tracking-[-0.03em]">
            {t("graph.heading")}
          </span>
          <span lang={lang === "zh" ? "en" : "zh-CN"} className="mt-3 block text-h4 font-normal text-ink-3">
            {translate(otherLang(lang), "graph.heading")}
          </span>
        </h1>
        <div className="flex flex-col justify-end gap-5 lg:col-span-5">
          <p className="text-small text-ink-2">{t("graph.lede")}</p>
          {toggle}
        </div>
      </header>

      <div className="mt-(--space-block) grid gap-(--space-block) lg:grid-cols-12">
        {!listOnly ? (
          <figure data-mount="relation-graph" className="hidden md:block lg:col-span-8 lg:col-start-3">
            <RelationPlate entries={all} relations={relations} title={t("graph.heading")} lang={lang} />
            <figcaption className="mt-8 flex flex-col gap-3">
              <RelationLegend lang={lang} />
              <p className="text-meta text-ink-3">{t("graph.listNote")}</p>
            </figcaption>
          </figure>
        ) : null}
        <section
          aria-label={t("graph.viewList")}
          className={cn("lg:col-span-8 lg:col-start-3", !listOnly && "md:hidden")}
        >
          <RelationList relations={relations} entries={byId} lang={lang} />
        </section>
      </div>
    </div>
  );
}
