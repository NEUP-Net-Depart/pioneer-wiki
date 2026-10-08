import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const emails = (process.env.PIONEER_ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

if (!url || !serviceKey || emails.length === 0) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and PIONEER_ADMIN_EMAILS before bootstrapping admins.",
  );
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
for (const email of emails) {
  const { data, error } = await supabase.rpc("pw_bootstrap_admin", { p_email: email });
  if (error) throw new Error(`Administrator bootstrap failed: ${error.message}`);
  if (!data?.verified) throw new Error("Administrator created but email is not verified. Verify it before signing in.");
}
console.log(`Bootstrapped ${emails.length} administrator(s), including author identity and audit.`);
