import { readFileSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import type { Asset } from "@/lib/model/types";
import { DOMAINS, DOMAIN_EMBLEMS, DOMAIN_IDS, DOMAIN_NOTES } from "@/lib/model/vocab";
import { otherLang, pick, translate } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { toRoman } from "@/lib/roman";
import { vignetteAsset } from "@/components/book/Vignette";
import { Overture, type OvertureCut } from "@/components/home/Overture";
import { PhylumIndex, type PhylumRow } from "@/components/home/PhylumIndex";

function overtureCuts(): OvertureCut[] {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", "overture", "cuts.json"), "utf8")) as OvertureCut[];
  } catch {
    return [];
  }
}

/**
 * Part I · 博物 Wiki — the natural-history book. Below the entrance stage: the
 * contents of the ten phyla and the latest revisions. On the first visit of a
 * session the opening titles play over everything first.
 */
export default async function WikiPart() {
  const { lang, t } = await getT();
  const zh = lang === "zh";
  const { entries, references } = getServices();
  const all = await entries.listEntries();
  const recent = all.filter((e) => e.status === "published").slice(0, 3);
  const plates = new Map<string, Asset>();
  await Promise.all(
    recent.map(async (e) => {
      const a = e.heroAssetId ? await references.getAsset(e.heroAssetId) : null;
      if (a) plates.set(e.id, a);
    }),
  );
  const birds = ["fly-finch", "fly-swallow", "fly-tit", "fly-wren"].map(vignetteAsset).filter((b) => b !== null);

  const phyla: PhylumRow[] = DOMAIN_IDS.map((d, i) => ({
    id: d,
    numeral: toRoman(i + 1),
    name: DOMAINS[d],
    note: DOMAIN_NOTES[d],
    organism: DOMAIN_EMBLEMS[d].organism,
    why: DOMAIN_EMBLEMS[d].why,
    count: all.filter((e) => e.domain === d).length,
    emblem: vignetteAsset(DOMAIN_EMBLEMS[d].vignette),
  }));

  return (
    <div className="flex flex-col">
      <Overture cuts={overtureCuts()} birds={birds} />

      {/* ── Contents: the ten phyla ──────────────────────────────── */}
      <nav aria-labelledby="contents" className="mt-(--space-block)">
        <div className="pw-double-rule mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
          <h2 id="contents" className="font-display text-[clamp(2.5rem,5vw,4.5rem)] leading-none tracking-[-0.03em]">
            {t("book.contents")}{" "}
            <span lang={zh ? "en" : "zh-CN"} className="ml-2 align-middle text-h3 font-normal text-ink-3">
              {translate(otherLang(lang), "book.contents")}
            </span>
          </h2>
          <span className="font-mono text-meta tracking-[0.14em] text-ink-3 uppercase">
            {DOMAIN_IDS.length} {zh ? "门" : "phyla"}
          </span>
        </div>
        <PhylumIndex rows={phyla} lang={lang} />
      </nav>

      {/* ── Latest revisions ─────────────────────────────────────── */}
      <section aria-labelledby="recent" className="mt-(--space-section)">
        <h2 id="recent" className="mb-10 font-display text-h3 text-ink">
          {t("index.recent")}
        </h2>
        <ol className="grid gap-12 sm:grid-cols-3 sm:gap-8">
          {recent.map((e, i) => {
            const p = plates.get(e.id);
            return (
              <li key={e.id} data-phylum={e.domain}>
                <Link href={`/entries/${e.slug}`} className="group flex flex-col no-underline">
                  <span className="grid aspect-[4/3] place-items-center">
                    {p ? (
                      <span
                        data-reveal="ink"
                        style={{ "--i": i } as React.CSSProperties}
                        className="pw-lift block w-full"
                      >
                        <span className="pw-print block">
                          <Image
                            src={p.src}
                            width={p.width}
                            height={p.height}
                            alt=""
                            sizes="(min-width: 640px) 30vw, 90vw"
                            className="max-h-[18rem] w-full object-contain"
                          />
                        </span>
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-4 flex items-baseline gap-3 font-mono text-meta text-ink-3">
                    <span className="pw-stamp">{e.id}</span>
                    <time dateTime={e.updatedAt}>{formatDate(e.updatedAt, lang)}</time>
                  </span>
                  <span className="mt-2 font-display text-h3 text-ink">
                    <span className="pw-link">{e.title[lang]}</span>
                  </span>
                  <span lang={zh ? "en" : "zh-CN"} className="text-small text-ink-3">
                    {e.title[otherLang(lang)]}
                    {e.analogue ? <span className="ml-2 text-phylum-ink">≈ {pick(e.analogue.name, lang)}</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
