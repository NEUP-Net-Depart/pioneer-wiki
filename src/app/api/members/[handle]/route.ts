import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { ServiceError } from "@/lib/services/contracts";
import type { MemberPatch } from "@/lib/model/types";
import { ownerOf } from "@/lib/members/owner";

/** PATCH /api/members/[handle] (MemberPatch) → Member. Only the member themselves may edit their page. */
export async function PATCH(request: NextRequest, { params }: RouteContext<"/api/members/[handle]">) {
  const { handle } = await params;
  const denied = await ownerOf(handle);
  if (denied) return denied;
  try {
    const patch = (await request.json()) as MemberPatch;
    const member = await getServices().community.updateMember(handle, patch);
    if (!member) return NextResponse.json({ error: { code: "not_found", message: "No such member" } }, { status: 404 });
    return NextResponse.json(member);
  } catch (error) {
    const e = error instanceof ServiceError ? error : new ServiceError("invalid", "Invalid page edit");
    return NextResponse.json(
      { error: { code: e.code, message: e.message } },
      { status: e.code === "invalid" ? 422 : 503 },
    );
  }
}
