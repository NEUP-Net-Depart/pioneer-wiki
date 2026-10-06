import "server-only";
import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";

export async function adminAccountOrResponse() {
  const account = await getServices().auth.getCurrentAccount();
  if (!account)
    return {
      response: NextResponse.json({ error: { code: "forbidden", message: "Sign in to continue." } }, { status: 401 }),
    } as const;
  if (!account.emailVerified)
    return {
      response: NextResponse.json(
        { error: { code: "email_not_verified", message: "Verify your email first." } },
        { status: 403 },
      ),
    } as const;
  if (account.role !== "admin")
    return {
      response: NextResponse.json(
        { error: { code: "forbidden", message: "Administrator access is required." } },
        { status: 403 },
      ),
    } as const;
  return { account } as const;
}
