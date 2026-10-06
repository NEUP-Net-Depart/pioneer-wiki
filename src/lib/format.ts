import type { Lang } from "@/lib/model/types";

/*
 * Dates are formatted in a fixed time zone so server and client render the
 * same string (no hydration mismatch) regardless of the reader's machine.
 */
const TIME_ZONE = "Asia/Shanghai";

const dateFormats: Record<Lang, Intl.DateTimeFormat> = {
  zh: new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", timeZone: TIME_ZONE }),
  en: new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "numeric", timeZone: TIME_ZONE }),
};

const dateTimeFormats: Record<Lang, Intl.DateTimeFormat> = {
  zh: new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
  }),
  en: new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
  }),
};

export function formatDate(iso: string, lang: Lang): string {
  return dateFormats[lang].format(new Date(iso));
}

export function formatDateTime(iso: string, lang: Lang): string {
  return dateTimeFormats[lang].format(new Date(iso));
}
