import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/lib/services/contracts";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/i18n/server", () => ({ getLang: async () => "en" }));
const mocks = vi.hoisted(() => ({ editableMember: vi.fn(), importProjectPreview: vi.fn() }));
vi.mock("@/lib/members/owner", () => ({ editableMember: mocks.editableMember }));
vi.mock("@/lib/members/preview", () => ({ importProjectPreview: mocks.importProjectPreview }));
import { POST } from "@/app/api/members/[handle]/project-preview/route";

const request = (url = "https://example.org/") =>
  new NextRequest("https://wiki.example/api/members/qingkong/project-preview", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
const context = { params: Promise.resolve({ handle: "qingkong" }) };

describe("owner-only project preview import", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.editableMember.mockResolvedValue({
      account: { id: "a" },
      member: { id: "m", handle: "qingkong" },
      admin: false,
    });
  });
  it("denies visitors and other accounts before any outbound request", async () => {
    mocks.editableMember.mockRejectedValue(new ServiceError("unauthenticated", "unauthenticated"));
    expect((await POST(request(), context)).status).toBe(401);
    mocks.editableMember.mockRejectedValue(new ServiceError("forbidden", "forbidden"));
    expect((await POST(request(), context)).status).toBe(403);
    expect(mocks.importProjectPreview).not.toHaveBeenCalled();
  });
  it("returns a preview without saving the member page", async () => {
    mocks.importProjectPreview.mockResolvedValue({ title: "A project" });
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ title: "A project" });
    expect(mocks.importProjectPreview).toHaveBeenCalledWith("https://example.org/");
  });
  it("contains malformed URL and remote errors without leaking diagnostics", async () => {
    expect((await POST(request("file:///private"), context)).status).toBe(422);
    expect(mocks.importProjectPreview).not.toHaveBeenCalled();
    mocks.importProjectPreview.mockRejectedValue(new Error("private internal details"));
    const response = await POST(request(), context);
    expect(response.status).toBe(422);
    expect(JSON.stringify(await response.json())).not.toContain("internal details");
  });
});
