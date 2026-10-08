import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import type { ApplicationKind } from "@/lib/model/types";

/** POST { kind, statement, handle? } — applies for author status, a member page, or both. */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAccount();
    const input = await readJson<{ kind?: ApplicationKind; statement?: string; handle?: string }>(request);
    return ok(
      await getServices().accounts.submitApplication({
        kind: input.kind ?? "author",
        statement: input.statement ?? "",
        handle: input.handle,
      }),
      201,
    );
  });
}
