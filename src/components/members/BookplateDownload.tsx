"use client";

import { useState } from "react";
import type { Bookplate, Lang, Localized } from "@/lib/model/types";
import { BORDERS, INKS } from "@/lib/model/vocab";

const W = 1200;
const H = 1800;

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** An engraving re-inked: keep its alpha, fill it with the ink. */
function tinted(img: HTMLImageElement, ink: string, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0, w, h);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = ink;
  x.fillRect(0, 0, w, h);
  return c;
}

/** Draws the bookplate at print size, with the same proportions as the on-page plate (styles/bookplate.css). */
async function render(plate: Bookplate, name: Localized, lang: Lang): Promise<Blob> {
  await document.fonts.ready;
  const css = getComputedStyle(document.documentElement);
  const font = (v: string) => css.getPropertyValue(v).trim() || "serif";
  const ink = INKS[plate.ink].hex;
  const [frame, emblem] = await Promise.all([
    load(`/vignettes/web/${BORDERS[plate.border].frame}.webp`),
    load(`/vignettes/web/${plate.emblem}.webp`),
  ]);

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  x.fillStyle = "#f7f2e6";
  x.fillRect(0, 0, W, H);
  x.drawImage(tinted(frame, ink, W, H), 0, 0);

  // Emblem: contained in the box left/right 20 %, top 19 %, height 38 %.
  const bw = W * 0.6;
  const bh = H * 0.38;
  const s = Math.min(bw / emblem.width, bh / emblem.height);
  const ew = emblem.width * s;
  const eh = emblem.height * s;
  x.drawImage(tinted(emblem, ink, Math.round(ew), Math.round(eh)), (W - ew) / 2, H * 0.19 + (bh - eh) / 2);

  x.fillStyle = ink;
  x.strokeStyle = ink;
  x.textAlign = "center";
  x.textBaseline = "top";
  const text = (str: string, y: number, size: number, family: string, style = "", spacing = "0px") => {
    x.font = `${style} ${size}px ${family}`;
    (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = spacing;
    x.fillText(str, W / 2, y, W * 0.76);
  };
  text("EX LIBRIS", H * 0.095, W * 0.072, font("--font-letterpress"), "", `${W * 0.072 * 0.32}px`);

  if (plate.motto) {
    const l = W * 0.14;
    const r = W * 0.86;
    const t = H * 0.585;
    const b = t + H * 0.085;
    const m = (t + b) / 2;
    const fold = W * 0.04;
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(l + fold, t);
    x.lineTo(r - fold, t);
    x.lineTo(r, t);
    x.lineTo(r - fold * 0.6, m);
    x.lineTo(r, b);
    x.lineTo(l, b);
    x.lineTo(l + fold * 0.6, m);
    x.lineTo(l, t);
    x.closePath();
    x.moveTo(l + fold, t);
    x.lineTo(l + fold, b);
    x.moveTo(r - fold, t);
    x.lineTo(r - fold, b);
    x.stroke();
    x.textBaseline = "middle";
    text(plate.motto, m, W * 0.054, font("--font-letterpress"), "italic");
    x.textBaseline = "top";
  }

  const other: Lang = lang === "zh" ? "en" : "zh";
  text(name[lang], H * 0.7, W * 0.12, font("--font-display"), "500", `${W * 0.12 * 0.04}px`);
  if (name[other] !== name[lang]) text(name[other], H * 0.795, W * 0.066, font("--font-display"), "italic");
  x.globalAlpha = 0.8;
  x.textBaseline = "bottom";
  text(
    `No. ${String(plate.number).padStart(3, "0")}`,
    H * 0.93,
    W * 0.044,
    font("--font-mono"),
    "",
    `${W * 0.044 * 0.16}px`,
  );

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"));
}

/** "Download my bookplate": a 1200 × 1800 PNG, ready to print and paste into a real book. */
export function BookplateDownload({
  plate,
  name,
  handle,
  lang,
  className,
}: {
  plate: Bookplate;
  name: Localized;
  handle: string;
  lang: Lang;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const zh = lang === "zh";
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const blob = await render(plate, name, lang);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `ex-libris-${handle}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        } finally {
          setBusy(false);
        }
      }}
      className={className ?? "pw-link text-small text-ink-2 hover:text-ink disabled:opacity-50"}
    >
      {busy ? (zh ? "正在印制…" : "Printing…") : zh ? "下载藏书票" : "Download bookplate"}{" "}
      <span className="pw-nudge">↓</span>
    </button>
  );
}
