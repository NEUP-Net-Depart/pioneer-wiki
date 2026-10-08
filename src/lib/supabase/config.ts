export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/*
 * Read at run time. `next build` inlines every literal
 * `process.env.NEXT_PUBLIC_*` reference — in server code too — so a prebuilt
 * image would keep whatever the build machine had (usually nothing). Reading
 * through a variable is never inlined, which lets one image serve any
 * deployment's `.env`. SUPABASE_URL / SUPABASE_ANON_KEY are the preferred
 * names; the NEXT_PUBLIC_ ones remain for existing `.env` files.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  const env = process.env;
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const anonKey = (env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

export function hasSupabaseEnv(): boolean {
  return Boolean(getSupabaseConfig());
}
