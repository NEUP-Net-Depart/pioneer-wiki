// Usage: node tools/filmstrip.mjs <path> <out.png> [ms,ms,...] — screenshots the page at the given times after load and tiles them.
// OVERTURE=1 lets the opening titles play. CLICK="<css selector>@<ms>" clicks an element at that time (e.g. a stage part tab).
import { chromium } from "@playwright/test";
import sharp from "sharp";
const [, , path = "/", out = "filmstrip.png", times = "200,800,1600,2600,3600,4600,5600,6600"] = process.argv;
const at = times.split(",").map(Number);
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "msedge" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "pw-lang", value: process.env.LANG_COOKIE ?? "en", url: "http://localhost:3000" }]);
if (!process.env.OVERTURE) await ctx.addInitScript(() => sessionStorage.setItem("pw:overture", "1"));
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)));
await page.goto("http://localhost:3000" + path, { waitUntil: "domcontentloaded" });
const t0 = Date.now();
const [clickSel, clickAt] = (process.env.CLICK ?? "").split("@");
let clicked = !clickSel;
const shots = [];
for (const t of at) {
  if (!clicked && Number(clickAt) <= t) {
    await page.waitForTimeout(Math.max(0, Number(clickAt) - (Date.now() - t0)));
    await page.click(clickSel);
    clicked = true;
  }
  await page.waitForTimeout(Math.max(0, t - (Date.now() - t0)));
  shots.push(await page.screenshot({ type: "png" }));
}
await browser.close();
const W = 480,
  H = 300,
  cols = 4;
const tiles = await Promise.all(shots.map((b) => sharp(b).resize(W, H).toBuffer()));
await sharp({
  create: { width: W * cols, height: H * Math.ceil(tiles.length / cols), channels: 3, background: "#000" },
})
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * W, top: Math.floor(i / cols) * H })))
  .png()
  .toFile(out);
console.log("filmstrip", out, at.join(","));
