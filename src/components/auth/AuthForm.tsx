"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/lib/i18n/client";

type Mode = "login" | "signup" | "forgot" | "resend" | "reset";

const endpoints: Record<Mode, string> = {
  login: "/api/auth/login",
  signup: "/api/auth/signup",
  forgot: "/api/auth/forgot-password",
  resend: "/api/auth/resend",
  reset: "/api/auth/reset-password",
};

export function AuthForm({ mode, email: initialEmail = "" }: { mode: Mode; email?: string }) {
  const router = useRouter();
  const { lang, t } = useI18n();
  const zh = lang === "zh";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(endpoints[mode], {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
        needsVerification?: boolean;
      };
      if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`);
      if (mode === "login") {
        router.push("/");
        router.refresh();
      } else if (mode === "signup") {
        const email = String(formData.get("email") ?? "");
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      } else if (mode === "reset") {
        router.push("/login?reset=1");
      } else {
        setMessage(
          mode === "resend"
            ? t("auth.resendDone")
            : zh
              ? "如果该邮箱已登记，重置链接很快会送达。"
              : "If an account uses this email, a reset link will arrive shortly.",
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "login"
      ? t("auth.loginTitle")
      : mode === "signup"
        ? t("auth.registerTitle")
        : mode === "forgot"
          ? t("auth.forgotTitle")
          : mode === "resend"
            ? t("auth.verifyTitle")
            : t("auth.resetTitle");
  const lede =
    mode === "login"
      ? t("auth.loginLede")
      : mode === "signup"
        ? t("auth.registerLede")
        : mode === "forgot"
          ? t("auth.forgotLede")
          : mode === "resend"
            ? t("auth.verifyLede")
            : zh
              ? "至少 8 个字符。"
              : "Use at least 8 characters.";
  const submitLabel =
    mode === "login"
      ? t("auth.loginSubmit")
      : mode === "signup"
        ? t("auth.registerSubmit")
        : mode === "forgot"
          ? t("auth.sendReset")
          : mode === "resend"
            ? t("auth.resend")
            : t("auth.resetSubmit");

  return (
    <form
      className="pw-sheet relative mx-auto w-full max-w-xl overflow-hidden px-6 py-8 sm:px-10 sm:py-10"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      <div className="pointer-events-none absolute right-5 top-5 w-20 opacity-65 sm:right-8 sm:top-7 sm:w-24">
        <Image
          src="/vignettes/web/ex-key.webp"
          alt=""
          aria-hidden="true"
          width={256}
          height={256}
          className="pw-print h-auto w-full"
        />
      </div>
      <p className="font-mono text-meta uppercase tracking-[0.12em] text-brick-ink">Pioneer Wiki · Account</p>
      <h1 className="mt-4 max-w-[12ch] font-display text-h1 leading-tight text-ink">{title}</h1>
      <p className="mt-3 max-w-prose text-small leading-relaxed text-ink-3">{lede}</p>

      <div className="mt-8 flex flex-col gap-5">
        {mode === "signup" ? (
          <Field name="displayName" label={t("auth.displayName")} autoComplete="nickname" required maxLength={40} />
        ) : null}
        {mode !== "reset" ? (
          <Field
            name="email"
            label={t("auth.email")}
            type="email"
            autoComplete="email"
            required
            defaultValue={initialEmail}
          />
        ) : null}
        {mode === "login" || mode === "signup" || mode === "reset" ? (
          <Field
            name="password"
            label={t("auth.password")}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
          />
        ) : null}
        {mode === "signup" || mode === "reset" ? (
          <Field
            name="confirmPassword"
            label={t("auth.confirmPassword")}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-5 text-small text-brick-ink">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-5 text-small text-moss-ink">
          {message}
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button type="submit" disabled={busy} className="pw-stamp-button disabled:opacity-50">
          {busy ? t("auth.working") : submitLabel}
        </button>
        {mode === "login" ? (
          <Link href="/forgot-password" className="pw-link text-small text-ink-3">
            {t("auth.forgotPassword")}
          </Link>
        ) : null}
      </div>
      <div className="mt-7 border-t border-rule pt-5 text-small text-ink-3">
        {mode === "login" ? (
          <span>
            {t("auth.noAccount")}{" "}
            <Link href="/register" className="pw-link text-ink">
              {t("auth.register")}
            </Link>
          </span>
        ) : null}
        {mode === "signup" ? (
          <span>
            {t("auth.hasAccount")}{" "}
            <Link href="/login" className="pw-link text-ink">
              {t("auth.login")}
            </Link>
          </span>
        ) : null}
        {mode !== "login" && mode !== "signup" ? (
          <Link href="/login" className="pw-link text-ink">
            ← {t("auth.backToLogin")}
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  ...props
}: { name: string; label: string; type?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="pw-label">{label}</span>
      <input name={name} type={type} className="pw-field text-body" {...props} />
    </label>
  );
}
