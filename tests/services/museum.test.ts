import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createMockServices } from "@/lib/services/mock";
import { bodyAt } from "@/lib/services/mock/body";
import { entries, museumBodySince } from "@/mock/entries";
import { museumArticles, museumSnapshots, museumSources } from "@/mock/museum";
import { sources } from "@/mock/people";
import { categories, families, entryTaxonomy } from "@/mock/taxonomy";
import { SpecimenLabel } from "@/components/taxonomy/Taxonomy";

/*
 * The museum articles are imported from the curation package by
 * tools/import-museum-articles.mjs. These checks hold the imported data to what
 * the site needs: rewrites keep the history they replace, every body passes the
 * bilingual submission rule, every citation and name snapshot resolves.
 */

const museumBody = (slug: string) =>
  readFileSync(join(process.cwd(), "src", "mock", "bodies", "museum", `${slug}.md`), "utf8").trim();

describe("museum articles", () => {
  it("rewrite the sixteen earlier entries as one new revision and leave their history readable", async () => {
    const { entries: repo } = createMockServices();
    const rewrites = museumArticles.filter((a) => a.legacy);
    expect(rewrites).toHaveLength(16);
    for (const article of rewrites) {
      const since = museumBodySince[article.slug];
      // Editors see every ring; readers only the published ones.
      const revisions = await repo.listRevisions(article.id, { scope: "editorial" });
      expect(revisions[0], article.slug).toMatchObject({ number: since, state: "published" });
      expect(revisions.length, article.slug).toBe(since);
      expect(bodyAt(article.slug, since)).toBe(museumBody(article.slug));
      // The revision before the rewrite still reads its own text, not the museum article.
      const before = bodyAt(article.slug, since - 1);
      expect(before, article.slug).not.toBe("");
      expect(before, article.slug).not.toBe(museumBody(article.slug));
      expect((await repo.getEntry(article.slug))?.revision).toBe(since);
    }
  });

  it("send a revision still waiting for review back to its author as a draft", async () => {
    const { entries: repo } = createMockServices();
    for (const id of ["PW-0006", "PW-0012"]) {
      const states = (await repo.listRevisions(id, { scope: "editorial" })).map((r) => `${r.number}:${r.state}`);
      expect(states).toEqual(["3:published", "2:draft", "1:published"]);
      // The draft ring is never offered to readers.
      expect((await repo.listRevisions(id)).map((r) => r.number)).toEqual([3, 1]);
    }
  });

  it("add the other thirty-seven as new published entries numbered after PW-0016", () => {
    const added = museumArticles.filter((a) => !a.legacy);
    expect(added).toHaveLength(37);
    expect(added.map((a) => a.id)).toEqual(added.map((_, i) => `PW-${String(17 + i).padStart(4, "0")}`));
    for (const a of added) {
      expect(entries.find((e) => e.slug === a.slug)).toMatchObject({ id: a.id, status: "published", revision: 1 });
      expect(museumBodySince[a.slug]).toBe(1);
    }
  });

  it("file each article where the catalogue's representative list puts it", () => {
    const genera = new Set(categories.map((c) => c.id));
    for (const a of museumArticles) {
      expect(genera.has(a.filing.categoryId), a.slug).toBe(true);
      for (const aux of a.filing.auxiliaryCategoryIds) expect(genera.has(aux), `${a.slug} → ${aux}`).toBe(true);
      // The sixteen filed by hand in PR #10 agree with the package.
      if (entryTaxonomy[a.slug]) expect(entryTaxonomy[a.slug], a.slug).toEqual(a.filing);
    }
  });

  it("pass the bilingual submission rule and link only to entries that exist", () => {
    const slugs = new Set(entries.map((e) => e.slug));
    for (const entry of entries) {
      const body = bodyAt(entry.slug, entry.revision);
      expect(body, entry.slug).toMatch(/^:::zh\s*$/m);
      expect(body, entry.slug).toMatch(/^:::en\s*$/m);
      expect(entry.title.zh && entry.title.en && entry.summary.zh && entry.summary.en, entry.slug).toBeTruthy();
      // The renderer reads $…$ math only.
      expect(body, entry.slug).not.toMatch(/\\\(|\\\[/);
      for (const [, slug] of body.matchAll(/\]\(\/entries\/([\w-]+)\)/g))
        expect(slugs.has(slug), `${entry.slug} → ${slug}`).toBe(true);
    }
  });

  it("keep the curatorial pairing sentence out of the card summary", () => {
    for (const a of museumArticles) {
      expect(a.summary.zh, a.slug).not.toMatch(/策展|对应物|taxonomy-map/);
      expect(a.summary.en, a.slug).not.toMatch(/counterpart|curatorial|catalogue pairing/i);
      expect(a.summary.zh + a.summary.en, a.slug).not.toMatch(/[*$]|\]\(/);
    }
  });

  it("cite sources that resolve, with a year only where the work states one", () => {
    const byId = new Map(sources.map((s) => [s.id, s]));
    for (const entry of entries) {
      for (const id of entry.sourceIds) expect(byId.has(id), `${entry.slug} cites ${id}`).toBe(true);
    }
    expect(new Set(museumSources.map((s) => s.url)).size).toBe(museumSources.length);
    for (const s of museumSources) {
      expect(s.title && s.creators && s.url, s.id).toBeTruthy();
      if (s.year !== undefined) expect(Number.isInteger(s.year) && s.year > 1900 && s.year < 2100, s.id).toBe(true);
    }
  });
});

describe("name snapshots", () => {
  it("cover every family, genus and species of the catalogue", () => {
    const names = new Set(museumSnapshots.map((s) => s.scientificName));
    for (const f of families) expect(names.has(f.scientificName), f.scientificName).toBe(true);
    for (const c of categories) expect(names.has(c.scientificName), c.scientificName).toBe(true);
    for (const e of entries) expect(names.has(e.species!), e.species).toBe(true);
  });

  it("name Catalogue of Life COL26.9 first, or the specialist database where COL has no species record", () => {
    for (const s of museumSnapshots) {
      const [primary] = s.sources;
      if (primary.catalogue === "col") expect(primary.release, s.scientificName).toBe("COL26.9");
      else expect([s.rank, primary.catalogue], s.scientificName).toEqual(["species", "algaebase"]);
      for (const source of s.sources) expect(source.url, s.scientificName).toMatch(/^https:\/\//);
    }
    const desmids = museumSnapshots.filter((s) => s.sources[0].catalogue === "algaebase");
    expect(desmids).toHaveLength(11);
  });

  it("are served by the taxonomy repository by scientific name", async () => {
    const { taxonomy } = createMockServices();
    const found = await taxonomy.snapshots(["Aphelocoma coerulescens", "Nomen nudum"]);
    expect(Object.keys(found)).toEqual(["Aphelocoma coerulescens"]);
    expect(found["Aphelocoma coerulescens"]).toMatchObject({ rank: "species", authority: "(Bosc, 1795)" });
  });
});

describe("the specimen label", () => {
  const entry = entries.find((e) => e.slug === "perceptron")!;
  const category = categories.find((c) => c.id === entry.categoryId)!;
  const family = families.find((f) => f.id === category.familyId)!;
  const snapshot = museumSnapshots.find((s) => s.scientificName === entry.species);

  it("prints the authority and links the checklists the name was verified in", () => {
    const html = renderToStaticMarkup(SpecimenLabel({ entry, family, category, snapshot, lang: "en" }));
    expect(html).toContain("(Bosc, 1795)");
    expect(html).toContain("Catalogue of Life COL26.9");
    expect(html).toContain('href="https://www.checklistbank.org/dataset/316321/taxon/FCWR"');
    expect(html).toContain("GBIF");
    expect(html).not.toContain("being verified");
  });

  it("says a name without a snapshot is still being verified", () => {
    const html = renderToStaticMarkup(SpecimenLabel({ entry, family, category, lang: "zh" }));
    expect(html).toContain("快照核验中");
  });
});
