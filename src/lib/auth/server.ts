import "server-only";
import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import type { Account } from "@/lib/model/types";

/** Returns a verified account or the response that should end a write request. */
export async function verifiedAccountOrResponse(): Promise<{ account: Account } | { response: NextResponse }> {
  const account = await getServices().auth.getCurrentAccount();
  if (!account)
    return {
      response: NextResponse.json({ error: { code: "forbidden", message: "Sign in to continue." } }, { status: 401 }),
    };
  if (!account.emailVerified)
    return {
      response: NextResponse.json(
        { error: { code: "email_not_verified", message: "Verify your email before posting or editing." } },
        { status: 403 },
      ),
    };
  return { account };
}
