// Usage: node tools/probe.mjs <path> "<js expression returning JSON-able>" — evaluates in a 1440 page (opening titles skipped).
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const [, , path = "/", raw = "document.title"] = process.argv;
// "@file.js" reads the expression from a file (avoids shell quoting).
const expr = raw.startsWith("@") ? readFileSync(raw.slice(1), "utf8") : raw;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "msedge" });
const ctx = await browser.newContext({
  viewport: { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 900) },
});
await ctx.addCookies([{ name: "pw-lang", value: process.env.LANG_COOKIE ?? "en", url: "http://localhost:3000" }]);
if (!process.env.OVERTURE) await ctx.addInitScript(() => sessionStorage.setItem("pw:overture", "1"));
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 300)));
await page.goto("http://localhost:3000" + path, { waitUntil: "networkidle" });
await page.waitForTimeout(Number(process.env.WAIT ?? 3000));
console.log(JSON.stringify(await page.evaluate(expr), null, 1));
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
await browser.close();
