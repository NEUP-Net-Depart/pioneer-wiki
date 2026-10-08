import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createMockServices } from "@/lib/services/mock";
import { categories, families } from "@/mock/taxonomy";
import { entries } from "@/mock/entries";
import { LEGACY_DOMAINS, genusForLegacyDomain } from "@/lib/taxonomy/legacy";
import { DOMAIN_IDS } from "@/lib/model/vocab";

const PACKAGE = join(process.cwd(), "handoff", "museum-upgrade", "taxonomy-map.json");

const draftBody = ":::zh\n内容\n:::\n\n:::en\nBody\n:::";
const meta = {
  scale: "macro" as const,
  role: "host" as const,
  contributorIds: [],
  sourceIds: [],
  tagIds: [],
  relationDrafts: [],
  pendingSources: [],
  pendingTags: [],
};

describe("the family → genus catalogue", () => {
  it("has seven families and forty-five genera, each genus in one family", () => {
    expect(families).toHaveLength(7);
    expect(categories).toHaveLength(45);
    const familyIds = new Set(families.map((f) => f.id));
    for (const c of categories) expect(familyIds.has(c.familyId), c.id).toBe(true);
    expect(new Set(categories.map((c) => c.id)).size).toBe(45);
    expect(new Set(categories.map((c) => c.scientificName)).size).toBe(45);
  });

  it("files every existing entry under an active genus, with a species of that genus", () => {
    const genera = new Map(categories.map((c) => [c.id, c]));
    for (const entry of entries) {
      const genus = genera.get(entry.categoryId);
      expect(genus, entry.slug).toBeDefined();
      expect(entry.species?.startsWith(`${genus?.scientificName} `), entry.slug).toBe(true);
      expect(entry.auxiliaryCategoryIds).not.toContain(entry.categoryId);
      for (const aux of entry.auxiliaryCategoryIds) expect(genera.has(aux), `${entry.slug} → ${aux}`).toBe(true);
    }
    expect(new Set(entries.map((e) => e.species)).size).toBe(entries.length);
  });

  it("holds the 53 museum articles: one species each, every genus represented", () => {
    const slugs = entries.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(53);
    expect(entries.every((e) => e.status === "published")).toBe(true);
    // Each genus's representative article is in the catalogue, and no species is described twice.
    for (const c of categories) expect(slugs).toContain(c.representativeSlug);
    expect(new Set(entries.map((e) => e.species)).size).toBe(53);
  });

  it("matches the curation package when it is present locally", () => {
    let pkg: {
      families: Array<{ id: string; scientificName: string }>;
      categories: Array<{ id: string; familyId: string; scientificName: string; representativeSlug: string }>;
      articles: Array<{ slug: string; legacyEntryId?: string; primaryCategoryId: string; species: string }>;
    };
    try {
      pkg = JSON.parse(readFileSync(PACKAGE, "utf8"));
    } catch {
      return; // The package is not in the repository; CI checks the fixture on its own.
    }
    expect(families.map((f) => [f.id, f.scientificName])).toEqual(pkg.families.map((f) => [f.id, f.scientificName]));
    for (const c of pkg.categories) {
      expect(categories.find((x) => x.id === c.id)).toMatchObject({
        familyId: c.familyId,
        scientificName: c.scientificName,
        representativeSlug: c.representativeSlug,
      });
    }
    for (const a of pkg.articles.filter((x) => x.legacyEntryId)) {
      expect(entries.find((e) => e.slug === a.slug)).toMatchObject({
        categoryId: a.primaryCategoryId,
        species: a.species,
      });
    }
  });

  it("maps every old phylum to a family or genus that exists", () => {
    expect(Object.keys(LEGACY_DOMAINS).sort()).toEqual([...DOMAIN_IDS].sort());
    for (const target of Object.values(LEGACY_DOMAINS)) {
      const pool = target.kind === "family" ? families : categories;
      expect(
        pool.some((t) => t.id === target.id),
        target.id,
      ).toBe(true);
    }
    expect(genusForLegacyDomain("distributed", categories)).toBe("distributed-systems");
    expect(genusForLegacyDomain("ml", categories)).toBe("machine-learning");
  });
});

