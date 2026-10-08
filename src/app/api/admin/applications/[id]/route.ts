import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import { ServiceError, type IdentityChoice } from "@/lib/services/contracts";

/**
 * POST { decision: approved | rejected, reason?, author?, member? } — decides
 * an application. Approval creates or picks the author and the page and binds
 * them in the same transaction; deciding twice is refused.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/applications/[id]">) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const { id } = await params;
    const input = await readJson<{
      decision?: "approved" | "rejected";
      reason?: string;
      author?: IdentityChoice | null;
      member?: IdentityChoice | null;
    }>(request);
    if (input.decision !== "approved" && input.decision !== "rejected")
      throw new ServiceError("invalid", "invalid_decision");
    return ok(
      await getServices().accounts.decideApplication(id, input.decision, {
        reason: input.reason,
        author: input.author ?? null,
        member: input.member ?? null,
      }),
    );
  });
}
