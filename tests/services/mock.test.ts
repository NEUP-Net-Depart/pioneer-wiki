import { describe, expect, it } from "vitest";
import { createMockServices } from "@/lib/services/mock";
import type { EntryMetadata } from "@/lib/model/types";

const body = (zh: string, en: string) => `:::zh\n${zh}\n:::\n\n:::en\n${en}\n:::`;
const metadataOf = async (services: ReturnType<typeof createMockServices>, id: string) =>
  (await services.entries.getEditorial(id))!.latest.metadata;

/** Saves a revision on top of whatever is latest, as an editor that just opened the entry would. */
async function save(
  services: ReturnType<typeof createMockServices>,
  entryId: string,
  change: {
    title?: { zh: string; en: string };
    summary?: { zh: string; en: string };
    body?: string;
    metadata?: Partial<EntryMetadata>;
  },
) {
  const packet = (await services.entries.getEditorial(entryId))!;
  return services.entries.saveDraft({
    entryId,
    title: change.title ?? packet.latest.title,
    summary: change.summary ?? packet.latest.summary,
    body: change.body ?? packet.latest.body,
    note: "test",
    authorId: "a-qingkong",
    baseRevision: packet.entry.latestRevision,
    metadata: { ...packet.latest.metadata, ...change.metadata },
  });
}

