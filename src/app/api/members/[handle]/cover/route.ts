import { handle, ok } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import { ServiceError } from "@/lib/services/contracts";
import { encodeImage } from "@/lib/media/store";
import { editableMember } from "@/lib/members/owner";

/** POST multipart { file, print = original | ink } → Member with the new page image (201). */
export async function POST(request: Request, { params }: RouteContext<"/api/members/[handle]/cover">) {
  return handle(async () => {
    const { handle: memberHandle } = await params;
    const { member } = await editableMember(memberHandle);
    const form = await request.formData().catch(() => {
      throw new ServiceError("invalid", "image_required");
    });
    const file = form.get("file");
    if (!(file instanceof File)) throw new ServiceError("invalid", "image_required");
    const image = await encodeImage(file);
    const print = form.get("print") === "ink" ? "ink" : "original";
    return ok(await getServices().community.uploadMemberCover(member.handle, image, print), 201);
  });
}

/** DELETE → Member without a page image (the marbled endpaper returns). */
export async function DELETE(_request: Request, { params }: RouteContext<"/api/members/[handle]/cover">) {
  return handle(async () => {
    const { handle: memberHandle } = await params;
    const { member } = await editableMember(memberHandle);
    return ok(await getServices().community.removeMemberCover(member.handle));
  });
}
