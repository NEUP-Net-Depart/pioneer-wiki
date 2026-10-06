import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function POST(request: Request) {
  if (!getSupabaseConfig())
    return NextResponse.json(
      { error: { message: "Supabase is not configured for this environment." } },
      { status: 503 },
    );
  const input = (await request.json().catch(() => ({}))) as { password?: unknown; confirmPassword?: unknown };
  const password = typeof input.password === "string" ? input.password : "";
  if (password.length < 8 || password !== input.confirmPassword)
    return NextResponse.json(
      { error: { message: "Use matching passwords of at least 8 characters." } },
      { status: 422 },
    );
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ ok: true });
}
