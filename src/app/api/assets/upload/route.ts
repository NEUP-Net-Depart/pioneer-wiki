import { NextRequest, NextResponse } from "next/server";
import { saveEntryImage } from "@/lib/media/store";
import { verifiedAccountOrResponse } from "@/lib/auth/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const clean = (value: FormDataEntryValue | null, fallback: string) =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

export async function POST(request: NextRequest) {
  const gate = await verifiedAccountOrResponse();
  if ("response" in gate) return gate.response;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: { code: "invalid", message: "Choose an image file." } }, { status: 422 });
  try {
    const saved = await saveEntryImage(file);
    const asset = {
      id: `asset-${crypto.randomUUID()}`,
      src: saved.src,
      width: saved.width,
      height: saved.height,
      alt: {
        zh: clean(form.get("altZh"), "待补充插图说明"),
        en: clean(form.get("altEn"), "Illustration awaiting description"),
      },
      credit: clean(form.get("credit"), gate.account.handle),
      license: clean(form.get("license"), "CC BY 4.0"),
    };
    if (getSupabaseConfig()) {
      const client = await createSupabaseServerClient();
      const { error } = await client.from("assets").insert({
        id: asset.id,
        src: asset.src,
        width: asset.width,
        height: asset.height,
        alt_zh: asset.alt.zh,
        alt_en: asset.alt.en,
        credit: asset.credit,
        license: asset.license,
        owner_id: gate.account.id,
        review_status: "pending",
      });
      if (error) return NextResponse.json({ error: { code: "unavailable", message: error.message } }, { status: 503 });
    }
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "invalid", message: error instanceof Error ? error.message : "Upload failed" } },
      { status: 422 },
    );
  }
}
