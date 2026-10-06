"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import type { Lang } from "@/lib/model/types";

const OPTIONS: Array<{ lang: Lang; short: string; label: string }> = [
  { lang: "zh", short: "中", label: "中文" },
  { lang: "en", short: "EN", label: "English" },
];

/**
 * 中 / EN as two typed labels with an ink underline that slides to the lead
 * language. Changes the lead language without leaving the page; while the
 * server re-renders, the label breathes.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang, t, switching } = useI18n();
  const index = OPTIONS.findIndex((o) => o.lang === lang);
  return (
    <div
      role="group"
      aria-label={t("lang.toggle")}
      aria-busy={switching || undefined}
      className={cn("relative inline-grid grid-cols-2 items-center text-small", className)}
    >
      {OPTIONS.map((o) => {
        const active = o.lang === lang;
        return (
          <button
            key={o.lang}
            type="button"
            lang={o.lang === "zh" ? "zh-CN" : "en"}
            aria-pressed={active}
            aria-label={o.label}
            onClick={() => !active && setLang(o.lang)}
            className={cn(
              "h-9 min-w-10 px-2 font-medium tracking-[0.06em] transition-colors duration-(--dur-quick)",
              active ? "text-ink" : "text-ink-3 hover:text-ink",
              active && switching && "pw-breathe",
            )}
          >
            {o.short}
          </button>
        );
      })}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1 left-0 h-px w-1/2 bg-ink transition-transform duration-(--dur-base) ease-(--ease-grow)"
        style={{ transform: `translateX(${index * 100}%) scaleX(0.5)` }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-rule-strong"
      />
    </div>
  );
}
