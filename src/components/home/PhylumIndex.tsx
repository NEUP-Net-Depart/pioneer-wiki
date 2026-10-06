"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { DomainId, Lang, Localized } from "@/lib/model/types";
import { cn } from "@/lib/utils";

export interface PhylumRow {
  id: DomainId;
  numeral: string;
  name: Localized;
  note: Localized;
  organism: Localized;
  why: Localized;
  count: number;
  emblem: { src: string; width: number; height: number } | null;
}

/**
 * The contents page. Ten phyla as a column of large type; the facing side is a
 * single plate that changes to whichever phylum the reader points at — its
 * emblem creature, its numeral, and why that creature stands for it.
 */
export function PhylumIndex({ rows, lang }: { rows: PhylumRow[]; lang: Lang }) {
  const [at, setAt] = useState(0);
  const cur = rows[at];
  const other: Lang = lang === "zh" ? "en" : "zh";

  return (
    <div className="grid gap-x-(--space-block) lg:grid-cols-12">
      {/* Facing plate (desktop): sticks while the list scrolls past. */}
      <div data-phylum={cur.id} className="hidden lg:col-span-5 lg:block">
        <div className="sticky top-[calc(var(--shell-header)+3rem)] flex min-h-[34rem] flex-col">
          <div className="relative grid flex-1 place-items-center">
            <span
              aria-hidden="true"
              key={`n-${cur.id}`}
              className="pw-settle absolute inset-0 grid place-items-center font-display text-[clamp(10rem,19vw,17rem)] leading-none text-transparent italic select-none [-webkit-text-stroke:1px_var(--phylum)]"
            >
              {cur.numeral}
            </span>
            {cur.emblem ? (
              <span key={`e-${cur.id}`} className="pw-index-emblem pw-print relative block w-[min(22rem,80%)]">
                <Image
                  src={cur.emblem.src}
                  width={cur.emblem.width}
                  height={cur.emblem.height}
                  alt=""
                  sizes="352px"
                  className="h-auto w-full"
                />
              </span>
            ) : null}
          </div>
          <div key={`t-${cur.id}`} className="pw-settle mt-4 max-w-[26rem]">
            <p className="pw-smallcaps text-meta text-phylum-ink">
              {cur.organism[lang]} <span className="text-ink-3">· {cur.organism[other]}</span>
            </p>
            <p className="mt-2 text-small leading-relaxed text-ink-2">{cur.why[lang]}</p>
          </div>
        </div>
      </div>

      <ol className="lg:col-span-7">
        {rows.map((r, i) => {
          const live = r.count > 0;
          const body = (
            <>
              <span
                className={cn(
                  "w-16 shrink-0 font-display text-h3 italic transition-colors duration-(--dur-quick)",
                  i === at ? "text-phylum" : "text-ink-3",
                )}
              >
                {r.numeral}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block font-display text-[clamp(1.875rem,3.6vw,3.25rem)] leading-[1.05] tracking-[-0.02em] transition-transform duration-(--dur-slow) ease-(--ease-grow)",
                    i === at && "lg:translate-x-3",
                  )}
                >
                  {r.name[lang]}
                </span>
                <span className="mt-1 hidden truncate text-small text-ink-3 sm:block">{r.note[lang]}</span>
              </span>
              {r.emblem ? (
                <span className="pw-print w-14 shrink-0 lg:hidden">
                  <Image
                    src={r.emblem.src}
                    width={r.emblem.width}
                    height={r.emblem.height}
                    alt=""
                    sizes="56px"
                    className="h-auto w-full"
                  />
                </span>
              ) : null}
              <span className="shrink-0 text-right font-mono text-meta text-ink-3">
                {live ? String(r.count).padStart(2, "0") : "—"}
                {live ? <span className="pw-nudge ml-2 inline-block text-ink">→</span> : null}
              </span>
            </>
          );
          return (
            <li
              key={r.id}
              data-phylum={r.id}
              data-reveal="rise"
              style={{ "--i": i % 5 } as React.CSSProperties}
              className="border-b border-rule first:border-t"
            >
              {live ? (
                <Link
                  href={`/domains/${r.id}`}
                  onPointerEnter={() => setAt(i)}
                  onFocus={() => setAt(i)}
                  className="group flex items-center gap-4 py-5 text-ink no-underline sm:gap-6"
                >
                  {body}
                </Link>
              ) : (
                <span onPointerEnter={() => setAt(i)} className="flex items-center gap-4 py-5 text-ink/45 sm:gap-6">
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
