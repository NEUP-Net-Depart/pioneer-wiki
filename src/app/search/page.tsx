import type { Metadata } from "next";
import Link from "next/link";
import type { DomainId, Lang, ReviewState, Scale } from "@/lib/model/types";
import { DOMAINS, DOMAIN_IDS, REVIEW_STATES, REVIEW_STATE_IDS, SCALES, SCALE_IDS } from "@/lib/model/vocab";
import { otherLang, pick } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { FilterSelect } from "@/components/search/filter-select";
import type { SearchFilters } from "@/lib/services/contracts";
import { formatDate } from "@/lib/format";
import { RunningHead } from "@/components/book/RunningHead";
import { SpecimenMark } from "@/components/archive/SpecimenMark";
import { StatusBadge } from "@/components/archive/StatusBadge";
import { ArchiveState } from "@/components/states/ArchiveState";
import { Vignette } from "@/components/book/Vignette";

export const metadata: Metadata = { title: "检索 Search" };

type Params = Record<string, string | string[] | undefined>;
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(",") : []).filter(Boolean);
const only = <T extends string>(values: string[], allowed: readonly T[]) =>
  values.filter((v): v is T => (allowed as readonly string[]).includes(v));

/** Highlight [start, end) ranges inside a snippet. */
function Highlighted({ text, ranges }: { text: string; ranges: Array<[number, number]> }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [s, e] of [...ranges].sort((a, b) => a[0] - b[0])) {
    if (s > at) parts.push(text.slice(at, s));
    parts.push(
      <mark key={s} className="rounded-xs bg-mark px-0.5 text-ink">
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  }
  parts.push(text.slice(at));
  return <>{parts}</>;
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params: Params = await searchParams;
  const { lang, t } = await getT();
  const { search, references } = getServices();
  const authors = await references.listAuthors();

  const q = typeof params.q === "string" ? params.q.trim() : "";
  const filters: SearchFilters = {
    domain: only<DomainId>(list(params.domain), DOMAIN_IDS),
    scale: only<Scale>(list(params.scale), SCALE_IDS),
    status: only<ReviewState>(list(params.status), REVIEW_STATE_IDS),
    lang: only<Lang>(list(params.lang), ["zh", "en"] as const),
    author: only(
      list(params.author),
      authors.map((a) => a.id),
    ),
  };
  const active = Object.values(filters).some((v) => v && v.length);
  const result = await search.search({ text: q, filters, limit: 50 });
  const second = otherLang(lang);
  const all = t("search.all");

  return (
    <div className="flex flex-col">
      <RunningHead
        left={`${t("site.name")} · ${t("search.heading")}`}
        right={`${result.total} ${t("search.results")}`}
      />

      <div className="mt-(--space-block) grid gap-(--space-block) lg:grid-cols-12">
        <form action="/search" method="get" role="search" className="flex flex-col gap-5 lg:col-span-4">
          <h1 className="font-display text-h2">{t("search.heading")}</h1>
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">{t("search.label")}</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder={t("search.placeholder")}
              className="pw-field h-12 font-display text-h4"
            />
          </label>

          <details open={active} className="group">
            <summary className="cursor-pointer list-none text-small text-ink-2 select-none hover:text-ink [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden="true"
                className="mr-1.5 inline-block transition-transform duration-(--dur-quick) group-open:rotate-90"
              >
                ›
              </span>
              {t("search.filters")}
            </summary>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <FilterSelect
                name="domain"
                label={t("filter.domain")}
                value={filters.domain?.[0] ?? ""}
                options={[["", all], ...DOMAIN_IDS.map((d): [string, string] => [d, DOMAINS[d][lang]])]}
              />
              <FilterSelect
                name="scale"
                label={t("filter.scale")}
                value={filters.scale?.[0] ?? ""}
                options={[["", all], ...SCALE_IDS.map((s): [string, string] => [s, SCALES[s][lang]])]}
              />
              <FilterSelect
                name="status"
                label={t("filter.status")}
                value={filters.status?.[0] ?? ""}
                options={[
                  ["", all],
                  ...REVIEW_STATE_IDS.map((s): [string, string] => [s, REVIEW_STATES[s].label[lang]]),
                ]}
              />
              <FilterSelect
                name="lang"
                label={t("filter.lang")}
                value={filters.lang?.[0] ?? ""}
                options={[
                  ["", all],
                  ["zh", "中文"],
                  ["en", "English"],
                ]}
              />
              <FilterSelect
                name="author"
                label={t("filter.author")}
                value={filters.author?.[0] ?? ""}
                options={[["", all], ...authors.map((a): [string, string] => [a.id, pick(a.name, lang)])]}
              />
            </div>
            {active ? (
              <Link
                href={q ? `/search?q=${encodeURIComponent(q)}` : "/search"}
                className="mt-3 inline-block text-small text-indigo"
              >
                {t("search.clearFilters")}
              </Link>
            ) : null}
          </details>

          <button
            type="submit"
            className="h-9 self-start rounded-sm bg-ink px-4 text-small text-paper-sheet hover:bg-ink-2"
          >
            {t("search.submit")}
          </button>
        </form>

        <section
          aria-label={`${result.total} ${t("search.results")}`}
          className="min-w-0 lg:col-span-8 lg:border-l lg:border-rule lg:pl-10"
        >
          {result.hits.length === 0 ? (
            <ArchiveState
              kind="empty"
              title={t("search.noResults")}
              hint={t("search.noResultsHint")}
              art={<Vignette name="dandelion-clock" />}
              className="min-h-56"
            />
          ) : (
            <ol className="flex flex-col">
              {result.hits.map(({ entry: e, snippet }) => (
                <li key={e.id} className="flex gap-4 border-b border-rule py-5 first:pt-0">
                  <SpecimenMark
                    scale={e.scale}
                    rings={e.revision}
                    state={e.status}
                    crossover={Boolean(e.analogue)}
                    className="size-10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-3">
                      <Link
                        href={`/entries/${e.slug}`}
                        className="font-display text-h4 text-ink no-underline hover:text-indigo"
                      >
                        {pick(e.title, lang)}
                      </Link>
                      <span className="text-small text-ink-3 italic">{pick(e.title, second)}</span>
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-small text-ink-2">
                      {snippet ? (
                        <Highlighted text={snippet.text} ranges={snippet.highlights} />
                      ) : (
                        pick(e.summary, lang)
                      )}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-3">
                      <span className="font-mono">{e.id}</span>
                      <span>{DOMAINS[e.domain][lang]}</span>
                      <span>{SCALES[e.scale][lang]}</span>
                      <span className="font-mono">{e.bodyLanguages.map((l) => l.toUpperCase()).join(" · ")}</span>
                      <time dateTime={e.updatedAt}>{formatDate(e.updatedAt, lang)}</time>
                      {e.status !== "published" ? <StatusBadge state={e.status} lang={lang} /> : null}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
