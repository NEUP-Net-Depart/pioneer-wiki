import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberProject } from "@/lib/model/types";
import { supabaseStub } from "../helpers/supabase-stub";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
import { createSupabaseServices } from "@/lib/services/supabase";

const work: MemberProject = {
  id: "work",
  url: "https://example.org/work",
  title: "My work",
  description: "A project",
  tags: ["Web"],
  links: [],
};
const member = { id: "m", handle: "qingkong", name_zh: "青空", name_en: "Qingkong", plate_number: 1, projects: [work], version: 3 };

describe("Supabase selected works contract (stubbed database)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("sends normalized projects through the audited save function, with the version the editor saw", async () => {
    const stub = supabaseStub({ members: { data: [member], error: null } }, { pw_save_member: { data: { ...member, version: 4 }, error: null } });
    mocks.client.mockResolvedValue(stub.client);
    const next = await createSupabaseServices().community.updateMember("qingkong", { projects: [{ ...work, title: "  My work  " }] }, 3);
    expect(stub.rpcCalls).toEqual([["pw_save_member", { p_member_id: "m", p_patch: { projects: [work] }, p_base_version: 3 }]]);
    expect(next).toMatchObject({ projects: [work], version: 4 });
    // No table write: member pages change only through the function that versions and audits them.
    expect(stub.calls.flatMap((c) => c.chain).some(([method]) => method === "update" || method === "upsert")).toBe(false);
  });

  it("rejects unsafe writes before asking the database anything", async () => {
    const stub = supabaseStub({ members: { data: [member], error: null } });
    mocks.client.mockResolvedValue(stub.client);
    await expect(
      createSupabaseServices().community.updateMember("qingkong", { projects: [{ ...work, url: "javascript:alert(1)" }] }),
    ).rejects.toMatchObject({ code: "invalid" });
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("keeps older records readable and excludes unchecked poisoned links from public reads", async () => {
    mocks.client.mockResolvedValue(supabaseStub({ members: { data: [{ ...member, projects: undefined }], error: null } }).client);
    expect((await createSupabaseServices().community.getMember("qingkong"))?.projects).toEqual([]);
    mocks.client.mockResolvedValue(
      supabaseStub({ members: { data: [{ ...member, projects: [{ ...work, links: [{ label: "bad", url: "javascript:alert(1)" }] }] }], error: null } })
        .client,
    );
    expect((await createSupabaseServices().community.getMember("qingkong"))?.projects).toEqual([]);
  });

  it("reads archived pages only on request, and resolves a former handle", async () => {
    const stub = supabaseStub({ members: { data: [{ ...member, handle: "sky" }], error: null } });
    mocks.client.mockResolvedValue(stub.client);
    const found = await createSupabaseServices().community.getMember("qingkong");
    expect(found?.handle).toBe("sky");
    expect(stub.calls[0].chain).toContainEqual(["or", "handle.eq.qingkong,former_handles.cs.{qingkong}"]);
    expect(stub.calls[0].chain).toContainEqual(["is", "archived_at", null]);
  });
});
