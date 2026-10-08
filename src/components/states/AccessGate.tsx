import Link from "next/link";
import type { Account } from "@/lib/model/types";

type Lang = "zh" | "en";
export type GateNeed = "account" | "verified" | "author" | "admin";

/** Why the signed-in visitor (or nobody) cannot be here, or null when they may. */
export function gateReason(account: Account | null, need: GateNeed): string | null {
  if (!account) return "signed_out";
  if (account.status === "suspended") return "suspended";
  if (account.status === "closed") return "closed";
  if (need === "account") return null;
  if (!account.emailVerified) return "unverified";
  if (need === "admin" && account.role !== "admin") return "not_admin";
  if (need === "author" && !account.authorId && account.role !== "admin") return "not_author";
  return null;
}

const COPY: Record<string, { zh: [string, string]; en: [string, string] }> = {
  signed_out: {
    zh: ["请先登录。", "登录后即可继续；没有账号可以先注册，验证邮箱后成为读者。"],
    en: ["Sign in to continue.", "Sign in to carry on; without an account, register and verify your email to become a reader."],
  },
  unverified: {
    zh: ["请先验证邮箱。", "我们向注册邮箱发送了验证链接。验证后才能写作、交流或使用管理功能。"],
    en: ["Verify your email first.", "A verification link was sent to your address. Writing, posting and administration need a verified email."],
  },
  suspended: {
    zh: ["账号已停用。", "停用期间可以阅读，但不能写作、发帖或管理。如有疑问请联系管理员。"],
    en: ["This account is suspended.", "You can read, but not write, post or administer. Contact an administrator if this is unexpected."],
  },
  closed: {
    zh: ["账号已注销。", "这个账号已被注销，无法再使用。"],
    en: ["This account is closed.", "This account has been closed and cannot be used."],
  },
  not_author: {
    zh: ["编辑 Wiki 需要作者资格。", "作者资格由管理员批准。你可以在账号页提交申请，并在那里查看处理进度。"],
    en: ["Editing the wiki needs author status.", "Administrators grant author status. Apply from your account page and follow its progress there."],
  },
  not_admin: {
    zh: ["此区域仅管理员可用。", "当前账号没有管理员权限。需要时请联系现有管理员。"],
    en: ["Administrators only.", "This account has no administrator access. Ask an existing administrator if you need it."],
  },
};

/** A catalogue card explaining the refusal and the next step, in place of the page. */
export function AccessGate({ reason, lang, next }: { reason: string; lang: Lang; next: string }) {
  const [title, body] = (COPY[reason] ?? COPY.not_admin)[lang];
  const zh = lang === "zh";
  const action =
    reason === "signed_out"
      ? { href: `/login?next=${encodeURIComponent(next)}`, label: zh ? "登录" : "Sign in" }
      : reason === "unverified"
        ? { href: "/verify-email", label: zh ? "重新发送验证邮件" : "Resend the verification email" }
        : reason === "not_author"
          ? { href: "/account/identity", label: zh ? "申请作者资格" : "Apply for author status" }
          : { href: "/account", label: zh ? "前往我的账号" : "Go to my account" };
  return (
    <section
      aria-labelledby="gate-title"
      className="pw-card mx-auto flex w-full max-w-xl flex-col items-start gap-3 px-6 pt-16 pb-12 sm:px-10"
    >
      <p className="font-mono text-meta tracking-[0.14em] text-brick-ink uppercase">
        {reason === "signed_out" ? "401" : "403"} · {zh ? "访问受限" : "Restricted"}
      </p>
      <h1 id="gate-title" className="font-display text-h2 leading-tight text-ink">
        {title}
      </h1>
      <p className="max-w-prose text-small leading-relaxed text-ink-2">{body}</p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-small">
        <Link href={action.href} className="pw-link min-h-11 py-2.5 text-ink">
          {action.label} →
        </Link>
        {reason === "signed_out" ? (
          <Link href="/register" className="pw-link min-h-11 py-2.5 text-ink-2">
            {zh ? "注册" : "Register"}
          </Link>
        ) : null}
        <Link href="/" className="pw-link min-h-11 py-2.5 text-ink-3">
          {zh ? "回到首页" : "Back to the home page"}
        </Link>
      </div>
    </section>
  );
}
