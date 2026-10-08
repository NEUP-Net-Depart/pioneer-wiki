import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";

/** POST { archived, reason? } — hides or restores a member page; the account and its binding are untouched. */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/members/[handle]/archive">) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const { handle: memberHandle } = await params;
    const { archived, reason } = await readJson<{ archived?: boolean; reason?: string }>(request);
    return ok(await getServices().community.setMemberArchived(memberHandle, archived !== false, reason));
  });
}
