import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/lib/model/types";
import { ServiceError } from "@/lib/services/contracts";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/i18n/server", () => ({ getLang: async () => "en" }));
const mocks = vi.hoisted(() => ({ account: vi.fn(), setArchived: vi.fn() }));
vi.mock("@/lib/services", () => ({
  getServices: () => ({
    auth: { getCurrentAccount: mocks.account },
    entries: { setArchived: mocks.setArchived },
  }),
}));
import { POST } from "@/app/api/admin/entries/[id]/archive/route";

const admin: Account = {
  id: "u-admin",
  email: "admin@example.test",
  handle: "admin",
  name: { zh: "管理员", en: "Admin" },
  sigil: "a",
  role: "admin",
  emailVerified: true,
  status: "active",
  authorId: "a-admin",
};
const archive = (body?: unknown) =>
  POST(
    new Request("http://example.test/api/admin/entries/e/archive", {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
    {
      params: Promise.resolve({ id: "e" }),
    },
  );

describe("administrator archive route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.account.mockResolvedValue(admin);
  });

  it("archives and restores through one service call with the reason", async () => {
    mocks.setArchived.mockResolvedValue({ id: "e", slug: "e", archivedAt: "2026-10-08" });
    const response = await archive({ reason: "Duplicate" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "e", slug: "e", archivedAt: "2026-10-08" });
    expect(mocks.setArchived).toHaveBeenCalledExactlyOnceWith("e", true, "Duplicate");
    await archive({ archived: false });
    expect(mocks.setArchived).toHaveBeenLastCalledWith("e", false, undefined);
  });

  it("stops visitors, readers, unverified and suspended administrators before the service", async () => {
    for (const [account, status] of [
      [null, 401],
      [{ ...admin, role: "reader" }, 403],
      [{ ...admin, emailVerified: false }, 403],
      [{ ...admin, status: "suspended" }, 403],
    ] as const) {
      mocks.account.mockResolvedValue(account);
      expect((await archive({})).status).toBe(status);
    }
    expect(mocks.setArchived).not.toHaveBeenCalled();
  });

  it("answers database refusals with their status and reason, never their text", async () => {
    mocks.setArchived.mockRejectedValueOnce(new ServiceError("invalid", "entry_not_found"));
    const missing = await archive({});
    expect(missing.status).toBe(422);
    expect((await missing.json()).error).toMatchObject({ reason: "entry_not_found", message: "No such entry." });
    mocks.setArchived.mockRejectedValueOnce(new ServiceError("forbidden", "admin_required"));
    expect((await archive({})).status).toBe(403);
    mocks.setArchived.mockRejectedValueOnce(new Error("connection refused at 10.0.0.5:5432"));
    const down = await archive({});
    expect(down.status).toBe(503);
    expect(JSON.stringify(await down.json())).not.toContain("10.0.0.5");
  });
});
