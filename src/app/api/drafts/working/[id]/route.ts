import { handle, ok, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";

/** DELETE — discards this account's working copy (after it was saved as a revision). */
export async function DELETE(_request: Request, { params }: RouteContext<"/api/drafts/working/[id]">) {
  return handle(async () => {
    await requireAccount({ author: true });
    const { id } = await params;
    await getServices().entries.deleteWorkingDraft(id);
    return ok({ ok: true });
  });
}
