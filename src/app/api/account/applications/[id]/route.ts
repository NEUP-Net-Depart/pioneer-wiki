import { handle, ok, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";

/** DELETE — withdraws one's own pending application. */
export async function DELETE(_request: Request, { params }: RouteContext<"/api/account/applications/[id]">) {
  return handle(async () => {
    await requireAccount({ verified: false });
    const { id } = await params;
    return ok(await getServices().accounts.withdrawApplication(id));
  });
}
