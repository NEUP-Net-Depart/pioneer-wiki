import Image from "next/image";
import type { Asset, Lang, Localized, ReviewState, Scale } from "@/lib/model/types";
import { pick, translate } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";
import { SpecimenMark } from "@/components/archive/SpecimenMark";

interface PlateProps {
  lang: Lang;
  /** Roman plate number, e.g. "IV". */
  number?: string;
  asset?: Asset | null;
  /** Used when there is no illustration yet: the procedural specimen mark. */
  fallback?: { scale: Scale; rings: number; state: ReviewState; crossover: boolean };
  caption?: Localized;
  /** natural = image at its own ratio; square / landscape = image centred in a fixed 1:1 / 4:3 cell (plate grids). */
  frame?: "natural" | "square" | "landscape";
  /** Image only — no plate number, caption or credit. */
  bare?: boolean;
  /** Responsive `sizes` for next/image. */
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/**
 * 图版 — an illustration presented as a printed plate: the image on bare paper,
 * a plate number and a short caption beneath. Plates are prepared by
 * tools/prepare-plates.mjs (ground → white) and multiplied into the page.
 */
export function Plate({
  lang,
  number,
  asset,
  fallback,
  caption,
  frame = "natural",
  bare = false,
  sizes = "(min-width: 1024px) 40vw, 92vw",
  priority,
  className,
}: PlateProps) {
  const label = number ? `${translate(lang, "book.plate")} ${number}` : null;
  const text = caption ?? asset?.caption;
  const fitted = frame === "square" || frame === "landscape";

  const art = asset ? (
    <span className={cn("pw-print", fitted ? "flex size-full items-center justify-center" : "w-full")}>
      <Image
        src={asset.src}
        width={asset.width}
        height={asset.height}
        alt={pick(asset.alt, lang)}
        sizes={sizes}
        priority={priority}
        className={fitted ? "max-h-full w-auto max-w-full object-contain" : "h-auto w-full"}
      />
    </span>
  ) : fallback ? (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", fitted ? "size-full" : "aspect-[4/5] w-full")}
    >
      <SpecimenMark {...fallback} className="pw-hairline size-3/5 max-h-56 max-w-56 text-ink-3" />
      <span className="text-meta tracking-[0.1em] text-ink-3 uppercase">{translate(lang, "book.platePending")}</span>
    </div>
  ) : null;

  return (
    <figure className={cn("flex flex-col", className)}>
      {/* min-h-0: a flex item may not grow past the fixed cell, or tall portraits stretch the grid out of alignment. */}
      {fitted ? (
        <div
          className={cn(
            "flex min-h-0 w-full items-center justify-center",
            frame === "square" ? "aspect-square" : "aspect-[4/3]",
          )}
        >
          {art}
        </div>
      ) : (
        art
      )}
      {!bare && (label || text) ? (
        <figcaption className="mt-4 flex flex-col gap-1 text-small text-ink-2">
          <span className="pw-letterpress text-lead leading-snug">
            {label ? <span className="mr-2 text-phylum-ink italic">{label}.</span> : null}
            {text ? pick(text, lang) : null}
          </span>
          {asset ? (
            <span className="text-meta text-ink-3">
              {asset.credit} · {asset.license}
            </span>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
