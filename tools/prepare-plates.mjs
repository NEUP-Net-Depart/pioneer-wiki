// Prepares generated illustrations for the page: node tools/prepare-plates.mjs
//
// Generated plates and vignettes sit on a flat, slightly darker paper ground.
// Each image is divided by (94 % of) its own ground colour, estimated from the
// border pixels, so the ground clips to white; then white is converted to
// alpha. Output is a transparent cut-out that prints straight onto the page.
// Inputs:  public/plates/*.png, public/vignettes/*.png
// Outputs: <dir>/web/<name>.webp (max 1600 px) + <dir>/web/sizes.json
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import sharp from "sharp";

const DIRS = ["public/plates", "public/vignettes"];

function groundColour(data, width, height, channels) {
  const samples = [[], [], []];
  const band = Math.max(4, Math.round(Math.min(width, height) * 0.02));
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (x > band && x < width - band && y > band && y < height - band) continue;
      const i = (y * width + x) * channels;
      for (let c = 0; c < 3; c++) samples[c].push(data[i + c]);
    }
  }
  return samples.map((s) => s.sort((a, b) => a - b)[Math.floor(s.length * 0.6)]);
}

for (const dir of DIRS.filter((d) => existsSync(d))) {
  const out = join(dir, "web");
  mkdirSync(out, { recursive: true });
  const sizes = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".png"))) {
    const name = basename(file, ".png");
    // Transparent PNGs: flatten onto white first so transparency stays "no ink".
    const img = sharp(join(dir, file))
      .flatten({ background: "#ffffff" })
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true });
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const ground = groundColour(data, info.width, info.height, info.channels);
    // 1. Divide by 94 % of the ground so the ground (and its own grain) clips to white.
    // 2. Colour-to-alpha against white: the least opaque ink that reproduces the
    //    pixel over white. The result is a true cut-out that sits on any surface
    //    (no blend modes, so it works inside sticky / isolated stacking contexts).
    const rgba = Buffer.alloc(info.width * info.height * 4);
    for (let i = 0, o = 0; i < data.length; i += info.channels, o += 4) {
      const p = [0, 1, 2].map((c) => Math.min(1, data[i + c] / (ground[c] * 0.94)));
      const alpha = Math.max(1 - p[0], 1 - p[1], 1 - p[2]);
      for (let c = 0; c < 3; c++)
        rgba[o + c] = alpha > 0 ? Math.round(255 * Math.max(0, Math.min(1, (p[c] - (1 - alpha)) / alpha))) : 0;
      rgba[o + 3] = Math.round(alpha * 255);
    }
    await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
      .webp({ quality: 84, alphaQuality: 90 })
      .toFile(join(out, `${name}.webp`));
    sizes[name] = { width: info.width, height: info.height, ground: `rgb(${ground.join(" ")})` };
    console.log(`${dir}/${name}: ${info.width}x${info.height}, ground rgb(${ground.join(",")})`);
  }
  writeFileSync(join(out, "sizes.json"), JSON.stringify(sizes, null, 2) + "\n");
}

// next/image caches optimised variants by URL; drop them so replaced files show up.
for (const cache of [".next/cache/images", ".next/dev/cache/images"]) rmSync(cache, { recursive: true, force: true });
console.log("cleared next/image caches");
