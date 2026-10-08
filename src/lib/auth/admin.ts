import "server-only";
import type { NextResponse } from "next/server";
import type { Account } from "@/lib/model/types";
import { failure, requireAccount } from "@/lib/http/route";

/** A verified, active administrator, or the response that ends the request. */
export async function adminAccountOrResponse(): Promise<{ account: Account } | { response: NextResponse }> {
  try {
    return { account: await requireAccount({ admin: true }) };
  } catch (error) {
    return { response: await failure(error) };
  }
}
