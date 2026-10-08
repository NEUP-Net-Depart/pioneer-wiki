import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabaseStub } from "../helpers/supabase-stub";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), account: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/lib/services/supabase-auth", () => ({
  createSupabaseAuthAdapter: () => ({ getCurrentAccount: mocks.account }),
}));
import { createSupabaseServices } from "@/lib/services/supabase";

const rows = [
  { id: "e1", slug: "one", author_id: "author", published_revision_number: 2, latest_revision_number: 4, status: "draft", title_en: "Public one" },
  { id: "e2", slug: "two", author_id: "author", published_revision_number: 1, latest_revision_number: 1, status: "published", title_en: "Two" },
];

describe("Supabase entry reads", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.account.mockResolvedValue({ id: "u", role: "admin", authorId: "author", emailVerified: true, status: "active" });
  });

  it("lists only published, unarchived entries and loads each association once for all of them", async () => {
    const stub = supabaseStub({
      entries: { data: rows, error: null },
      entry_tags: { data: [{ entry_id: "e1", tag_id: "tag" }], error: null },
    });
    mocks.client.mockResolvedValue(stub.client);
    const entries = await createSupabaseServices().entries.listEntries();
    expect(stub.calls.map((c) => c.table)).toEqual([
      "entries",
      "entry_contributors",
      "entry_sources",
      "entry_tags",
      "entry_auxiliary_categories",
    ]);
    const filters = stub.calls[0].chain;
    expect(filters).toContainEqual(["is", "deleted_at", null]);
    expect(filters).toContainEqual(["not", "published_revision_number", "is", null]);
    // Whoever is signed in — an administrator here — readers' lists show the published revision.
    expect(mocks.account).not.toHaveBeenCalled();
    expect(entries[0]).toMatchObject({ id: "e1", revision: 2, status: "published", tagIds: ["tag"], title: { en: "Public one" } });
    expect(entries[1].tagIds).toEqual([]);
  });

  it("answers an unpublished-only listing with nothing", async () => {
    const stub = supabaseStub();
    mocks.client.mockResolvedValue(stub.client);
    expect(await createSupabaseServices().entries.listEntries({ status: ["draft"] })).toEqual([]);
    expect(stub.calls).toEqual([]);
  });

  it("reads an entry's body from its published revision, never the latest", async () => {
    const stub = supabaseStub({
      entries: { data: [rows[0]], error: null },
      entry_revision_bodies: { data: { body: "published body" }, error: null },
    });
    mocks.client.mockResolvedValue(stub.client);
    const entry = await createSupabaseServices().entries.getEntry("one");
    expect(entry?.body).toBe("published body");
    const bodyQuery = stub.calls.find((c) => c.table === "entry_revision_bodies")!;
    expect(bodyQuery.chain).toContainEqual(["eq", "revision_id", "e1@r2"]);
  });

  it("offers readers only published revisions in the history", async () => {
    const stub = supabaseStub({ entry_revisions: { data: [], error: null } });
    mocks.client.mockResolvedValue(stub.client);
    await createSupabaseServices().entries.listRevisions("e1");
    expect(stub.calls[0].chain).toContainEqual(["eq", "state", "published"]);
    await createSupabaseServices().entries.listRevisions("e1", { scope: "editorial" });
    expect(stub.calls[1].chain).not.toContainEqual(["eq", "state", "published"]);
  });

  it("publishes through the lifecycle function with the revision that was reviewed", async () => {
    const stub = supabaseStub({}, { pw_entry_lifecycle: { data: { id: "e1@r6", entryId: "e1", number: 6, state: "published" }, error: null } });
    mocks.client.mockResolvedValue(stub.client);
    const revision = await createSupabaseServices().entries.transition({ entryId: "e1", action: "publish", actorId: "author", expectedRevision: 5 });
    expect(stub.rpcCalls).toEqual([
      ["pw_entry_lifecycle", { p_entry_id: "e1", p_action: "publish", p_expected_revision: 5, p_target_revision_id: null, p_note: null }],
    ]);
    expect(revision).toMatchObject({ id: "e1@r6", number: 6, state: "published" });
  });

  it("turns database refusals into reasons the interface can explain", async () => {
    const stub = supabaseStub({}, { pw_entry_lifecycle: { data: null, error: { code: "40001", message: "revision_conflict" } } });
    mocks.client.mockResolvedValue(stub.client);
    await expect(
      createSupabaseServices().entries.transition({ entryId: "e1", action: "publish", actorId: "author", expectedRevision: 5 }),
    ).rejects.toMatchObject({ code: "conflict", reason: "revision_conflict" });
    const forbidden = supabaseStub({}, { pw_save_draft: { data: null, error: { code: "42501", message: "permission denied for function pw_save_draft" } } });
    mocks.client.mockResolvedValue(forbidden.client);
    await expect(
      createSupabaseServices().entries.saveDraft({ title: { zh: "x", en: "x" }, summary: { zh: "", en: "" }, body: "", note: "", authorId: "a" }),
    ).rejects.toMatchObject({ code: "forbidden", reason: "forbidden" });
  });
});
