import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { History, PenLine } from "lucide-react";
import type { EntrySummary, TaxonSnapshot } from "@/lib/model/types";
import { CONTENT_ROLES, LEVELS } from "@/lib/model/vocab";
import { otherLang, pick } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { extractToc } from "@/lib/markdown/toc";
import { getCatalogue } from "@/lib/taxonomy/catalogue";
import { cataloguePlate } from "@/lib/taxonomy/plates";
import { RunningHead } from "@/components/book/RunningHead";
import { PageTurn } from "@/components/book/PageTurn";
import { Markdown } from "@/components/markdown/Markdown";
import { Bookplate } from "@/components/members/Bookplate";
import { StatusBadge } from "@/components/archive/StatusBadge";
import { SpecimenPanel, SPECIMEN_VIEWS, type SpecimenView } from "@/components/entry/SpecimenPanel";
import { Vignette } from "@/components/book/Vignette";
import { CopyButton } from "@/components/markdown/CopyButton";
import { SpecimenLabel } from "@/components/taxonomy/Taxonomy";
import { opensWithSummary } from "@/lib/markdown/bilingual";
import { marksSources } from "@/lib/markdown/citations";
import { ReadingControls } from "@/components/reading/ReadingControls";

export async function generateMetadata({ params }: PageProps<"/entries/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getServices().entries.getEntry(slug);
  return entry ? { title: `${entry.title.zh} ${entry.title.en}`, description: entry.summary.en } : {};
}

/**
 * 标本页 Specimen page — a species, the third rank under family and genus.
 * Facing pages: the specimen panel and its museum label on one side, the
 * description and its record on the other. The technical title leads; the
 * species is its subtitle and label.
 */
