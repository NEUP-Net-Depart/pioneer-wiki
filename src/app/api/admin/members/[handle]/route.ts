import { NextRequest, NextResponse } from "next/server";
import type { MemberPatch } from "@/lib/model/types";
import { adminAccountOrResponse } from "@/lib/auth/admin";
import { getServices } from "@/lib/services";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: RouteContext<"/api/admin/members/[handle]">) {
  const gate = await adminAccountOrResponse();
  if ("response" in gate) return gate.response;
  const { handle } = await params;
  const before = await getServices().community.getMember(handle);
  const member = await getServices().community.updateMember(handle, (await request.json()) as MemberPatch);
  if (!member) return NextResponse.json({ error: { code: "not_found", message: "No such member" } }, { status: 404 });
  if (getSupabaseConfig()) {
    const client = await createSupabaseServerClient();
    await client.rpc("pw_audit_insert", {
      p_action: "update",
      p_object_type: "member",
      p_object_id: member.id,
      p_before: before,
      p_after: member,
    });
  }
  return NextResponse.json(member);
}
