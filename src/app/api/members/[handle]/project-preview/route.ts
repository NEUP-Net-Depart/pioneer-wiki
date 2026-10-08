import { NextResponse } from "next/server";
import { handle } from "@/lib/http/route";
import { editableMember } from "@/lib/members/owner";
import { projectUrl } from "@/lib/members/project-validation";
import { importProjectPreview } from "@/lib/members/preview";

export const runtime = "nodejs";

/** Explicit import by the page's owner or an administrator; importing does not save or publish the draft. */
export async function POST(request: Request, { params }: RouteContext<"/api/members/[handle]/project-preview">) {
  return handle(async () => {
    const { handle: memberHandle } = await params;
    await editableMember(memberHandle);
    try {
      const input = await request.json();
      const preview = await importProjectPreview(projectUrl(input?.url));
      return NextResponse.json(preview, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "unavailable",
            reason: "preview_unavailable",
            message: "Preview unavailable. You can still describe and save this project manually.",
          },
        },
        { status: 422 },
      );
    }
  });
}
