// Usage: node tools/screenshot.mjs <path> [name] [lang] — desktop 1440 + mobile 390 full-page screenshots, console errors, overflow check.
// The opening titles are skipped (sessionStorage) unless OVERTURE=1; the page is scrolled through first so scroll reveals have fired.
// WAIT=<ms> waits after load (entrance animations); ONLY=desktop|mobile limits the viewports.
import { chromium } from "@playwright/test";
const [, , path = "/", name = "home", langArg = "zh"] = process.argv;
const base = "http://localhost:3000";
import { mkdirSync } from "node:fs";
mkdirSync(process.env.SHOT_DIR ?? "test-results/shots", { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "msedge" });
const views = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
].filter(([l]) => !process.env.ONLY || process.env.ONLY === l);
for (const [label, viewport] of views) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.addCookies([{ name: "pw-lang", value: langArg, url: base }]);
  if (!process.env.OVERTURE) await ctx.addInitScript(() => sessionStorage.setItem("pw:overture", "1"));
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  const res = await page.goto(base + path, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(Number(process.env.WAIT ?? 2600));
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const file = `${process.env.SHOT_DIR ?? "test-results/shots"}/${name}-${langArg}-${label}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(`${label}: HTTP ${res?.status()} overflowX=${overflow}px errors=${errors.length} → ${file}`);
  for (const e of errors.slice(0, 5)) console.log("   ERR", e.slice(0, 300));
  await ctx.close();
}
await browser.close();
