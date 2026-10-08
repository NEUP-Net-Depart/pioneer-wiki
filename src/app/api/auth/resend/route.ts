import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/http/route";
import { authClient, siteUrl, throttle, validEmail } from "@/lib/http/site";
import { ServiceError } from "@/lib/services/contracts";

/** Sends the verification email again. Answers alike for known and unknown addresses. */
export async function POST(request: Request) {
  return handle(async () => {
    const supabase = await authClient();
    const email = validEmail((await readJson(request)).email);
    await throttle(request, "resend");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${siteUrl(request)}/auth/confirm?next=/account` },
    });
    if (error?.status === 429) throw new ServiceError("rate_limited", "throttled");
    return NextResponse.json({ ok: true });
  });
}
