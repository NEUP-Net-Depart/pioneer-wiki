import type { Bookplate as Plate, Lang, Localized } from "@/lib/model/types";
import { BORDERS, INKS } from "@/lib/model/vocab";
import { cn } from "@/lib/utils";

const mask = (name: string) => ({
  maskImage: `url(/vignettes/web/${name}.webp)`,
  WebkitMaskImage: `url(/vignettes/web/${name}.webp)`,
});

/** The ribbon the motto is set on: a banner with forked, folded-back ends. */
function Ribbon({ motto }: { motto: string }) {
  return (
    <span className="pw-plate-ribbon">
      <svg viewBox="0 0 200 26" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M14 4 H186 L200 4 L192 13 L200 22 H186 L14 22 H0 L8 13 L0 4 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path d="M14 4 V22 M186 4 V22" stroke="currentColor" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
      </svg>
      <span>{motto}</span>
    </span>
  );
}

/**
 * 藏书票 — a member's ex libris: engraved frame and emblem printed in their
 * ink, EX LIBRIS, the motto on a ribbon, the name in both languages and the
 * plate number. `mini` keeps only frame and emblem, for signatures and bylines.
 * Built from spans only, so it is valid inside a paragraph or a byline.
 */
export function Bookplate({
  plate,
  name,
  lang,
  mini = false,
  pasted = false,
  className,
}: {
  plate: Plate;
  name: Localized;
  lang: Lang;
  mini?: boolean;
  pasted?: boolean;
  className?: string;
}) {
  const other: Lang = lang === "zh" ? "en" : "zh";
  return (
    <span
      role="img"
      aria-label={`Ex libris ${name[lang]} · No. ${String(plate.number).padStart(3, "0")}`}
      data-pasted={pasted || undefined}
      className={cn("pw-plate block", className)}
      style={{ "--plate-ink": INKS[plate.ink].hex } as React.CSSProperties}
    >
      <span aria-hidden="true" className="pw-plate-ink pw-plate-frame" style={mask(BORDERS[plate.border].frame)} />
      <span
        aria-hidden="true"
        className={cn("pw-plate-ink pw-plate-emblem", mini && "!top-[22%] !right-[16%] !left-[16%] !h-[56%]")}
        style={mask(plate.emblem)}
      />
      {mini ? null : (
        <>
          <span aria-hidden="true" className="pw-plate-text pw-plate-exlibris">
            EX LIBRIS
          </span>
          {plate.motto ? <Ribbon motto={plate.motto} /> : null}
          <span aria-hidden="true" lang={lang === "zh" ? "zh-CN" : "en"} className="pw-plate-text pw-plate-name">
            {name[lang]}
          </span>
          {name[other] !== name[lang] ? (
            <span aria-hidden="true" className="pw-plate-text pw-plate-name-alt">
              {name[other]}
            </span>
          ) : null}
          <span aria-hidden="true" className="pw-plate-text pw-plate-number">
            No. {String(plate.number).padStart(3, "0")}
          </span>
        </>
      )}
    </span>
  );
}

/** A member's emblem alone, printed in their ink (cast list, pickers). */
export function Emblem({ emblem, ink, className }: { emblem: string; ink: Plate["ink"]; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block aspect-square bg-current [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
        className,
      )}
      style={{ color: INKS[ink].hex, ...mask(emblem) }}
    />
  );
}
