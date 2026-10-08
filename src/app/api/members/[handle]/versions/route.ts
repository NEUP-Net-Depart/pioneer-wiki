import { handle, ok, readJson } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import { editableMember } from "@/lib/members/owner";

/** GET — the page's saved versions, newest first (its owner and administrators). */
export async function GET(_request: Request, { params }: RouteContext<"/api/members/[handle]/versions">) {
  return handle(async () => {
    const { handle: memberHandle } = await params;
    const { member } = await editableMember(memberHandle);
    return ok({ versions: await getServices().community.listVersions("member", member.id) });
  });
}

/** POST { number } — makes an older version current again, as a new version. */
export async function POST(request: Request, { params }: RouteContext<"/api/members/[handle]/versions">) {
  return handle(async () => {
    const { handle: memberHandle } = await params;
    const { member } = await editableMember(memberHandle);
    const { number } = await readJson<{ number?: number }>(request);
    await getServices().community.restoreVersion("member", member.id, Number(number));
    return ok({ ok: true });
  });
}
