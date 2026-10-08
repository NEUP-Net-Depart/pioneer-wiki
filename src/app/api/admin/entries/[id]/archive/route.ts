import { NextResponse } from "next/server";
import { adminAccountOrResponse } from "@/lib/auth/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: RouteContext<"/api/admin/entries/[id]/archive">) {
  const gate = await adminAccountOrResponse();
  if ("response" in gate) return gate.response;
  if (!getSupabaseConfig()) return NextResponse.json({ error: { code: "unavailable", message: "Archiving requires Supabase." } }, { status: 503 });
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("pw_archive_entry", { p_entry_id: id });
  if (error) return NextResponse.json({ error: { code: "unavailable", message: error.message } }, { status: error.code === "42501" ? 403 : 503 });
  if (!data) return NextResponse.json({ error: { code: "not_found", message: "No such entry" } }, { status: 404 });
  return NextResponse.json(data);
}
