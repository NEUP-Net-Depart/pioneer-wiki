import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness: the process answers. It never touches the database, so a short
 * database outage does not make the container look dead and restart in a loop.
 */
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}
