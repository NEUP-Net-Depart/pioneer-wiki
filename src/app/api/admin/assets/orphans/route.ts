import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";

/** GET — stored files nothing references any more. */
export async function GET() {
  return handle(async () => {
    await requireAccount({ admin: true });
    return ok({ files: await getServices().references.listOrphanFiles() });
  });
}

/** DELETE { bucket, name } — removes one of them; a file that became referenced again is refused. */
export async function DELETE(request: Request) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const { bucket, name } = await readJson<{ bucket?: string; name?: string }>(request);
    await getServices().references.removeOrphanFile(String(bucket ?? ""), String(name ?? ""));
    return ok({ ok: true });
  });
}
