import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { ServiceError } from "@/lib/services/contracts";
import { removeImage, saveImage } from "@/lib/media/store";
import { ownerOf } from "@/lib/members/owner";

/** POST /api/members/[handle]/cover (multipart: file, print=original|ink) → Member, with the new page image. */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/members/[handle]/cover">) {
  const { handle } = await params;
  const denied = await ownerOf(handle);
  if (denied) return denied;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ServiceError("invalid", "Choose an image to upload");
    const print = form.get("print") === "ink" ? "ink" : "original";
    const { community } = getServices();
    const before = await community.getMember(handle);
    const saved = await saveImage(file);
    const member = await community.setMemberCover(handle, { ...saved, print });
    await removeImage(before?.cover?.src);
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    const e = error instanceof ServiceError ? error : new ServiceError("invalid", "Upload failed");
    return NextResponse.json(
      { error: { code: e.code, message: e.message } },
      { status: e.code === "invalid" ? 422 : 503 },
    );
  }
}

/** DELETE /api/members/[handle]/cover → Member, without a page image (the marbled endpaper returns). */
export async function DELETE(_request: NextRequest, { params }: RouteContext<"/api/members/[handle]/cover">) {
  const { handle } = await params;
  const denied = await ownerOf(handle);
  if (denied) return denied;
  const { community } = getServices();
  const before = await community.getMember(handle);
  const member = await community.setMemberCover(handle, null);
  await removeImage(before?.cover?.src);
  return NextResponse.json(member);
}
