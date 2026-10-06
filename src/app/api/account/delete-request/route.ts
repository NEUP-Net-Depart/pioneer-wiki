import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const account = await getServices().auth.getCurrentAccount();
  if (!account) return NextResponse.json({ error: { message: "Sign in to continue." } }, { status: 401 });
  if (!getSupabaseConfig()) return NextResponse.json({ ok: true, mock: true });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq("id", account.id);
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ ok: true });
}
