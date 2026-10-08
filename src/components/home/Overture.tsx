"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface OvertureCut {
  name: string;
  width: number;
  height: number;
  /** Median border colour: the cut sits centred on a full-bleed field of it. */
  ground: string;
}

export interface OvertureBird {
  src: string;
  width: number;
  height: number;
}

type Phase = "idle" | "boot" | "montage" | "scatter" | "title" | "lift";

const MONTAGE = 10;
const FINAL = "m-birds";

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Montage rhythm: the cuts start at half a second and quicken, then the birds hold. */
const beat = (i: number, n: number) => (i === n - 1 ? 760 : Math.max(170, 540 - i * 44));

function preload(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => (img.decode ? img.decode().then(resolve, () => resolve()) : resolve());
    img.onerror = () => resolve();
    img.src = src;
  });
}

/**
 * The opening titles, after the reference film: a montage of collections —
 * eggs, blueprints, coins, clover, punched tape, cyanotype ferns, culture
 * dishes, gears — each laid out as the same letter P, cut faster and faster,
 * until a P of songbirds takes flight toward the reader and the brick-red
 * title card is lifted away to reveal the frontispiece.
 *
 * Armed only by the boot script (`html[data-overture="play"]`): first home
 * visit per session, never under reduced motion. Any key, click, wheel or touch
 * skips it. The page underneath is complete and readable without it.
 */
export function Overture({ cuts, birds }: { cuts: OvertureCut[]; birds: OvertureBird[] }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seq, setSeq] = useState<OvertureCut[]>([]);
  const [at, setAt] = useState(0);
  const timers = useRef<number[]>([]);
  const finished = useRef(false);

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    timers.current.forEach((t) => window.clearTimeout(t));
    document.documentElement.dataset.overture = "done";
    setPhase("idle");
  }, []);

  const skip = useCallback(() => {
    if (finished.current) return;
    timers.current.forEach((t) => window.clearTimeout(t));
    setPhase("lift");
    timers.current = [window.setTimeout(finish, 520)];
  }, [finish]);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.overture !== "play") return;
    try {
      sessionStorage.setItem("pw:overture", "1");
    } catch {}
    const final = cuts.find((c) => c.name === FINAL);
    const order = [...shuffle(cuts.filter((c) => c.name !== FINAL)).slice(0, MONTAGE), ...(final ? [final] : [])];
    let cancelled = false;
    // Start on the next frame: the boot script has already covered the page with paper.
    const startFrame = requestAnimationFrame(() => {
      setSeq(order);
      setPhase("boot");
    });

    const ready = Promise.all([
      ...order.map((c) => preload(`/overture/${c.name}.webp`)),
      ...birds.map((b) => preload(b.src)),
    ]);
    const timeout = new Promise((r) => window.setTimeout(r, 2600));
    Promise.race([ready, timeout]).then(() => {
      if (cancelled || finished.current) return;
      setPhase("montage");
      let t = 0;
      order.forEach((_, i) => {
        later(() => setAt(i), t);
        t += beat(i, order.length);
      });
      later(() => setPhase("scatter"), t);
      later(() => setPhase("title"), t + 900);
      later(() => setPhase("lift"), t + 900 + 1500);
      later(finish, t + 900 + 1500 + 760);
    });

    const onInput = (e: Event) => {
      if (e instanceof KeyboardEvent && ["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      skip();
    };
    const opts = { passive: true } as const;
    window.addEventListener("keydown", onInput);
    window.addEventListener("wheel", onInput, opts);
    window.addEventListener("touchstart", onInput, opts);
    window.addEventListener("pointerdown", onInput);
    return () => {
      cancelled = true;
      cancelAnimationFrame(startFrame);
      window.removeEventListener("keydown", onInput);
      window.removeEventListener("wheel", onInput);
      window.removeEventListener("touchstart", onInput);
      window.removeEventListener("pointerdown", onInput);
      timers.current.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page load; cuts/birds are static props.
  }, []);

  // While the card lifts, uncover the page so the frontispiece plays its own entrance underneath.
  useEffect(() => {
    if (phase === "lift") document.documentElement.dataset.overture = "lift";
  }, [phase]);

  if (phase === "idle") return null;

  const showCuts = phase === "boot" || phase === "montage" || phase === "scatter";
  const flock = Array.from({ length: 11 }, (_, i) => {
    const angle = (i / 11) * Math.PI * 2 + (i % 2 ? 0.35 : -0.2);
    return {
      bird: birds[i % birds.length],
      x: Math.cos(angle) * (60 + (i % 3) * 18),
      y: Math.sin(angle) * (52 + (i % 4) * 12) - 18,
      sx: ((i * 37) % 30) - 15,
      sy: ((i * 53) % 34) - 17,
      flip: Math.cos(angle) < 0,
      delay: (i % 5) * 45,
      size: 9 + (i % 4) * 2.5,
    };
  });

  return (
    <div aria-hidden="true" className="pw-overture" data-phase={phase}>
      {showCuts
        ? seq.map((c, i) => (
            <div
              key={c.name}
              className="pw-cut"
              data-on={(phase !== "boot" && i === at) || undefined}
              style={
                {
                  background: c.ground,
                  "--d": `${beat(i, seq.length) + 120}ms`,
                  "--dir": i % 2 ? 1 : -1,
                } as React.CSSProperties
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- preloaded montage frames, swapped by hard cuts */}
              <img src={`/overture/${c.name}.webp`} width={c.width} height={c.height} alt="" draggable={false} />
            </div>
          ))
        : null}

      {phase === "boot" ? (
        <div className="pw-overture-boot">
          <span>Pioneer Wiki</span>
          <span>Vol. I — MMXXVI</span>
        </div>
      ) : null}

      {phase === "montage" ? (
        <div className="pw-overture-counter">
          <span>Pl. {String(at + 1).padStart(2, "0")}</span>
          <span>/ {String(seq.length).padStart(2, "0")}</span>
        </div>
      ) : null}

      {phase === "scatter" ? (
        <div className="pw-flock">
          {flock.map((f, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- transient sprites
            <img
              key={i}
              src={f.bird.src}
              alt=""
              style={
                {
                  "--x": `${f.x}vw`,
                  "--y": `${f.y}vh`,
                  "--sx": `${f.sx}vw`,
                  "--sy": `${f.sy}vh`,
                  "--flip": f.flip ? -1 : 1,
                  "--w": `${f.size}vw`,
                  animationDelay: `${f.delay}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      {phase === "title" || phase === "lift" ? (
        <div className="pw-title-card">
          <p className="pw-title-card-word">
            {"Pioneer".split("").map((ch, i) => (
              <span key={i} style={{ animationDelay: `${120 + i * 45}ms` }}>
                {ch}
              </span>
            ))}
            <span className="pw-title-card-gap" />
            {"Wiki".split("").map((ch, i) => (
              <span key={`w${i}`} className="italic" style={{ animationDelay: `${120 + (8 + i) * 45}ms` }}>
                {ch}
              </span>
            ))}
          </p>
          <p className="pw-title-card-sub">先锋维基 · A natural history of computer science</p>
        </div>
      ) : null}

      <button type="button" className="pw-overture-skip" onClick={skip} tabIndex={-1}>
        Skip ›
      </button>
    </div>
  );
}
