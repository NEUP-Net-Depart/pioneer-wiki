"use client";

import { Search } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { KeyboardHint } from "@/components/archive/KeyboardHint";
import { OPEN_SEARCH_EVENT } from "./SearchPalette";

/** Opens the search palette; a plain link to /search underneath for no-JS readers. */
export function SearchTrigger({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <a
      href="/search"
      onClick={(e) => {
        e.preventDefault();
        window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
      }}
      aria-keyshortcuts="Control+K Meta+K /"
      className="group inline-flex h-9 items-center gap-2 text-ink-2 no-underline hover:text-ink"
    >
      <Search
        aria-hidden="true"
        className="size-[1.125rem] transition-transform duration-(--dur-quick) group-hover:-rotate-12"
      />
      <span className={compact ? "sr-only" : "text-small"}>{t("nav.search")}</span>
      {compact ? null : <KeyboardHint keys={["Ctrl", "K"]} className="hidden lg:inline-flex" />}
    </a>
  );
}
