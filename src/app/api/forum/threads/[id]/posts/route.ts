import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { ServiceError } from "@/lib/services/contracts";
import { verifiedAccountOrResponse } from "@/lib/auth/server";

/** POST /api/forum/threads/[id]/posts { body } → ForumPost (201); 404 when the thread does not exist. Identity comes from the verified session. */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/forum/threads/[id]/posts">) {
  try {
    const { id } = await params;
    const input = (await request.json()) as { body?: string };
    const gate = await verifiedAccountOrResponse();
    if ("response" in gate) return gate.response;
    const { community } = getServices();
    const member = gate.account.authorId
      ? (await community.listMembers()).find((m) => m.authorId === gate.account.authorId)
      : undefined;
    const post = await community.reply({
      threadId: id,
      body: input.body ?? "",
      authorName: member?.name.zh || gate.account.name.zh,
      memberId: member?.id,
    });
    if (!post) return NextResponse.json({ error: { code: "not_found", message: "No such thread" } }, { status: 404 });
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    const e = error instanceof ServiceError ? error : new ServiceError("invalid", "Invalid post payload");
    return NextResponse.json(
      { error: { code: e.code, message: e.message } },
      { status: e.code === "invalid" ? 422 : 503 },
    );
  }
}
