import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";

/** POST { slug } — gives an entry a new address; the old one keeps redirecting. */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/entries/[id]/slug">) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const { id } = await params;
    const { slug } = await readJson<{ slug?: string }>(request);
    return ok(await getServices().entries.renameSlug(id, String(slug ?? "")));
  });
}
