import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp, { type OutputInfo } from "sharp";
import { ServiceError } from "@/lib/services/contracts";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Uploaded images (members' page images). Stored outside public/ in
 * `.data/uploads` (git-ignored) and served by GET /api/media/[file], so files
 * added while the server runs are served in production too. Every upload is
 * re-encoded to WebP (max 2400 px wide), which also strips metadata.
 */

const DIR = join(process.cwd(), ".data", "uploads");
const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
const NAME = /^[a-f0-9-]{36}\.webp$/;
const BUCKET = "member-covers";
const ENTRY_BUCKET = "entry-assets";
const isSupabaseEnabled = () =>
  process.env.PIONEER_DATA_SOURCE === "supabase" || (!process.env.PIONEER_DATA_SOURCE && Boolean(getSupabaseConfig()));

async function saveImageToBucket(file: File, bucket: string): Promise<{ src: string; width: number; height: number }> {
  if (!ACCEPTED.has(file.type)) throw new ServiceError("invalid", "Only JPEG, PNG, WebP, AVIF or GIF images");
  if (file.size > MAX_BYTES) throw new ServiceError("invalid", "Image is larger than 15 MB");
  const input = Buffer.from(await file.arrayBuffer());
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(input, { animated: false })
      .rotate()
      .resize({ width: 2400, withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ServiceError("invalid", "Not a readable image");
  }
  const name = `${randomUUID()}.webp`;
  if (isSupabaseEnabled()) {
    const config = getSupabaseConfig();
    if (!config) throw new ServiceError("unavailable", "Supabase is not configured");
    const server = await createSupabaseServerClient();
    const user = await server.auth.getUser();
    if (user.error || !user.data.user) throw new ServiceError("forbidden", "Sign in before uploading an image");
    const { error } = await server.storage
      .from(bucket)
      .upload(name, out.data, { contentType: "image/webp", upsert: false });
    if (error) throw new ServiceError("unavailable", error.message);
    const { data } = createClient(config.url, config.anonKey).storage.from(bucket).getPublicUrl(name);
    if (bucket === BUCKET)
      await server.from("media_assets").insert({
        owner_id: user.data.user.id,
        object_path: name,
        bucket,
        width: out.info.width,
        height: out.info.height,
        content_type: "image/webp",
      });
    return { src: data.publicUrl, width: out.info.width, height: out.info.height };
  }
  await mkdir(DIR, { recursive: true });
  await writeFile(join(DIR, name), out.data);
  return { src: `/api/media/${name}`, width: out.info.width, height: out.info.height };
}

export function saveImage(file: File) {
  return saveImageToBucket(file, BUCKET);
}
export function saveEntryImage(file: File) {
  return saveImageToBucket(file, ENTRY_BUCKET);
}

export async function readImage(name: string): Promise<Buffer | null> {
  if (isSupabaseEnabled()) {
    const config = getSupabaseConfig();
    if (!config) return null;
    const object = name.startsWith("http") ? (name.split("/").at(-1) ?? "") : name;
    if (!NAME.test(object)) return null;
    const client = createClient(config.url, config.anonKey);
    const { data, error } = await client.storage.from(BUCKET).download(object);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  if (!NAME.test(name)) return null;
  try {
    return await readFile(join(DIR, name));
  } catch {
    return null;
  }
}

/** Removes a stored upload by its public src; ignores anything that is not one. */
export async function removeImage(src: string | undefined): Promise<void> {
  if (isSupabaseEnabled()) {
    const config = getSupabaseConfig();
    if (!config || !src) return;
    const name = src.split("/").at(-1) ?? "";
    if (!NAME.test(name)) return;
    const server = await createSupabaseServerClient();
    await server.storage.from(BUCKET).remove([name]);
    await server.from("media_assets").update({ deleted_at: new Date().toISOString() }).eq("object_path", name);
    return;
  }
  const name = src?.startsWith("/api/media/") ? src.slice("/api/media/".length) : "";
  if (NAME.test(name)) await unlink(join(DIR, name)).catch(() => undefined);
}
