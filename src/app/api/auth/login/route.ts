import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { authInputError } from "@/lib/auth/validation";

export async function POST(request: Request) {
  if (!getSupabaseConfig())
    return NextResponse.json(
      { error: { message: "Supabase is not configured for this environment." } },
      { status: 503 },
    );
  const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const invalid = authInputError(input, "login");
  if (invalid) return NextResponse.json({ error: invalid }, { status: 422 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(input.email).trim().toLowerCase(),
    password: String(input.password),
  });
  if (error || !data.user)
    return NextResponse.json({ error: { message: "Email or password is incorrect." } }, { status: 401 });
  if (!data.user.email_confirmed_at) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: { message: "Verify your email before signing in.", code: "email_not_verified" } },
      { status: 403 },
    );
  }
  return NextResponse.json({ ok: true });
}
