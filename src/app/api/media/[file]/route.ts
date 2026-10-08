import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";

/** GET /api/media/[file] — a stored member page image (immutable: every upload gets a new name). */
export async function GET(_request: Request, { params }: RouteContext<"/api/media/[file]">) {
  const { file } = await params;
  const data = await getServices()
    .community.readMemberImage(file)
    .catch(() => null);
  if (!data) return NextResponse.json({ error: { code: "not_found", reason: "not_found" } }, { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" },
  });
}
