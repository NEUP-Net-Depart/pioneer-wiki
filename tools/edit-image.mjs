#!/usr/bin/env node
/**
 * Image-to-image with an OpenAI-compatible /v1/images/edits endpoint: one or
 * more reference images + a prompt → a new image that keeps their composition.
 *
 *   PW_IMAGE_API_KEY=… PW_IMAGE_BASE_URL=… node tools/edit-image.mjs jobs.json [--only a,b] [--concurrency 2]
 *
 * jobs.json: [{ "out": "public/stage/links.png", "inputs": ["public/plates/frontispiece.png"], "prompt": "…", "size": "1536x1024" }]
 * Outputs already on disk are skipped (resume) unless --force.
 * Jobs run in order of dependency: a job whose input is another job's output waits for it.
 * The key is read from the environment only — never write it into the repository.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const KEY = process.env.PW_IMAGE_API_KEY;
const BASE = (process.env.PW_IMAGE_BASE_URL ?? "").replace(/\/+$/, "");
const MODEL = process.env.PW_IMAGE_MODEL ?? "gpt-image-2";
if (!KEY || !BASE) {
  console.error("Set PW_IMAGE_API_KEY and PW_IMAGE_BASE_URL in the environment.");
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = flag("only")?.split(",");
const concurrency = Number(flag("concurrency") ?? 2);
const all = JSON.parse(
  await fs.readFile(
    args.find((a) => !a.startsWith("--")),
    "utf8",
  ),
);
const force = args.includes("--force");
const stream = !args.includes("--no-stream");
const exists = async (p) =>
  fs.access(p).then(
    () => true,
    () => false,
  );
// Resume: outputs already on disk are skipped unless --force.
const jobs = [];
for (const j of all)
  if ((!only || only.includes(path.basename(j.out, ".png"))) && (force || !(await exists(j.out)))) jobs.push(j);
const endpoint = BASE.endsWith("/v1") ? `${BASE}/images/edits` : `${BASE}/v1/images/edits`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const done = new Map(); // out → Promise
async function run(job) {
  for (const input of job.inputs) if (done.has(input)) await done.get(input);
  for (let attempt = 1; attempt <= 6; attempt++) {
    const started = Date.now();
    try {
      const form = new FormData();
      form.append("model", MODEL);
      form.append("prompt", job.prompt);
      form.append("size", job.size ?? "1536x1024");
      // The gateway closes connections at 60 s; medium quality finishes inside that window.
      // After two cut-off attempts, fall back to low quality so the job still lands.
      form.append("quality", attempt > 2 && job.quality !== "low" ? "low" : (job.quality ?? "medium"));
      form.append("n", "1");
      // Stream: partial images keep the connection busy, so the gateway's idle cutoff never fires.
      if (stream) {
        form.append("stream", "true");
        form.append("partial_images", "2");
      }
      for (const input of job.inputs) {
        // Upload a compact JPEG of the reference; the composition is what matters, not the bytes.
        const buf = await sharp(input)
          .flatten({ background: "#ffffff" })
          .resize({ width: 1536, withoutEnlargement: true })
          .jpeg({ quality: 88 })
          .toBuffer();
        form.append(
          job.inputs.length > 1 ? "image[]" : "image",
          new Blob([buf], { type: "image/jpeg" }),
          path.basename(input).replace(/\.png$/, ".jpg"),
        );
      }
      const res = await fetch(endpoint, { method: "POST", headers: { authorization: `Bearer ${KEY}` }, body: form });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`);
      let data;
      if (text.trimStart().startsWith("{")) data = JSON.parse(text).data?.[0];
      else {
        // Server-sent events: keep the last event that carries a full image.
        for (const line of text.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.b64_json && (!ev.type || ev.type.endsWith("completed"))) data = ev;
            else if (ev.data?.[0]?.b64_json) data = ev.data[0];
          } catch {}
        }
      }
      const buf = data?.b64_json
        ? Buffer.from(data.b64_json, "base64")
        : data?.url
          ? Buffer.from(await (await fetch(data.url)).arrayBuffer())
          : null;
      if (!buf) throw new Error(`no image: ${text.slice(0, 200)}`);
      await fs.mkdir(path.dirname(job.out), { recursive: true });
      await fs.writeFile(job.out, buf);
      console.log(`ok   ${job.out}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
      return;
    } catch (err) {
      console.log(
        `fail ${job.out}  attempt ${attempt} after ${((Date.now() - started) / 1000).toFixed(0)}s: ${String(err.message ?? err).slice(0, 200)} ${err.cause ? `[${err.cause.code ?? ""} ${String(err.cause.message ?? "").slice(0, 120)}]` : ""}`,
      );
      await sleep(6000 * attempt);
    }
  }
}

const queue = [...jobs];
let running = 0;
await new Promise((resolve) => {
  const pump = () => {
    if (!queue.length && !running) return resolve();
    while (running < concurrency && queue.length) {
      const job = queue.shift();
      running++;
      const p = run(job).finally(() => {
        running--;
        pump();
      });
      done.set(job.out, p);
    }
  };
  pump();
});
