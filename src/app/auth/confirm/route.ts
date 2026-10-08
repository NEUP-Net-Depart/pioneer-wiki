import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext, siteUrl } from "@/lib/http/site";
import { dataSource } from "@/lib/services";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TYPES = new Set<EmailOtpType>(["signup", "email", "recovery", "email_change", "invite", "magiclink"]);

/**
 * Where every email link lands (see supabase/templates). The token hash is
 * verified on the server, so a link works in any browser or device — unlike a
 * PKCE code, which needs the verifier cookie of the browser that asked.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type") as EmailOtpType | null;
  const tokenHash = params.get("token_hash");
  const fallback = type === "recovery" ? "/reset-password" : type === "email_change" ? "/account/security" : "/account";
  const next = safeNext(params.get("next"), fallback);
  let origin: string;
  try {
    origin = siteUrl(request);
  } catch {
    origin = request.nextUrl.origin;
  }
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
  if (dataSource() !== "supabase") return fail("supabase_required");
  if (!type || !TYPES.has(type) || !tokenHash) return fail("link_expired");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return fail("link_expired");
  const done = type === "email_change" ? `${next}${next.includes("?") ? "&" : "?"}email=changed` : next;
  return NextResponse.redirect(new URL(done, origin));
}
