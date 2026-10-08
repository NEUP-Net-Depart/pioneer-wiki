import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/http/route";
import { authClient, siteUrl, throttle, validEmail, validPassword } from "@/lib/http/site";
import { authInputError } from "@/lib/auth/validation";
import { ServiceError } from "@/lib/services/contracts";

/**
 * Registers a reader. The answer is the same whether or not the address
 * already has an account, so the form cannot be used to find who is a member.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const supabase = await authClient();
    const input = await readJson(request);
    const invalid = authInputError(input, "signup");
    if (invalid) return NextResponse.json({ error: { ...invalid, code: "invalid", reason: "invalid_payload" } }, { status: 422 });
    const email = validEmail(input.email);
    const password = validPassword(input.password, input.confirmPassword);
    await throttle(request, "signup");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl(request)}/auth/confirm?next=/account`,
        data: { display_name: String(input.displayName).trim() },
      },
    });
    if (error) {
      if (error.status === 429) throw new ServiceError("rate_limited", "throttled");
      if (/password/i.test(error.message)) throw new ServiceError("invalid", "invalid_password");
      throw new ServiceError("unavailable", "unavailable");
    }
    return NextResponse.json({ needsVerification: true }, { status: 201 });
  });
}
