"use client";

import Link from "next/link";
import type { Lang } from "@/lib/model/types";
import type { PlateAnnotation } from "@/mock/frontispiece";
import { cn } from "@/lib/utils";

/**
 * The plate's key, kept quiet: brick dots that breathe on the illustration;
 * pointing at (or tabbing to) a dot draws a short leader and names the part
 * of the scene and the specimen it stands for. Only on the natural-history
 * plate, and hidden while the stage is turning.
 */
export function StageCallouts({
  annotations,
  lang,
  visible,
}: {
  annotations: PlateAnnotation[];
  lang: Lang;
  visible: boolean;
}) {
  return (
    <ol
      aria-hidden={!visible || undefined}
      className={cn(
        "absolute inset-0 hidden transition-opacity duration-(--dur-slow) lg:block",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {annotations.map((a, i) => {
        const toLeft = a.x > 0.7;
        return (
          <li key={a.key} className="group/key absolute" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}>
            <Link
              href={a.href}
              tabIndex={visible ? undefined : -1}
              className="pw-key-dot absolute block size-6 -translate-1/2 rounded-full no-underline"
              style={{ "--i": i } as React.CSSProperties}
              aria-label={`${a.part[lang]} → ${a.concept[lang]}`}
            >
              <span
                aria-hidden="true"
                className="absolute inset-[7px] rounded-full bg-brick ring-[3px] ring-paper/90"
              />
            </Link>
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute top-0 flex w-max -translate-y-1/2 items-center gap-2 opacity-0 transition-[opacity,translate] duration-(--dur-base) ease-(--ease-grow) group-focus-within/key:opacity-100 group-hover/key:opacity-100",
                toLeft
                  ? "right-4 flex-row-reverse translate-x-1 group-hover/key:translate-x-0"
                  : "left-4 -translate-x-1 group-hover/key:translate-x-0",
              )}
            >
              <span className="h-px w-8 bg-ink/60" />
              <span className={cn("rounded-xs bg-paper/92 px-2 py-1 shadow-sheet", toLeft && "text-right")}>
                <span className="block font-mono text-[0.625rem] tracking-[0.14em] text-ink-3 uppercase">
                  {a.key}. {a.part[lang]} · {a.part[lang === "zh" ? "en" : "zh"]}
                </span>
                <span className="block font-display text-lead text-ink italic">→ {a.concept[lang]}</span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
