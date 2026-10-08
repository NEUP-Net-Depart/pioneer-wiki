import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { ServiceError } from "@/lib/services/contracts";

/*
 * Uploaded images. Every upload is checked (type, bytes, pixels), decoded and
 * re-encoded to WebP at most 2400 px wide, which also strips metadata; only
 * the re-encoded bytes are ever stored. With Supabase the bytes go to Storage
 * (see the Supabase adapter); with the local fixtures they are written to
 * `.data/uploads` (git-ignored) and served by GET /api/media/[file].
 */

const DIR = join(process.cwd(), ".data", "uploads");
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
/** Decoding is refused above this many pixels, so a small file cannot expand into a huge bitmap. */
export const MAX_INPUT_PIXELS = 40_000_000;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
export const STORED_NAME = /^[a-f0-9-]{36}\.webp$/;

export interface EncodedImage {
  /** A fresh object name, `<uuid>.webp`. */
  name: string;
  data: Buffer;
  width: number;
  height: number;
}

export async function encodeImage(file: File): Promise<EncodedImage> {
  if (!ACCEPTED.has(file.type)) throw new ServiceError("invalid", "unsupported_image_type");
  if (file.size > MAX_UPLOAD_BYTES) throw new ServiceError("invalid", "image_too_large");
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const source = sharp(input, { animated: false, limitInputPixels: MAX_INPUT_PIXELS });
    const meta = await source.metadata();
    if (!meta.width || !meta.height) throw new Error("no size");
    const out = await source
      .rotate()
      .resize({ width: 2400, withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
    return { name: `${randomUUID()}.webp`, data: out.data, width: out.info.width, height: out.info.height };
  } catch {
    throw new ServiceError("invalid", "unreadable_image");
  }
}

export async function writeLocalImage(image: EncodedImage): Promise<string> {
  await mkdir(DIR, { recursive: true });
  await writeFile(join(DIR, image.name), image.data);
  return `/api/media/${image.name}`;
}

export async function readLocalImage(name: string): Promise<Buffer | null> {
  if (!STORED_NAME.test(name)) return null;
  try {
    return await readFile(join(DIR, name));
  } catch {
    return null;
  }
}

/** Removes a locally stored upload by its public src; ignores anything that is not one. */
export async function removeLocalImage(src: string | undefined): Promise<void> {
  const name = src?.startsWith("/api/media/") ? src.slice("/api/media/".length) : "";
  if (STORED_NAME.test(name)) await unlink(join(DIR, name)).catch(() => undefined);
}
