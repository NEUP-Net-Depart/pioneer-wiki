import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";

/** POST { reason? } — asks administrators to close this account. Repeating it keeps the first request. */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAccount({ verified: false });
    const { reason } = await readJson<{ reason?: string }>(request).catch(() => ({ reason: undefined }));
    return ok(await getServices().accounts.requestClosure(reason));
  });
}

/** DELETE — withdraws the closure request while it is still waiting. */
export async function DELETE() {
  return handle(async () => {
    await requireAccount({ verified: false });
    await getServices().accounts.cancelClosure();
    return ok({ requestedAt: null });
  });
}
