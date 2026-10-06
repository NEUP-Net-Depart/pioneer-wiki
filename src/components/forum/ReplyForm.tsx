"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { DraftingSheet } from "@/components/writing/DraftingSheet";

/**
 * A reply, drawn on a smaller sheet of the same drawing: the note in the
 * gridded area, the name and the post number in the title block.
 * POST /api/forum/threads/[id]/posts, then refresh the thread in place.
 */
export function ReplyForm({
  threadId,
  sheetNumber,
  nextPost,
  today,
}: {
  threadId: string;
  sheetNumber: number;
  nextPost: number;
  today: string;
}) {
  const router = useRouter();
  const { lang } = useI18n();
  const zh = lang === "zh";
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={form}
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          const res = await fetch(`/api/forum/threads/${threadId}/posts`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body: data.get("body") }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error?.message ?? res.statusText);
          form.current?.reset();
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <DraftingSheet
        lang={lang}
        notes={
          zh
            ? ["批注只针对这张图纸。", "引用前文请写批注号，如 #02。"]
            : ["Notes stay on this sheet's subject.", "Refer to earlier notes by number, e.g. #02."]
        }
        block={
          <>
            <div>
              <small>{zh ? "图号 · Sheet" : "Sheet · 图号"}</small>
              <output>No. {String(sheetNumber).padStart(3, "0")}</output>
            </div>
            <div>
              <small>{zh ? "批注 · Note" : "Note · 批注"}</small>
              <output>{String(nextPost).padStart(2, "0")}</output>
            </div>
            <div data-span>
              <small>{zh ? "署名 · Drawn by" : "Drawn by · 署名"}</small>
              <output>{zh ? "由账号资料读取" : "From your account"}</output>
            </div>
            <div data-span>
              <small>{zh ? "日期 · Date" : "Date · 日期"}</small>
              <output>{today}</output>
            </div>
            <div data-span className="items-start gap-2 py-4">
              <button type="submit" disabled={busy} data-busy={busy || undefined} className="pw-stamp-button">
                {busy ? (zh ? "发送中…" : "Sending…") : zh ? "批注 · Reply" : "Reply · 批注"}
              </button>
              {error ? (
                <p role="alert" className="text-small text-brick-ink">
                  {error}
                </p>
              ) : null}
            </div>
          </>
        }
      >
        <label htmlFor="pw-reply-body" className="sr-only">
          {zh ? "回复" : "Reply"}
        </label>
        <textarea
          id="pw-reply-body"
          name="body"
          required
          maxLength={8000}
          rows={7}
          placeholder={zh ? "在这张图纸上加一条批注……" : "Add a note to this sheet…"}
          className="pw-drafting-text text-body"
        />
      </DraftingSheet>
    </form>
  );
}
