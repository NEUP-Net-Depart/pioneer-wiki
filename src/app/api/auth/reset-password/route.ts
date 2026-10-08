import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/http/route";
import { authClient, validPassword } from "@/lib/http/site";
import { ServiceError } from "@/lib/services/contracts";

/** Sets a new password for the session a reset link opened, then ends it so the new password is used. */
export async function POST(request: Request) {
  return handle(async () => {
    const supabase = await authClient();
    const input = await readJson(request);
    const password = validPassword(input.password, input.confirmPassword);
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new ServiceError("unauthenticated", "link_expired");
    const { error } = await supabase.auth.updateUser({ password });
    if (error)
      throw new ServiceError(
        "invalid",
        /should be different/i.test(error.message) ? "invalid_password" : "link_expired",
      );
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.json({ ok: true });
  });
}
