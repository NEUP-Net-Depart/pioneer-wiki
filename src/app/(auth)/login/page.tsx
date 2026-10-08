import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { getLang } from "@/lib/i18n/server";
import { hasReason, reasonText } from "@/lib/services/errors";

export const metadata: Metadata = { title: "登录 Sign in", robots: { index: false } };

/** ?next= returns there after signing in; ?error= is a reason code from an email link, explained in words. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const lang = await getLang();
  const next = typeof params.next === "string" ? params.next : undefined;
  const error = typeof params.error === "string" && hasReason(params.error) ? params.error : params.error ? "link_expired" : null;
  return (
    <div>
      {error ? (
        <p role="alert" className="mx-auto mb-4 max-w-xl text-small text-brick-ink">
          {reasonText(error, lang)}
        </p>
      ) : null}
      {params.reset === "1" ? (
        <p role="status" className="mx-auto mb-4 max-w-xl text-small text-moss-ink">
          {lang === "zh" ? "密码已更新，请用新密码登录。" : "Password changed. Sign in with the new one."}
        </p>
      ) : null}
      <AuthForm mode="login" next={next} />
    </div>
  );
}
