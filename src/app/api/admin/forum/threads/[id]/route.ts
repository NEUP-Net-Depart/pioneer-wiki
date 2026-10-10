import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import { ServiceError } from "@/lib/services/contracts";

/** POST { action: archive | unarchive | hide | restore | lock | unlock, reason? } — moderates a thread. */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/forum/threads/[id]">) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const { id } = await params;
    const { action, reason } = await readJson<{ action?: string; reason?: string }>(request);
    if (
      action !== "hide" &&
      action !== "restore" &&
      action !== "archive" &&
      action !== "unarchive" &&
      action !== "lock" &&
      action !== "unlock"
    )
      throw new ServiceError("invalid", "invalid_action");
    return ok(await getServices().community.moderateThread(id, action, reason));
  });
}
