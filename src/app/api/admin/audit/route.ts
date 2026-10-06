import { NextResponse } from "next/server";
import { adminAccountOrResponse } from "@/lib/auth/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const gate = await adminAccountOrResponse();
  if ("response" in gate) return gate.response;
  if (!getSupabaseConfig()) return NextResponse.json({ logs: [] });
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: { code: "unavailable", message: error.message } }, { status: 503 });
  return NextResponse.json({ logs: data ?? [] });
}
