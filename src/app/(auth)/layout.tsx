import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const { lang } = await getT();
  return (
    <div className="mx-auto grid min-h-[72vh] max-w-(--content-max) items-center gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,34rem)] lg:gap-16">
      <div className="relative hidden min-h-[34rem] flex-col justify-between border-y border-rule py-8 lg:flex">
        <Link href="/" className="pw-link w-fit font-display text-h4 text-ink no-underline">
          Pioneer <i>Wiki</i>
        </Link>
        <div className="max-w-lg">
          <p className="font-mono text-meta uppercase tracking-[0.12em] text-ink-3">
            {lang === "zh" ? "读者 · 作者 · 同行者" : "Reader · Author · Fellow"}
          </p>
          <p className="mt-4 font-display text-display leading-none text-ink">Ex libris</p>
          <p className="mt-5 max-w-md font-display text-h3 leading-snug text-ink-2">
            {lang === "zh" ? "每一份档案，都从一个名字开始。" : "Every record begins with a name."}
          </p>
        </div>
        <p className="font-mono text-meta text-ink-3">I · 计算机科学自然史</p>
      </div>
      {children}
    </div>
  );
}
