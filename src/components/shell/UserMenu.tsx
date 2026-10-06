"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Account, Author } from "@/lib/model/types";
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

export function UserMenu({ account, user }: { account: Account | null; user: Author | null }) {
  const { t, pick } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!account)
    return (
      <Link href="/login" className="pw-link text-small text-ink-2">
        {t("user.signIn")}
      </Link>
    );
  const displayName = pick(account.name);
  const signOut = async () => {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    router.push("/");
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-9 items-center justify-center rounded-full"
        aria-label={`${t("user.menu")} — ${displayName}`}
      >
        <AuthorSigil seed={account.sigil} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-small text-ink">{displayName}</span>
          <span className="font-mono text-meta font-normal text-ink-3">@{account.handle}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {account.authorId ? (
          <DropdownMenuItem asChild>
            <Link href={`/search?status=draft&author=${account.authorId}`}>{t("user.drafts")}</Link>
          </DropdownMenuItem>
        ) : null}
        {user?.role === "reviewer" || user?.role === "editor" ? (
          <DropdownMenuItem asChild>
            <Link href="/search?status=in_review">{t("user.reviews")}</Link>
          </DropdownMenuItem>
        ) : null}
        {account.role === "admin" ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">{t("user.admin")}</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/account">{t("user.account")}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
          disabled={busy}
        >
          {t("user.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
