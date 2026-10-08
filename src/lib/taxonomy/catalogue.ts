import "server-only";
import type { Category, EntrySummary, Family } from "@/lib/model/types";
import { getServices } from "@/lib/services";
import { toRoman } from "@/lib/roman";

/**
 * The catalogue as readers see it: active families and genera in order, with
 * the published entries filed under each genus and the ones that cite it as a
 * cross-genus reference. Every catalogue page reads it through here, so the
 * numbering (family I–VII, genus 1–n) is the same on every page.
 */
export interface Catalogue {
  families: Family[];
  categories: Category[];
  /** Readers only see published entries in the catalogue. */
  entries: EntrySummary[];
  familyOf: (category: Category) => Family | undefined;
  /** Family number, I, II… by sort order. */
  familyNumeral: (family: Family) => string;
  /** Genus number inside its family, 1, 2… by sort order. */
  genusNumber: (category: Category) => number;
  genera: (family: Family) => Category[];
  /** Published entries whose primary genus is this one, by catalogue number. */
  filed: (category: Category) => EntrySummary[];
  /** Published entries filed elsewhere that list this genus as a cross-genus reference. */
  referenced: (category: Category) => EntrySummary[];
  category: (id: string) => Category | undefined;
}

export async function getCatalogue(visibleEntries?: EntrySummary[]): Promise<Catalogue> {
  const { taxonomy, entries } = getServices();
  const [families, categories, all] = await Promise.all([
    taxonomy.listFamilies(),
    taxonomy.listCategories(),
    visibleEntries
      ? Promise.resolve(visibleEntries.filter((entry) => entry.status === "published"))
      : entries.listEntries({ status: ["published"] }),
  ]);
  const familyIds = new Set(families.map((f) => f.id));
  const live = categories.filter((c) => familyIds.has(c.familyId));
  const byCatalogue = (a: EntrySummary, b: EntrySummary) => a.id.localeCompare(b.id);
  const genera = (family: Family) => live.filter((c) => c.familyId === family.id);
  return {
    families,
    categories: live,
    entries: all,
    familyOf: (c) => families.find((f) => f.id === c.familyId),
    familyNumeral: (f) => toRoman(families.indexOf(f) + 1),
    genusNumber: (c) => live.filter((x) => x.familyId === c.familyId).indexOf(c) + 1,
    genera,
    filed: (c) => all.filter((e) => e.categoryId === c.id).sort(byCatalogue),
    referenced: (c) =>
      all.filter((e) => e.categoryId !== c.id && e.auxiliaryCategoryIds.includes(c.id)).sort(byCatalogue),
    category: (id) => live.find((c) => c.id === id),
  };
}
