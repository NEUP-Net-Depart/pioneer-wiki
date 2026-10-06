"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ForumCategory, ForumThread } from "@/lib/model/types";
import { useI18n } from "@/lib/i18n/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DraftingSheet } from "@/components/writing/DraftingSheet";
import { FORUM_CATEGORIES } from "./categories";

/**
 * A new sheet for the register, drawn up as an engineering drawing: the body
 * goes in the gridded drawing area, title / name / category in the title
 * block, and filing it is stamping it. POST /api/forum/threads, then open it.
 */
export function NewThreadForm({ nextNumber, today }: { nextNumber: number; today: string }) {
  const router = useRouter();
  const { lang } = useI18n();
  const zh = lang === "zh";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/forum/threads", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title: data.get("title"), category: data.get("category"), body: data.get("body") }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error?.message ?? res.statusText);
          router.push(`/forum/${(json as ForumThread).id}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setBusy(false);
        }
      }}
    >
      <DraftingSheet
        lang={lang}
        notes={
          zh
            ? ["一张图纸只谈一件事。", "讨论条目请注明编号，如 PW-0001。", "申请友链请写站名、地址与一句介绍。"]
            : [
                "One subject per sheet.",
                "Cite entries by number, e.g. PW-0001.",
                "To exchange links: name, address, one line.",
              ]
        }
        block={
          <>
            <label data-span className="pw-titleblock-title">
              <small>{zh ? "标题 · Title" : "Title · 标题"}</small>
              <input
                name="title"
                required
                maxLength={120}
                placeholder={zh ? "这张图纸要讨论什么？" : "What is this sheet about?"}
              />
            </label>
            <div>
              <small>{zh ? "署名 · Drawn by" : "Drawn by · 署名"}</small>
              <output>{zh ? "由账号资料读取" : "From your account"}</output>
            </div>
            <label>
              <small>{zh ? "分类 · Class" : "Class · 分类"}</small>
              <Select name="category" defaultValue={"general" satisfies ForumCategory}>
                <SelectTrigger
                  size="sm"
                  className="h-auto w-full justify-between gap-2 rounded-none border-0 bg-transparent px-0 py-0.5 shadow-none text-small font-normal text-ink focus-visible:border-0 focus-visible:ring-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {FORUM_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <div>
              <small>{zh ? "图号 · Sheet" : "Sheet · 图号"}</small>
              <output>No. {String(nextNumber).padStart(3, "0")}</output>
            </div>
            <div>
              <small>{zh ? "日期 · Date" : "Date · 日期"}</small>
              <output>{today}</output>
            </div>
            <div data-span className="items-start gap-2 py-4">
              <button type="submit" disabled={busy} data-busy={busy || undefined} className="pw-stamp-button">
                {busy ? (zh ? "登记中…" : "Filing…") : zh ? "登记 · File" : "File · 登记"}
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
        <label htmlFor="pw-new-sheet-body" className="sr-only">
          {zh ? "正文" : "Body"}
        </label>
        <textarea
          id="pw-new-sheet-body"
          name="body"
          required
          maxLength={8000}
          rows={10}
          placeholder={zh ? "在图纸上写下你的问题、发现或想法……" : "Draw up your question, finding or idea…"}
          className="pw-drafting-text text-body"
        />
      </DraftingSheet>
    </form>
  );
}
