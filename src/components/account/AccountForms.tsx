"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationKind, IdentityApplication, Localized } from "@/lib/model/types";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { api, ApiError, ConfirmAction, failureText, focusFirstInvalid, NoticeLine } from "@/components/admin/actions";

/*
 * The account holder's own forms. Each keeps what was typed when a request
 * fails, marks the field at fault and moves focus to it, and says plainly
 * what happened — including when the backend cannot do the thing at all.
 */

type Notice = { kind: "ok" | "error"; text: string } | null;

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
    required?: boolean;
  }) => React.ReactNode;
}) {
  const id = useId();
  const { lang } = useI18n();
  const described = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="pw-label">
        {label}
        {required ? <span className="ml-1 text-brick-ink">{lang === "zh" ? "（必填）" : "(required)"}</span> : null}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": described, required })}
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

function useForm() {
  const { lang } = useI18n();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const submit = async (work: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      setNotice({ kind: "ok", text: await work() });
      router.refresh();
    } catch (error) {
      setNotice({ kind: "error", text: failureText(error, lang) });
      requestAnimationFrame(() => focusFirstInvalid(ref.current));
    } finally {
      setBusy(false);
    }
  };
  return { ref, busy, notice, submit, lang };
}

function Submit({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy || undefined}
      data-busy={busy || undefined}
      className="pw-stamp-button self-start [--draft:var(--color-ink)]"
    >
      {busy ? busyLabel : label}
    </button>
  );
}

export function ProfileForm({ name }: { name: Localized }) {
  const { ref, busy, notice, submit, lang } = useForm();
  const zh = lang === "zh";
  const [value, setValue] = useState(name);
  const [errors, setErrors] = useState<{ zh?: string; en?: string }>({});
  return (
    <form
      ref={ref}
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const next = {
          zh:
            !value.zh.trim() || value.zh.length > 40
              ? zh
                ? "请填写 1–40 个字符。"
                : "Use 1–40 characters."
              : undefined,
          en:
            !value.en.trim() || value.en.length > 40
              ? zh
                ? "请填写 1–40 个字符。"
                : "Use 1–40 characters."
              : undefined,
        };
        setErrors(next);
        if (next.zh || next.en) {
          requestAnimationFrame(() => focusFirstInvalid(ref.current));
          return;
        }
        void submit(async () => {
          await api("/api/account/profile", "PATCH", { name: value });
          return zh ? "显示名已保存。" : "Display name saved.";
        });
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={zh ? "中文显示名" : "Chinese display name"} error={errors.zh} required>
          {(props) => (
            <input
              {...props}
              value={value.zh}
              maxLength={40}
              onChange={(e) => setValue({ ...value, zh: e.target.value })}
              className="pw-field"
            />
          )}
        </Field>
        <Field label={zh ? "英文显示名" : "English display name"} error={errors.en} required>
          {(props) => (
            <input
              {...props}
              value={value.en}
              maxLength={40}
              onChange={(e) => setValue({ ...value, en: e.target.value })}
              className="pw-field"
            />
          )}
        </Field>
      </div>
      <p className="text-meta text-ink-3">
        {zh
          ? "显示名用于论坛署名（未绑定成员主页时）与账号菜单。公开成员主页的名字在主页编辑器中修改。"
          : "Your display name signs forum posts (when no member page is bound) and appears in the account menu. A member page's name is edited in its own editor."}
      </p>
      <Submit busy={busy} label={zh ? "保存显示名" : "Save name"} busyLabel={zh ? "保存中…" : "Saving…"} />
      <NoticeLine notice={notice} />
    </form>
  );
}

export function EmailForm({ current }: { current: string }) {
  const { ref, busy, notice, submit, lang } = useForm();
  const zh = lang === "zh";
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  return (
    <form
      ref={ref}
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          setError(zh ? "请输入有效的邮箱地址。" : "Enter a valid email address.");
          requestAnimationFrame(() => focusFirstInvalid(ref.current));
          return;
        }
        setError(undefined);
        void submit(async () => {
          try {
            await api("/api/account/email", "POST", { email: email.trim() });
          } catch (cause) {
            if (cause instanceof ApiError && cause.status === 422) setError(cause.message);
            throw cause;
          }
          return zh
            ? `确认链接已发送到 ${email.trim()}（如启用了安全邮箱变更，原邮箱也会收到一封）。打开链接后才会生效。`
            : `A confirmation link went to ${email.trim()} (and to your current address if secure change is on). Nothing changes until it is opened.`;
        });
      }}
    >
      <p className="text-small text-ink-2">
        {zh ? "当前登录邮箱：" : "Current sign-in email: "}
        <span className="font-mono">{current}</span>
      </p>
      <Field label={zh ? "新邮箱" : "New email"} error={error} required>
        {(props) => (
          <input
            {...props}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pw-field"
          />
        )}
      </Field>
      <Submit busy={busy} label={zh ? "发送确认邮件" : "Send confirmation"} busyLabel={zh ? "发送中…" : "Sending…"} />
      <NoticeLine notice={notice} />
    </form>
  );
}

