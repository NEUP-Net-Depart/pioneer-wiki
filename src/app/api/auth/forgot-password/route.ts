import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/http/route";
import { authClient, siteUrl, throttle, validEmail } from "@/lib/http/site";
import { ServiceError } from "@/lib/services/contracts";

/** Sends a password reset link. Answers alike for known and unknown addresses. */
export async function POST(request: Request) {
  return handle(async () => {
    const supabase = await authClient();
    const email = validEmail((await readJson(request)).email);
    await throttle(request, "recover");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl(request)}/auth/confirm?next=/reset-password`,
    });
    if (error?.status === 429) throw new ServiceError("rate_limited", "throttled");
    return NextResponse.json({ ok: true });
  });
}
