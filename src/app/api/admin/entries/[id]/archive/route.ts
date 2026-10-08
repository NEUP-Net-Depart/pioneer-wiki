import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";

/** POST { archived?: boolean = true, reason? } — archives or restores an entry; history and links stay. */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/entries/[id]/archive">) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const { id } = await params;
    const input = await readJson<{ archived?: boolean; reason?: string }>(request).catch(() => ({}) as { archived?: boolean; reason?: string });
    return ok(await getServices().entries.setArchived(id, input.archived !== false, input.reason));
  });
}
