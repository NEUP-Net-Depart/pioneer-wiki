"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { Account, Author, Member } from "@/lib/model/types";
import { useI18n } from "@/lib/i18n/client";
import { AuthorSigil } from "@/components/archive/AuthorSigil";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The account menu: only what this account can actually open — its record,
 * its entries when it writes, its page when it has one, the office when it
 * administers — and a sign-out that clears the session before leaving.
 */
export function UserMenu({ account, me }: { account: Account | null; user: Author | null; me?: Member | null }) {
  const { t, pick, lang } = useI18n();
  const zh = lang === "zh";
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  if (!account)
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className="pw-link inline-flex min-h-11 items-center text-small text-ink-2"
      >
        {t("user.signIn")}
      </Link>
    );
  const displayName = pick(account.name);
  const writes = (account.status ?? "active") === "active" && (Boolean(account.authorId) || account.role === "admin");
  const signOut = async () => {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/");
    router.refresh();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-11 items-center justify-center rounded-full"
        aria-label={`${t("user.menu")} — ${displayName}`}
      >
        <AuthorSigil seed={account.sigil} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-small text-ink">{displayName}</span>
          <span className="font-mono text-meta font-normal text-ink-3">
            {account.role === "admin"
              ? zh
                ? "管理员"
                : "Administrator"
              : account.authorId
                ? zh
                  ? "作者"
                  : "Author"
                : zh
                  ? "读者"
                  : "Reader"}
            {account.status === "suspended"
              ? zh
                ? " · 已停用"
                : " · suspended"
              : !account.emailVerified
                ? zh
                  ? " · 未验证"
                  : " · unverified"
                : ""}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">{t("user.account")}</Link>
        </DropdownMenuItem>
        {writes ? (
          <DropdownMenuItem asChild>
            <Link href="/account/entries">{zh ? "我的文章" : "My entries"}</Link>
          </DropdownMenuItem>
        ) : null}
        {writes ? (
          <DropdownMenuItem asChild>
            <Link href="/editor/new">{t("nav.create")}</Link>
          </DropdownMenuItem>
        ) : null}
        {me ? (
          <DropdownMenuItem asChild>
            <Link href={`/members/${me.handle}`}>{zh ? "我的主页" : "My page"}</Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link href="/account/identity">{zh ? "申请作者或主页" : "Apply to write or for a page"}</Link>
          </DropdownMenuItem>
        )}
        {account.role === "admin" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin">{t("user.admin")}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/review">{zh ? "审核队列" : "Review queue"}</Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
          disabled={busy}
        >
          {busy ? (zh ? "正在退出…" : "Signing out…") : t("user.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
