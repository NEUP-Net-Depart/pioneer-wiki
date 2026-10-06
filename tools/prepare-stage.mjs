#!/usr/bin/env node
/**
 * Entrance stage frames: public/stage/src/*.png → public/stage/<name>.webp and
 * public/stage/frames.json. The four theme plates (biology, geography, art,
 * blueprint) share one composition.
 *
 * Frames are kept opaque (the blueprint ones are blue to the edges), but a
 * paper-coloured ground is normalised to exactly the page paper (#e9e1d1), so
 * a paper frame meets the page without a seam. For every frame we record the
 * colours along its left/right/top edges: the stage paints its side margins
 * with them, and picks a light or dark title ink from the top colour.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "public/stage/src";
const OUT = "public/stage";
const PAPER = [233, 225, 209];
const WIDTH = 1600;

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

async function edges(img) {
  const { data, info } = await img
    .clone()
    .resize(120, 80, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const at = (x, y) => [0, 1, 2].map((c) => data[(y * info.width + x) * 3 + c]);
  const band = (pick) => {
    const ch = [[], [], []];
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) if (pick(x, y)) at(x, y).forEach((v, c) => ch[c].push(v));
    return ch.map(median);
  };
  return {
    left: band((x, y) => x < 3 && y < info.height * 0.8),
    right: band((x, y) => x >= info.width - 3 && y < info.height * 0.8),
    top: band((x, y) => y < 4),
  };
}

const rgb = (c) => `rgb(${c.map(Math.round).join(" ")})`;

const frames = [];
for (const file of (await fs.readdir(SRC)).filter((f) => f.endsWith(".png")).sort()) {
  const name = path.basename(file, ".png");
  let img = sharp(path.join(SRC, file));
  const e = await edges(img);
  // A paper ground (light, warm) is scaled onto the page paper; a blue blueprint ground is left alone.
  const paperish = lum(e.top) > 170 && e.top[0] >= e.top[2];
  if (paperish)
    img = img.linear(
      PAPER.map((p, c) => p / Math.max(1, e.top[c])),
      [0, 0, 0],
    );
  const fix = (c) => (paperish ? c.map((v, i) => Math.min(255, (v * PAPER[i]) / Math.max(1, e.top[i]))) : c);
  const out = await img
    .resize({ width: WIDTH })
    .webp({ quality: 74, effort: 5 })
    .toFile(path.join(OUT, `${name}.webp`));
  const top = fix(e.top);
  frames.push({
    name,
    width: out.width,
    height: out.height,
    left: rgb(fix(e.left)),
    right: rgb(fix(e.right)),
    top: rgb(top),
    dark: lum(top) < 120,
  });
  console.log(
    name,
    `${out.width}x${out.height}`,
    `${Math.round(out.size / 1024)} KB`,
    paperish ? "paper" : "dark",
    rgb(top),
  );
}
await fs.writeFile(path.join(OUT, "frames.json"), JSON.stringify(frames, null, 2) + "\n");
