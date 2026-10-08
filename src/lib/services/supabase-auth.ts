import "server-only";
import { cache } from "react";
import type { Account, Author, Localized } from "@/lib/model/types";
import type { AuthAdapter } from "./contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileRow = {
  handle?: string | null;
  display_name_zh?: string | null;
  display_name_en?: string | null;
  sigil?: string | null;
  account_role?: string | null;
  account_status?: string | null;
  author_id?: string | null;
  member_id?: string | null;
  deletion_requested_at?: string | null;
};

type AuthorRow = {
  id: string;
  handle: string;
  name_zh: string;
  name_en: string;
  affiliation_zh?: string | null;
  affiliation_en?: string | null;
  role: Author["role"];
  sigil: string;
};

function localized(zh: string, en: string): Localized {
  return { zh, en };
}

function fallbackHandle(email: string): string {
  const base =
    email
      .split("@")[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "reader";
  return base.slice(0, 32);
}

/*
 * One identity lookup per request: getUser() verifies the session with the
 * Auth server, so pages and handlers that ask several times share the answer.
 */
const currentAccount = cache(async (): Promise<Account | null> => {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return null;
  }
  const { data: authData, error } = await supabase.auth.getUser();
  if (error || !authData.user || !authData.user.email) return null;

  const { data } = await supabase
    .from("profiles")
    .select(
      "handle, display_name_zh, display_name_en, sigil, account_role, account_status, author_id, member_id, deletion_requested_at",
    )
    .eq("id", authData.user.id)
    .maybeSingle();
  const profile = (data ?? {}) as ProfileRow;
  const metadata = (authData.user.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    typeof metadata.display_name === "string" && metadata.display_name.trim() ? metadata.display_name.trim() : "Reader";
  const status =
    profile.account_status === "suspended" || profile.account_status === "closed" ? profile.account_status : "active";

  return {
    id: authData.user.id,
    email: authData.user.email,
    handle: profile.handle?.trim() || fallbackHandle(authData.user.email),
    name: localized(profile.display_name_zh?.trim() || displayName, profile.display_name_en?.trim() || displayName),
    sigil: profile.sigil?.trim() || `account:${authData.user.id}`,
    // A suspended administrator is not an administrator.
    role: profile.account_role === "admin" && status === "active" ? "admin" : "reader",
    emailVerified: Boolean(authData.user.email_confirmed_at),
    status,
    authorId: (status === "active" && profile.author_id) || undefined,
    memberId: profile.member_id ?? undefined,
    closureRequestedAt: profile.deletion_requested_at ?? undefined,
  };
});

export function createSupabaseAuthAdapter(): AuthAdapter {
  return {
    getCurrentAccount: () => currentAccount(),

    async getCurrentUser(): Promise<Author | null> {
      const account = await currentAccount();
      if (!account?.authorId) return null;
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("authors")
        .select("id, handle, name_zh, name_en, affiliation_zh, affiliation_en, role, sigil")
        .eq("id", account.authorId)
        .maybeSingle();
      const author = data as AuthorRow | null;
      if (!author) return null;
      return {
        id: author.id,
        handle: author.handle,
        name: localized(author.name_zh, author.name_en),
        affiliation: localized(author.affiliation_zh ?? "", author.affiliation_en ?? ""),
        role: author.role,
        sigil: author.sigil,
      };
    },
  };
}
