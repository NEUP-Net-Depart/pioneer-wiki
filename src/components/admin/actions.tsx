"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/*
 * The administrators' moving parts: one way to call the API, one dialog for
 * every consequential action, one place where results are announced. Nothing
 * here reloads the page; a successful change refreshes the server data in
 * place, so filters, scroll position and focus stay where they were.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason?: string,
    readonly detail?: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, method = "POST", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body instanceof FormData || body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("", 0, "network");
  }
  const json = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(json?.error?.message ?? "", response.status, json?.error?.reason, json?.error?.detail);
  return json as T;
}

/** A sentence for a failed call, in the interface language. */
export function failureText(error: unknown, lang: "zh" | "en"): string {
  if (error instanceof ApiError) {
    if (error.status === 0)
      return lang === "zh" ? "网络连接失败，内容没有保存。请检查网络后重试。" : "The network failed and nothing was saved. Check the connection and retry.";
    const base = error.message || (lang === "zh" ? `请求失败（${error.status}）。` : `The request failed (${error.status}).`);
    return error.detail ? `${base} ${error.detail}` : base;
  }
  return lang === "zh" ? "发生了意外错误，请重试。" : "Something went wrong. Try again.";
}

type Notice = { kind: "ok" | "error"; text: string } | null;

/**
 * Runs a write, keeps it from running twice, announces the outcome and
 * refreshes the server data on success.
 */
export function useAction() {
  const router = useRouter();
  const { lang } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const run = useCallback(
    async <T,>(key: string, work: () => Promise<T>, done?: string | ((value: T) => string)): Promise<T | null> => {
      if (busy) return null;
      setBusy(key);
      setNotice(null);
      try {
        const value = await work();
        if (done) setNotice({ kind: "ok", text: typeof done === "function" ? done(value) : done });
        router.refresh();
        return value;
      } catch (error) {
        setNotice({ kind: "error", text: failureText(error, lang) });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [busy, lang, router],
  );
  /** For dialogs that call the API themselves (a failure stays inside the dialog): announce and refresh. */
  const succeed = useCallback(
    (text: string) => {
      setNotice({ kind: "ok", text });
      router.refresh();
    },
    [router],
  );
  return { busy, notice, setNotice, run, succeed };
}

/** The live line where outcomes are read out; errors interrupt, successes wait their turn. */
export function NoticeLine({ notice, className }: { notice: Notice; className?: string }) {
  return (
    <p
      role={notice?.kind === "error" ? "alert" : "status"}
      aria-live={notice?.kind === "error" ? "assertive" : "polite"}
      className={cn(
        "min-h-5 text-small",
        notice?.kind === "error" ? "text-brick-ink" : "text-moss-ink",
        !notice && "sr-only",
        className,
      )}
    >
      {notice ? (
        <>
          <span aria-hidden="true" className="mr-1.5 font-mono">
            {notice.kind === "error" ? "✕" : "✓"}
          </span>
          {notice.text}
        </>
      ) : null}
    </p>
  );
}

export interface ConfirmProps {
  /** What the trigger says, e.g. 归档 · Archive. */
  trigger: React.ReactNode;
  triggerClassName?: string;
  /** The trigger brings its own look (e.g. a stamp); no text-link styling is added. */
  plainTrigger?: boolean;
  title: string;
  /** Which object, and what will happen to it. */
  description: React.ReactNode;
  /** The confirming button names the consequence ("归档条目"), never a bare "OK". */
  confirmLabel: string;
  tone?: "default" | "danger";
  /** Ask for a reason; required ones block confirming while empty. */
  reason?: { label: string; required?: boolean; placeholder?: string };
  disabled?: boolean;
  /** Return false to keep the dialog open (e.g. the call failed). */
  onConfirm: (reason: string) => Promise<boolean | void>;
}

/**
 * The one dialog for consequential actions. Focus moves into it, stays
 * there, and returns to the trigger when it closes; Escape cancels. A failed
 * call keeps it open with the error inside, so nothing typed is lost.
 */
export function ConfirmAction({
  trigger,
  triggerClassName,
  plainTrigger,
  title,
  description,
  confirmLabel,
  tone = "default",
  reason,
  disabled,
  onConfirm,
}: ConfirmProps) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonId = useId();
  const missing = Boolean(reason?.required && !text.trim());
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) {
          setText("");
          setError(null);
        }
      }}
    >
      <Dialog.Trigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            plainTrigger
              ? "disabled:cursor-not-allowed disabled:opacity-45"
              : "pw-link min-h-8 text-small disabled:cursor-not-allowed disabled:opacity-45",
            !plainTrigger && (tone === "danger" ? "text-brick-ink" : "text-ink-2"),
            triggerClassName,
          )}
        >
          {trigger}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-veil data-open:animate-in data-open:fade-in-0" />
        <Dialog.Content
          className="pw-sheet fixed top-1/2 left-1/2 z-(--z-overlay) flex max-h-[calc(100svh-2rem)] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto p-6 shadow-lifted focus:outline-none sm:p-8"
          onEscapeKeyDown={(event) => busy && event.preventDefault()}
          onPointerDownOutside={(event) => busy && event.preventDefault()}
        >
          <Dialog.Title className="pw-double-rule font-display text-h3 text-ink">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="text-small leading-relaxed text-ink-2">{description}</div>
          </Dialog.Description>
          {reason ? (
            <label htmlFor={reasonId} className="flex flex-col gap-1.5">
              <span className="pw-label">
                {reason.label}
                {reason.required ? (
                  <span className="ml-1 text-brick-ink">{lang === "zh" ? "（必填）" : "(required)"}</span>
                ) : null}
              </span>
              <textarea
                id={reasonId}
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={reason.placeholder}
                className="pw-lined min-h-24 resize-y text-small"
              />
            </label>
          ) : null}
          {error ? (
            <p role="alert" className="text-small text-brick-ink">
              {error}
            </p>
          ) : null}
          <div className="pw-ink-over flex flex-wrap items-center justify-end gap-x-6 gap-y-3">
            <Dialog.Close asChild>
              <button type="button" disabled={busy} className="pw-link min-h-11 text-small text-ink-2 disabled:opacity-45">
                {lang === "zh" ? "取消" : "Cancel"}
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={busy || missing}
              data-busy={busy || undefined}
              aria-busy={busy || undefined}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const keep = (await onConfirm(text.trim())) === false;
                  if (!keep) {
                    setOpen(false);
                    setText("");
                  }
                } catch (cause) {
                  setError(failureText(cause, lang));
                } finally {
                  setBusy(false);
                }
              }}
              className={cn(
                "pw-stamp-button",
                tone === "danger" ? "[--draft:var(--color-brick-ink)]" : "[--draft:var(--color-ink)]",
              )}
            >
              {busy ? (lang === "zh" ? "处理中…" : "Working…") : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Warns before leaving a page with unsaved edits (tab close, reload, links).
 * In-app navigation is caught at the document level for plain links.
 */
export function useLeaveGuard(dirty: boolean, message: string) {
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (anchor.pathname === window.location.pathname && anchor.search === window.location.search) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [message]);
}

/** Moves focus to the first field marked invalid in a form, so the error is read where it is. */
export function focusFirstInvalid(root: HTMLElement | null) {
  const target = root?.querySelector<HTMLElement>("[aria-invalid='true']");
  target?.focus();
  target?.scrollIntoView({ block: "center", behavior: "smooth" });
}
