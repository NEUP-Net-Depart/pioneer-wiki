import { describe, expect, it } from "vitest";
import { createMockServices } from "@/lib/services/mock";

describe("mock wiki services", () => {
  it("lists and searches entries with filters", async () => {
    const services = createMockServices();
    const entries = await services.entries.listEntries({ featured: true });
    expect(entries.length).toBeGreaterThan(0);
    const result = await services.search.search({ text: "memory", filters: { scale: ["macro"] } });
    expect(result.hits.some((hit) => hit.entry.slug === "memory-hierarchy")).toBe(true);
  });

  it("stores draft bodies and applies review transitions", async () => {
    const services = createMockServices();
    const draft = await services.entries.saveDraft({
      entryId: "PW-0010",
      title: { zh: "布隆过滤器", en: "Bloom filter" },
      summary: { zh: "草稿", en: "Draft" },
      body: "draft body",
      note: "test draft",
      authorId: "a-qingkong",
    });
    expect(await services.entries.getRevisionBody(draft.id)).toBe("draft body");
    const submitted = await services.entries.transition({
      entryId: "PW-0010",
      action: "submit",
      actorId: "a-qingkong",
    });
    expect(submitted.state).toBe("in_review");
    const published = await services.entries.transition({
      entryId: "PW-0010",
      action: "publish",
      actorId: "a-qingkong",
    });
    expect(published.state).toBe("published");
  });

  it("rejects invalid lifecycle transitions", async () => {
    const services = createMockServices();
    await expect(
      services.entries.transition({ entryId: "PW-0001", action: "publish", actorId: "a-qingkong" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects a stale editor revision", async () => {
    const services = createMockServices();
    await expect(
      services.entries.saveDraft({
        entryId: "PW-0001",
        title: { zh: "流言协议", en: "Gossip protocol" },
        summary: { zh: "摘要", en: "Summary" },
        body: "new",
        note: "stale",
        authorId: "a-qingkong",
        baseRevision: 1,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("creates a new entry from a draft filed into a phylum", async () => {
    const services = createMockServices();
    const rev = await services.entries.saveDraft({
      title: { zh: "测试条目", en: "Test entry" },
      summary: { zh: "一份测试草稿。", en: "A test draft." },
      body: ":::zh\n内容\n:::\n\n:::en\nBody\n:::",
      note: "new sheet",
      authorId: "a-qingkong",
      domain: "systems",
    });
    expect(rev.number).toBe(1);
    expect(rev.entryId).toMatch(/^PW-\d{4}$/);
    const entry = await services.entries.getEntryById(rev.entryId);
    expect(entry?.domain).toBe("systems");
    expect(entry?.status).toBe("draft");
    expect(entry?.slug).toBe("test-entry");
    expect(entry?.bodyLanguages).toEqual(["zh", "en"]);
    expect(await services.entries.getRevisionBody(rev.id)).toContain("内容");
  });

  it("persists entry metadata with a draft", async () => {
    const services = createMockServices();
    const revision = await services.entries.saveDraft({
      title: { zh: "带元数据的条目", en: "Metadata entry" },
      summary: { zh: "摘要", en: "Summary" },
      body: ":::zh\n内容\n:::\n\n:::en\nBody\n:::",
      note: "metadata",
      authorId: "a-qingkong",
      domain: "systems",
      metadata: {
        scale: "macro",
        role: "host",
        contributorIds: [],
        sourceIds: ["s-ostep18"],
        tagIds: ["memory"],
        relationDrafts: [],
        pendingSources: [],
        pendingTags: [],
        heroAssetId: "plate-os-kernel",
      },
    });
    const entry = await services.entries.getEntryById(revision.entryId);
    expect(entry).toMatchObject({
      scale: "macro",
      role: "host",
      sourceIds: ["s-ostep18"],
      tagIds: ["memory"],
      heroAssetId: "plate-os-kernel",
    });
  });

  it("rejects a new draft without a valid phylum", async () => {
    const services = createMockServices();
    await expect(
      services.entries.saveDraft({
        title: { zh: "x", en: "x" },
        summary: { zh: "", en: "" },
        body: "b",
        note: "n",
        authorId: "a-qingkong",
        domain: "not-a-phylum" as never,
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });
});
