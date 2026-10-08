"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { api, failureText } from "@/components/admin/actions";
import { Composer } from "@/components/writing/Composer";

/** The reply box at the foot of a discussion; the new reply appears in place, without a reload. */
export function ReplyForm({
  threadId,
  accountId,
  signature,
}: {
  threadId: string;
  accountId: string;
  signature: string;
}) {
  const router = useRouter();
  const { lang } = useI18n();
  const zh = lang === "zh";
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const storageKey = `pioneer-wiki:forum:${accountId}:reply:${threadId}`;

  const send = async () => {
    if (busy) return;
    if (!body.trim()) {
      setError(zh ? "回复不能为空。" : "The reply is empty.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await api(`/api/forum/threads/${threadId}/posts`, "POST", { body });
      setBody("");
      setDone(true);
      router.refresh();
    } catch (cause) {
      setError(failureText(cause, lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
      className="flex flex-col gap-3"
    >
      <h2 className="font-display text-h4">{zh ? "参与讨论" : "Join the discussion"}</h2>
      <Composer
        value={body}
        onChange={setBody}
        storageKey={storageKey}
        label={zh ? "回复内容" : "Reply"}
        placeholder={zh ? "写下你的回复……" : "Write a reply…"}
        invalid={Boolean(error && !body.trim())}
        onSubmitShortcut={() => void send()}
        minRows={6}
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <button type="submit" disabled={busy} data-busy={busy || undefined} className="pw-stamp-button">
          {busy ? (zh ? "发送中…" : "Sending…") : zh ? "回复" : "Reply"}
        </button>
        <span className="text-meta text-ink-3">
          {zh ? "署名：" : "Signed: "}
          {signature}
        </span>
        <p
          role={error ? "alert" : "status"}
          className={error ? "text-small text-brick-ink" : "text-small text-moss-ink"}
        >
          {error ?? (done ? (zh ? "回复已发布。" : "Reply posted.") : "")}
        </p>
      </div>
    </form>
  );
}
