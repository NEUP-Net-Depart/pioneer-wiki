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
  const invalid = authInputError(input, "signup");
  if (invalid) return NextResponse.json({ error: invalid }, { status: 422 });

  const email = String(input.email).trim().toLowerCase();
  const password = String(input.password);
  const displayName = String(input.displayName).trim();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: new URL("/auth/callback?next=/account", request.url).toString(),
      data: { display_name: displayName },
    },
  });
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ needsVerification: !data.session, userId: data.user?.id ?? null }, { status: 201 });
}
