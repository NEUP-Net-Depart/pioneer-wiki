import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import { ServiceError, type ReviewAction } from "@/lib/services/contracts";

const ACTIONS: ReviewAction[] = ["submit", "withdraw", "return", "publish", "rollback"];
const ADMIN_ACTIONS: ReviewAction[] = ["return", "publish", "rollback"];

/**
 * POST { action, expectedRevision?, targetRevisionId?, note? } → the new revision.
 * The database decides; these checks only answer early with the same reasons.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/entries/[id]/transition">) {
  return handle(async () => {
    const account = await requireAccount({ author: true });
    const { id } = await params;
    const input = await readJson<{
      action?: ReviewAction;
      expectedRevision?: number;
      targetRevisionId?: string;
      note?: string;
    }>(request);
    if (!input.action || !ACTIONS.includes(input.action)) throw new ServiceError("invalid", "invalid_action");
    if (ADMIN_ACTIONS.includes(input.action) && account.role !== "admin")
      throw new ServiceError("forbidden", "admin_required");
    return ok(
      await getServices().entries.transition({
        entryId: id,
        action: input.action,
        actorId: account.authorId ?? "",
        expectedRevision: typeof input.expectedRevision === "number" ? input.expectedRevision : undefined,
        targetRevisionId: input.targetRevisionId,
        note: input.note,
      }),
    );
  });
}
