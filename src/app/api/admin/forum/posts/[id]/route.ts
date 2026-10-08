import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import { ServiceError } from "@/lib/services/contracts";

/** POST { action: hide | restore, reason? } — moderates a reply. */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/forum/posts/[id]">) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const { id } = await params;
    const { action, reason } = await readJson<{ action?: string; reason?: string }>(request);
    if (action !== "hide" && action !== "restore") throw new ServiceError("invalid", "invalid_action");
    return ok(await getServices().community.moderatePost(id, action, reason));
  });
}
