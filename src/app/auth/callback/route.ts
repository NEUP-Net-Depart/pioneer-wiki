import { NextResponse, type NextRequest } from "next/server";
import { safeNext, siteUrl } from "@/lib/http/site";
import { dataSource } from "@/lib/services";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** PKCE code exchange, kept for links sent before the token-hash templates (/auth/confirm). */
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  let origin: string;
  try {
    origin = siteUrl(request);
  } catch {
    origin = request.nextUrl.origin;
  }
  if (dataSource() !== "supabase") return NextResponse.redirect(new URL("/login?error=supabase_required", origin));
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=link_expired", origin));
  }
  return NextResponse.redirect(new URL(next, origin));
}
