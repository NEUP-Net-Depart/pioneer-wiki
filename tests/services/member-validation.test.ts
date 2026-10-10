import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
import { createSupabaseServices } from "@/lib/services/supabase";
import { createMockCommunityRepository } from "@/lib/services/mock/community";
import { createMockContext } from "@/lib/services/mock/context";

/** The page's own account, so the fixtures backend checks values rather than refusing a stranger. */
const owner = createMockContext(() => ({
  id: "a-qingkong",
  email: "qingkong@example.test",
  handle: "qingkong",
  name: { zh: "青空", en: "Qingkong" },
  sigil: "qingkong",
  role: "reader",
  emailVerified: true,
  status: "active",
  authorId: "a-qingkong",
  memberId: "m-qingkong",
}));
import { readMemberLinks, validateMemberPatch } from "@/lib/members/validation";

describe("member validation across stores", () => {
  beforeEach(() => vi.resetAllMocks());
  it.each([
    { links: [{ label: "x", url: "javascript:alert(1)" }] },
    { links: [null] },
    { links: [{ label: "x", url: "https://example.org\n" + "javascript:alert(1)" }] },
    { links: [{ label: "x", url: "https://" }] },
    { github: "bad login" },
    { about: "x".repeat(20001) },
    { plate: { ink: "toString" } },
    { name: null },
    { links: null },
  ])("rejects malformed values before Supabase writes", async (patch) => {
    const mock = createMockCommunityRepository(owner);
    await expect(mock.updateMember("qingkong", patch as never)).rejects.toMatchObject({ code: "invalid" });
    await expect(createSupabaseServices().community.updateMember("qingkong", patch as never)).rejects.toMatchObject({
      code: "invalid",
    });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("preserves valid links, Markdown and empty reset fields, while dropping protected extras", () => {
    expect(
      validateMemberPatch({
        about: "  Markdown  ",
        links: [{ label: " Email ", url: "MAILTO:reader@example.org" }],
        github: null,
        plate: { motto: "", number: 99 },
        authorId: "victim",
      }),
    ).toEqual({
      about: "  Markdown  ",
      links: [{ label: "Email", url: "MAILTO:reader@example.org" }],
      github: null,
      plate: { motto: "" },
    });
  });
  it("allows optional role and bio fields to be cleared", () => {
    expect(validateMemberPatch({ role: { zh: "", en: " " }, bio: { zh: "", en: "" } })).toEqual({
      role: { zh: "", en: "" },
      bio: { zh: "", en: "" },
    });
  });
  it("keeps valid older links and filters malformed entries independently", () => {
    expect(
      readMemberLinks([
        null,
        { label: "unsafe", url: "javascript:alert(1)" },
        { label: "Blog", url: "https://example.org" },
      ]),
    ).toEqual([{ label: "Blog", url: "https://example.org" }]);
  });
});
