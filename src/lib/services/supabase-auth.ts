import "server-only";
import type { Account, Author, Localized } from "@/lib/model/types";
import type { AuthAdapter } from "./contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileRow = {
  handle?: string | null;
  display_name_zh?: string | null;
  display_name_en?: string | null;
  sigil?: string | null;
  account_role?: string | null;
  author_id?: string | null;
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

function sigilFor(id: string): string {
  return `account:${id}`;
}

export function createSupabaseAuthAdapter(): AuthAdapter {
  return {
    async getCurrentAccount(): Promise<Account | null> {
      const supabase = await createSupabaseServerClient();
      const { data: authData, error } = await supabase.auth.getUser();
      if (error || !authData.user || !authData.user.email) return null;

      const { data } = await supabase
        .from("profiles")
        .select("handle, display_name_zh, display_name_en, sigil, account_role, author_id")
        .eq("id", authData.user.id)
        .maybeSingle();
      const profile = (data ?? {}) as ProfileRow;
      const metadata = (authData.user.user_metadata ?? {}) as Record<string, unknown>;
      const displayName =
        typeof metadata.display_name === "string" && metadata.display_name.trim()
          ? metadata.display_name.trim()
          : "Reader";
      const role = profile.account_role === "admin" ? "admin" : "reader";

      return {
        id: authData.user.id,
        email: authData.user.email,
        handle: profile.handle?.trim() || fallbackHandle(authData.user.email),
        name: localized(profile.display_name_zh?.trim() || displayName, profile.display_name_en?.trim() || displayName),
        sigil: profile.sigil?.trim() || sigilFor(authData.user.id),
        role,
        emailVerified: Boolean(authData.user.email_confirmed_at),
        authorId: profile.author_id ?? undefined,
      };
    },

    async getCurrentUser(): Promise<Author | null> {
      const supabase = await createSupabaseServerClient();
      const { data: authData, error } = await supabase.auth.getUser();
      if (error || !authData.user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("author_id")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (!profile?.author_id) return null;
      const { data } = await supabase
        .from("authors")
        .select("id, handle, name_zh, name_en, affiliation_zh, affiliation_en, role, sigil")
        .eq("id", profile.author_id)
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
