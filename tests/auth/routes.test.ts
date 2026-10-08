import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/i18n/server", () => ({ getLang: async () => "en" }));
const mocks = vi.hoisted(() => ({ config: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: mocks.config, hasSupabaseEnv: () => Boolean(mocks.config()) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));

import { POST as login } from "@/app/api/auth/login/route";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";

const request = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://attacker.example${path}`, { method: "POST", body: JSON.stringify(body), headers });

function client({ throttled = false, status = "active" } = {}) {
  const auth = {
    signInWithPassword: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn(),
    resend: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  };
  const rpc = vi.fn().mockResolvedValue({ data: !throttled, error: null });
  const profile = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { account_status: status }, error: null }) };
  profile.select.mockReturnValue(profile);
  profile.eq.mockReturnValue(profile);
  mocks.client.mockResolvedValue({ auth, rpc, from: vi.fn().mockReturnValue(profile) });
  return { auth, rpc };
}

describe("authentication route boundaries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.config.mockReturnValue({ url: "https://supabase.example", anonKey: "anon" });
    vi.stubEnv("PIONEER_DATA_SOURCE", "");
    vi.stubEnv("PIONEER_SITE_URL", "https://wiki.example.org");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("says plainly when there is no sign-in service, and rejects malformed input before contacting it", async () => {
    mocks.config.mockReturnValue(null);
    const unconfigured = await login(request("/api/auth/login", { email: "a@b.co", password: "long-enough" }));
    expect(unconfigured.status).toBe(503);
    expect((await unconfigured.json()).error.reason).toBe("supabase_required");
    mocks.config.mockReturnValue({ url: "https://supabase.example", anonKey: "anon" });
    client();
    expect((await login(request("/api/auth/login", { email: "bad", password: "short" }))).status).toBe(422);
  });

  it("signs out unverified and suspended sign-ins, and lets verified active ones in", async () => {
    const { auth } = client();
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "u", email_confirmed_at: null } }, error: null });
    const unverified = await login(request("/api/auth/login", { email: "Reader@Example.com", password: "long-enough" }));
    expect(unverified.status).toBe(403);
    expect((await unverified.json()).error.reason).toBe("email_not_verified");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });

    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "u", email_confirmed_at: "2026-10-08" } }, error: null });
    expect((await login(request("/api/auth/login", { email: "Reader@Example.com", password: "long-enough" }))).status).toBe(200);
    expect(auth.signInWithPassword).toHaveBeenLastCalledWith({ email: "reader@example.com", password: "long-enough" });

    const suspended = client({ status: "suspended" });
    suspended.auth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "u", email_confirmed_at: "2026-10-08" } }, error: null });
    const refused = await login(request("/api/auth/login", { email: "reader@example.com", password: "long-enough" }));
    expect(refused.status).toBe(403);
    expect((await refused.json()).error.reason).toBe("account_suspended");
    expect(suspended.auth.signOut).toHaveBeenCalledOnce();
  });

  it("gives one answer for a wrong password whoever the address belongs to", async () => {
    const { auth } = client();
    auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials", status: 400 } });
    const response = await login(request("/api/auth/login", { email: "reader@example.com", password: "long-enough" }));
    expect(response.status).toBe(401);
    expect((await response.json()).error.reason).toBe("invalid_credentials");
  });

  it("stops at the database throttle before any password is tried", async () => {
    const { auth, rpc } = client({ throttled: true });
    const response = await login(request("/api/auth/login", { email: "reader@example.com", password: "long-enough" }));
    expect(response.status).toBe(429);
    expect(rpc).toHaveBeenCalledWith("pw_throttle", { p_bucket: "login", p_key: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("registers without revealing whether the address exists, and links to the configured site only", async () => {
    expect((await signup(request("/api/auth/signup", { email: "bad", password: "short" }))).status).toBe(422);
    const { auth } = client();
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: "u-1" } }, error: null });
    const response = await signup(
      request(
        "/api/auth/signup",
        { email: "Reader@Example.com", password: "long-enough", displayName: "Reader", confirmPassword: "long-enough" },
        { host: "attacker.example" },
      ),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ needsVerification: true });
    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "reader@example.com",
        options: expect.objectContaining({ emailRedirectTo: "https://wiki.example.org/auth/confirm?next=/account" }),
      }),
    );
  });

  it("refuses to build email links in production without a configured site address", async () => {
    vi.stubEnv("PIONEER_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    client();
    const response = await forgot(request("/api/auth/forgot-password", { email: "reader@example.com" }));
    expect(response.status).toBe(503);
    expect((await response.json()).error.reason).toBe("site_url_missing");
  });

  it("sends recovery links for any address, and only resets a password inside a recovery session", async () => {
    expect((await forgot(request("/api/auth/forgot-password", { email: "bad" }))).status).toBe(422);
    const { auth } = client();
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    expect((await forgot(request("/api/auth/forgot-password", { email: "nobody@example.com" }))).status).toBe(200);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("nobody@example.com", {
      redirectTo: "https://wiki.example.org/auth/confirm?next=/reset-password",
    });
    expect((await resetPassword(request("/api/auth/reset-password", { password: "short", confirmPassword: "short" }))).status).toBe(422);
    const expired = await resetPassword(request("/api/auth/reset-password", { password: "long-enough", confirmPassword: "long-enough" }));
    expect(expired.status).toBe(401);
    expect((await expired.json()).error.reason).toBe("link_expired");
    auth.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    expect((await resetPassword(request("/api/auth/reset-password", { password: "long-enough", confirmPassword: "long-enough" }))).status).toBe(200);
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "long-enough" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
