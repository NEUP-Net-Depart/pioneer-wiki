import { NextResponse } from "next/server";
import { handle } from "@/lib/http/route";
import { dataSource } from "@/lib/services";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Signs this browser out: its refresh token is revoked and the auth cookies are cleared. */
export async function POST() {
  return handle(async () => {
    if (dataSource() !== "supabase") return NextResponse.json({ ok: true });
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.json({ ok: true });
  });
}
