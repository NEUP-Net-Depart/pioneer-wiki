import { NextRequest, NextResponse } from "next/server";
import { adminAccountOrResponse } from "@/lib/auth/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TABLES = {
  authors: "authors",
  sources: "sources",
  tags: "tags",
  assets: "assets",
  relations: "relations",
  links: "friend_links",
} as const;
type Kind = keyof typeof TABLES;

export async function POST(request: NextRequest, { params }: RouteContext<"/api/admin/references/[kind]">) {
  const gate = await adminAccountOrResponse();
  if ("response" in gate) return gate.response;
  if (!getSupabaseConfig())
    return NextResponse.json(
      { error: { code: "unavailable", message: "This operation requires Supabase." } },
      { status: 503 },
    );
  const { kind } = await params;
  if (!(kind in TABLES))
    return NextResponse.json({ error: { code: "invalid", message: "Unknown reference type." } }, { status: 422 });
  const row = (await request.json()) as Record<string, unknown>;
  const table = TABLES[kind as Kind];
  const client = await createSupabaseServerClient();
  const objectId = String(row.id ?? "");
  const previous = objectId ? await client.from(table).select("*").eq("id", objectId).maybeSingle() : { data: null };
  const { data, error } = await client.from(table).upsert(row).select().single();
  if (error) return NextResponse.json({ error: { code: "invalid", message: error.message } }, { status: 422 });
  await client.rpc("pw_audit_insert", {
    p_action: "upsert",
    p_object_type: kind,
    p_object_id: objectId,
    p_before: previous.data,
    p_after: data,
  });
  return NextResponse.json(data, { status: 201 });
}
