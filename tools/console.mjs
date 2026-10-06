// Usage: node tools/console.mjs <path> — prints every console error/warning of a page load in full (opening titles skipped).
import { chromium } from "@playwright/test";
const [, , path = "/"] = process.argv;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "msedge" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "pw-lang", value: process.env.LANG_COOKIE ?? "zh", url: "http://localhost:3000" }]);
await ctx.addInitScript(() => sessionStorage.setItem("pw:overture", "1"));
const page = await ctx.newPage();
page.on(
  "console",
  (m) => ["error", "warning"].includes(m.type()) && console.log(`[${m.type()}]`, m.text().slice(0, 4000)),
);
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 2000)));
await page.goto("http://localhost:3000" + path, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await browser.close();
