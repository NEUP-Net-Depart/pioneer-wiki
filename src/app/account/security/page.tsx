import type { Metadata } from "next";
import Link from "next/link";
import { dataSource, getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import { EmailForm, PasswordForm, SectionCard } from "@/components/account/AccountForms";

export const metadata: Metadata = { title: "登录与安全 Security" };

/** Email and password, changed through Supabase Auth's own confirmation. */
export default async function SecurityPage({ searchParams }: PageProps<"/account/security">) {
  const lang = await getLang();
  const zh = lang === "zh";
  const params = await searchParams;
  const account = (await getServices().auth.getCurrentAccount())!;
  if (dataSource() !== "supabase")
    return (
      <SectionCard title={zh ? "登录与安全" : "Sign-in & security"}>
        <p role="note" className="text-small text-ink-2">
          {zh
            ? "当前运行在本地演示数据上，没有真实的登录服务，所以无法修改邮箱或密码。连接 Supabase 后这里可用。"
            : "This server runs on local fixtures with no sign-in service, so email and password cannot change here. It works once Supabase is connected."}
        </p>
      </SectionCard>
    );
  return (
    <>
      {params.email === "changed" ? (
        <p role="status" className="pw-sheet border-moss/40 px-5 py-3 text-small text-moss-ink">
          ✓ {zh ? "新邮箱已确认，之后请用它登录。" : "The new email is confirmed; sign in with it from now on."}
        </p>
      ) : null}
      <SectionCard title={zh ? "更换登录邮箱" : "Change the sign-in email"}>
        <EmailForm current={account.email} />
      </SectionCard>
      <SectionCard title={zh ? "修改密码" : "Change the password"}>
        <PasswordForm />
        <p className="text-meta text-ink-3">
          {zh ? "忘记了当前密码？" : "Forgot your current password? "}
          <Link href="/forgot-password" className="pw-link">
            {zh ? "通过邮件重设" : "Reset it by email"}
          </Link>
        </p>
      </SectionCard>
    </>
  );
}
