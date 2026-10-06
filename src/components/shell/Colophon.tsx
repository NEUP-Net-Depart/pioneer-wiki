import Link from "next/link";
import type { Lang } from "@/lib/model/types";
import { Vignette } from "@/components/book/Vignette";

/**
 * 版权页 Colophon — the last thing on every page, as at the end of a book:
 * what this is, how it is made, under which licence. Quiet, set small.
 */
export function Colophon({ lang, entryCount }: { lang: Lang; entryCount: number }) {
  const zh = lang === "zh";
  return (
    <footer className="mx-auto w-full max-w-(--content-max) px-4 pb-10 sm:px-6">
      <div className="pw-ink-over grid gap-8 pt-10 text-meta text-ink-3 sm:grid-cols-12">
        <div className="flex items-start gap-4 sm:col-span-5">
          <Vignette name="feather" className="w-10 shrink-0 -rotate-12" sizes="40px" />
          <p className="max-w-[30em] leading-relaxed">
            <span className="font-display text-small text-ink italic">Pioneer Wiki</span> · 先锋维基 —{" "}
            {zh
              ? "一部按尺度、角色与关系编目的计算机科学博物志。"
              : "a natural history of computer science, catalogued by scale, role and relation."}
          </p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono tracking-[0.06em] sm:col-span-4">
          <dt className="uppercase">{zh ? "卷" : "Volume"}</dt>
          <dd>
            I · MMXXVI · {entryCount} {zh ? "件标本" : "specimens"}
          </dd>
          <dt className="uppercase">{zh ? "图版" : "Plates"}</dt>
          <dd>CC BY 4.0</dd>
          <dt className="uppercase">{zh ? "字体" : "Type"}</dt>
          <dd>Newsreader · Source Sans 3 · IM Fell · Noto Serif SC</dd>
        </dl>
        <nav aria-label={zh ? "页脚" : "Footer"} className="flex flex-col gap-1 sm:col-span-3 sm:items-end">
          <Link href="/graph" className="pw-link text-ink-2">
            {zh ? "关系图" : "Relation map"}
          </Link>
          <Link href="/search" className="pw-link text-ink-2">
            {zh ? "检索档案" : "Search the archive"}
          </Link>
          <Link href="/editor/new" className="pw-link text-ink-2">
            {zh ? "撰写新条目" : "Write an entry"}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
