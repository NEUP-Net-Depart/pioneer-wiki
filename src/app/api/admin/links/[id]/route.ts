import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import type { LinkPatch } from "@/lib/services/contracts";

/** PATCH { patch, baseVersion? } → the saved link. */
export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/links/[id]">) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const { id } = await params;
    const { patch, baseVersion } = await readJson<{ patch?: LinkPatch; baseVersion?: number }>(request);
    return ok(await getServices().community.saveLink(id, patch ?? {}, baseVersion));
  });
}

/** POST { archived, reason? } — archives or restores the link. */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/links/[id]">) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const { id } = await params;
    const { archived, reason } = await readJson<{ archived?: boolean; reason?: string }>(request);
    return ok(await getServices().community.setLinkArchived(id, archived !== false, reason));
  });
}
