import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
const { error } = await supabase.from("profiles").update({ account_role: "admin" }).in("email", emails);
if (error) throw error;
console.log(`Promoted ${emails.length} configured admin email(s).`);
