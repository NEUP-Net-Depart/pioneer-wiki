import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import type { MemberCreateInput } from "@/lib/services/contracts";

/** POST MemberCreateInput → a new public member page (201). Bind it to an account from the account register. */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAccount({ admin: true });
    return ok(await getServices().community.createMember(await readJson<MemberCreateInput>(request)), 201);
  });
}
