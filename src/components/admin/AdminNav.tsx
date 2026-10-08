"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminTodo } from "@/lib/services/contracts";
import { ADMIN_GROUPS, type AdminNavItem } from "@/lib/admin/navigation";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export { ADMIN_GROUPS } from "@/lib/admin/navigation";

const active = (pathname: string, href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

/**
 * Wide screens: a register down the margin. Narrow screens: one row of rooms
 * that scrolls sideways, the current one in view.
 */
export function AdminNav({ todo }: { todo: AdminTodo | null }) {
  const { lang } = useI18n();
  const pathname = usePathname();
  const label = (item: AdminNavItem) => (lang === "zh" ? item.zh : item.en);
  const count = (item: AdminNavItem) => (item.count && todo ? todo[item.count] : 0);
  return (
    <nav
      aria-label={lang === "zh" ? "管理后台" : "Administration"}
      className="lg:sticky lg:top-[calc(var(--shell-header)+1.5rem)]"
    >
      <ol className="flex gap-x-5 overflow-x-auto pb-2 [scrollbar-width:thin] lg:flex-col lg:gap-6 lg:overflow-visible lg:pb-0">
        {ADMIN_GROUPS.map((group) => (
          <li key={group.en} className="contents lg:block">
            <p className="pw-smallcaps hidden text-meta text-ink-3 lg:block">{lang === "zh" ? group.zh : group.en}</p>
            <ul className="contents lg:mt-2 lg:flex lg:flex-col lg:gap-0.5">
              {group.items.map((item) => {
                const current = active(pathname, item.href);
                const n = count(item);
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-3 border-b-2 py-2 text-small whitespace-nowrap no-underline lg:min-h-9 lg:border-b-0 lg:border-l-2 lg:py-1.5 lg:pl-3",
                        current ? "border-brick text-ink" : "border-transparent text-ink-2 hover:text-ink",
                      )}
                    >
                      <span>{label(item)}</span>
                      {n ? (
                        <span className="rounded-xs bg-brick-ink px-1.5 font-mono text-meta text-paper-sheet">
                          {n}
                          <span className="sr-only">{lang === "zh" ? " 件待办" : " waiting"}</span>
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </nav>
  );
}