export function PasswordForm() {
  const { ref, busy, notice, submit, lang } = useForm();
  const zh = lang === "zh";
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; password?: string; confirm?: string }>({});
  return (
    <form
      ref={ref}
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const next = {
          current: current ? undefined : zh ? "请输入当前密码。" : "Enter your current password.",
          password: password.length >= 8 ? undefined : zh ? "至少 8 个字符。" : "At least 8 characters.",
          confirm: confirm === password ? undefined : zh ? "两次输入不一致。" : "The passwords do not match.",
        };
        setErrors(next);
        if (next.current || next.password || next.confirm) {
          requestAnimationFrame(() => focusFirstInvalid(ref.current));
          return;
        }
        void submit(async () => {
          try {
            await api("/api/account/password", "POST", {
              currentPassword: current,
              password,
              confirmPassword: confirm,
            });
          } catch (cause) {
            if (cause instanceof ApiError && cause.reason === "wrong_password") setErrors({ current: cause.message });
            throw cause;
          }
          setCurrent("");
          setPassword("");
          setConfirm("");
          return zh ? "密码已更新。" : "Password changed.";
        });
      }}
    >
      <Field label={zh ? "当前密码" : "Current password"} error={errors.current} required>
        {(props) => (
          <input
            {...props}
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="pw-field"
          />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={zh ? "新密码" : "New password"}
          hint={zh ? "至少 8 个字符。" : "At least 8 characters."}
          error={errors.password}
          required
        >
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pw-field"
            />
          )}
        </Field>
        <Field label={zh ? "再次输入新密码" : "Repeat the new password"} error={errors.confirm} required>
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="pw-field"
            />
          )}
        </Field>
      </div>
      <Submit busy={busy} label={zh ? "更新密码" : "Change password"} busyLabel={zh ? "更新中…" : "Changing…"} />
      <NoticeLine notice={notice} />
    </form>
  );
}

export function ClosureControl({ requestedAt }: { requestedAt?: string }) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  return (
    <div className="flex flex-col gap-2">
      {requestedAt ? (
        <>
          <p className="text-small text-ink-2">
            {zh ? "你已于 " : "You asked on "}
            <time dateTime={requestedAt}>{new Date(requestedAt).toLocaleDateString(zh ? "zh-CN" : "en-GB")}</time>
            {zh
              ? " 申请注销，等待管理员处理。处理前你可以撤回。"
              : " to close this account; an administrator will process it. You can withdraw until then."}
          </p>
          <ConfirmAction
            trigger={zh ? "撤回注销申请" : "Withdraw the request"}
            title={zh ? "撤回注销申请？" : "Withdraw the closure request?"}
            description={
              zh ? "账号将保持原样，可以继续使用。" : "The account stays as it is and can be used as before."
            }
            confirmLabel={zh ? "撤回申请" : "Withdraw request"}
            onConfirm={async () => {
              await api("/api/account/closure", "DELETE");
              setNotice({ kind: "ok", text: zh ? "已撤回注销申请。" : "Request withdrawn." });
              router.refresh();
            }}
          />
        </>
      ) : (
        <ConfirmAction
          tone="danger"
          trigger={zh ? "申请注销账号" : "Ask to close this account"}
          title={zh ? "申请注销账号？" : "Ask to close your account?"}
          description={
            <ul className="list-disc space-y-1 pl-5">
              <li>
                {zh
                  ? "管理员处理后：登录邮箱、密码与显示名会被删除，所有登录失效，且无法恢复。"
                  : "Once processed: your sign-in email, password and display name are removed and every session ends. This cannot be undone."}
              </li>
              <li>
                {zh
                  ? "公开成员主页会被归档；论坛帖子保留但署名改为“已注销账号”。"
                  : "Your public page is archived; forum posts stay, signed “closed account”."}
              </li>
              <li>
                {zh
                  ? "已发布条目的历史署名按作者记录保留。处理前可以随时撤回。"
                  : "Published entries keep their historical credit. You can withdraw until it is processed."}
              </li>
            </ul>
          }
          reason={{ label: zh ? "原因（可选，仅管理员可见）" : "Reason (optional, administrators only)" }}
          confirmLabel={zh ? "提交注销申请" : "Submit the request"}
          onConfirm={async (reason) => {
            await api("/api/account/closure", "POST", { reason });
            setNotice({ kind: "ok", text: zh ? "注销申请已提交。" : "Closure request submitted." });
            router.refresh();
          }}
        />
      )}
      <NoticeLine notice={notice} />
    </div>
  );
}

