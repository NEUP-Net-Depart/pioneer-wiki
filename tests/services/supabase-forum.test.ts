import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
import { createSupabaseServices } from "@/lib/services/supabase";

describe("Supabase forum transaction contract", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  });

  it("lets the database derive identity and allocate thread and opening post", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: "t-uuid",
        number: 9,
        title: "Thread",
        category: "help",
        author_name: "Real author",
        member_id: "real-member",
        created_at: "2026-10-08",
        post_count: 1,
        excerpt: "Body",
        last_activity_at: "2026-10-08",
      },
      error: null,
    });
    const thread = await createSupabaseServices().community.createThread({
      title: "Thread",
      body: "Body",
      category: "help",
      authorName: "Forged",
      memberId: "victim",
    });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("pw_create_forum_thread", {
      p_title: "Thread",
      p_body: "Body",
      p_category: "help",
    });
    expect(thread).toMatchObject({
      id: "t-uuid",
      number: 9,
      authorName: "Real author",
      memberId: "real-member",
      postCount: 1,
    });
  });

  it("preserves unbound reader replies and missing/deleted thread results", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: {
          id: "p-uuid",
          thread_id: "t-old",
          author_name: "Reader",
          body: "Reply",
          created_at: "2026-10-08",
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });
    const community = createSupabaseServices().community;
    const input = { threadId: "t-old", body: "Reply", authorName: "Forged", memberId: "victim" };
    expect(await community.reply(input)).toMatchObject({ id: "p-uuid", authorName: "Reader", memberId: undefined });
    expect(mocks.rpc).toHaveBeenCalledWith("pw_reply_forum_thread", { p_thread_id: "t-old", p_body: "Reply" });
    expect(await community.reply(input)).toBeNull();
  });

  it("propagates database validation and authorization failures", async () => {
    const community = createSupabaseServices().community;
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "invalid_post" } });
    await expect(community.reply({ threadId: "t", body: "", authorName: "Reader" })).rejects.toMatchObject({
      code: "invalid",
    });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "verified_account_required" } });
    await expect(community.reply({ threadId: "t", body: "Body", authorName: "Reader" })).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});
