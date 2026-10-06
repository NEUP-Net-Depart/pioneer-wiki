import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { History, PenLine } from "lucide-react";
import type { Asset, EntrySummary } from "@/lib/model/types";
import { DOMAINS, DOMAIN_IDS, ROLES, SCALES } from "@/lib/model/vocab";
import { otherLang, pick } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { extractToc } from "@/lib/markdown/toc";
import { toRoman } from "@/lib/roman";
import { RunningHead } from "@/components/book/RunningHead";
import { PageTurn } from "@/components/book/PageTurn";
import { Markdown } from "@/components/markdown/Markdown";
import { Bookplate } from "@/components/members/Bookplate";
import { StatusBadge } from "@/components/archive/StatusBadge";
import { SpecimenPanel, SPECIMEN_VIEWS, type SpecimenView } from "@/components/entry/SpecimenPanel";
import { Vignette } from "@/components/book/Vignette";
import { CopyButton } from "@/components/markdown/CopyButton";

export async function generateMetadata({ params }: PageProps<"/entries/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getServices().entries.getEntry(slug);
  return entry ? { title: `${entry.title.zh} ${entry.title.en}`, description: entry.summary.en } : {};
}

/**
 * 标本页 Specimen page — level three. Facing pages: the specimen panel on one
 * side, the description and its record on the other.
 */
export default async function EntryPage({ params, searchParams }: PageProps<"/entries/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const { entries: repo, references, community } = getServices();
  const entry = await repo.getEntry(slug);
  if (!entry) notFound();

  const { lang, t } = await getT();
  const view: SpecimenView = SPECIMEN_VIEWS.includes(query.view as SpecimenView)
    ? (query.view as SpecimenView)
    : "macro";

  const [all, revisions, relations, authors, sources, tags, asset, members] = await Promise.all([
    repo.listEntries(),
    repo.listRevisions(entry.id),
    repo.listRelations(entry.id),
    references.listAuthors(),
    references.listSources(),
    references.listTags(),
    entry.heroAssetId ? references.getAsset(entry.heroAssetId) : Promise.resolve<Asset | null>(null),
    community.listMembers(),
  ]);
  const authorPage = members.find((m) => m.authorId === entry.authorId);
  const byId = new Map<string, EntrySummary>(all.map((e) => [e.id, e]));
  const author = authors.find((a) => a.id === entry.authorId);
  const contributors = authors.filter((a) => entry.contributorIds.includes(a.id));
  const entrySources = sources.filter((s) => entry.sourceIds.includes(s.id));
  const entryTags = tags.filter((tg) => entry.tagIds.includes(tg.id));
  const pending = revisions.find((r) => r.number > entry.revision && r.state === "in_review");
  const phylum = toRoman(DOMAIN_IDS.indexOf(entry.domain) + 1);

  const [latest] = revisions;
  const latestAuthor = latest ? authors.find((a) => a.id === latest.authorId) : undefined;
  const citationAuthors = `${author ? pick(author.name, lang) : ""}${contributors.length ? ` ${t("entry.etAl")}` : ""}.`;
  const citation = [
    citationAuthors,
    `${entry.title.en} · ${entry.title.zh}.`,
    `${t("site.name")} ${entry.id}, r${entry.revision}, ${formatDate(entry.updatedAt, lang)}.`,
    `/entries/${entry.slug}`,
  ].join(" ");

  const siblings = all.filter((e) => e.domain === entry.domain).sort((a, b) => a.id.localeCompare(b.id));
  const at = siblings.findIndex((e) => e.id === entry.id);
  const side = (e?: EntrySummary) =>
    e ? { href: `/entries/${e.slug}`, kicker: e.id, title: pick(e.title, lang) } : null;

  return (
    <article data-phylum={entry.domain} className="flex flex-col">
      <RunningHead
        left={
          <Link href={`/domains/${entry.domain}`} className="no-underline hover:text-ink">
            {t("book.phylum")} {phylum} · {DOMAINS[entry.domain][lang]}
          </Link>
        }
        right={`${entry.id} · r${entry.revision}`}
      />

      {/* Facing pages. Mobile reads title → plate → text; desktop puts the sticky plate panel beside both. */}
      <div className="mt-(--space-block) grid gap-x-(--space-block) gap-y-12 lg:grid-cols-12">
        <header className="min-w-0 lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:pl-4">
          <p className="flex flex-wrap items-center gap-3 text-meta text-ink-3">
            <span className="pw-stamp">{entry.id}</span>
            <span>
              {SCALES[entry.scale][lang]} · {ROLES[entry.role][lang]}
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
          </h1>
          <p className="mt-5 max-w-(--measure) text-lead text-ink-2">{pick(entry.summary, lang)}</p>

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
            <span className="ml-auto flex items-center gap-2">
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

        <div className="lg:sticky lg:top-[calc(var(--shell-header)+2rem)] lg:col-span-5 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start">
          <SpecimenPanel
            entry={entry}
            view={view}
            lang={lang}
            asset={asset}
            toc={extractToc(entry.body)}
            relations={relations}
            entries={byId}
          />
        </div>

        <div className="min-w-0 lg:col-span-7 lg:col-start-6 lg:row-start-2 lg:pl-4">
          <Markdown lang={lang}>{entry.body}</Markdown>

          <div aria-hidden="true" className="mt-(--space-block) flex justify-center">
            <Vignette name="fern-crozier" className="w-16" sizes="64px" />
          </div>
          <footer className="pw-ink-over mt-(--space-block) pt-6 text-small">
            <h2 className="mb-3 pw-smallcaps text-small text-ink-3">{t("entry.record")}</h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[7rem_1fr]">
              <dt className="text-ink-3">{t("entry.sources")}</dt>
              <dd>
                <ol className="flex flex-col gap-1.5">
                  {entrySources.map((s) => (
                    <li key={s.id} className="text-ink-2">
                      {s.creators}. <cite className="text-ink">{s.title}</cite>. {s.publisher ? `${s.publisher}, ` : ""}
                      {s.year}.{" "}
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
                  <dt className="text-ink-3">{t("entry.tags")}</dt>
                  <dd className="flex flex-wrap gap-x-3 gap-y-1 text-ink-2">
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
              <dt className="text-ink-3">{t("entry.rings")}</dt>
              <dd className="text-ink-2">
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