export function ApplicationForm({ needsAuthor, needsMember }: { needsAuthor: boolean; needsMember: boolean }) {
  const { ref, busy, notice, submit, lang } = useForm();
  const zh = lang === "zh";
  const [kind, setKind] = useState<ApplicationKind>(
    needsAuthor && needsMember ? "both" : needsAuthor ? "author" : "member",
  );
  const [statement, setStatement] = useState("");
  const [handle, setHandle] = useState("");
  const [errors, setErrors] = useState<{ statement?: string; handle?: string }>({});
  const kinds: ApplicationKind[] = [
    ...(needsAuthor ? (["author"] as const) : []),
    ...(needsMember ? (["member"] as const) : []),
    ...(needsAuthor && needsMember ? (["both"] as const) : []),
  ];
  return (
    <form
      ref={ref}
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const next = {
          statement:
            statement.trim() && statement.length <= 2000
              ? undefined
              : zh
                ? "请用 1–2000 字说明。"
                : "Explain in 1–2000 characters.",
          handle:
            !handle || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(handle)
              ? undefined
              : zh
                ? "只能使用小写字母、数字和连字符。"
                : "Use lowercase letters, digits and hyphens.",
        };
        setErrors(next);
        if (next.statement || next.handle) {
          requestAnimationFrame(() => focusFirstInvalid(ref.current));
          return;
        }
        void submit(async () => {
          await api("/api/account/applications", "POST", { kind, statement, handle: handle || undefined });
          setStatement("");
          return zh ? "申请已提交，管理员处理后会在这里显示结果。" : "Application sent; the decision will show here.";
        });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="pw-label">{zh ? "申请内容" : "Applying for"}</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-small">
          {kinds.map((value) => (
            <label key={value} className="flex min-h-9 items-center gap-2">
              <input type="radio" name="kind" checked={kind === value} onChange={() => setKind(value)} />
              {value === "author"
                ? zh
                  ? "Wiki 作者资格"
                  : "Wiki author status"
                : value === "member"
                  ? zh
                    ? "公开成员主页"
                    : "A public member page"
                  : zh
                    ? "两者都要"
                    : "Both"}
            </label>
          ))}
        </div>
      </fieldset>
      <Field
        label={zh ? "说明" : "About you"}
        hint={
          zh
            ? "你想写哪些方向、在本会做什么，或附上作品链接。"
            : "What you would write about, what you do in the society, or links to your work."
        }
        error={errors.statement}
        required
      >
        {(props) => (
          <textarea
            {...props}
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            rows={5}
            maxLength={2000}
            className="pw-lined min-h-32 resize-y text-small"
          />
        )}
      </Field>
      <Field
        label={zh ? "希望的主页代号（可选）" : "Preferred handle (optional)"}
        hint={zh ? "例如 qingkong；最终由管理员确定。" : "e.g. qingkong; administrators decide."}
        error={errors.handle}
      >
        {(props) => (
          <input
            {...props}
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase())}
            maxLength={32}
            className="pw-field font-mono"
          />
        )}
      </Field>
      <Submit busy={busy} label={zh ? "提交申请" : "Send application"} busyLabel={zh ? "提交中…" : "Sending…"} />
      <NoticeLine notice={notice} />
    </form>
  );
}

export function WithdrawApplication({ application }: { application: IdentityApplication }) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={zh ? "撤回申请" : "Withdraw"}
      title={zh ? "撤回这份申请？" : "Withdraw this application?"}
      description={zh ? "撤回后可以重新提交。" : "You can apply again afterwards."}
      confirmLabel={zh ? "撤回申请" : "Withdraw application"}
      onConfirm={async () => {
        await api(`/api/account/applications/${application.id}`, "DELETE");
        router.refresh();
      }}
    />
  );
}

export function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("pw-sheet flex flex-col gap-5 p-6 sm:p-8", className)}>
      <h2 className="pw-double-rule font-display text-h3">{title}</h2>
      {children}
    </section>
  );
}
