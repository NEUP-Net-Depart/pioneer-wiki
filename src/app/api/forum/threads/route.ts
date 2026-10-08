import type { NextRequest } from "next/server";
import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import type { NewThreadInput } from "@/lib/services/contracts";
import type { ForumCategory } from "@/lib/model/types";

/** GET /api/forum/threads?category=&limit= → ForumThread[] (most recently active first). */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const p = request.nextUrl.searchParams;
    return ok(
      await getServices().community.listThreads({
        category: (p.get("category") as ForumCategory | null) ?? undefined,
        limit: p.has("limit") ? Math.min(200, Math.max(1, Number(p.get("limit")) || 100)) : undefined,
      }),
    );
  });
}

/**
 * POST { title, body, category } → ForumThread (201). The signature comes
 * from the session (the database derives it); the fixtures use the bound page.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const account = await requireAccount();
    const input = await readJson<Partial<NewThreadInput>>(request);
    const { community } = getServices();
    const member = account.memberId ? await community.getMember(account.memberId) : null;
    const thread = await community.createThread({
      title: input.title ?? "",
      body: input.body ?? "",
      category: input.category ?? "general",
      authorName: member?.name.zh || account.name.zh,
      memberId: member?.id,
    });
    return ok(thread, 201);
  });
}
