import { NextResponse } from "next/server";
import { verifiedAccountOrResponse } from "@/lib/auth/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: RouteContext<"/api/drafts/working/[id]">) {
  const gate = await verifiedAccountOrResponse();
  if ("response" in gate) return gate.response;
  if (!getSupabaseConfig()) return NextResponse.json({ draft: null, localOnly: true });
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("entry_working_drafts")
    .select("id, entry_id, base_revision, payload, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: { code: "unavailable", message: error.message } }, { status: 503 });
  return NextResponse.json({ draft: data ?? null });
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/drafts/working/[id]">) {
  const gate = await verifiedAccountOrResponse();
  if ("response" in gate) return gate.response;
  if (!getSupabaseConfig()) return NextResponse.json({ ok: true });
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const { error } = await client.from("entry_working_drafts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: { code: "unavailable", message: error.message } }, { status: 503 });
  return NextResponse.json({ ok: true });
}
