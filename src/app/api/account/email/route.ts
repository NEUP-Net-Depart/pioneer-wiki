import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { authClient, siteUrl, throttle, validEmail } from "@/lib/http/site";
import { ServiceError } from "@/lib/services/contracts";

/**
 * POST { email } — asks Supabase Auth to change the sign-in address. Nothing
 * changes until the confirmation link is opened (with secure email change,
 * links go to both the old and the new address).
 */
export async function POST(request: Request) {
  return handle(async () => {
    const account = await requireAccount();
    const supabase = await authClient();
    const email = validEmail((await readJson(request)).email);
    if (email === account.email.toLowerCase()) throw new ServiceError("invalid", "same_email");
    await throttle(request, "email_change");
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${siteUrl(request)}/auth/confirm?next=/account/security` },
    );
    if (error?.status === 429) throw new ServiceError("rate_limited", "throttled");
    if (error) throw new ServiceError("invalid", /already/i.test(error.message) ? "invalid_email" : "unavailable");
    return ok({ ok: true, pending: email });
  });
}
