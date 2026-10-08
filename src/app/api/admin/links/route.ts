import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import type { LinkPatch } from "@/lib/services/contracts";

/** POST LinkPatch → the new friend link (201), public at once. */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAccount({ admin: true });
    return ok(await getServices().community.saveLink(null, await readJson<LinkPatch>(request)), 201);
  });
}
