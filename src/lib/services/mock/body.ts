import { readFileSync } from "node:fs";
import { join } from "node:path";

const BODY_DIR = join(process.cwd(), "src", "mock", "bodies");

export function bodyAt(slug: string, revision: number): string {
  let raw: string;
  try {
    raw = readFileSync(join(BODY_DIR, `${slug}.md`), "utf8");
  } catch {
    return "";
  }
  return raw
    .replace(
      /<!-- @(since|until|in) (\d+)(?:-(\d+))? -->\r?\n([\s\S]*?)<!-- @end -->\r?\n?/g,
      (_m, kind: string, a: string, b: string | undefined, block: string) => {
        const n = Number(a);
        const keep =
          kind === "since" ? n <= revision : kind === "until" ? revision <= n : n <= revision && revision <= Number(b);
        return keep ? block : "";
      },
    )
    .trim();
}
