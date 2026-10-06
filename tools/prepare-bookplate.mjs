#!/usr/bin/env node
/**
 * Marbled endpapers for members' pages: public/bookplate/src/marble-*.png →
 * public/bookplate/marble-*.webp, greyscale. The page prints them in the
 * member's ink (see .pw-print-ink in styles/bookplate.css). Emblems (ex-*) and
 * frames (frame-*) live in public/vignettes and go through prepare-plates.mjs.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "public/bookplate/src";
for (const file of (await fs.readdir(SRC)).filter((f) => /^marble-.*\.png$/.test(f))) {
  const out = path.join("public/bookplate", file.replace(/\.png$/, ".webp"));
  const info = await sharp(path.join(SRC, file))
    .greyscale()
    .normalise()
    .resize({ width: 1600 })
    .webp({ quality: 72 })
    .toFile(out);
  console.log(out, `${info.width}x${info.height}`, `${Math.round(info.size / 1024)} KB`);
}
