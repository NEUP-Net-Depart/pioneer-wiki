"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/dictionary";

/** The four parts, with the relation graph promoted to a first-class destination. */
export const NAV_ITEMS: Array<{ href: string; key: MessageKey; match: (p: string) => boolean }> = [
  { href: "/", key: "nav.index", match: (p) => p === "/" || /^\/(domains|entries|editor)(\/|$)/.test(p) },
  { href: "/graph", key: "nav.graph", match: (p) => p.startsWith("/graph") },
  { href: "/links", key: "nav.links", match: (p) => p.startsWith("/links") },
  { href: "/members", key: "nav.members", match: (p) => p.startsWith("/members") },
  { href: "/forum", key: "nav.forum", match: (p) => p.startsWith("/forum") },
];

/**
 * Typed destinations. In the header row a single brick hairline marks where
 * the reader is and slides to the next destination when the page turns.
 */
export function NavLinks({
  orientation = "row",
  onNavigate,
}: {
  orientation?: "row" | "column";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const listRef = useRef<HTMLUListElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    if (orientation !== "row") return;
    const current = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    setBar(current ? { x: current.offsetLeft, w: current.offsetWidth } : null);
  }, [pathname, orientation, t]);

  return (
    <ul ref={listRef} className={cn("relative flex", orientation === "row" ? "items-center gap-6" : "flex-col gap-1")}>
      {NAV_ITEMS.map((item) => {
        const current = item.match(pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={current ? "page" : undefined}
              className={cn(
                "block no-underline transition-colors duration-(--dur-quick)",
                orientation === "row"
                  ? "py-1.5 font-display text-lead text-ink-2 hover:text-ink aria-[current=page]:text-ink aria-[current=page]:italic"
                  : "rounded-xs px-2 py-2 font-display text-h4 text-ink-2 hover:bg-ink/5 aria-[current=page]:text-ink aria-[current=page]:italic",
              )}
            >
              {t(item.key)}
            </Link>
          </li>
        );
      })}
      {orientation === "row" && bar ? (
        <li
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-px bg-brick transition-[transform,width] duration-(--dur-slow) ease-(--ease-grow)"
          style={{ width: bar.w, transform: `translateX(${bar.x}px)` }}
        />
      ) : null}
    </ul>
  );
}
