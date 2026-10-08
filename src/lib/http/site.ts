import "server-only";
import { createHash } from "node:crypto";
import { ServiceError } from "@/lib/services/contracts";
import { dataSource } from "@/lib/services";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Where the site lives and who is asking. Links in emails are built from the
 * configured site address, never from the request's Host header, which a
 * client can set to anything.
 */

/** The public origin, e.g. https://wiki.example.org (no trailing slash). */
export function siteUrl(request: Request): string {
  const configured = process.env.PIONEER_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") return new URL(request.url).origin;
  throw new ServiceError("unavailable", "site_url_missing");
}

/** A same-site path to continue to, or the fallback: never another origin. */
export function safeNext(value: string | null | undefined, fallback = "/account"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  try {
    const url = new URL(value, "http://pioneer.invalid");
    return url.origin === "http://pioneer.invalid" ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

/**
 * The client's address. Behind a reverse proxy (PIONEER_TRUST_PROXY=1) it is
 * the X-Real-IP the proxy sets (see deploy/Caddyfile.example); otherwise the
 * request carries no trustworthy address and every client shares one bucket.
 */
export function clientAddress(request: Request): string {
  if (process.env.PIONEER_TRUST_PROXY === "1") {
    const real = request.headers.get("x-real-ip")?.trim();
    if (real && /^[0-9a-f.:]{2,45}$/i.test(real)) return real;
  }
  return "unknown";
}

export type ThrottleBucket = "signup" | "resend" | "recover" | "login" | "email_change" | "password";

/**
 * Counts a request against its bucket in the database, so the limit holds
 * across processes and restarts. The address is hashed with
 * PIONEER_THROTTLE_SECRET before it leaves the server. Supabase Auth applies
 * its own email limits on top; with the fixtures backend there is no email.
 */
export async function throttle(request: Request, bucket: ThrottleBucket): Promise<void> {
  if (dataSource() !== "supabase") return;
  const key = createHash("sha256")
    .update(`${process.env.PIONEER_THROTTLE_SECRET ?? ""}\u0000${bucket}\u0000${clientAddress(request)}`)
    .digest("hex");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("pw_throttle", { p_bucket: bucket, p_key: key });
  if (error) {
    // A throttle that cannot count must not lock everyone out; the request still meets Supabase's own limits.
    console.error(JSON.stringify({ level: "warn", event: "throttle_unavailable", bucket }));
    return;
  }
  if (data === false) throw new ServiceError("rate_limited", "throttled");
}

export function validEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ServiceError("invalid", "invalid_email");
  return email;
}

export function validPassword(password: unknown, confirm?: unknown): string {
  if (typeof password !== "string" || password.length < 8 || password.length > 128)
    throw new ServiceError("invalid", "invalid_password");
  if (confirm !== undefined && confirm !== password) throw new ServiceError("invalid", "invalid_password");
  return password;
}

/** Auth flows need Supabase Auth; the fixtures backend has no accounts to sign in to. */
export async function authClient() {
  if (dataSource() !== "supabase") throw new ServiceError("unavailable", "supabase_required");
  try {
    return await createSupabaseServerClient();
  } catch {
    throw new ServiceError("unavailable", "supabase_required");
  }
}
