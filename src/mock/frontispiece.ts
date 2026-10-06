import type { Localized } from "@/lib/model/types";

/*
 * Frontispiece composition data (content, not layout): which plate leads the
 * home page, and the key pinned onto it. Coordinates are fractions of the plate
 * image box (0–1; > 1 = below it, on empty paper), so they survive any rendered
 * size. `x,y` is the point touched on the illustration; `lx,ly` is where the
 * key label sits. Each part of the scene stands for one specimen in the book.
 */

export interface PlateAnnotation {
  key: string;
  x: number;
  y: number;
  lx: number;
  ly: number;
  /** Label text aligns away from the leader line. */
  align: "left" | "right";
  part: Localized;
  concept: Localized;
  href: string;
}

export const frontispiece: {
  assetId: string;
  fallbackAssetId: string;
  seed: { x: number; y: number };
  annotations: PlateAnnotation[];
} = {
  assetId: "plate-frontispiece",
  fallbackAssetId: "plate-gossip-protocol",
  /** Where the hyphae sprout when the spread opens (the white mycelium in the soil). */
  seed: { x: 0.42, y: 0.72 },
  annotations: [
    {
      key: "a",
      x: 0.075,
      y: 0.33,
      lx: 0.03,
      ly: 0.98,
      align: "left",
      part: { zh: "层孔菌", en: "Bracket fungus" },
      concept: { zh: "垃圾回收", en: "Garbage collection" },
      href: "/entries/garbage-collection",
    },
    {
      key: "b",
      x: 0.41,
      y: 0.72,
      lx: 0.3,
      ly: 0.98,
      align: "left",
      part: { zh: "菌丝", en: "Hyphae" },
      concept: { zh: "流言协议", en: "Gossip protocol" },
      href: "/entries/gossip-protocol",
    },
    {
      key: "c",
      x: 0.655,
      y: 0.36,
      lx: 0.56,
      ly: 0.98,
      align: "left",
      part: { zh: "蕨叶", en: "Fern frond" },
      concept: { zh: "L 系统", en: "L-system" },
      href: "/entries/l-system",
    },
    {
      key: "d",
      x: 0.84,
      y: 0.62,
      lx: 0.97,
      ly: 0.98,
      align: "right",
      part: { zh: "溪流", en: "Stream" },
      concept: { zh: "拥塞控制", en: "Congestion control" },
      href: "/entries/tcp-congestion-control",
    },
  ],
};
