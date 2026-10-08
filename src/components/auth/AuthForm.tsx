"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup" | "forgot" | "resend" | "reset";
type FieldName = "displayName" | "email" | "password" | "confirmPassword";

const endpoints: Record<Mode, string> = {
  login: "/api/auth/login",
  signup: "/api/auth/signup",
  forgot: "/api/auth/forgot-password",
  resend: "/api/auth/resend",
  reset: "/api/auth/reset-password",
};

/** Same-site path to return to after signing in. */
const safeNext = (value: string | undefined) => (value && value.startsWith("/") && !value.startsWith("//") ? value : "/");

export function AuthForm({ mode, email: initialEmail = "", next }: { mode: Mode; email?: string; next?: string }) {
  const router = useRouter();
  const { lang, t } = useI18n();
  const zh = lang === "zh";
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; field?: FieldName; reason?: string } | null>(null);
  const [email, setEmail] = useState(initialEmail);

  const focusField = (field?: FieldName) =>
    requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>(field ? `[name="${field}"]` : "input")?.focus());

  function localCheck(data: FormData): { text: string; field: FieldName } | null {
    const value = (name: string) => String(data.get(name) ?? "");
    if (mode === "signup" && (!value("displayName").trim() || value("displayName").length > 40))
      return { field: "displayName", text: zh ? "请填写 1–40 个字符的显示名。" : "Enter a display name of 1–40 characters." };
    if (mode !== "reset" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value("email").trim()))
      return { field: "email", text: zh ? "请输入有效的邮箱地址。" : "Enter a valid email address." };
    if ((mode === "login" || mode === "signup" || mode === "reset") && value("password").length < 8)
      return { field: "password", text: zh ? "密码至少 8 个字符。" : "Use at least 8 characters." };
    if ((mode === "signup" || mode === "reset") && value("confirmPassword") !== value("password"))
      return { field: "confirmPassword", text: zh ? "两次输入的密码不一致。" : "The passwords do not match." };
    return null;
  }

  async function submit(formData: FormData) {
    if (busy) return;
    const invalid = localCheck(formData);
    if (invalid) {
      setError(invalid);
      focusField(invalid.field);
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      let res: Response;
      try {
        res = await fetch(endpoints[mode], {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(Object.fromEntries(formData)),
        });
      } catch {
        throw { text: zh ? "网络连接失败，请检查网络后重试。" : "The network failed. Check the connection and retry." };
      }
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; field?: FieldName; reason?: string } };
      if (!res.ok)
        throw {
          text: json.error?.message || (zh ? `请求失败（${res.status}）。` : `The request failed (${res.status}).`),
          field: json.error?.field,
          reason: json.error?.reason,
        };
      if (mode === "login") {
        router.push(safeNext(next));
        router.refresh();
      } else if (mode === "signup") {
        router.push(`/verify-email?email=${encodeURIComponent(String(formData.get("email") ?? ""))}&sent=1`);
      } else if (mode === "reset") {
        router.push("/login?reset=1");
      } else {
        setMessage(
          mode === "resend"
            ? t("auth.resendDone")
            : zh
              ? "如果该邮箱已登记，重置链接很快会送达。请查看收件箱（也看看垃圾邮件）。"
              : "If an account uses this email, a reset link will arrive shortly. Check your inbox (and spam).",
        );
      }
    } catch (cause) {
      const failure = cause as { text: string; field?: FieldName; reason?: string };
      setError(failure);
      focusField(failure.field ?? (failure.reason === "invalid_credentials" ? "password" : undefined));
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "login" ? t("auth.loginTitle") : mode === "signup" ? t("auth.registerTitle") : mode === "forgot" ? t("auth.forgotTitle") : mode === "resend" ? t("auth.verifyTitle") : t("auth.resetTitle");
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
              ? "设置新密码，至少 8 个字符。完成后请用新密码重新登录。"
              : "Choose a new password of at least 8 characters, then sign in with it.";
  const submitLabel =
    mode === "login" ? t("auth.loginSubmit") : mode === "signup" ? t("auth.registerSubmit") : mode === "forgot" ? t("auth.sendReset") : mode === "resend" ? t("auth.resend") : t("auth.resetSubmit");
  const fieldError = (name: FieldName) => (error?.field === name ? error.text : undefined);

  return (
    <form
      ref={form}
      noValidate
      aria-busy={busy || undefined}
      className="pw-sheet relative mx-auto w-full max-w-xl overflow-hidden px-6 py-8 sm:px-10 sm:py-10"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      <div className="pointer-events-none absolute top-5 right-5 w-20 opacity-65 sm:top-7 sm:right-8 sm:w-24">
        <Image src="/vignettes/web/ex-key.webp" alt="" aria-hidden="true" width={256} height={256} className="pw-print h-auto w-full" />
      </div>
      <p className="font-mono text-meta tracking-[0.12em] text-brick-ink uppercase">Pioneer Wiki · Account</p>
      <h1 className="mt-4 max-w-[12ch] font-display text-h1 leading-tight text-ink">{title}</h1>
      <p className="mt-3 max-w-prose text-small leading-relaxed text-ink-3">{lede}</p>

      <div className="mt-8 flex flex-col gap-5">
        {mode === "signup" ? (
          <Field name="displayName" label={t("auth.displayName")} autoComplete="nickname" required maxLength={40} error={fieldError("displayName")} />
        ) : null}
        {mode !== "reset" ? (
          <Field
            name="email"
            label={t("auth.email")}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldError("email")}
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
            hint={mode === "login" ? undefined : zh ? "至少 8 个字符。" : "At least 8 characters."}
            error={fieldError("password")}
          />
        ) : null}
        {mode === "signup" || mode === "reset" ? (
          <Field name="confirmPassword" label={t("auth.confirmPassword")} type="password" autoComplete="new-password" required minLength={8} error={fieldError("confirmPassword")} />
        ) : null}
      </div>

      <div className="mt-5 min-h-6" aria-live="polite">
        {error && !error.field ? (
          <p role="alert" className="text-small text-brick-ink">
            {error.text}
            {error.reason === "email_not_verified" ? (
              <>
                {" "}
                <Link href={`/verify-email?email=${encodeURIComponent(email)}`} className="pw-link text-ink">
                  {zh ? "重新发送验证邮件" : "Resend the verification email"}
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-small text-moss-ink">
            {message}
          </p>
        ) : null}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button type="submit" disabled={busy} data-busy={busy || undefined} className="pw-stamp-button disabled:opacity-50">
          {busy ? t("auth.working") : submitLabel}
        </button>
        {mode === "login" ? (
          <Link href="/forgot-password" className="pw-link inline-flex min-h-11 items-center text-small text-ink-3">
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
  hint,
  error,
  ...props
}: { name: string; label: string; type?: string; hint?: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `auth-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="pw-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
        className={cn("pw-field text-body", error && "bg-[linear-gradient(var(--color-brick-ink),var(--color-brick-ink))] bg-[length:100%_2px] bg-bottom bg-no-repeat")}
        {...props}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-meta text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-meta text-brick-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
