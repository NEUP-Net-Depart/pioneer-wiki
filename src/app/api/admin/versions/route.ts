import type { NextRequest } from "next/server";
import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import { ServiceError } from "@/lib/services/contracts";
import type { ContentVersion } from "@/lib/model/types";

const KINDS: Array<ContentVersion["kind"]> = ["member", "link", "chronicle"];
const kindOf = (value: unknown): ContentVersion["kind"] => {
  if (!KINDS.includes(value as ContentVersion["kind"])) throw new ServiceError("invalid", "invalid_kind");
  return value as ContentVersion["kind"];
};

/** GET ?kind=&id= — saved versions of a member page, link or chronicle, newest first. */
export async function GET(request: NextRequest) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const p = request.nextUrl.searchParams;
    return ok({
      versions: await getServices().community.listVersions(kindOf(p.get("kind")), String(p.get("id") ?? "")),
    });
  });
}

/** POST { kind, id, number } — makes an older version current again, as a new version. */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const input = await readJson<{ kind?: string; id?: string; number?: number }>(request);
    await getServices().community.restoreVersion(kindOf(input.kind), String(input.id ?? ""), Number(input.number));
    return ok({ ok: true });
  });
}
