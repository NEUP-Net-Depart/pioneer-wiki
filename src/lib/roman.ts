const NUMERALS: Array<[number, string]> = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** Plate and phylum numbers are set in roman numerals, as in printed natural histories. */
export function toRoman(n: number): string {
  let out = "";
  for (const [value, glyph] of NUMERALS) {
    while (n >= value) {
      out += glyph;
      n -= value;
    }
  }
  return out;
}

/** "PW-0007" → 7 */
export function catalogueNumber(id: string): number {
  return Number(id.replace(/\D/g, "")) || 0;
}
