import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import type { ChroniclePatch } from "@/lib/services/contracts";

/** POST ChroniclePatch → a new record in the annals (201), public at once. */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAccount({ admin: true });
    return ok(await getServices().chronicles.saveChronicle(null, await readJson<ChroniclePatch>(request)), 201);
  });
}
