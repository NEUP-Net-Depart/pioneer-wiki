import { NextResponse } from "next/server";
import { dataSource, getServices } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * Readiness: the configured backend answers with the schema this build
 * expects. 503 with a reason code otherwise — never a host, key or stack.
 */
export async function GET() {
  const headers = { "cache-control": "no-store" };
  let source: string;
  try {
    source = dataSource();
  } catch {
    return NextResponse.json({ status: "unavailable", reason: "not_configured" }, { status: 503, headers });
  }
  const ready = await getServices()
    .operations.ready()
    .catch(() => ({ ok: false, reason: "database_unreachable", schema: undefined }));
  return NextResponse.json(
    {
      status: ready.ok ? "ready" : "unavailable",
      source,
      schema: ready.schema,
      reason: ready.ok ? undefined : ready.reason,
    },
    { status: ready.ok ? 200 : 503, headers },
  );
}
