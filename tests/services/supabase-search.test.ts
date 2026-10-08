import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
import { createSupabaseServices } from "@/lib/services/supabase";

describe("Supabase search contract", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  });
  it("passes every selected filter and preserves total/facets", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        hits: [{ entry: { id: "e" }, familyId: "family", score: 1, matchedFields: ["body"], snippet: null }],
        total: 12,
        facets: { family: { family: 4 }, lang: { zh: 12 } },
      },
      error: null,
    });
    const result = await createSupabaseServices().search.search({
      text: "tree",
      offset: 10,
      limit: 2,
      filters: {
        familyId: ["family", "other"],
        categoryId: ["category"],
        domain: ["algorithms"],
        scale: ["micro"],
        status: ["published"],
        lang: ["zh"],
        author: ["author"],
      },
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "pw_search_entries_v2",
      expect.objectContaining({
        p_family: ["family", "other"],
        p_category: ["category"],
        p_domain: ["algorithms"],
        p_offset: 10,
        p_limit: 2,
      }),
    );
    expect(result.total).toBe(12);
    expect(result.facets.family).toEqual({ family: 4 });
    expect(result.hits[0].familyId).toBe("family");
  });
});
