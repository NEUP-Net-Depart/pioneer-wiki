import type { Lang } from "@/lib/model/types";
import { cn } from "@/lib/utils";

const ZONES_X = ["A", "B", "C", "D", "E", "F"];
const ZONES_Y = ["1", "2", "3", "4"];

/** First-angle projection symbol: a truncated cone seen from the side and from its end. */
function ProjectionSymbol() {
  return (
    <svg
      viewBox="0 0 58 24"
      aria-hidden="true"
      className="h-5 w-auto"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <path d="M4 6 L24 3 L24 21 L4 18 Z" />
      <path d="M1 12 H27 M42 1 V23 M30 12 H55" strokeDasharray="4 2 1 2" strokeWidth="0.6" />
      <circle cx="42" cy="12" r="9" />
      <circle cx="42" cy="12" r="5.5" />
    </svg>
  );
}

/** A drafting scale bar, 0–10 in alternate inked blocks. */
function ScaleBar() {
  return (
    <svg
      viewBox="0 0 132 22"
      aria-hidden="true"
      className="h-[1.375rem] w-auto"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.8"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={6 + i * 24} y="3" width="24" height="5" fill={i % 2 ? "none" : "currentColor"} />
      ))}
      {["0", "5", "10"].map((t, i) => (
        <text
          key={t}
          x={6 + i * 60}
          y="19"
          fontSize="7"
          fill="currentColor"
          stroke="none"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
        >
          {t}
        </text>
      ))}
    </svg>
  );
}

/**
 * An engineering drawing sheet: a double frame with zone letters and numbers,
 * a gridded drawing area (the body, `children`) with a scale bar and a faint
 * machine watermark, and a title block whose ruled cells are the form's
 * fields (`block`), headed by the drawing office and finished with scale,
 * checker and numbered drawing notes. Used by the forum (blueprint part).
 */
export function DraftingSheet({
  children,
  block,
  notes,
  lang,
  className,
}: {
  children: React.ReactNode;
  block: React.ReactNode;
  notes: string[];
  lang: Lang;
  className?: string;
}) {
  const zh = lang === "zh";
  return (
    <div className={cn("pw-drafting", className)}>
      <div aria-hidden="true" className="pw-drafting-zones-x">
        {ZONES_X.map((z) => (
          <span key={z}>{z}</span>
        ))}
      </div>
      <div aria-hidden="true" className="pw-drafting-zones-y">
        {ZONES_Y.map((z) => (
          <span key={z}>{z}</span>
        ))}
      </div>
      <div className="pw-drafting-board">
        <div className="pw-drafting-area">
          {children}
          <div aria-hidden="true" className="pw-drafting-furniture">
            <span className="flex items-end gap-3">
              <ScaleBar />
              <span>{zh ? "比例 1 : 1" : "Scale 1 : 1"}</span>
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative watermark */}
            <img src="/vignettes/web/bp-gears.webp" alt="" className="pw-drafting-watermark" />
          </div>
        </div>
        <div className="pw-titleblock">
          <div data-span className="pw-titleblock-office">
            <span className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-display text-lead leading-tight">
                  {zh ? "先锋维基 · 制图室" : "Pioneer Wiki · Drawing Office"}
                </span>
                <small>{zh ? "Pioneer Wiki Drawing Office" : "先锋维基 · 制图室"}</small>
              </span>
              <ProjectionSymbol />
            </span>
          </div>
          {block}
          <div>
            <small>{zh ? "比例 · Scale" : "Scale · 比例"}</small>
            <output>1 : 1</output>
          </div>
          <div>
            <small>{zh ? "审核 · Checked" : "Checked · 审核"}</small>
            <output>—</output>
          </div>
          <div data-span>
            <small>{zh ? "附注 · Notes" : "Notes · 附注"}</small>
            <ol className="mt-1 flex flex-col gap-0.5 font-mono text-[0.6875rem] leading-relaxed text-ink-3">
              {notes.map((n, i) => (
                <li key={i}>
                  {i + 1}. {n}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
