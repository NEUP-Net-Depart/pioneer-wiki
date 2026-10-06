import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Asset, DomainId } from "@/lib/model/types";
import { DOMAINS, DOMAIN_EMBLEMS, DOMAIN_IDS, DOMAIN_NOTES, ROLES, SCALES } from "@/lib/model/vocab";
import { otherLang, pick } from "@/lib/i18n/dictionary";
import { Vignette } from "@/components/book/Vignette";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { toRoman } from "@/lib/roman";
import { RunningHead } from "@/components/book/RunningHead";
import { PageTurn } from "@/components/book/PageTurn";
import { Plate } from "@/components/book/Plate";
import { StatusBadge } from "@/components/archive/StatusBadge";
import { ArchiveState } from "@/components/states/ArchiveState";

const isDomain = (v: string): v is DomainId => (DOMAIN_IDS as string[]).includes(v);

export async function generateMetadata({ params }: PageProps<"/domains/[domain]">): Promise<Metadata> {
  const { domain } = await params;
  return isDomain(domain) ? { title: `${DOMAINS[domain].zh} ${DOMAINS[domain].en}` } : {};
}

/**
 * 图版页 Plate page — level two. The phylum's specimens laid out as one
 * numbered plate, with a legend beside it. Prev / next turn to the
 * neighbouring phyla.
 */
export default async function DomainPlatePage({ params }: PageProps<"/domains/[domain]">) {
  const { domain } = await params;
  if (!isDomain(domain)) notFound();

  const { lang, t } = await getT();
  const { entries, references } = getServices();
  const specimens = (await entries.listEntries({ domain: [domain] })).sort((a, b) => a.id.localeCompare(b.id));
  const assets = new Map<string, Asset>();
  await Promise.all(
    specimens.map(async (e) => {
      const a = e.heroAssetId ? await references.getAsset(e.heroAssetId) : null;
      if (a) assets.set(e.id, a);
    }),
  );

  const index = DOMAIN_IDS.indexOf(domain);
  const numeral = toRoman(index + 1);
  const other = otherLang(lang);
  const neighbour = (i: number) => {
    const d = DOMAIN_IDS[i];
    return d
      ? { href: `/domains/${d}`, kicker: `${t("book.phylum")} ${toRoman(i + 1)}`, title: DOMAINS[d][lang] }
      : null;
  };

  return (
    <div data-phylum={domain} className="flex flex-col">
      <RunningHead
        left={`${t("site.name")} · ${t("book.phylum")} ${numeral}`}
        right={`${DOMAINS[domain][lang]} · ${DOMAINS[domain][other]}`}
      />

      <header className="mt-(--space-block) grid gap-6 lg:grid-cols-12">
        <p
          aria-hidden="true"
          className="font-display text-[clamp(4rem,8vw,7rem)] leading-none text-phylum italic lg:col-span-2"
        >
          {numeral}
        </p>
        <div className="lg:col-span-7">
          <h1 className="font-display">
            <span className="block text-[clamp(3rem,6.5vw,5.75rem)] leading-[0.95] font-[480] tracking-[-0.03em]">
              {DOMAINS[domain][lang]}
            </span>
            <span lang={other === "zh" ? "zh-CN" : "en"} className="mt-3 block text-h4 font-normal text-ink-3">
              {DOMAINS[domain][other]}
            </span>
          </h1>
          <p className="mt-5 max-w-[40ch] text-lead text-ink-2">{pick(DOMAIN_NOTES[domain], lang)}</p>
        </div>
        {/* Phylum emblem (R5): the organism that stands for this phylum. */}
        <figure className="hidden lg:col-span-3 lg:flex lg:flex-col lg:items-end">
          <Vignette name={DOMAIN_EMBLEMS[domain].vignette} className="w-40" sizes="160px" />
          <figcaption className="pw-letterpress mt-2 text-small text-ink-3 italic">
            {DOMAIN_EMBLEMS[domain].organism[lang]} · {DOMAIN_EMBLEMS[domain].organism[other]}
          </figcaption>
        </figure>
      </header>

      {specimens.length === 0 ? (
        <ArchiveState
          kind="empty"
          title={t("book.emptyPhylum")}
          art={<Vignette name="dandelion-clock" />}
          className="mt-(--space-block) max-w-xl"
        />
      ) : (
        <div className="mt-(--space-block) grid gap-(--space-block) lg:grid-cols-12">
          {/* The plate: numbered specimens only, no text — the legend carries the names (Codex R3-M2 links the two on hover). */}
          <ol data-mount="domain-plate" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:col-span-8">
            {specimens.map((e, i) => (
              <li key={e.id}>
                <Link href={`/entries/${e.slug}`} className="group flex flex-col items-center no-underline">
                  <Plate
                    lang={lang}
                    asset={assets.get(e.id)}
                    fallback={{ scale: e.scale, rings: e.revision, state: e.status, crossover: Boolean(e.analogue) }}
                    frame="landscape"
                    bare
                    sizes="(min-width: 1024px) 18vw, 45vw"
                    className="w-full transition-transform duration-(--dur-base) ease-grow group-hover:-translate-y-0.5"
                  />
                  <span className="mt-2 flex flex-col items-center gap-0.5 text-center">
                    <span className="font-display text-lead leading-snug text-ink-2 group-hover:text-indigo">
                      <span className="mr-1 italic text-phylum-ink">{i + 1}.</span>
                      {pick(e.title, lang)}
                    </span>
                    {e.analogue ? <span className="text-meta text-ink-3">≈ {pick(e.analogue.name, lang)}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          <section aria-labelledby="legend" className="lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
            <h2 id="legend" className="mb-4 pw-smallcaps text-small text-ink-3">
              {t("book.legend")}
            </h2>
            <ol className="flex flex-col gap-5">
              {specimens.map((e, i) => (
                <li key={e.id} className="flex gap-3">
                  <span className="w-5 shrink-0 font-display text-lead text-ink-3 italic">{i + 1}.</span>
                  <div className="min-w-0">
                    <Link
                      href={`/entries/${e.slug}`}
                      className="font-display text-h4 text-ink no-underline hover:text-indigo"
                    >
                      {e.title[lang]}
                    </Link>
                    <p lang={other === "zh" ? "zh-CN" : "en"} className="text-small text-ink-3">
                      {e.title[other]}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-3">
                      <span className="font-mono">{e.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>{SCALES[e.scale][lang]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{ROLES[e.role][lang]}</span>
                      {e.status !== "published" ? <StatusBadge state={e.status} lang={lang} /> : null}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}

      <PageTurn
        prev={neighbour(index - 1)}
        next={neighbour(index + 1)}
        label={{ prev: t("book.prev"), next: t("book.next"), nav: t("book.pageNav") }}
      />
    </div>
  );
}