export default async function EntryPage({ params, searchParams }: PageProps<"/entries/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const { entries: repo, references, community, taxonomy } = getServices();
  const entry = await repo.getEntry(slug);
  if (!entry) notFound();

  const { lang, t } = await getT();
  const view: SpecimenView = SPECIMEN_VIEWS.includes(query.view as SpecimenView)
    ? (query.view as SpecimenView)
    : "macro";

  const allEntries = repo.listEntries();
  const [all, revisions, relations, authors, sources, tags, members, catalogue, snapshots] = await Promise.all([
    allEntries,
    repo.listRevisions(entry.id),
    repo.listRelations(entry.id),
    references.listAuthors(),
    references.listSources(),
    references.listTags(),
    community.listMembers(),
    allEntries.then((visible) => getCatalogue(visible)),
    entry.species ? taxonomy.snapshots([entry.species]) : Promise.resolve<Record<string, TaxonSnapshot>>({}),
  ]);
  // Figures the body places as ![](asset:<id>); the asset store only lists ones that passed review.
  const figureIds = [...entry.body.matchAll(/\]\(asset:([\w-]+)\)/g)].map((m) => m[1]);
  const figures = Object.fromEntries(
    (await Promise.all(figureIds.map((id) => references.getAsset(id)))).flatMap((a) => (a ? [[a.id, a]] : [])),
  );
  const category = catalogue.category(entry.categoryId);
  const family = category ? catalogue.familyOf(category) : undefined;
  // Cross-genus references the reader can follow; archived genera are left out.
  const references_ = entry.auxiliaryCategoryIds
    .map((id) => catalogue.category(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const authorPage = members.find((m) => m.authorId === entry.authorId);
  const byId = new Map<string, EntrySummary>(all.map((e) => [e.id, e]));
  const author = authors.find((a) => a.id === entry.authorId);
  const contributors = authors.filter((a) => entry.contributorIds.includes(a.id));
  // In the order the entry cites them.
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const entrySources = entry.sourceIds.flatMap((id) => sourceById.get(id) ?? []);
  // A body that marks its sources [S1] … gets them numbered, and its marks link here.
  const numbered = marksSources(entry.body);
  const entryTags = tags.filter((tg) => entry.tagIds.includes(tg.id));
  const pending = revisions.find((r) => r.number > entry.revision && r.state === "in_review");

  const [latest] = revisions;
  const latestAuthor = latest ? authors.find((a) => a.id === latest.authorId) : undefined;
  const citationAuthors = `${author ? pick(author.name, lang) : ""}${contributors.length ? ` ${t("entry.etAl")}` : ""}.`;
  const citation = [
    citationAuthors,
    `${entry.title.en} · ${entry.title.zh}.`,
    `${t("site.name")} ${entry.id}, r${entry.revision}, ${formatDate(entry.updatedAt, lang)}.`,
    `/entries/${entry.slug}`,
  ].join(" ");

  // Turn the page within the genus, among the species readers can open.
  const siblings = (category ? catalogue.filed(category) : []).some((e) => e.id === entry.id)
    ? catalogue.filed(category!)
    : all.filter((e) => e.categoryId === entry.categoryId).sort((a, b) => a.id.localeCompare(b.id));
  const at = siblings.findIndex((e) => e.id === entry.id);
  const side = (e?: EntrySummary) =>
    e ? { href: `/entries/${e.slug}`, kicker: e.id, title: pick(e.title, lang) } : null;

  return (
    <article data-reading-page data-phylum={family?.id} className="flex flex-col">
      <RunningHead
        left={
          family && category ? (
            <nav aria-label={lang === "zh" ? "分类位置" : "Place in the catalogue"} className="truncate">
              <Link href={`/families/${family.slug}`} className="no-underline hover:text-ink">
                {catalogue.familyNumeral(family)} · {family.name[lang]}
              </Link>
              <span aria-hidden="true" className="mx-2 text-ink-3">
                ›
              </span>
              <Link href={`/categories/${category.slug}`} className="no-underline hover:text-ink">
                {category.name[lang]}
              </Link>
              {entry.species ? (
                <>
                  <span aria-hidden="true" className="mx-2 text-ink-3">
                    ›
                  </span>
                  <i className="normal-case">{entry.species}</i>
                </>
              ) : null}
            </nav>
          ) : (
            t("site.name")
          )
        }
        right={`${entry.id} · r${entry.revision}`}
      />

      <ReadingControls />
      {/* Facing pages. Mobile reads title → plate → text; desktop puts the sticky plate panel beside both. */}
      <div data-reading-layout className="mt-(--space-block) grid gap-x-(--space-block) gap-y-12 lg:grid-cols-12">
        <header data-reading-header className="min-w-0 lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:pl-4">
          <p data-reading-extra className="flex flex-wrap items-center gap-3 text-meta text-ink-3">
            <span className="pw-stamp">{entry.id}</span>
            <span>
              {LEVELS[entry.level][lang]} · {CONTENT_ROLES[entry.contentRole][lang]}
            </span>
            {/* Only an entry with no published ring is itself a draft; a pending newer ring gets the note below. */}
            {entry.status === "draft" ? <StatusBadge state="draft" lang={lang} showForm /> : null}
          </p>
          <h1 className="mt-4 font-display">
            <span className="block text-[clamp(2.75rem,5.5vw,4.75rem)] leading-[0.98] font-[480] tracking-[-0.03em] text-balance">
              {entry.title[lang]}
            </span>
            <span
              lang={otherLang(lang) === "zh" ? "zh-CN" : "en"}
              className="mt-3 block text-h3 font-normal text-ink-3"
            >
              {entry.title[otherLang(lang)]}
            </span>
            {entry.species ? (
              <span className="mt-2 block font-display text-h4 font-normal text-phylum-ink italic">
                {entry.species}
              </span>
            ) : null}
          </h1>
          {opensWithSummary(entry.body, pick(entry.summary, lang), lang) ? null : (
            <p className="mt-5 max-w-(--measure) text-lead text-ink-2">{pick(entry.summary, lang)}</p>
          )}

          {pending ? (
            <p className="mt-4 flex items-center gap-2 text-small text-ink-2">
              <StatusBadge state="in_review" lang={lang} />
              {t("entry.pendingRevision")} · r{pending.number}
            </p>
          ) : null}

          <div className="pw-ink-both mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-small">
            {author ? (
              <span className="flex items-center gap-2 text-ink-2">
                {authorPage ? (
                  <Link
                    href={`/members/${authorPage.handle}`}
                    className="group flex items-center gap-2 text-ink-2 no-underline hover:text-ink"
                  >
                    <Bookplate
                      plate={authorPage.plate}
                      name={authorPage.name}
                      lang={lang}
                      mini
                      className="w-6 shadow-sheet transition-transform duration-(--dur-quick) group-hover:-rotate-6"
                    />
                    <span className="pw-link">{pick(author.name, lang)}</span>
                  </Link>
                ) : (
                  pick(author.name, lang)
                )}
                {contributors.length ? (
                  <span className="text-ink-3">
                    + {contributors.map((c) => pick(c.name, lang)).join(lang === "zh" ? "、" : ", ")}
                  </span>
                ) : null}
              </span>
            ) : null}
            <span className="text-ink-3">
              {t("entry.updated")} <time dateTime={entry.updatedAt}>{formatDate(entry.updatedAt, lang)}</time>
            </span>
            <span data-reading-extra className="ml-auto flex items-center gap-2">
              <Link
                href={`/entries/${entry.slug}/history`}
                className="inline-flex h-8 items-center gap-1.5 px-2 text-ink-2 no-underline hover:text-ink"
              >
                <History className="size-4" aria-hidden="true" />
                {t("entry.history")}
              </Link>
              <Link
                href={`/editor/${entry.slug}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-ink px-3 text-paper-sheet no-underline transition-colors duration-(--dur-quick) hover:bg-ink-2"
              >
                <PenLine className="size-4" aria-hidden="true" />
                {t("entry.edit")}
              </Link>
            </span>
          </div>
        </header>

        <div
          data-reading-extra
          className="lg:sticky lg:top-[calc(var(--shell-header)+2rem)] lg:col-span-5 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start"
        >
          <SpecimenPanel
            entry={entry}
            view={view}
            lang={lang}
            toc={extractToc(entry.body)}
            relations={relations}
            entries={byId}
            plate={cataloguePlate("species", entry.slug)}
          />
          {family && category ? (
            <SpecimenLabel
              entry={entry}
              family={family}
              category={category}
              snapshot={entry.species ? snapshots[entry.species] : undefined}
              lang={lang}
              className="mt-8"
            />
          ) : null}
          {references_.length ? (
            <section aria-labelledby="cross-genus" className="mt-6">
              <h2 id="cross-genus" className="mb-2 pw-smallcaps text-small text-ink-3">
                {lang === "zh" ? "跨属参照" : "Cross-genus references"}
              </h2>
              <ul className="flex flex-col gap-1.5 text-small">
                {references_.map((c) => {
                  const f = catalogue.familyOf(c);
                  return (
                    <li key={c.id} data-phylum={f?.id}>
                      <Link
                        href={`/categories/${c.slug}`}
                        className="group flex items-baseline gap-2 text-ink-2 no-underline hover:text-ink"
                      >
                        <span aria-hidden="true" className="text-phylum-ink">
                          ⤳
                        </span>
                        <span className="pw-link">{c.name[lang]}</span>
                        <i className="font-display text-ink-3">{c.scientificName}</i>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>

        <div data-reading-body className="min-w-0 lg:col-span-7 lg:col-start-6 lg:row-start-2 lg:pl-4">
          <Markdown lang={lang} assets={figures}>
            {entry.body}
          </Markdown>

          <div data-reading-extra aria-hidden="true" className="mt-(--space-block) flex justify-center">
            <Vignette name="fern-crozier" className="w-16" sizes="64px" />
          </div>
          <footer className="pw-ink-over mt-(--space-block) pt-6 text-small">
            <h2 className="mb-3 pw-smallcaps text-small text-ink-3">{t("entry.record")}</h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[7rem_1fr]">
              <dt className="text-ink-3">{t("entry.sources")}</dt>
              <dd>
                <ol className="flex flex-col gap-1.5">
                  {entrySources.map((s, i) => (
                    <li
                      key={s.id}
                      id={numbered ? `source-${i + 1}` : undefined}
                      className="scroll-mt-24 text-ink-2 target:bg-paper-deep"
                    >
                      {numbered ? <span className="mr-2 font-mono text-[0.85em] text-phylum-ink">S{i + 1}</span> : null}
                      {s.creators}. <cite className="text-ink">{s.title}</cite>.{" "}
                      {[s.publisher, s.locator, s.year].filter(Boolean).length
                        ? `${[s.publisher, s.locator, s.year].filter(Boolean).join(", ")}. `
                        : ""}
                      {s.url ? (
                        <a href={s.url} className="text-indigo" target="_blank" rel="noreferrer">
                          ↗
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </dd>
              {entryTags.length ? (
                <>
                  <dt data-reading-extra className="text-ink-3">
                    {t("entry.tags")}
                  </dt>
                  <dd data-reading-extra className="flex flex-wrap gap-x-3 gap-y-1 text-ink-2">
                    {entryTags.map((tg) => (
                      <Link
                        key={tg.id}
                        href={`/search?q=${encodeURIComponent(pick(tg.label, lang))}`}
                        className="no-underline hover:text-indigo"
                      >
                        #{pick(tg.label, lang)}
                      </Link>
                    ))}
                  </dd>
                </>
              ) : null}
              <dt data-reading-extra className="text-ink-3">
                {t("entry.rings")}
              </dt>
              <dd data-reading-extra className="text-ink-2">
                <span className="font-mono text-meta text-ink">r{entry.revision}</span> · {revisions.length}{" "}
                {t("entry.revisionCount")}
                {latest ? (
                  <span className="block text-meta text-ink-3">
                    {t("entry.latestRing")} · {latestAuthor ? pick(latestAuthor.name, lang) : null} — {latest.note}
                  </span>
                ) : null}
                <Link href={`/entries/${entry.slug}/history`} className="mt-1 inline-block text-meta text-indigo">
                  {t("entry.allRings")} →
                </Link>
              </dd>
              <dt className="text-ink-3">{t("entry.cite")}</dt>
              <dd className="text-ink-2">
                <p>
                  {citationAuthors}{" "}
                  <cite className="text-ink">
                    {entry.title.en} · {entry.title.zh}
                  </cite>
                  . {t("site.name")} {entry.id}, r{entry.revision}, {formatDate(entry.updatedAt, lang)}.
                </p>
                <span className="mt-1 inline-block">
                  <CopyButton
                    text={citation}
                    lang={lang}
                    variant="link"
                    idleLabel={lang === "zh" ? "复制引用" : "Copy citation"}
                  />
                </span>
              </dd>
            </dl>
          </footer>
        </div>
      </div>

      <PageTurn
        prev={side(siblings[at - 1])}
        next={side(siblings[at + 1])}
        label={{ prev: t("book.prev"), next: t("book.next"), nav: t("book.pageNav") }}
      />
    </article>
  );
}