describe("mock wiki services", () => {
  it("lists and searches entries with filters", async () => {
    const services = createMockServices();
    const entries = await services.entries.listEntries({ featured: true });
    expect(entries.length).toBeGreaterThan(0);
    const result = await services.search.search({ text: "memory", filters: { scale: ["macro"] } });
    expect(result.hits.some((hit) => hit.entry.slug === "memory-hierarchy")).toBe(true);
  });

  it("keeps a published entry whole for readers while its next revision is drafted and reviewed", async () => {
    const services = createMockServices();
    const before = (await services.entries.getEntry("gossip-protocol"))!;
    await save(services, "PW-0001", {
      title: { zh: "新标题", en: "Gossip, revised" },
      summary: { zh: "新摘要", en: "A revised summary" },
      body: body("新正文", "revised-body-needle"),
      metadata: { scale: before.scale === "macro" ? "micro" : "macro", tagIds: ["memory"] },
    });
    const draft = (await services.entries.getEntry("gossip-protocol"))!;
    expect(draft.title).toEqual(before.title);
    expect(draft.summary).toEqual(before.summary);
    expect(draft.scale).toBe(before.scale);
    expect(draft.tagIds).toEqual(before.tagIds);
    expect(draft.body).toBe(before.body);
    expect(draft.revision).toBe(before.revision);
    expect((await services.search.search({ text: "revised-body-needle" })).total).toBe(0);
    expect((await services.entries.listEntries()).find((e) => e.id === "PW-0001")?.title.en).toBe(before.title.en);
    // Editors see the draft.
    expect((await services.entries.getEditorial("PW-0001"))!.latest.title.en).toBe("Gossip, revised");

    const submitted = await services.entries.transition({
      entryId: "PW-0001",
      action: "submit",
      actorId: "a-qingkong",
    });
    expect((await services.entries.getEntry("gossip-protocol"))!.title.en).toBe(before.title.en);
    await services.entries.transition({
      entryId: "PW-0001",
      action: "publish",
      actorId: "a-qingkong",
      expectedRevision: submitted.number,
    });
    const after = (await services.entries.getEntry("gossip-protocol"))!;
    expect(after.title.en).toBe("Gossip, revised");
    expect(after.summary.en).toBe("A revised summary");
    expect(after.scale).not.toBe(before.scale);
    expect(after.tagIds).toEqual(["memory"]);
    expect(after.body).toContain("revised-body-needle");
    expect((await services.search.search({ text: "revised-body-needle" })).total).toBe(1);
  });

  it("never publishes a revision changed after it was reviewed", async () => {
    const services = createMockServices();
    await save(services, "PW-0003", { body: body("一", "one") });
    const submitted = await services.entries.transition({
      entryId: "PW-0003",
      action: "submit",
      actorId: "a-qingkong",
    });
    const resaved = await save(services, "PW-0003", { body: body("二", "two") });
    expect(resaved.withdrewReview).toBe(true);
    await expect(
      services.entries.transition({
        entryId: "PW-0003",
        action: "publish",
        actorId: "a-qingkong",
        expectedRevision: submitted.number,
      }),
    ).rejects.toMatchObject({ code: "conflict", reason: "revision_conflict" });
    await expect(
      services.entries.transition({ entryId: "PW-0003", action: "publish", actorId: "a-qingkong" }),
    ).rejects.toMatchObject({ reason: "expected_revision_required" });
  });

  it("returns a submission with a reason the author sees, and clears it on resubmission", async () => {
    const services = createMockServices();
    await save(services, "PW-0004", { body: body("改", "changed") });
    const submitted = await services.entries.transition({
      entryId: "PW-0004",
      action: "submit",
      actorId: "a-qingkong",
    });
    await expect(
      services.entries.transition({
        entryId: "PW-0004",
        action: "return",
        actorId: "a-qingkong",
        expectedRevision: submitted.number,
      }),
    ).rejects.toMatchObject({ reason: "reason_required" });
    await services.entries.transition({
      entryId: "PW-0004",
      action: "return",
      actorId: "a-qingkong",
      expectedRevision: submitted.number,
      note: "Cite a source",
    });
    const returned = await services.entries.listEditorial({ scope: "all", status: ["returned"] });
    expect(returned.rows.find((e) => e.id === "PW-0004")).toMatchObject({
      status: "draft",
      returnNote: "Cite a source",
    });
    await services.entries.transition({ entryId: "PW-0004", action: "submit", actorId: "a-qingkong" });
    expect((await services.entries.getEditorial("PW-0004"))!.entry.returnNote).toBeUndefined();
  });

  it("rolls back to a once-public revision as a new revision, and refuses an unreviewed one", async () => {
    const services = createMockServices();
    const original = (await services.entries.getEntry("gossip-protocol"))!;
    await save(services, "PW-0001", { title: { zh: "改名", en: "Renamed" } });
    const draftId = `PW-0001@r${(await services.entries.getEditorial("PW-0001"))!.entry.latestRevision}`;
    const submitted = await services.entries.transition({
      entryId: "PW-0001",
      action: "submit",
      actorId: "a-qingkong",
    });
    await expect(
      services.entries.transition({
        entryId: "PW-0001",
        action: "rollback",
        actorId: "a-qingkong",
        targetRevisionId: `PW-0001@r${original.revision}`,
      }),
    ).rejects.toMatchObject({ reason: "review_pending" });
    await services.entries.transition({
      entryId: "PW-0001",
      action: "publish",
      actorId: "a-qingkong",
      expectedRevision: submitted.number,
    });
    expect((await services.entries.getEntry("gossip-protocol"))!.title.en).toBe("Renamed");
    await expect(
      services.entries.transition({
        entryId: "PW-0001",
        action: "rollback",
        actorId: "a-qingkong",
        targetRevisionId: draftId,
      }),
    ).rejects.toMatchObject({ reason: "rollback_target_unpublished" });
    const rolled = await services.entries.transition({
      entryId: "PW-0001",
      action: "rollback",
      actorId: "a-qingkong",
      targetRevisionId: `PW-0001@r${original.revision}`,
    });
    const restored = (await services.entries.getEntry("gossip-protocol"))!;
    expect(restored.title).toEqual(original.title);
    expect(restored.revision).toBe(rolled.number);
    expect(rolled.number).toBeGreaterThan(submitted.number);
  });

  it("hides an archived entry everywhere public and brings it back on restore", async () => {
    const services = createMockServices();
    await services.entries.setArchived("PW-0001", true, "test");
    expect(await services.entries.getEntry("gossip-protocol")).toBeNull();
    expect((await services.entries.listEntries()).some((e) => e.id === "PW-0001")).toBe(false);
    expect((await services.search.search({ text: "PW-0001" })).total).toBe(0);
    await expect(save(services, "PW-0001", {})).rejects.toMatchObject({ reason: "entry_archived" });
    expect((await services.entries.listEditorial({ scope: "all", view: "archived" })).rows.map((e) => e.id)).toContain(
      "PW-0001",
    );
    await services.entries.setArchived("PW-0001", false);
    expect((await services.entries.getEntry("gossip-protocol"))?.id).toBe("PW-0001");
  });

  it("creates a new entry that stays private until published", async () => {
    const services = createMockServices();
    const rev = await services.entries.saveDraft({
      title: { zh: "测试条目", en: "Test entry" },
      summary: { zh: "一份测试草稿。", en: "A test draft." },
      body: body("内容", "Body"),
      note: "new sheet",
      authorId: "a-qingkong",
      domain: "systems",
    });
    expect(rev.number).toBe(1);
    expect(rev.entryId).toMatch(/^PW-\d{4}$/);
    expect(rev.slug).toBe("test-entry");
    expect(await services.entries.getEntryById(rev.entryId)).toBeNull();
    const twin = await services.entries.saveDraft({
      title: { zh: "测试条目二", en: "Test entry" },
      summary: { zh: "摘要", en: "Summary" },
      body: body("内容", "Body"),
      note: "twin",
      authorId: "a-qingkong",
      domain: "systems",
    });
    expect(twin.slug).toBe("test-entry-2");
    const submitted = await services.entries.transition({
      entryId: rev.entryId,
      action: "submit",
      actorId: "a-qingkong",
    });
    await services.entries.transition({
      entryId: rev.entryId,
      action: "publish",
      actorId: "a-qingkong",
      expectedRevision: submitted.number,
    });
    expect(await services.entries.getEntry("test-entry")).toMatchObject({
      id: rev.entryId,
      status: "published",
      bodyLanguages: ["zh", "en"],
    });
  });

  it("records the whole draft contract in the revision and only publishes it as a whole", async () => {
    const services = createMockServices();
    const rev = await services.entries.saveDraft({
      title: { zh: "带元数据的条目", en: "Metadata entry" },
      summary: { zh: "摘要", en: "Summary" },
      body: body("内容", "Body"),
      note: "metadata",
      authorId: "a-qingkong",
      domain: "systems",
      metadata: {
        scale: "macro",
        role: "host",
        contributorIds: [],
        sourceIds: ["s-ostep18"],
        tagIds: ["memory"],
        relationDrafts: [{ to: "PW-0001", kind: "contrast", strength: 2 }],
        pendingSources: ["A field guide https://example.org/guide"],
        pendingTags: ["流式 / Streaming"],
        heroAssetId: "plate-os-kernel",
      },
    });
    const snapshot = (await services.entries.getRevision(rev.id))!;
    expect(snapshot).toMatchObject({ recorded: true, title: { en: "Metadata entry" } });
    expect(snapshot.metadata).toMatchObject({
      scale: "macro",
      role: "host",
      sourceIds: ["s-ostep18"],
      heroAssetId: "plate-os-kernel",
    });
    expect(snapshot.metadata.pendingTags).toEqual(["流式 / Streaming"]);
    const submitted = await services.entries.transition({
      entryId: rev.entryId,
      action: "submit",
      actorId: "a-qingkong",
    });
    await services.entries.transition({
      entryId: rev.entryId,
      action: "publish",
      actorId: "a-qingkong",
      expectedRevision: submitted.number,
    });
    const entry = (await services.entries.getEntryById(rev.entryId))!;
    expect(entry).toMatchObject({ scale: "macro", role: "host", heroAssetId: "plate-os-kernel" });
    const tags = await services.references.listTags();
    expect(tags.find((t) => t.label.en === "Streaming")?.label.zh).toBe("流式");
    expect(entry.tagIds).toEqual(["memory", tags.find((t) => t.label.en === "Streaming")!.id]);
    expect(entry.sourceIds).toHaveLength(2);
    expect((await services.entries.listRelations(rev.entryId)).map((r) => r.to)).toContain("PW-0001");
    expect((await metadataOf(services, rev.entryId)).pendingTags).toEqual([]);
  });

  it("rejects incomplete submissions, unknown references and stale revisions", async () => {
    const services = createMockServices();
    const mono = await services.entries.saveDraft({
      title: { zh: "", en: "English only" },
      summary: { zh: "", en: "Summary" },
      body: "No blocks",
      note: "n",
      authorId: "a-qingkong",
      domain: "systems",
    });
    await expect(
      services.entries.transition({ entryId: mono.entryId, action: "submit", actorId: "a-qingkong" }),
    ).rejects.toMatchObject({
      reason: "bilingual_incomplete",
    });
    await expect(save(services, "PW-0001", { metadata: { tagIds: ["no-such-tag"] } })).rejects.toMatchObject({
      reason: "unknown_tag",
    });
    await expect(
      save(services, "PW-0001", { metadata: { relationDrafts: [{ to: "PW-0001", kind: "contrast", strength: 1 }] } }),
    ).rejects.toMatchObject({ reason: "relation_to_self" });
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
    ).rejects.toMatchObject({ code: "conflict", reason: "revision_conflict" });
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

  it("refuses to publish an entry whose images are not approved", async () => {
    const services = createMockServices();
    const image = await services.references.uploadEntryAsset(
      { name: "00000000-0000-4000-8000-000000000001.webp", data: Buffer.from("x"), width: 4, height: 3 },
      { altZh: "图", altEn: "Figure", credit: "Test", license: "CC BY 4.0" },
    );
    expect(await services.references.getAsset(image.id)).toBeNull();
    await save(services, "PW-0001", { body: body("图", `![x](asset:${image.id})`) });
    const submitted = await services.entries.transition({
      entryId: "PW-0001",
      action: "submit",
      actorId: "a-qingkong",
    });
    await expect(
      services.entries.transition({
        entryId: "PW-0001",
        action: "publish",
        actorId: "a-qingkong",
        expectedRevision: submitted.number,
      }),
    ).rejects.toMatchObject({ reason: "assets_not_approved" });
    await services.references.reviewAsset(image.id, "approved");
    await services.entries.transition({
      entryId: "PW-0001",
      action: "publish",
      actorId: "a-qingkong",
      expectedRevision: submitted.number,
    });
    await expect(services.references.reviewAsset(image.id, "rejected", "late")).rejects.toMatchObject({
      reason: "asset_in_published_entry",
    });
  });

  it("keeps a newer autosave from being overwritten by an older editor", async () => {
    const services = createMockServices();
    const first = await services.entries.saveWorkingDraft({ entryId: "PW-0001", payload: { body: "a" } });
    const second = await services.entries.saveWorkingDraft({
      entryId: "PW-0001",
      payload: { body: "b" },
      knownVersion: first.version,
    });
    expect(second).toMatchObject({ conflict: false, version: 2 });
    const stale = await services.entries.saveWorkingDraft({
      entryId: "PW-0001",
      payload: { body: "old tab" },
      knownVersion: first.version,
    });
    expect(stale).toMatchObject({ conflict: true, version: 2, payload: { body: "b" } });
    expect((await services.entries.getWorkingDraft({ entryId: "PW-0001" }))?.payload).toEqual({ body: "b" });
  });
});
