import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import type { ChroniclePatch } from "@/lib/services/contracts";

/** PATCH { patch, baseVersion? } → the saved record. */
export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/chronicles/[id]">) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const { id } = await params;
    const { patch, baseVersion } = await readJson<{ patch?: ChroniclePatch; baseVersion?: number }>(request);
    return ok(await getServices().chronicles.saveChronicle(id, patch ?? {}, baseVersion));
  });
}

/** POST { archived, reason? } — archives or restores the record. */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/chronicles/[id]">) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const { id } = await params;
    const { archived, reason } = await readJson<{ archived?: boolean; reason?: string }>(request);
    return ok(await getServices().chronicles.setChronicleArchived(id, archived !== false, reason));
  });
}
