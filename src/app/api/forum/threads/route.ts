import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { ServiceError, type NewThreadInput } from "@/lib/services/contracts";
import type { ForumCategory } from "@/lib/model/types";
import { verifiedAccountOrResponse } from "@/lib/auth/server";

const status = (e: ServiceError) =>
  e.code === "forbidden" ? 403 : e.code === "conflict" ? 409 : e.code === "unavailable" ? 503 : 422;

/** GET /api/forum/threads?category=&limit= → ForumThread[] (most recently active first). */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const threads = await getServices().community.listThreads({
    category: (p.get("category") as ForumCategory | null) ?? undefined,
    limit: p.has("limit") ? Number(p.get("limit")) : undefined,
  });
  return NextResponse.json(threads);
}

/** POST /api/forum/threads { title, body, category } → ForumThread (201). Identity comes from the verified session. */
export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as Partial<NewThreadInput>;
    const gate = await verifiedAccountOrResponse();
    if ("response" in gate) return gate.response;
    const { community } = getServices();
    const members = await community.listMembers();
    const member = gate.account.authorId ? members.find((m) => m.authorId === gate.account.authorId) : undefined;
    const thread = await community.createThread({
      title: input.title ?? "",
      body: input.body ?? "",
      category: input.category ?? "general",
      authorName: member?.name.zh || gate.account.name.zh,
      memberId: member?.id,
    });
    return NextResponse.json(thread, { status: 201 });
  } catch (error) {
    const e = error instanceof ServiceError ? error : new ServiceError("invalid", "Invalid thread payload");
    return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: status(e) });
  }
}
