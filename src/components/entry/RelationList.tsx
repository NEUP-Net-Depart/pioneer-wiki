import Link from "next/link";
import type { EntrySummary, Lang, Relation } from "@/lib/model/types";
import { RELATION_KINDS, RELATION_KIND_IDS } from "@/lib/model/vocab";
import { pick } from "@/lib/i18n/dictionary";

/**
 * Typed edges around one entry (or all entries), grouped by kind. This is also
 * the accessible, static alternative to the graph drawings.
 */
export function RelationList({
  relations,
  entries,
  lang,
  focusId,
}: {
  relations: Relation[];
  entries: Map<string, EntrySummary>;
  lang: Lang;
  focusId?: string;
}) {
  const groups = RELATION_KIND_IDS.map((kind) => ({ kind, items: relations.filter((r) => r.kind === kind) })).filter(
    (g) => g.items.length,
  );
  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ kind, items }) => (
        <section key={kind} aria-label={RELATION_KINDS[kind].label[lang]}>
          <h3 className="mb-2 pw-smallcaps text-small text-ink-3">{RELATION_KINDS[kind].label[lang]}</h3>
          <ul className="flex flex-col gap-3">
            {items.map((r) => {
              const from = entries.get(r.from);
              const to = entries.get(r.to);
              if (!from || !to) return null;
              const symmetric = RELATION_KINDS[kind].symmetric;
              const outgoing = r.from === focusId;
              const other = focusId ? (outgoing ? to : from) : null;
              return (
                <li key={r.id} className="text-small">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    {other ? (
                      <>
                        <span aria-hidden="true" className="w-4 font-mono text-ink-3">
                          {symmetric ? "↔" : outgoing ? "→" : "←"}
                        </span>
                        <Link href={`/entries/${other.slug}`} className="text-ink no-underline hover:text-indigo">
                          {pick(other.title, lang)}
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link href={`/entries/${from.slug}`} className="text-ink no-underline hover:text-indigo">
                          {pick(from.title, lang)}
                        </Link>
                        <span aria-label={symmetric ? "↔" : "→"} className="font-mono text-ink-3">
                          {symmetric ? "↔" : "→"}
                        </span>
                        <Link href={`/entries/${to.slug}`} className="text-ink no-underline hover:text-indigo">
                          {pick(to.title, lang)}
                        </Link>
                      </>
                    )}
                    <span aria-hidden="true" className="ml-auto flex gap-0.5">
                      {Array.from({ length: r.strength }, (_, i) => (
                        <span key={i} className="inline-block h-1 w-1 rounded-full bg-ink-3" />
                      ))}
                    </span>
                  </p>
                  {r.note ? (
                    <p className={`mt-0.5 text-meta text-ink-3 ${other ? "pl-6" : ""}`}>{pick(r.note, lang)}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
