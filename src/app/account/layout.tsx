import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import { AuthorSigil } from "@/components/archive/AuthorSigil";
import { RunningHead } from "@/components/book/RunningHead";
import { AccountNav } from "@/components/account/AccountNav";
import { AccessGate } from "@/components/states/AccessGate";

export const metadata: Metadata = {
  title: { template: "%s · 我的账号 Account", default: "我的账号 Account" },
  robots: { index: false, follow: false },
};

/** 账号档案 — the signed-in reader's own record, in four sections. */
export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const lang = await getLang();
  const zh = lang === "zh";
  const account = await getServices().auth.getCurrentAccount();
  if (!account) return <AccessGate reason="signed_out" lang={lang} next="/account" />;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <RunningHead left={zh ? "先锋维基 · 账号档案" : "Pioneer Wiki · Account record"} right={`@${account.handle}`} />
      <header className="flex flex-wrap items-center gap-5">
        <AuthorSigil seed={account.sigil} className="size-14" />
        <div className="min-w-0">
          <p className="font-mono text-meta tracking-[0.14em] text-brick-ink uppercase">
            {zh ? "我的账号" : "My account"}
          </p>
          <h1 className="font-display text-[clamp(2rem,5vw,3.25rem)] leading-tight break-words">
            {account.name[lang]}
          </h1>
        </div>
      </header>
      <AccountNav />
      <div className="flex flex-col gap-8">{children}</div>
    </div>
  );
}
