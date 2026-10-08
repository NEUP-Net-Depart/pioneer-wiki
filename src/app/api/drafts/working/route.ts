import type { NextRequest } from "next/server";
import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import type { WorkingDraftSave } from "@/lib/services/contracts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET ?entryId= | ?id= → this account's autosaved working copy, or null. */
export async function GET(request: NextRequest) {
  return handle(async () => {
    await requireAccount({ author: true });
    const params = request.nextUrl.searchParams;
    const id = params.get("id");
    const draft = await getServices().entries.getWorkingDraft({
      id: id && UUID.test(id) ? id : undefined,
      entryId: params.get("entryId") ?? undefined,
    });
    return ok({ draft });
  });
}

/**
 * POST { id?, entryId?, baseRevision?, payload, knownVersion? } → { conflict, id, version, savedAt }.
 * A newer copy saved elsewhere is returned (conflict: true), never overwritten.
 */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAccount({ author: true });
    const input = await readJson<WorkingDraftSave>(request);
    return ok(
      await getServices().entries.saveWorkingDraft({
        id: input.id && UUID.test(input.id) ? input.id : undefined,
        entryId: input.entryId || undefined,
        baseRevision: typeof input.baseRevision === "number" ? input.baseRevision : undefined,
        payload: input.payload && typeof input.payload === "object" ? input.payload : {},
        knownVersion: typeof input.knownVersion === "number" ? input.knownVersion : undefined,
      }),
    );
  });
}
