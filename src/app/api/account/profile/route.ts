import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import type { Localized } from "@/lib/model/types";

/** PATCH { name: { zh, en } } — the signed-in account's display name. */
export async function PATCH(request: Request) {
  return handle(async () => {
    await requireAccount({ verified: false });
    const { name } = await readJson<{ name?: Localized }>(request);
    return ok({ name: await getServices().accounts.updateOwnProfile({ zh: name?.zh ?? "", en: name?.en ?? "" }) });
  });
}
