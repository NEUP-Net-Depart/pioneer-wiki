import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/http/route";
import { authClient, throttle } from "@/lib/http/site";
import { authInputError } from "@/lib/auth/validation";
import { ServiceError } from "@/lib/services/contracts";

export async function POST(request: Request) {
  return handle(async () => {
    const supabase = await authClient();
    const input = await readJson(request);
    const invalid = authInputError(input, "login");
    if (invalid)
      return NextResponse.json({ error: { ...invalid, code: "invalid", reason: "invalid_payload" } }, { status: 422 });
    await throttle(request, "login");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(input.email).trim().toLowerCase(),
      password: String(input.password),
    });
    if (error?.status === 429) throw new ServiceError("rate_limited", "throttled");
    if (error && /confirm/i.test(error.message)) throw new ServiceError("forbidden", "email_not_verified");
    if (error || !data.user) throw new ServiceError("unauthenticated", "invalid_credentials");
    if (!data.user.email_confirmed_at) {
      await supabase.auth.signOut({ scope: "local" });
      throw new ServiceError("forbidden", "email_not_verified");
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.account_status && profile.account_status !== "active") {
      await supabase.auth.signOut({ scope: "local" });
      throw new ServiceError("forbidden", profile.account_status === "closed" ? "account_closed" : "account_suspended");
    }
    return NextResponse.json({ ok: true });
  });
}
