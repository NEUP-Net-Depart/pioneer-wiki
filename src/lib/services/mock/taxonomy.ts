import type { Category, Family, TaxonKind, TaxonLink, TaxonVersion } from "@/lib/model/types";
import { categories, families } from "@/mock/taxonomy";
import { museumSnapshots } from "@/mock/museum";
import { authors } from "@/mock/people";
import { ServiceError, type TaxonPatch, type TaxonSaveInput, type TaxonomyRepository } from "@/lib/services/contracts";

/*
 * The catalogue in memory. Each createMockServices() call gets its own copy, so
 * tests that archive or rename a taxon do not leak into one another. Every
 * change appends a version; nothing is ever removed.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LATIN = /^[A-Z][a-z]+$/;

export interface TaxonomyStore {
  families: Family[];
  categories: Category[];
  versions: TaxonVersion[];
}

export function createTaxonomyStore(): TaxonomyStore {
  const store: TaxonomyStore = {
    families: families.map((f) => structuredClone(f)),
    categories: categories.map((c) => structuredClone(c)),
    versions: [],
  };
  for (const f of store.families) store.versions.push(version("family", f, "Catalogue imported"));
  for (const c of store.categories) store.versions.push(version("category", c, "Catalogue imported"));
  return store;
}

function version(kind: TaxonKind, data: Family | Category, note: string, authorId?: string): TaxonVersion {
  return {
    id: `${kind}:${data.id}@v${data.version}`,
    kind,
    taxonId: data.id,
    number: data.version,
    data: structuredClone(data),
    note,
    authorId,
    createdAt: data.updatedAt,
  };
}

/** A related link must be a site path or an http(s) address. */
export function validLink(link: TaxonLink): boolean {
  if (!link.label.zh.trim() && !link.label.en.trim()) return false;
  if (link.url.startsWith("/")) return !link.url.startsWith("//");
  try {
    const url = new URL(link.url);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function createMockTaxonomyRepository(store: TaxonomyStore): TaxonomyRepository {
  const list = (kind: TaxonKind): Array<Family | Category> => (kind === "family" ? store.families : store.categories);
  const find = (kind: TaxonKind, id: string) => list(kind).find((t) => t.id === id);
  const bySlug = (kind: TaxonKind, slug: string) =>
    list(kind).find((t) => t.slug === slug) ?? list(kind).find((t) => t.formerSlugs.includes(slug));
  const familyOrder = (id: string) => store.families.find((f) => f.id === id)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const record = (kind: TaxonKind, taxon: Family | Category, note: string, authorId?: string) => {
    const v = version(kind, taxon, note, authorId);
    store.versions.push(v);
    return structuredClone(v);
  };

  /** Checks a patched taxon and returns the next state; throws on anything a reader should never see. */
  const apply = (kind: TaxonKind, current: Family | Category, patch: TaxonPatch): Family | Category => {
    const next = structuredClone(current) as Family & Partial<Category>;
    if (patch.slug !== undefined) {
      if (!SLUG.test(patch.slug)) throw new ServiceError("invalid", "invalid_slug");
      const owner = bySlug(kind, patch.slug);
      if (owner && owner.id !== current.id) throw new ServiceError("conflict", "slug_taken");
      if (patch.slug !== current.slug) {
        next.formerSlugs = [...current.formerSlugs.filter((s) => s !== patch.slug), current.slug];
        next.slug = patch.slug;
      }
    }
    if (patch.name !== undefined) {
      if (!patch.name.zh.trim() || !patch.name.en.trim())
        throw new ServiceError("invalid", "invalid_name");
      next.name = { zh: patch.name.zh.trim(), en: patch.name.en.trim() };
    }
    if (patch.scientificName !== undefined) {
      if (!LATIN.test(patch.scientificName.trim()))
        throw new ServiceError("invalid", "invalid_scientific_name");
      next.scientificName = patch.scientificName.trim();
    }
    if (patch.taxonNameZh !== undefined) next.taxonNameZh = patch.taxonNameZh?.trim() || undefined;
    if (patch.intro !== undefined) next.intro = { zh: patch.intro.zh.trim(), en: patch.intro.en.trim() };
    if (patch.essay !== undefined) next.essay = patch.essay;
    if (patch.emblemAssetId !== undefined) next.emblemAssetId = patch.emblemAssetId ?? undefined;
    if (patch.links !== undefined) {
      if (!patch.links.every(validLink))
        throw new ServiceError("invalid", "invalid_links");
      next.links = patch.links.map((l) => ({ label: l.label, url: l.url.trim() }));
    }
    if (patch.leadId !== undefined) {
      if (patch.leadId && !authors.some((a) => a.id === patch.leadId))
        throw new ServiceError("invalid", "author_not_found");
      next.leadId = patch.leadId ?? undefined;
    }
    if (patch.collaboratorIds !== undefined) {
      if (!patch.collaboratorIds.every((id) => authors.some((a) => a.id === id)))
        throw new ServiceError("invalid", "author_not_found");
      next.collaboratorIds = [...new Set(patch.collaboratorIds)].filter((id) => id !== next.leadId);
    }
    if (patch.sortOrder !== undefined) {
      if (!Number.isInteger(patch.sortOrder) || patch.sortOrder < 0)
        throw new ServiceError("invalid", "invalid_sort_order");
      next.sortOrder = patch.sortOrder;
    }
    if (kind === "category") {
      if (patch.familyId !== undefined) {
        const family = store.families.find((f) => f.id === patch.familyId);
        if (!family || family.status !== "active") throw new ServiceError("invalid", "invalid_family");
        next.familyId = patch.familyId;
      }
      if (patch.representativeSlug !== undefined) {
        if (patch.representativeSlug && !SLUG.test(patch.representativeSlug))
          throw new ServiceError("invalid", "invalid_slug");
        next.representativeSlug = patch.representativeSlug ?? undefined;
      }
    }
    return next;
  };

  const sorted = <T extends Family | Category>(items: T[]) =>
    [...items].sort(
      (a, b) =>
        ("familyId" in a && "familyId" in b ? familyOrder(a.familyId) - familyOrder(b.familyId) : 0) ||
        a.sortOrder - b.sortOrder ||
        a.id.localeCompare(b.id),
    );

  const transition = (
    kind: TaxonKind,
    id: string,
    status: "active" | "archived",
    actorId: string | undefined,
    note: string,
  ) => {
    const taxon = find(kind, id);
    if (!taxon) throw new ServiceError("invalid", "taxon_not_found");
    if (taxon.status === status) throw new ServiceError("conflict", "unchanged_status");
    if (
      kind === "family" &&
      status === "archived" &&
      store.categories.some((c) => c.familyId === id && c.status === "active")
    )
      throw new ServiceError("conflict", "family_has_active_genera");
    if (kind === "category" && status === "active") {
      const family = store.families.find((f) => f.id === (taxon as Category).familyId);
      if (family?.status !== "active") throw new ServiceError("conflict", "family_archived");
    }
    taxon.status = status;
    taxon.version += 1;
    taxon.updatedAt = new Date().toISOString();
    return record(kind, taxon, note, actorId);
  };

  return {
    async listFamilies(query = {}) {
      return sorted(store.families.filter((f) => query.includeArchived || f.status === "active")).map((f) =>
        structuredClone(f),
      );
    },
    async listCategories(query = {}) {
      return sorted(
        store.categories.filter(
          (c) => (query.includeArchived || c.status === "active") && (!query.familyId || c.familyId === query.familyId),
        ),
      ).map((c) => structuredClone(c));
    },
    async getFamily(slug, query = {}) {
      const f = bySlug("family", slug);
      return f && (query.includeArchived || f.status === "active") ? (structuredClone(f) as Family) : null;
    },
    async getCategory(slug, query = {}) {
      const c = bySlug("category", slug) as Category | undefined;
      return c && (query.includeArchived || c.status === "active") ? structuredClone(c) : null;
    },
    async saveTaxon(input: TaxonSaveInput) {
      const now = new Date().toISOString();
      if (!input.id) {
        const { slug, name, scientificName } = input.patch;
        if (!slug || !name || !scientificName)
          throw new ServiceError("invalid", "taxon_incomplete");
        if (find(input.kind, slug)) throw new ServiceError("conflict", "slug_taken");
        if (input.kind === "category" && !input.patch.familyId)
          throw new ServiceError("invalid", "family_required");
        const blank: Family = {
          id: slug,
          slug,
          formerSlugs: [],
          name,
          scientificName,
          intro: { zh: "", en: "" },
          essay: "",
          links: [],
          collaboratorIds: [],
          sortOrder: list(input.kind).length + 1,
          status: "active",
          createdAt: now,
          updatedAt: now,
          version: 0,
        };
        const seed = input.kind === "category" ? { ...blank, familyId: input.patch.familyId ?? "" } : blank;
        const next = apply(input.kind, seed, input.patch);
        next.version = 1;
        list(input.kind).push(next as Family & Category);
        return record(input.kind, next, input.note || "Created", input.actorId);
      }
      const current = find(input.kind, input.id);
      if (!current) throw new ServiceError("invalid", "taxon_not_found");
      if (input.baseVersion !== undefined && input.baseVersion !== current.version)
        throw new ServiceError("conflict", "version_conflict");
      const next = apply(input.kind, current, input.patch);
      next.version = current.version + 1;
      next.updatedAt = now;
      Object.assign(current, next);
      return record(input.kind, current, input.note || "Saved", input.actorId);
    },
    async archiveTaxon(kind, id, actorId, note) {
      return transition(kind, id, "archived", actorId, note || "Archived");
    },
    async restoreTaxon(kind, id, actorId, note) {
      return transition(kind, id, "active", actorId, note || "Restored");
    },
    async snapshots(scientificNames) {
      const wanted = new Set(scientificNames);
      return Object.fromEntries(
        museumSnapshots.filter((s) => wanted.has(s.scientificName)).map((s) => [s.scientificName, structuredClone(s)]),
      );
    },
    async listTaxonVersions(kind, id) {
      return store.versions
        .filter((v) => v.kind === kind && v.taxonId === id)
        .sort((a, b) => b.number - a.number)
        .map((v) => structuredClone(v));
    },
    async revertTaxon(kind, id, versionNumber, actorId) {
      const current = find(kind, id);
      const old = store.versions.find((v) => v.kind === kind && v.taxonId === id && v.number === versionNumber);
      if (!current || !old) throw new ServiceError("invalid", "version_not_found");
      const {
        slug,
        name,
        scientificName,
        taxonNameZh,
        intro,
        essay,
        emblemAssetId,
        links,
        leadId,
        collaboratorIds,
        sortOrder,
      } = old.data;
      const patch: TaxonPatch = {
        slug,
        name,
        scientificName,
        taxonNameZh: taxonNameZh ?? null,
        intro,
        essay,
        emblemAssetId: emblemAssetId ?? null,
        links,
        leadId: leadId ?? null,
        collaboratorIds,
        sortOrder,
      };
      if (kind === "category") {
        patch.familyId = (old.data as Category).familyId;
        patch.representativeSlug = (old.data as Category).representativeSlug ?? null;
      }
      return this.saveTaxon({ kind, id, patch, note: `Reverted to version ${versionNumber}`, actorId });
    },
  };
}
