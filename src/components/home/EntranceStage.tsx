"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Lang } from "@/lib/model/types";
import { PARTS, partForPath, type StageTheme } from "@/lib/parts";
import { cn } from "@/lib/utils";
import { PlateLoupe } from "./PlateLoupe";
import { HyphaeField } from "./HyphaeField";

export interface StageFrame {
  name: string;
  width: number;
  height: number;
  left: string;
  right: string;
  top: string;
  dark: boolean;
}

const src = (name: string) => `/stage/${name}.webp`;
const loaded = new Map<string, Promise<void>>();
function preload(name: string): Promise<void> {
  if (!loaded.has(name)) {
    loaded.set(
      name,
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => img.decode().then(resolve, resolve);
        img.onerror = () => resolve();
        img.src = src(name);
      }),
    );
  }
  return loaded.get(name)!;
}

/**
 * The entrance stage shared by the four parts (/, /links, /members, /forum).
 * One plate, one composition, four 19th-century manners: the forest floor,
 * the coast, the marble capriccio, the blueprint. Choosing a part swaps the
 * plate straight to that part's manner (a short fade, no in-between frames),
 * starting on the click itself rather than when the route arrives. The stage
 * stays mounted across the four routes (it lives in their layout); only the
 * part content below it changes.
 */
