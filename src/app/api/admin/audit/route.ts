import type { NextRequest } from "next/server";
import { handle, ok, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";

/** GET ?type=&id=&action=&offset= → one page of audit events, newest first. */
export async function GET(request: NextRequest) {
  return handle(async () => {
    await requireAccount({ admin: true });
    const p = request.nextUrl.searchParams;
    return ok(
      await getServices().audit.listAudit({
        objectType: p.get("type") ?? undefined,
        objectId: p.get("id") ?? undefined,
        action: p.get("action") ?? undefined,
        limit: 50,
        offset: Math.max(0, Number(p.get("offset")) || 0),
      }),
    );
  });
}
