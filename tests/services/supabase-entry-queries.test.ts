import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), account: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/lib/services/supabase-auth", () => ({
  createSupabaseAuthAdapter: () => ({ getCurrentAccount: mocks.account }),
}));
import { createSupabaseServices } from "@/lib/services/supabase";

describe("Supabase entry batching", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.account.mockResolvedValue(null);
  });
  it("loads each relation once for all entries and resolves identity once", async () => {
    const rows = [
      {
        id: "e1",
        slug: "one",
        author_id: "author",
        published_revision_number: 2,
        latest_revision_number: 4,
        status: "draft",
      },
      {
        id: "e2",
        slug: "two",
        author_id: "author",
        published_revision_number: 1,
        latest_revision_number: 1,
        status: "published",
      },
    ];
    const from = vi.fn((table: string) => {
      const response = table === "entries" ? rows : table === "entry_tags" ? [{ entry_id: "e1", tag_id: "tag" }] : [];
      const builder = {
        select: vi.fn(),
        is: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        in: vi.fn(),
        range: vi.fn(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: response, error: null }).then(resolve),
      };
      for (const method of [builder.select, builder.is, builder.order, builder.limit, builder.in, builder.range])
        method.mockReturnValue(builder);
      return builder;
    });
    mocks.client.mockResolvedValue({ from });
    const entries = await createSupabaseServices().entries.listEntries();
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "entries",
      "entry_contributors",
      "entry_sources",
      "entry_tags",
      "entry_auxiliary_categories",
    ]);
    expect(mocks.account).toHaveBeenCalledTimes(1);
    expect(entries[0]).toMatchObject({ id: "e1", revision: 2, status: "published", tagIds: ["tag"] });
    expect(entries[1].tagIds).toEqual([]);
  });
});