export function EntranceStage({
  frames,
  lang,
  meta,
  seed,
}: {
  frames: Record<string, StageFrame>;
  lang: Lang;
  /** One typed line per part, e.g. "16 specimens · 10 phyla". */
  meta: Record<string, string>;
  seed: { x: number; y: number };
}) {
  const pathname = usePathname();
  const routed = partForPath(pathname) ?? PARTS[0];
  // The part the reader asked for: set on click, before the route has even arrived,
  // so the stage starts turning at once instead of waiting for the server.
  // It is remembered with the route it was made from, so it lapses by itself once the route moves on.
  const [intent, setIntent] = useState<{ theme: StageTheme; from: StageTheme } | null>(null);
  const live = intent && intent.from === routed.theme ? intent.theme : null;
  const part = (live && PARTS.find((p) => p.theme === live)) || routed;
  const [layers, setLayers] = useState<[string, string]>([routed.theme, routed.theme]);
  const [front, setFront] = useState<0 | 1>(0);
  const shown = layers[front];
  const settled = useRef<StageTheme>(part.theme);
  const frontRef = useRef<0 | 1>(0);
  const currentRoute = useRef<StageTheme>(routed.theme);
  useEffect(() => {
    currentRoute.current = routed.theme;
  }, [routed.theme]);
  const run = useRef(0);

  // Put the frame on the back layer, let it paint, then cross-fade to it.
  const show = useCallback(
    (name: string) =>
      new Promise<void>((resolve) => {
        const back: 0 | 1 = frontRef.current === 0 ? 1 : 0;
        setLayers((l) => (back === 0 ? [name, l[1]] : [l[0], name]));
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            frontRef.current = back;
            setFront(back);
            resolve();
          }),
        );
      }),
    [],
  );

  // Catch clicks on any link to a part (stage tabs, header, footer) as they happen.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.target === "_blank" || a.origin !== location.origin) return;
      const next = partForPath(a.pathname);
      if (next) setIntent({ theme: next.theme, from: currentRoute.current });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Straight to the chosen plate; a later choice overrides one still loading.
  useEffect(() => {
    const to = part.theme;
    if (to === settled.current) return;
    settled.current = to;
    const id = ++run.current;
    preload(to).then(() => {
      if (run.current === id) show(to);
    });
  }, [part.theme, show]);

  // Warm the other three plates once the page is idle, so a switch never waits on the network.
  useEffect(() => {
    const id = window.setTimeout(() => Object.keys(frames).forEach((n) => preload(n)), 1200);
    return () => window.clearTimeout(id);
  }, [frames]);

  const f = frames[shown] ?? frames[part.theme];
  const dark = f?.dark ?? false;
  const biology = shown === "biology";

  return (
    <section
      aria-labelledby="stage-title"
      data-dark={dark || undefined}
      className="pw-stage relative -mt-8 ml-[calc(50%-50vw)] w-screen overflow-hidden sm:-mt-10"
      style={
        {
          "--stage-l": f?.left,
          "--stage-r": f?.right,
          "--stage-ink": dark ? "#f1ece2" : "var(--color-ink)",
          "--stage-ink-2": dark ? "rgb(241 236 226 / 0.72)" : "var(--color-ink-3)",
        } as React.CSSProperties
      }
    >
      {biology ? <HyphaeField seed={{ x: 0.5 + (seed.x - 0.5) * 0.8, y: 0.2 + seed.y * 0.62 }} delay={300} /> : null}

      <div className="relative mx-auto flex h-full max-w-(--content-max) flex-col px-4 sm:px-6">
        <div className="relative z-[2] flex items-start justify-between gap-6 pt-5 lg:pt-7">
          <h1 id="stage-title" className="pw-stage-title font-display leading-[0.86] tracking-[-0.04em]">
            <span className="pw-hero-letters inline-block whitespace-nowrap">
              {"Pioneer".split("").map((ch, i) => (
                <span key={i} aria-hidden="true">
                  <span style={{ "--i": i } as React.CSSProperties}>{ch}</span>
                </span>
              ))}
            </span>{" "}
            <span key={part.word} className="pw-hero-letters inline-block whitespace-nowrap italic">
              {part.word.split("").map((ch, i) => (
                <span key={i} aria-hidden="true">
                  <span style={{ "--i": i + 3 } as React.CSSProperties}>{ch}</span>
                </span>
              ))}
            </span>
            <span className="sr-only">
              Pioneer {part.word} · 先锋维基 · {part.name.zh}
            </span>
          </h1>
          <div className="pw-hero-in flex items-start gap-4" style={{ "--delay": "900ms" } as React.CSSProperties}>
            <p
              className="hidden pt-1 text-right font-mono text-[0.6875rem] leading-relaxed tracking-[0.18em] uppercase sm:block"
              style={{ color: "var(--stage-ink-2)" }}
            >
              <span className="block">
                Part {part.numeral} · {part.manner[lang]}
              </span>
              <span key={part.id} className="pw-settle block">
                {meta[part.id]}
              </span>
            </p>
            <p
              aria-hidden="true"
              lang="zh-CN"
              className="font-display text-[clamp(1rem,1.4vw,1.25rem)] leading-none tracking-[0.4em] [writing-mode:vertical-rl]"
              style={{ color: "var(--stage-ink)" }}
            >
              先锋维基
            </p>
          </div>
        </div>

        {/* The plate: in the flow on small screens, floating full-bleed behind the type on large ones. */}
        <div className="pw-stage-plate">
          <PlateLoupe src={src(shown)} className="relative size-full">
            <div className="pw-stage-layers">
              <div className="pw-hero-ink absolute inset-0">
                {layers.map((name, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- frame-by-frame plate, preloaded and swapped by hand
                  <img
                    key={i}
                    src={src(name)}
                    alt={i === front ? `${part.manner[lang]} — ${part.lede[lang]}` : ""}
                    aria-hidden={i === front ? undefined : true}
                    width={frames[name]?.width ?? 1600}
                    height={frames[name]?.height ?? 1067}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    draggable={false}
                    data-front={i === front || undefined}
                  />
                ))}
              </div>
            </div>
          </PlateLoupe>
        </div>

        {/* The four parts. Every part has its own route; the stage turns between them. */}
        <nav
          aria-label={lang === "zh" ? "四个部分" : "Four parts"}
          className="pw-hero-in relative z-[2] mt-auto pb-5"
          style={{ "--delay": "1100ms" } as React.CSSProperties}
        >
          <ol className="grid grid-cols-2 gap-px sm:grid-cols-4">
            {PARTS.map((p) => {
              const current = p.id === part.id;
              return (
                <li key={p.id}>
                  <Link
                    href={p.href}
                    scroll={false}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "pw-part-tab group flex items-baseline gap-3 py-3 no-underline",
                      current && "is-current",
                    )}
                  >
                    <span className="font-display text-h4 italic">{p.numeral}</span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-display text-lead leading-tight">
                        {p.name[lang]}{" "}
                        <span className="text-small opacity-70">{p.name[lang === "zh" ? "en" : "zh"]}</span>
                      </span>
                      <span className="font-mono text-[0.625rem] tracking-[0.16em] uppercase opacity-70">
                        {p.manner[lang]}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </section>
  );
}
