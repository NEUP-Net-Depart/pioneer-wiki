import { handle, ok, readJson, requireAccount } from "@/lib/http/route";
import { authClient, throttle, validPassword } from "@/lib/http/site";
import { ServiceError } from "@/lib/services/contracts";

/** POST { currentPassword, password, confirmPassword } — the current password is checked first. */
export async function POST(request: Request) {
  return handle(async () => {
    const account = await requireAccount();
    const supabase = await authClient();
    const input = await readJson(request);
    const password = validPassword(input.password, input.confirmPassword);
    await throttle(request, "password");
    const check = await supabase.auth.signInWithPassword({
      email: account.email,
      password: typeof input.currentPassword === "string" ? input.currentPassword : "",
    });
    if (check.error) throw new ServiceError("invalid", "wrong_password");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new ServiceError("invalid", "invalid_password");
    return ok({ ok: true });
  });
}
