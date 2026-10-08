import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import { ServiceError, type AssetDetails } from "@/lib/services/contracts";
import type { AssetReviewStatus } from "@/lib/model/types";

/** POST { decision: approved | rejected | pending, note?, details? } — the decision on an image. */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/assets/[id]">) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const { id } = await params;
    const input = await readJson<{ decision?: AssetReviewStatus; note?: string; details?: AssetDetails }>(request);
    if (!input.decision || !["approved", "rejected", "pending"].includes(input.decision))
      throw new ServiceError("invalid", "invalid_decision");
    return ok(await getServices().references.reviewAsset(id, input.decision, input.note, input.details));
  });
}
