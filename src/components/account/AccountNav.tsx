"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/account", zh: "档案", en: "Profile" },
  { href: "/account/security", zh: "登录与安全", en: "Sign-in & security" },
  { href: "/account/identity", zh: "身份与申请", en: "Identity" },
  { href: "/account/entries", zh: "我的文章", en: "My entries" },
];

/** The account's sections, as tabs on the ruled head of the page. */
export function AccountNav() {
  const { lang } = useI18n();
  const pathname = usePathname();
  return (
    <nav aria-label={lang === "zh" ? "账号" : "Account"} className="pw-ink-under -mb-px overflow-x-auto">
      <ul className="flex gap-x-7">
        {TABS.map((tab) => {
          const current = tab.href === "/account" ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 text-small whitespace-nowrap no-underline",
                  current ? "border-brick text-ink" : "border-transparent text-ink-2 hover:text-ink",
                )}
              >
                {lang === "zh" ? tab.zh : tab.en}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
