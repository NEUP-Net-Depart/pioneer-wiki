"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ForumCategory, ForumThread } from "@/lib/model/types";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { api, failureText } from "@/components/admin/actions";
import { Composer } from "@/components/writing/Composer";
import { Vignette } from "@/components/book/Vignette";
import { FORUM_CATEGORIES } from "./categories";

const NOTES: Record<ForumCategory, { zh: string; en: string }> = {
  general: { zh: "闲谈、想法和不属于其他分类的话题。", en: "Ideas, chat and anything that fits nowhere else." },
  help: { zh: "遇到问题？写清楚做了什么、看到了什么。", en: "Stuck? Say what you did and what you saw." },
  showcase: { zh: "分享你做的东西：项目、笔记、图。", en: "Show what you made: projects, notes, drawings." },
  meta: {
    zh: "关于本站与本会：建议、勘误、友链交换。",
    en: "About the site and the society: suggestions, errata, link exchanges.",
  },
};

/** Start a discussion: choose its category, give it a title, write the opening post. */
export function NewThreadForm({ accountId }: { accountId: string }) {
  const router = useRouter();
  const { lang } = useI18n();
  const zh = lang === "zh";
  const form = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState<ForumCategory>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; body?: string; form?: string }>({});
  const storageKey = `pioneer-wiki:forum:${accountId}:new`;

  const send = async () => {
    if (busy) return;
    const next = {
      title:
        title.trim() && title.length <= 120
          ? undefined
          : zh
            ? "标题需要 1–120 个字符。"
            : "Titles need 1–120 characters.",
      body: body.trim() ? undefined : zh ? "请写下首帖内容。" : "Write the opening post.",
    };
    setErrors(next);
    if (next.title || next.body) {
      form.current?.querySelector<HTMLElement>(next.title ? "#nt-title" : "textarea")?.focus();
      return;
    }
    setBusy(true);
    try {
      const thread = await api<ForumThread>("/api/forum/threads", "POST", { title: title.trim(), category, body });
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Nothing to clear.
      }
      router.push(`/forum/${thread.id}`);
    } catch (error) {
      setErrors({ form: failureText(error, lang) });
      setBusy(false);
    }
  };

  return (
    <form
      ref={form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
      className="flex flex-col gap-8"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="pw-label mb-2">{zh ? "分类" : "Category"}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {FORUM_CATEGORIES.map((c) => (
            <label
              key={c.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-sm border px-4 py-3 transition-colors duration-(--dur-quick)",
                category === c.id ? "border-part bg-part-wash" : "border-rule hover:border-rule-strong",
              )}
            >
              <input
                type="radio"
                name="category"
                value={c.id}
                checked={category === c.id}
                onChange={() => setCategory(c.id)}
                className="mt-1.5"
              />
              <Vignette name={c.emblem} className="w-10 shrink-0" sizes="40px" />
              <span>
                <span className="block font-display text-h4 text-ink">{c.label[lang]}</span>
                <span className="block text-small text-ink-2">{NOTES[c.id][lang]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nt-title" className="pw-label">
          {zh ? "标题" : "Title"} <span className="text-brick-ink">*</span>
        </label>
        <input
          id="nt-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "nt-title-error" : undefined}
          placeholder={zh ? "一句话说清这次讨论的主题" : "Say in one line what this is about"}
          className="pw-field font-display text-h3"
        />
        {errors.title ? (
          <p id="nt-title-error" className="text-meta text-brick-ink">
            {errors.title}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="pw-label">
          {zh ? "首帖" : "Opening post"} <span className="text-brick-ink">*</span>
        </span>
        <Composer
          value={body}
          onChange={setBody}
          storageKey={storageKey}
          label={zh ? "首帖内容" : "Opening post"}
          placeholder={
            zh
              ? "写下问题、发现或想法。讨论条目时请写编号，例如 PW-0001。"
              : "Your question, finding or idea. Cite entries by number, e.g. PW-0001."
          }
          invalid={Boolean(errors.body)}
          describedBy={errors.body ? "nt-body-error" : undefined}
          onSubmitShortcut={() => void send()}
          minRows={10}
        />
        {errors.body ? (
          <p id="nt-body-error" className="text-meta text-brick-ink">
            {errors.body}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button type="submit" disabled={busy} data-busy={busy || undefined} className="pw-stamp-button">
          {busy ? (zh ? "发布中…" : "Posting…") : zh ? "发起讨论" : "Start discussion"}
        </button>
        <p role="alert" className="text-small text-brick-ink">
          {errors.form ?? ""}
        </p>
      </div>
    </form>
  );
}
