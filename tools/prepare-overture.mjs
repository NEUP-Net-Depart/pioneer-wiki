#!/usr/bin/env node
/**
 * Opening montage cuts: public/overture/src/m-*.png → public/overture/<name>.webp
 * plus public/overture/cuts.json ({ name, width, height, ground }). The ground is
 * the median colour of the image border, so each cut can sit centred on a
 * full-bleed field of its own paper. Flying-bird sprites (fly-*.png) are cut
 * to alpha by tools/prepare-plates.mjs via public/vignettes instead.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "public/overture/src";
const OUT = "public/overture";
const HEIGHT = 1080;

const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const cuts = [];
for (const file of (await fs.readdir(SRC)).filter((f) => /^m-.*\.png$/.test(f)).sort()) {
  const name = path.basename(file, ".png");
  const img = sharp(path.join(SRC, file));
  const { data, info } = await img
    .clone()
    .resize(96, 96, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = [[], [], []];
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      if (x > 3 && x < info.width - 4 && y > 3 && y < info.height - 4) continue;
      const i = (y * info.width + x) * 3;
      for (let c = 0; c < 3; c++) ch[c].push(data[i + c]);
    }
  const ground = `rgb(${ch.map(median).join(" ")})`;
  const out = await img
    .resize({ height: HEIGHT })
    .webp({ quality: 70, effort: 5 })
    .toFile(path.join(OUT, `${name}.webp`));
  cuts.push({ name, width: out.width, height: out.height, ground, kb: Math.round(out.size / 1024) });
  console.log(name, ground, `${out.width}x${out.height}`, `${Math.round(out.size / 1024)} KB`);
}
await fs.writeFile(
  path.join(OUT, "cuts.json"),
  JSON.stringify(
    cuts.map(({ kb, ...c }) => c),
    null,
    2,
  ) + "\n",
);
