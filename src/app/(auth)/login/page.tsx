import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "登录 Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  return (
    <div>
      <AuthForm mode="login" />
      {params.reset === "1" ? (
        <p role="status" className="mx-auto mt-4 max-w-xl text-small text-moss-ink">
          密码已更新，请重新登录。
        </p>
      ) : null}
      {params.error ? (
        <p role="alert" className="mx-auto mt-4 max-w-xl text-small text-brick-ink">
          {params.error}
        </p>
      ) : null}
    </div>
  );
}