describe("mock taxonomy repository", () => {
  it("lists families in order and genera by family", async () => {
    const { taxonomy } = createMockServices();
    const list = await taxonomy.listFamilies();
    expect(list.map((f) => f.scientificName)).toEqual([
      "Corvidae",
      "Rosaceae",
      "Desmidiaceae",
      "Sciuridae",
      "Nymphalidae",
      "Geoemydidae",
      "Cichlidae",
    ]);
    const genera = await taxonomy.listCategories({ familyId: "systems-infrastructure" });
    expect(genera.map((c) => c.scientificName)).toEqual([
      "Cosmarium",
      "Micrasterias",
      "Staurastrum",
      "Desmidium",
      "Xanthidium",
      "Euastrum",
      "Staurodesmus",
    ]);
  });

  it("saves at once, keeps a version per change, and keeps old slugs resolving", async () => {
    const { taxonomy } = createMockServices();
    const v2 = await taxonomy.saveTaxon({
      kind: "category",
      id: "databases",
      patch: { slug: "database-systems", intro: { zh: "数据如何被保存与查询。", en: "How data is kept and queried." } },
      note: "rename",
      baseVersion: 1,
    });
    expect(v2.number).toBe(2);
    expect((await taxonomy.getCategory("database-systems"))?.intro.zh).toBe("数据如何被保存与查询。");
    expect((await taxonomy.getCategory("databases"))?.slug).toBe("database-systems");
    await expect(
      taxonomy.saveTaxon({ kind: "category", id: "databases", patch: { sortOrder: 3 }, note: "stale", baseVersion: 1 }),
    ).rejects.toMatchObject({ code: "conflict" });
    const reverted = await taxonomy.revertTaxon("category", "databases", 1);
    expect(reverted.number).toBe(3);
    expect((await taxonomy.getCategory("databases"))?.intro.zh).toBe("");
    expect((await taxonomy.listTaxonVersions("category", "databases")).map((v) => v.number)).toEqual([3, 2, 1]);
  });

  it("validates names, Latin names, slugs and links", async () => {
    const { taxonomy } = createMockServices();
    const save = (patch: Record<string, unknown>) =>
      taxonomy.saveTaxon({ kind: "family", id: "ai", patch, note: "check" });
    await expect(save({ name: { zh: "人工智能", en: "" } })).rejects.toMatchObject({ code: "invalid" });
    await expect(save({ scientificName: "corvidae" })).rejects.toMatchObject({ code: "invalid" });
    await expect(save({ slug: "Not A Slug" })).rejects.toMatchObject({ code: "invalid" });
    await expect(save({ slug: "software-development" })).rejects.toMatchObject({ code: "conflict" });
    await expect(
      save({ links: [{ label: { zh: "坏", en: "Bad" }, url: "javascript:alert(1)" }] }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(save({ links: [{ label: { zh: "", en: "" }, url: "/graph" }] })).rejects.toMatchObject({
      code: "invalid",
    });
    const ok = await save({
      links: [
        { label: { zh: "关系图", en: "Relations" }, url: "/graph" },
        { label: { zh: "外部", en: "External" }, url: "https://example.org/corvids" },
      ],
      leadId: "a-qingkong",
    });
    expect(ok.data.links).toHaveLength(2);
    expect(ok.data.leadId).toBe("a-qingkong");
  });

  it("archives and restores, never deletes, and guards the family order", async () => {
    const services = createMockServices();
    const { taxonomy } = services;
    expect("deleteTaxon" in taxonomy).toBe(false);
    await expect(taxonomy.archiveTaxon("family", "ai")).rejects.toMatchObject({ code: "conflict" });
    await taxonomy.archiveTaxon("category", "cloud-devops");
    expect(await taxonomy.getCategory("cloud-devops")).toBeNull();
    expect((await taxonomy.getCategory("cloud-devops", { includeArchived: true }))?.status).toBe("archived");
    expect((await taxonomy.listCategories()).map((c) => c.id)).not.toContain("cloud-devops");
    await taxonomy.restoreTaxon("category", "cloud-devops");
    expect((await taxonomy.getCategory("cloud-devops"))?.status).toBe("active");
    expect((await taxonomy.listTaxonVersions("category", "cloud-devops")).map((v) => v.note)).toEqual([
      "Restored",
      "Archived",
      "Catalogue imported",
    ]);
  });

  it("keeps each services instance's catalogue separate", async () => {
    const a = createMockServices();
    const b = createMockServices();
    await a.taxonomy.archiveTaxon("category", "observability");
    expect(await b.taxonomy.getCategory("observability")).not.toBeNull();
  });
});

describe("entries and their place in the catalogue", () => {
  it("lists entries by genus, by family and by cross-genus reference", async () => {
    const { entries: repo } = createMockServices();
    const genus = await repo.listEntries({ categoryId: ["distributed-systems"] });
    expect(genus.map((e) => e.slug).sort()).toEqual([
      "distributed-systems",
      "gossip-protocol",
      "paxos",
      "raft-consensus",
    ]);
    const family = await repo.listEntries({ familyId: ["systems-infrastructure"] });
    expect(family.map((e) => e.slug).sort()).toEqual([
      "cache-line",
      "distributed-systems",
      "garbage-collection",
      "gossip-protocol",
      "memory-hierarchy",
      "os-kernel",
      "paxos",
      "performance-analysis",
      "raft-consensus",
      "repeatable-deployment",
      "tcp-congestion-control",
    ]);
    const referenced = await repo.listEntries({ auxiliaryCategoryId: ["performance-engineering"] });
    expect(referenced.map((e) => e.slug).sort()).toEqual([
      "cache-line",
      "garbage-collection",
      "memory-hierarchy",
      "tcp-congestion-control",
    ]);
  });

  it("refiles an entry only when the revision that refiles it is published", async () => {
    const { entries: repo } = createMockServices();
    const draft = await repo.saveDraft({
      entryId: "PW-0002",
      title: { zh: "Raft 共识算法", en: "Raft consensus" },
      summary: { zh: "摘要", en: "Summary" },
      body: draftBody,
      note: "refile",
      authorId: "a-qingkong",
      baseRevision: 3,
      metadata: {
        ...meta,
        categoryId: "networks-protocols",
        auxiliaryCategoryIds: ["distributed-systems"],
        species: "Staurastrum paradoxum",
      },
    });
    expect(draft.taxonomy).toMatchObject({ categoryId: "networks-protocols", species: "Staurastrum paradoxum" });
    // The public place does not move with a draft.
    expect((await repo.getEntry("raft-consensus"))?.categoryId).toBe("distributed-systems");
    expect((await repo.listEntries({ categoryId: ["networks-protocols"] })).map((e) => e.slug)).not.toContain(
      "raft-consensus",
    );

    const submitted = await repo.transition({ entryId: "PW-0002", action: "submit", actorId: "a-qingkong" });
    expect((await repo.getEntry("raft-consensus"))?.categoryId).toBe("distributed-systems");
    await repo.transition({
      entryId: "PW-0002",
      action: "publish",
      actorId: "a-qingkong",
      expectedRevision: submitted.number,
    });
    const published = await repo.getEntry("raft-consensus");
    expect(published).toMatchObject({
      categoryId: "networks-protocols",
      auxiliaryCategoryIds: ["distributed-systems"],
      species: "Staurastrum paradoxum",
    });
    expect((await repo.listEntries({ auxiliaryCategoryId: ["distributed-systems"] })).map((e) => e.slug)).toContain(
      "raft-consensus",
    );

    // Rolling back to r3 (the museum rewrite) restores the old place.
    await repo.transition({
      entryId: "PW-0002",
      action: "rollback",
      actorId: "a-qingkong",
      targetRevisionId: "PW-0002@r3",
    });
    expect(await repo.getEntry("raft-consensus")).toMatchObject({
      categoryId: "distributed-systems",
      species: "Desmidium aptogonum",
    });
  });

  it("rejects a place the catalogue cannot hold", async () => {
    const services = createMockServices();
    const save = (metadata: Record<string, unknown>) =>
      services.entries.saveDraft({
        entryId: "PW-0001",
        title: { zh: "流言协议", en: "Gossip protocol" },
        summary: { zh: "摘要", en: "Summary" },
        body: draftBody,
        note: "bad place",
        authorId: "a-qingkong",
        metadata: { ...meta, ...metadata },
      });
    await expect(save({ categoryId: "no-such-genus" })).rejects.toMatchObject({ code: "invalid" });
    await expect(save({ auxiliaryCategoryIds: ["distributed-systems"] })).rejects.toMatchObject({ code: "invalid" });
    await expect(save({ species: "Corvus corax" })).rejects.toMatchObject({ code: "invalid" });
    await expect(save({ level: "expert" })).rejects.toMatchObject({ code: "invalid" });
    await services.taxonomy.archiveTaxon("category", "observability");
    await expect(save({ auxiliaryCategoryIds: ["observability"] })).rejects.toMatchObject({ code: "invalid" });
  });

  it("files a new entry by genus, or by an old phylum for older clients", async () => {
    const { entries: repo } = createMockServices();
    const byGenus = await repo.saveDraft({
      title: { zh: "新条目", en: "Genus entry" },
      summary: { zh: "摘要", en: "Summary" },
      body: draftBody,
      note: "new",
      authorId: "a-qingkong",
      categoryId: "cryptography",
    });
    // Unpublished: readers do not see it, its editors find it filed under the genus.
    expect(await repo.getEntryById(byGenus.entryId)).toBeNull();
    expect((await repo.getEditorial(byGenus.entryId))?.latest.metadata.categoryId).toBe("cryptography");
    const byPhylum = await repo.saveDraft({
      title: { zh: "旧客户端", en: "Phylum entry" },
      summary: { zh: "摘要", en: "Summary" },
      body: draftBody,
      note: "new",
      authorId: "a-qingkong",
      domain: "security",
    });
    expect((await repo.getEditorial(byPhylum.entryId))?.latest.metadata.categoryId).toBe("application-security");
  });

  it("searches by family and genus", async () => {
    const { search } = createMockServices();
    const result = await search.search({ text: "", filters: { familyId: ["ai"] } });
    expect(result.hits.map((h) => h.entry.slug).sort()).toEqual([
      "agent-architecture",
      "ai-assisted-development",
      "ai-evaluation",
      "backpropagation",
      "llm-generation",
      "model-serving",
      "perceptron",
    ]);
    expect(result.facets.family["systems-infrastructure"]).toBe(11);
    const genus = await search.search({ text: "", filters: { categoryId: ["data-structures"] } });
    expect(genus.hits.map((h) => h.entry.slug).sort()).toEqual(["b-tree", "bloom-filter", "data-structures"]);
  });
});

describe("publishing into an archived genus", () => {
  it("refuses, and leaves the entry and its history untouched", async () => {
    const { entries: repo, taxonomy } = createMockServices();
    await repo.saveDraft({
      entryId: "PW-0007",
      title: { zh: "操作系统内核", en: "Operating-system kernel" },
      summary: { zh: "摘要", en: "Summary" },
      body: draftBody,
      note: "refile",
      authorId: "a-qingkong",
      metadata: { ...meta, categoryId: "cloud-devops", auxiliaryCategoryIds: [], species: "Xanthidium armatum" },
    });
    await repo.transition({ entryId: "PW-0007", action: "submit", actorId: "a-qingkong" });
    await taxonomy.archiveTaxon("category", "cloud-devops");
    const before = (await repo.listRevisions("PW-0007")).length;
    await expect(
      repo.transition({ entryId: "PW-0007", action: "publish", actorId: "a-qingkong" }),
    ).rejects.toMatchObject({ code: "invalid" });
    expect((await repo.listRevisions("PW-0007")).length).toBe(before);
    expect((await repo.getEntry("os-kernel"))?.categoryId).toBe("operating-systems");
  });
});
