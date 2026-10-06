import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function POST(request: Request) {
  if (!getSupabaseConfig())
    return NextResponse.json(
      { error: { message: "Supabase is not configured for this environment." } },
      { status: 503 },
    );
  const input = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!/^\S+@\S+\.\S+$/.test(email))
    return NextResponse.json({ error: { message: "Enter a valid email address." } }, { status: 422 });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL("/auth/callback?next=/reset-password", request.url).toString(),
  });
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ ok: true });
}
