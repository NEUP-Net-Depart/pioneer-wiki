import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import type { AssetDetails } from "@/lib/services/contracts";

/** PATCH AssetDetails — the owner describes a pending or rejected image (a rejected one returns to pending). */
export async function PATCH(request: Request, { params }: RouteContext<"/api/assets/[id]">) {
  return handle(async () => {
    await requireAccount({ author: true });
    const { id } = await params;
    return ok(await getServices().references.updateAssetDetails(id, await readJson<AssetDetails>(request)));
  });
}
