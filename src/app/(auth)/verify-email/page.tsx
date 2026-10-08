import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { getLang } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "验证邮箱 Verify email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const params = await searchParams;
  const lang = await getLang();
  const email = Array.isArray(params.email) ? params.email[0] : params.email;
  return (
    <div>
      {params.sent === "1" ? (
        <p role="status" className="mx-auto mb-4 max-w-xl text-small text-moss-ink">
          {lang === "zh"
            ? "注册已提交。如果这个邮箱可以注册，验证邮件很快会送达；打开邮件里的链接即可完成验证，链接在任何设备上都可以打开。"
            : "Registration sent. If this address can register, a verification email arrives shortly; open its link on any device to finish."}
        </p>
      ) : null}
      <AuthForm mode="resend" email={email ?? ""} />
    </div>
  );
}
