import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import { ServiceError } from "@/lib/services/contracts";

type Input =
  | { action: "set_role"; role: "reader" | "admin"; reason?: string }
  | { action: "set_status"; status: "active" | "suspended"; reason?: string }
  | { action: "set_identity"; authorId?: string | null; memberId?: string | null; reason?: string }
  | { action: "close"; note?: string };

/**
 * POST { action, … } — one administrative change to an account. Each is a
 * single audited database transaction; the last active administrator can
 * never be demoted, suspended or closed.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/accounts/[id]">) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const { id } = await params;
    const input = await readJson<Input>(request);
    const { accounts } = getServices();
    switch (input.action) {
      case "set_role":
        await accounts.setRole(id, input.role, input.reason);
        break;
      case "set_status":
        await accounts.setStatus(id, input.status, input.reason);
        break;
      case "set_identity": {
        const patch: { authorId?: string | null; memberId?: string | null } = {};
        if ("authorId" in input) patch.authorId = input.authorId || null;
        if ("memberId" in input) patch.memberId = input.memberId || null;
        await accounts.setIdentity(id, patch, input.reason);
        break;
      }
      case "close":
        await accounts.closeAccount(id, input.note);
        break;
      default:
        throw new ServiceError("invalid", "invalid_action");
    }
    return ok({ ok: true });
  });
}
