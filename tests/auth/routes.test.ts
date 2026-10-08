import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ config: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: mocks.config }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));

import { POST as login } from "@/app/api/auth/login/route";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";

const request = (path: string, body: unknown) =>
  new Request(`http://example.test${path}`, { method: "POST", body: JSON.stringify(body) });

function client() {
  const auth = {
    signInWithPassword: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  };
  mocks.client.mockResolvedValue({ auth });
  return auth;
}

describe("authentication route boundaries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.config.mockReturnValue({ url: "https://supabase.example", anonKey: "anon" });
  });

  it("rejects unavailable and malformed login before contacting Supabase", async () => {
    mocks.config.mockReturnValue(null);
    expect((await login(request("/api/auth/login", {}))).status).toBe(503);
    mocks.config.mockReturnValue({ url: "https://supabase.example", anonKey: "anon" });
    expect((await login(request("/api/auth/login", { email: "bad", password: "short" }))).status).toBe(422);
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("signs out an unverified login and returns a generic success only after verification", async () => {
    const auth = client();
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: { email_confirmed_at: null } }, error: null });
    expect(
      (await login(request("/api/auth/login", { email: "Reader@Example.com", password: "long-enough" }))).status,
    ).toBe(403);
    expect(auth.signOut).toHaveBeenCalledOnce();
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { email_confirmed_at: "2026-10-08" } },
      error: null,
    });
    expect(
      (await login(request("/api/auth/login", { email: "Reader@Example.com", password: "long-enough" }))).status,
    ).toBe(200);
    expect(auth.signInWithPassword).toHaveBeenLastCalledWith({ email: "reader@example.com", password: "long-enough" });
  });

  it("validates signup and preserves verification response semantics", async () => {
    expect((await signup(request("/api/auth/signup", { email: "bad", password: "short" }))).status).toBe(422);
    const auth = client();
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: "u-1" } }, error: null });
    const response = await signup(
      request("/api/auth/signup", {
        email: "Reader@Example.com",
        password: "long-enough",
        displayName: "Reader",
        confirmPassword: "long-enough",
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ needsVerification: true, userId: "u-1" });
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: "reader@example.com" }));
  });

  it("validates recovery and password reset inputs before provider calls", async () => {
    expect((await forgot(request("/api/auth/forgot-password", { email: "bad" }))).status).toBe(422);
    expect(
      (await resetPassword(request("/api/auth/reset-password", { password: "short", confirmPassword: "short" })))
        .status,
    ).toBe(422);
    const auth = client();
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    expect((await forgot(request("/api/auth/forgot-password", { email: "reader@example.com" }))).status).toBe(200);
    expect(
      (
        await resetPassword(
          request("/api/auth/reset-password", { password: "long-enough", confirmPassword: "long-enough" }),
        )
      ).status,
    ).toBe(200);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledOnce();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "long-enough" });
  });
});
