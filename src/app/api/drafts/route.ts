import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import type { DraftInput } from "@/lib/services/contracts";

/**
 * POST (DraftInput without authorId) → the saved revision (201). Saving never
 * changes what readers see; saving over a submission withdraws it, and the
 * answer says so (withdrewReview).
 */
export async function POST(request: Request) {
  return handle(async () => {
    const account = await requireAccount({ author: true });
    const input = await readJson<Omit<DraftInput, "authorId">>(request);
    const revision = await getServices().entries.saveDraft({
      ...input,
      title: { zh: String(input.title?.zh ?? ""), en: String(input.title?.en ?? "") },
      summary: { zh: String(input.summary?.zh ?? ""), en: String(input.summary?.en ?? "") },
      body: String(input.body ?? ""),
      note: String(input.note ?? ""),
      authorId: account.authorId ?? "",
    });
    return ok(revision, 201);
  });
}
