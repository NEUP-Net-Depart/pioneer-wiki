import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import { cn } from "@/lib/utils";

/*
 * Small decorative illustrations (request R5): corner ornaments, state art,
 * phylum emblems, tailpieces. Always decorative — the meaning is carried by
 * adjacent text — so they are hidden from assistive tech. A name that has not
 * been delivered yet renders nothing, so pages never break while Codex works
 * through the list. Sizes come from tools/prepare-plates.mjs.
 */

type Sizes = Record<string, { width: number; height: number }>;

function deliveredSizes(): Sizes {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", "vignettes", "web", "sizes.json"), "utf8")) as Sizes;
  } catch {
    return {};
  }
}

/** Delivered size of a vignette, for client components that render it themselves. */
export function vignetteAsset(name: string): { src: string; width: number; height: number } | null {
  const s = deliveredSizes()[name];
  return s ? { src: `/vignettes/web/${name}.webp`, width: s.width, height: s.height } : null;
}

export function Vignette({ name, className, sizes = "160px" }: { name: string; className?: string; sizes?: string }) {
  const s = deliveredSizes()[name];
  if (!s) return null;
  return (
    <span className={cn("pw-print pointer-events-none select-none", className)}>
      <Image
        src={`/vignettes/web/${name}.webp`}
        width={s.width}
        height={s.height}
        alt=""
        aria-hidden="true"
        sizes={sizes}
        data-vignette={name}
        className="h-auto w-full"
      />
    </span>
  );
}
