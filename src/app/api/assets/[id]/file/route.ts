import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";

/**
 * GET — an uploaded article image, read with the caller's session. Approved
 * images are public and cached for a year (every upload has a new name); a
 * pending or rejected one is served only to its owner and administrators,
 * and never cached.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/assets/[id]/file">) {
  const { id } = await params;
  try {
    const file = await getServices().references.readAssetFile(id);
    if (!file) return NextResponse.json({ error: { code: "not_found", reason: "asset_not_found" } }, { status: 404 });
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "content-type": "image/webp",
        "cache-control": file.cacheable ? "public, max-age=31536000, immutable" : "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: { code: "unavailable", reason: "unavailable" } }, { status: 503 });
  }
}
