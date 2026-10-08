import { handle, ok, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import { ServiceError } from "@/lib/services/contracts";
import { encodeImage } from "@/lib/media/store";

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : undefined;
};

/**
 * POST multipart { file, altZh, altEn, captionZh, captionEn, credit, license, sourceUrl }
 * → { asset } (201). The image is re-encoded, stored and recorded as pending
 * review; readers see it only once an administrator approves it.
 */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAccount({ author: true });
    const form = await request.formData().catch(() => {
      throw new ServiceError("invalid", "image_required");
    });
    const file = form.get("file");
    if (!(file instanceof File)) throw new ServiceError("invalid", "image_required");
    const image = await encodeImage(file);
    const asset = await getServices().references.uploadEntryAsset(image, {
      altZh: field(form, "altZh"),
      altEn: field(form, "altEn"),
      captionZh: field(form, "captionZh"),
      captionEn: field(form, "captionEn"),
      credit: field(form, "credit"),
      license: field(form, "license"),
      sourceUrl: field(form, "sourceUrl"),
    });
    return ok({ asset }, 201);
  });
}
