import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { ArchiveState } from "@/components/states/ArchiveState";
import { AuthorSigil } from "@/components/archive/AuthorSigil";
import { AccountActions } from "@/components/auth/AccountActions";

export const metadata: Metadata = { title: "账号 Account", robots: { index: false } };

export default async function AccountPage() {
  const { lang } = await getT();
  const zh = lang === "zh";
  const { auth, community } = getServices();
  const account = await auth.getCurrentAccount();
  if (!account) return <ArchiveState kind="empty" title={zh ? "请先登录。" : "Sign in first."} code="401" />;
  const members = await community.listMembers();
  const member = account.authorId ? members.find((item) => item.authorId === account.authorId) : undefined;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="pw-double-rule">
        <p className="font-mono text-meta uppercase tracking-[0.14em] text-brick-ink">
          {zh ? "账号档案" : "Account record"}
        </p>
        <h1 className="mt-3 font-display text-[clamp(2.5rem,6vw,4.75rem)] leading-none">
          {zh ? "我的账号" : "My account"}
        </h1>
      </header>
      <section className="pw-sheet grid gap-6 p-6 sm:grid-cols-[5rem_1fr] sm:p-8">
        <AuthorSigil seed={account.sigil} className="size-16" />
        <div>
          <p className="font-display text-h3 text-ink">{account.name[lang]}</p>
          <p className="mt-1 font-mono text-small text-ink-3">
            @{account.handle} · {account.email}
          </p>
          <p className="mt-5 text-small leading-relaxed text-ink-2">
            {account.emailVerified
              ? zh
                ? "邮箱已验证。你可以参与交流。"
                : "Email verified. You can join the register."
              : zh
                ? "请验证邮箱后再参与交流或编辑。"
                : "Verify your email before posting or editing."}
          </p>
        </div>
      </section>
      <section className="pw-ink-over flex flex-col gap-4">
        <h2 className="font-display text-h3">{zh ? "站内身份" : "Wiki identity"}</h2>
        {member ? (
          <p className="text-small leading-relaxed text-ink-2">
            {zh ? "你已绑定成员主页：" : "Your account is bound to the member page "}
            <Link href={`/members/${member.handle}`} className="pw-link text-ink">
              {member.name[lang]}
            </Link>
            {zh ? "。" : "."}
          </p>
        ) : (
          <p className="text-small leading-relaxed text-ink-2">
            {zh
              ? "账号与成员主页、Wiki 作者身份分开管理。需要编辑 Wiki 时，请联系管理员绑定作者角色。"
              : "Accounts, member pages and wiki authors are separate. Contact an administrator to bind an author role before editing the Wiki."}
          </p>
        )}
      </section>
      <section className="border-t border-rule pt-6">
        <h2 className="font-display text-h4">{zh ? "账号管理" : "Account controls"}</h2>
        <p className="mt-2 max-w-prose text-small leading-relaxed text-ink-3">
          {zh
            ? "注销申请会解除你的公开身份；已发布内容会保留并匿名化。管理员完成处理后，登录将被撤销。"
            : "A closure request removes your public identity; published content is retained and anonymised. An administrator will revoke access after processing."}
        </p>
        <div className="mt-4">
          <AccountActions
            label={zh ? "申请注销账号" : "Request account closure"}
            doneLabel={zh ? "申请已提交" : "Request submitted"}
            confirmLabel={zh ? "确认提交账号注销申请？" : "Submit an account closure request?"}
          />
        </div>
      </section>
    </div>
  );
}
