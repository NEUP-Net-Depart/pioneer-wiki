#!/usr/bin/env node
/**
 * Generate illustrations with an OpenAI-compatible image endpoint.
 *
 *   PW_IMAGE_API_KEY=… PW_IMAGE_BASE_URL=https://… node tools/gen-images.mjs jobs.json [--only a,b] [--concurrency 2]
 *
 * jobs.json: [{ "out": "public/plates/raft-consensus.png", "prompt": "…", "size": "1024x1024" }]
 * The key is read from the environment only — never write it into the repository.
 * Each finished job is appended to <dir>/manifest.json (slug, file, model, prompt, createdAt).
 * Run `node tools/prepare-plates.mjs` afterwards to cut the paper ground to alpha.
 */
import fs from "node:fs/promises";
import path from "node:path";

const KEY = process.env.PW_IMAGE_API_KEY;
const BASE = (process.env.PW_IMAGE_BASE_URL ?? "").replace(/\/+$/, "");
const MODEL = process.env.PW_IMAGE_MODEL ?? "gpt-image-2";
if (!KEY || !BASE) {
  console.error("Set PW_IMAGE_API_KEY and PW_IMAGE_BASE_URL in the environment.");
  process.exit(1);
}

const args = process.argv.slice(2);
const jobsFile = args.find((a) => !a.startsWith("--"));
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = flag("only")?.split(",");
const concurrency = Number(flag("concurrency") ?? 2);

const jobs = JSON.parse(await fs.readFile(jobsFile, "utf8")).filter(
  (j) => !only || only.includes(path.basename(j.out, ".png")),
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(job) {
  const endpoint = BASE.endsWith("/v1") ? `${BASE}/images/generations` : `${BASE}/v1/images/generations`;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const started = Date.now();
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
        body: JSON.stringify({
          model: MODEL,
          prompt: job.prompt,
          size: job.size ?? "1024x1024",
          quality: job.quality ?? "high",
          n: 1,
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      const data = JSON.parse(text).data?.[0];
      let buf;
      if (data?.b64_json) buf = Buffer.from(data.b64_json, "base64");
      else if (data?.url) buf = Buffer.from(await (await fetch(data.url)).arrayBuffer());
      else throw new Error(`no image in response: ${text.slice(0, 200)}`);
      await fs.mkdir(path.dirname(job.out), { recursive: true });
      await fs.writeFile(job.out, buf);
      await record(job);
      console.log(`ok   ${job.out}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
      return;
    } catch (err) {
      console.log(`fail ${job.out}  attempt ${attempt}: ${String(err.message ?? err).slice(0, 160)}`);
      await sleep(5000 * attempt);
    }
  }
}

let manifestLock = Promise.resolve();
function record(job) {
  manifestLock = manifestLock.then(async () => {
    const file = path.join(path.dirname(job.out), "manifest.json");
    let list = [];
    try {
      list = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {}
    const slug = path.basename(job.out, ".png");
    list = list.filter((m) => (m.slug ?? m.name) !== slug);
    list.push({
      slug,
      file: `/${path.relative("public", job.out).replaceAll("\\", "/")}`,
      model: MODEL,
      prompt: job.prompt,
      license: "CC BY 4.0",
      createdAt: new Date().toISOString(),
    });
    await fs.writeFile(file, JSON.stringify(list, null, 2) + "\n");
  });
  return manifestLock;
}

const queue = [...jobs];
await Promise.all(
  Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) await generate(queue.shift());
  }),
);
