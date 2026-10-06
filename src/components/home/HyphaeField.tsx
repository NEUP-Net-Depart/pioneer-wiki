"use client";

import { useEffect, useRef } from "react";

interface Tip {
  x: number;
  y: number;
  a: number;
  life: number;
  w: number;
}

const INK = "36, 34, 30";

/**
 * Mycelium on the open page. Hairline hyphae grow out of a seed point when the
 * spread opens, and wherever the reader's pointer wanders over empty paper,
 * branching as they go and slowly soaking back into the sheet. Decorative,
 * pointer-events: none, stops drawing when idle, absent under reduced motion.
 */
export function HyphaeField({
  seed = { x: 0.62, y: 0.7 },
  delay = 300,
}: {
  seed?: { x: number; y: number };
  delay?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let tips: Tip[] = [];
    let frame = 0;
    let idle = 0;
    let last: { x: number; y: number } | null = null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const sprout = (x: number, y: number, n: number, life = 34) => {
      for (let i = 0; i < n && tips.length < 220; i++) {
        tips.push({ x, y, a: Math.random() * Math.PI * 2, life: life * (0.6 + Math.random() * 0.6), w: 0.9 });
      }
      if (!frame) frame = requestAnimationFrame(step);
    };

    const step = () => {
      frame = 0;
      // Soak: older ink fades back into the paper.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.035)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";

      const next: Tip[] = [];
      for (const t of tips) {
        const len = 3.2 + Math.random() * 3.4;
        const a = t.a + (Math.random() - 0.5) * 0.55;
        const nx = t.x + Math.cos(a) * len;
        const ny = t.y + Math.sin(a) * len;
        ctx.strokeStyle = `rgba(${INK}, ${0.22 + 0.25 * Math.min(1, t.life / 30)})`;
        ctx.lineWidth = t.w;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        const life = t.life - 1;
        if (life > 0) {
          next.push({ x: nx, y: ny, a, life, w: Math.max(0.35, t.w * 0.985) });
          if (Math.random() < 0.055 && next.length < 220)
            next.push({
              x: nx,
              y: ny,
              a: a + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6),
              life: life * 0.7,
              w: t.w * 0.8,
            });
        } else if (Math.random() < 0.5) {
          ctx.fillStyle = `rgba(${INK}, 0.35)`;
          ctx.beginPath();
          ctx.arc(nx, ny, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      tips = next;
      idle = tips.length ? 0 : idle + 1;
      // Keep fading for a while after the last tip dies, then rest.
      if (idle < 160) frame = requestAnimationFrame(step);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) return;
      if (last && Math.hypot(x - last.x, y - last.y) < 26) return;
      last = { x, y };
      sprout(x, y, 2, 22);
    };

    resize();
    // The seed sprouts when the spread opens — after the opening titles, if they are playing.
    const root = document.documentElement;
    let start = 0;
    const arm = () => {
      start = window.setTimeout(() => {
        const r = canvas.getBoundingClientRect();
        sprout(r.width * seed.x, r.height * seed.y, 11, 70);
      }, delay);
    };
    const waiting = new MutationObserver(() => {
      if (root.dataset.overture === "play") return;
      waiting.disconnect();
      arm();
    });
    if (root.dataset.overture === "play")
      waiting.observe(root, { attributes: true, attributeFilter: ["data-overture"] });
    else arm();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.clearTimeout(start);
      waiting.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [seed.x, seed.y, delay]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />;
}
