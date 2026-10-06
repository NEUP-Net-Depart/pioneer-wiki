"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LanguageToggle } from "./LanguageToggle";
import { NavLinks } from "./NavLinks";

/** Small screens: navigation, language and "new entry" move into a drawer. */
export function MobileNav() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="inline-flex size-9 items-center justify-center rounded-sm text-ink-2 hover:bg-ink/5"
        aria-label={t("nav.primary")}
      >
        <Menu className="size-5" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(20rem,86vw)] bg-paper-sheet">
        <SheetHeader>
          <SheetTitle className="font-display text-h4">{t("site.name")}</SheetTitle>
          <SheetDescription className="text-meta">{t("site.tagline")}</SheetDescription>
        </SheetHeader>
        <nav aria-label={t("nav.primary")} className="px-4">
          <NavLinks orientation="column" onNavigate={() => setOpen(false)} />
        </nav>
        <div className="mt-4 flex flex-col gap-3 border-t border-rule px-4 pt-4">
          <LanguageToggle className="self-start" />
          <Link
            href="/editor/new"
            onClick={() => setOpen(false)}
            className="pw-link inline-flex items-center gap-1.5 self-start text-small text-ink"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("nav.create")}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
