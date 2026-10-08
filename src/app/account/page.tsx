import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import { StateTag } from "@/components/admin/desk";
import { ClosureControl, ProfileForm, SectionCard } from "@/components/account/AccountForms";

export const metadata: Metadata = { title: "档案 Profile" };

/** The account's standing (verified, active, role), its display name and the closure request. */
export default async function AccountPage() {
  const lang = await getLang();
  const zh = lang === "zh";
  const account = (await getServices().auth.getCurrentAccount())!;
  const status = account.status ?? "active";
  return (
    <>
      <SectionCard title={zh ? "账号状态" : "Standing"}>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="pw-label">{zh ? "登录邮箱" : "Sign-in email"}</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2 text-small break-all">
              <span className="font-mono">{account.email}</span>
              {account.emailVerified ? (
                <StateTag tone="ok">{zh ? "已验证" : "Verified"}</StateTag>
              ) : (
                <StateTag tone="warn">{zh ? "未验证" : "Not verified"}</StateTag>
              )}
            </dd>
          </div>
          <div>
            <dt className="pw-label">{zh ? "角色" : "Role"}</dt>
            <dd className="mt-1 flex flex-wrap gap-2 text-small">
              <StateTag tone={account.role === "admin" ? "pending" : "neutral"}>{account.role === "admin" ? (zh ? "管理员" : "Administrator") : zh ? "读者" : "Reader"}</StateTag>
              {account.authorId ? <StateTag tone="ok">{zh ? "Wiki 作者" : "Wiki author"}</StateTag> : null}
              {status === "suspended" ? <StateTag tone="danger">{zh ? "已停用" : "Suspended"}</StateTag> : null}
            </dd>
          </div>
        </dl>
        {!account.emailVerified ? (
          <p className="text-small text-ink-2">
            {zh ? "验证邮箱后才能写作、交流和申请作者资格。" : "Writing, posting and applying need a verified email. "}
            <Link href={`/verify-email?email=${encodeURIComponent(account.email)}`} className="pw-link text-ink">
              {zh ? "重新发送验证邮件" : "Resend the verification email"} →
            </Link>
          </p>
        ) : null}
        {status === "suspended" ? (
          <p role="note" className="text-small text-brick-ink">
            {zh ? "账号已停用：可以阅读，但不能写作、发帖或上传。如有疑问请联系管理员。" : "Suspended: you can read, but not write, post or upload. Contact an administrator if this is unexpected."}
          </p>
        ) : null}
        <p className="text-meta text-ink-3">
          {zh ? "账号代号 @" : "Account handle @"}
          {account.handle}
          {zh ? " 只用于站内识别，不是公开地址；公开成员主页有自己的地址。" : " identifies you inside the site and is never a public address; a member page has its own."}
        </p>
      </SectionCard>
      <SectionCard title={zh ? "显示名" : "Display name"}>
        <ProfileForm name={account.name} />
      </SectionCard>
      <SectionCard title={zh ? "注销账号" : "Close the account"} className="border-brick/30">
        <ClosureControl requestedAt={account.closureRequestedAt} />
      </SectionCard>
    </>
  );
}
