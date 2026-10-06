import { NextRequest, NextResponse } from "next/server";
import { adminAccountOrResponse } from "@/lib/auth/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/admin/accounts/[id]/bind">) {
  const gate = await adminAccountOrResponse();
  if ("response" in gate) return gate.response;
  if (!getSupabaseConfig())
    return NextResponse.json(
      { error: { code: "unavailable", message: "Account binding requires Supabase." } },
      { status: 503 },
    );
  const { id } = await params;
  const body = (await request.json()) as { authorId?: string | null; memberId?: string | null };
  const client = await createSupabaseServerClient();
  const before = await client.from("profiles").select("id, author_id, member_id").eq("id", id).maybeSingle();
  if (body.authorId !== undefined) {
    const { error } = await client.rpc("pw_bind_author", { target_user: id, target_author: body.authorId });
    if (error) return NextResponse.json({ error: { code: "invalid", message: error.message } }, { status: 422 });
  }
  if (body.memberId !== undefined) {
    const { error } = await client.rpc("pw_bind_member", { target_user: id, target_member: body.memberId });
    if (error) return NextResponse.json({ error: { code: "invalid", message: error.message } }, { status: 422 });
  }
  const after = await client.from("profiles").select("id, author_id, member_id").eq("id", id).maybeSingle();
  await client.rpc("pw_audit_insert", {
    p_action: "bind_identity",
    p_object_type: "profile",
    p_object_id: id,
    p_before: before.data,
    p_after: after.data,
  });
  return NextResponse.json({ ok: true });
}
