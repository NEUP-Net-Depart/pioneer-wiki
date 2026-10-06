import Link from "next/link";
import type { Asset, Entry, EntrySummary, Lang, Relation } from "@/lib/model/types";
import type { TocItem } from "@/lib/markdown/bilingual";
import { pick, translate } from "@/lib/i18n/dictionary";
import { toRoman, catalogueNumber } from "@/lib/roman";
import { cn } from "@/lib/utils";
import { Plate } from "@/components/book/Plate";
import { RelationList } from "./RelationList";

export type SpecimenView = "macro" | "micro" | "relations";
export const SPECIMEN_VIEWS: SpecimenView[] = ["macro", "micro", "relations"];

interface SpecimenPanelProps {
  entry: Entry;
  view: SpecimenView;
  lang: Lang;
  asset: Asset | null;
  toc: TocItem[];
  relations: Relation[];
  entries: Map<string, EntrySummary>;
}

/**
 * The facing page of a specimen: one panel, three ways of looking at it.
 * Macro = the organism (plate); Micro = its anatomy (sections); Relations =
 * its ties to others. Views are links (?view=) so every state has a URL;
 * Codex adds the tab keyboard pattern and transitions (R3-M3).
 */
export function SpecimenPanel({ entry, view, lang, asset, toc, relations, entries }: SpecimenPanelProps) {
  const t = (k: Parameters<typeof translate>[1]) => translate(lang, k);
  const labels: Record<SpecimenView, string> = {
    macro: t("entry.view.macro"),
    micro: t("entry.view.micro"),
    relations: t("entry.view.relations"),
  };
  const plateNo = toRoman(catalogueNumber(entry.id));

  return (
    <div data-mount="specimen-panel" data-view={view}>
      <nav aria-label={t("entry.views")} className="mb-6 flex gap-5 border-b border-rule">
        {SPECIMEN_VIEWS.map((v) => (
          <Link
            key={v}
            href={v === "macro" ? `/entries/${entry.slug}` : `/entries/${entry.slug}?view=${v}`}
            scroll={false}
            replace
            aria-current={v === view ? "true" : undefined}
            className={cn(
              "-mb-px border-b py-2 text-small no-underline transition-colors duration-(--dur-quick)",
              v === view ? "border-brick text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {labels[v]}
          </Link>
        ))}
      </nav>

      {view === "macro" ? (
        <div className="flex flex-col gap-5">
          <Plate
            lang={lang}
            number={plateNo}
            asset={asset}
            fallback={{
              scale: entry.scale,
              rings: entry.revision,
              state: entry.status,
              crossover: Boolean(entry.analogue),
            }}
            caption={asset?.caption ?? entry.analogue?.name}
            priority
          />
          {entry.analogue?.note ? (
            <p className="border-l-2 border-brick pl-4 font-display text-small text-ink-2 italic">
              <span className="not-italic text-meta tracking-[0.1em] text-brick-ink uppercase">
                {t("entry.analogue")} ·{" "}
              </span>
              {pick(entry.analogue.name, lang)} — {pick(entry.analogue.note, lang)}
            </p>
          ) : null}
        </div>
      ) : view === "micro" ? (
        <section aria-label={t("entry.anatomy")}>
          <h2 className="mb-4 pw-smallcaps text-small text-ink-3">{t("entry.anatomy")}</h2>
          <ol className="flex flex-col">
            {toc.map((item, i) => (
              <li key={item.id} className={item.depth === 3 ? "pl-8" : ""}>
                <a
                  href={`#${item.id}`}
                  className="flex items-baseline gap-3 border-b border-rule py-2 text-small text-ink no-underline hover:text-indigo"
                >
                  <span className="w-6 shrink-0 font-mono text-meta text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0">
                    {item.parts.zh && item.parts.en ? (lang === "zh" ? item.parts.zh : item.parts.en) : item.parts.text}
                    {item.parts.zh && item.parts.en ? (
                      <span className="ml-2 text-meta text-ink-3 italic">
                        {lang === "zh" ? item.parts.en : item.parts.zh}
                      </span>
                    ) : null}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      ) : relations.length ? (
        <RelationList relations={relations} entries={entries} lang={lang} focusId={entry.id} />
      ) : (
        <p className="text-small text-ink-3 italic">{t("entry.noRelations")}</p>
      )}
    </div>
  );
}
