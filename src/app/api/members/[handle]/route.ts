import { handle, ok, readJson } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import type { MemberAdminPatch } from "@/lib/services/contracts";
import { editableMember } from "@/lib/members/owner";

/**
 * PATCH { patch, baseVersion? } (or a bare MemberPatch) → Member. The member
 * edits their own page, public at once; administrators may edit any page and
 * also its handle, joining date, sample stamp and author attribution.
 */
export async function PATCH(request: Request, { params }: RouteContext<"/api/members/[handle]">) {
  return handle(async () => {
    const { handle: memberHandle } = await params;
    const { member } = await editableMember(memberHandle);
    const body = await readJson<{ patch?: MemberAdminPatch; baseVersion?: number } & MemberAdminPatch>(request);
    const patch = body.patch ?? body;
    return ok(
      await getServices().community.updateMember(
        member.handle,
        patch,
        typeof body.baseVersion === "number" ? body.baseVersion : undefined,
      ),
    );
  });
}
