import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ gate: vi.fn(), config: vi.fn(), client: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/admin", () => ({ adminAccountOrResponse: mocks.gate }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: mocks.config }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
import { POST } from "@/app/api/admin/entries/[id]/archive/route";

describe("administrator archive route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.gate.mockResolvedValue({ account: { role: "admin" } });
    mocks.config.mockReturnValue({ url: "http://example.test" });
    mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  });
  const archive = () =>
    POST(new Request("http://example.test/api/admin/entries/e/archive", { method: "POST" }), {
      params: Promise.resolve({ id: "e" }),
    });
  it("returns the archived row from one authorized transaction", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: "e", deleted_at: "2026-10-08" }, error: null });
    const response = await archive();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "e", deleted_at: "2026-10-08" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("pw_archive_entry", { p_entry_id: "e" });
  });
  it("stops denied callers before touching the database", async () => {
    mocks.gate.mockResolvedValue({ response: new Response(null, { status: 403 }) });
    expect((await archive()).status).toBe(403);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("preserves missing, unavailable and permission error statuses", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect((await archive()).status).toBe(404);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "admin_required" } });
    expect((await archive()).status).toBe(403);
    mocks.config.mockReturnValue(null);
    expect((await archive()).status).toBe(503);
  });
});
