import { describe, expect, it } from "vitest";
import { createMockServices } from "@/lib/services/mock";
import { PARTS, partForPath } from "@/lib/parts";

describe("mock community services", () => {
  it("lists links, members and threads (most recently active first)", async () => {
    const { community } = createMockServices();
    expect((await community.listLinks()).length).toBeGreaterThan(0);
    const members = await community.listMembers();
    expect(members[0]).toMatchObject({ name: { zh: "青空" }, authorId: "a-qingkong" });
    const threads = await community.listThreads();
    const times = threads.map((t) => t.lastActivityAt);
    expect([...times].sort().reverse()).toEqual(times);
    expect(threads.every((t) => t.postCount > 0 && t.excerpt.length > 0)).toBe(true);
    expect((await community.listThreads({ category: "help" })).every((t) => t.category === "help")).toBe(true);
  });

  it("files a thread, takes replies and keeps the summary current", async () => {
    const { community } = createMockServices();
    const thread = await community.createThread({
      title: "  A new sheet  ",
      body: "First note",
      category: "showcase",
      authorName: "Reader",
    });
    expect(thread).toMatchObject({ title: "A new sheet", postCount: 1, excerpt: "First note" });
    const post = await community.reply({ threadId: thread.id, body: "Second note", authorName: "Another" });
    expect(post).not.toBeNull();
    const found = await community.getThread(thread.id);
    expect(found?.posts.map((p) => p.body)).toEqual(["First note", "Second note"]);
    expect(found?.thread.postCount).toBe(2);
    expect((await community.listThreads())[0].id).toBe(thread.id);
  });

  it("rejects empty input and unknown threads", async () => {
    const { community } = createMockServices();
    await expect(
      community.createThread({ title: " ", body: "x", category: "general", authorName: "R" }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      community.createThread({ title: "t", body: "x", category: "nope" as never, authorName: "R" }),
    ).rejects.toMatchObject({ code: "invalid" });
    expect(await community.reply({ threadId: "t-999", body: "x", authorName: "R" })).toBeNull();
    expect(await community.getThread("t-999")).toBeNull();
  });
});

describe("entrance parts", () => {
  it("maps each part route to its own stage manner", () => {
    expect(PARTS.map((p) => [p.href, p.theme])).toEqual([
      ["/", "biology"],
      ["/links", "geography"],
      ["/members", "art"],
      ["/forum", "blueprint"],
    ]);
    expect(partForPath("/forum")?.id).toBe("forum");
    expect(partForPath("/forum/t-1")).toBeUndefined();
  });
});

describe("member pages", () => {
  it("only 青空 is real; everyone else is a labelled placeholder", async () => {
    const people = await createMockServices().community.listMembers();
    expect(people.filter((m) => !m.sample).map((m) => m.name.zh)).toEqual(["青空"]);
    expect(people.filter((m) => m.sample).every((m) => m.name.zh.startsWith("示例"))).toBe(true);
    expect(new Set(people.map((m) => m.plate.number)).size).toBe(people.length);
  });

  it("applies a valid edit and rejects bad values", async () => {
    const { community } = createMockServices();
    const next = await community.updateMember("qingkong", {
      plate: { ink: "madder", border: "rope", emblem: "ex-owl", motto: "  Lux  " },
      links: [{ label: "Blog", url: "https://example.org" }],
      github: "puresky271",
      coverPrint: "ink",
    });
    expect(next?.plate).toMatchObject({ number: 1, ink: "madder", border: "rope", emblem: "ex-owl", motto: "Lux" });
    expect(next?.links).toEqual([{ label: "Blog", url: "https://example.org" }]);
    await expect(community.updateMember("qingkong", { plate: { ink: "gold" as never } })).rejects.toMatchObject({
      code: "invalid",
    });
    await expect(
      community.updateMember("qingkong", { links: [{ label: "x", url: "javascript:alert(1)" }] }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(community.updateMember("qingkong", { github: "not a login!" })).rejects.toMatchObject({
      code: "invalid",
    });
    expect(await community.updateMember("nobody", { about: "x" })).toBeNull();
  });

  it("sets and removes the page image, and lists a member's posts", async () => {
    const { community } = createMockServices();
    const withCover = await community.setMemberCover("qingkong", {
      src: "/api/media/x.webp",
      width: 10,
      height: 5,
      print: "original",
    });
    expect(withCover?.cover?.src).toBe("/api/media/x.webp");
    expect((await community.setMemberCover("qingkong", null))?.cover).toBeUndefined();
    const posts = await community.listPostsBy("m-qingkong");
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every(({ post, thread }) => post.memberId === "m-qingkong" && thread.id === post.threadId)).toBe(true);
  });
});
