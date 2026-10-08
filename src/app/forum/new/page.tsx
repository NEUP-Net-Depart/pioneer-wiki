import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { RunningHead } from "@/components/book/RunningHead";
import { NewThreadForm } from "@/components/forum/NewThreadForm";
import { AccessGate, gateReason } from "@/components/states/AccessGate";

export const metadata: Metadata = { title: "发起讨论 New discussion", robots: { index: false } };

/** Start a discussion: verified, active accounts only; the signature comes from the account. */
export default async function NewDiscussionPage() {
  const { lang } = await getT();
  const zh = lang === "zh";
  const { auth, community } = getServices();
  const account = await auth.getCurrentAccount();
  const refused = gateReason(account, "verified");
  if (refused) return <AccessGate reason={refused} lang={lang} next="/forum/new" />;
  const member = account!.memberId ? await community.getMember(account!.memberId).catch(() => null) : null;
  return (
    <div data-part="forum" className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <RunningHead
        left={
          <Link href="/forum" transitionTypes={["nav-back"]} className="no-underline hover:text-ink">
            ← {zh ? "交流 · 讨论区" : "Forum · Discussions"}
          </Link>
        }
        right={zh ? "发起讨论" : "New discussion"}
      />
      <header>
        <h1 className="font-display text-[clamp(2.25rem,4.5vw,3.5rem)] leading-tight">
          {zh ? "发起讨论" : "Start a discussion"}
        </h1>
        <p className="mt-2 text-small text-ink-2">
          {zh ? "署名：" : "Signed as "}
          <span className="text-ink">{member ? member.name[lang] : account!.name[lang]}</span>
          {zh
            ? "（由账号决定，绑定成员主页后使用主页名称）。"
            : " (from your account; a bound member page signs with its name)."}
        </p>
      </header>
      <NewThreadForm accountId={account!.id} />
    </div>
  );
}
