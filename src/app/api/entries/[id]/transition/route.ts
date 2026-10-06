import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { ServiceError, type ReviewAction } from "@/lib/services/contracts";
import { verifiedAccountOrResponse } from "@/lib/auth/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await verifiedAccountOrResponse();
    if ("response" in gate) return gate.response;
    if (!gate.account.authorId)
      return NextResponse.json(
        { error: { code: "forbidden", message: "An administrator must bind you to a wiki author before editing." } },
        { status: 403 },
      );
    const { id } = await params;
    const input = (await request.json()) as { action: ReviewAction; targetRevisionId?: string; note?: string };
    if ((input.action === "publish" || input.action === "rollback") && gate.account.role !== "admin") {
      return NextResponse.json(
        { error: { code: "forbidden", message: "Only administrators can publish or roll back entries." } },
        { status: 403 },
      );
    }
    if (input.action === "submit") {
      const entry = await getServices().entries.getEntryById(id);
      const body = entry?.body ?? "";
      const missing =
        [entry?.title.zh, entry?.title.en, entry?.summary.zh, entry?.summary.en].some((value) => !value?.trim()) ||
        !body.includes(":::zh") ||
        !body.includes(":::en");
      if (missing)
        return NextResponse.json(
          {
            error: {
              code: "invalid",
              message: "A submission needs bilingual title, summary and :::zh / :::en body blocks.",
            },
          },
          { status: 422 },
        );
    }
    const revision = await getServices().entries.transition({ entryId: id, actorId: gate.account.authorId, ...input });
    return NextResponse.json(revision);
  } catch (error) {
    const serviceError =
      error instanceof ServiceError ? error : new ServiceError("invalid", "Invalid transition payload");
    const status =
      serviceError.code === "forbidden"
        ? 403
        : serviceError.code === "conflict"
          ? 409
          : serviceError.code === "unavailable"
            ? 503
            : 422;
    return NextResponse.json({ error: { code: serviceError.code, message: serviceError.message } }, { status });
  }
}
