import type { Asset, AssetRecord } from "@/lib/model/types";
import { ServiceError, type AssetDetails, type EntryRepository, type ReferenceRepository } from "@/lib/services/contracts";
import { readLocalImage, writeLocalImage } from "@/lib/media/store";
import { bodyAssetIds } from "@/lib/entries/lifecycle";
import { paginate, type MockAsset, type MockContext } from "./context";

/*
 * Reference records and images for the fixtures backend. Fixture images are
 * files under public/ and count as approved; uploads are kept in .data and
 * wait for an administrator, exactly like the database's review.
 */

const strip = ({ ownerId, file, usedBy, reviewNote, ownerHandle, createdAt, ...asset }: MockAsset): Asset => {
  void ownerId;
  void file;
  void usedBy;
  void reviewNote;
  void ownerHandle;
  void createdAt;
  return structuredClone(asset);
};

function describe(asset: MockAsset, details: AssetDetails | undefined) {
  if (!details) return;
  for (const [key, max] of [
    ["altZh", 300],
    ["altEn", 300],
    ["captionZh", 300],
    ["captionEn", 300],
    ["credit", 120],
    ["license", 80],
  ] as const)
    if ((details[key]?.length ?? 0) > max) throw new ServiceError("invalid", "invalid_asset_details");
  if (details.sourceUrl && !/^https?:\/\//i.test(details.sourceUrl)) throw new ServiceError("invalid", "invalid_asset_details");
  if (details.altZh !== undefined || details.altEn !== undefined)
    asset.alt = { zh: details.altZh?.trim() ?? asset.alt.zh, en: details.altEn?.trim() ?? asset.alt.en };
  if (details.captionZh !== undefined || details.captionEn !== undefined)
    asset.caption = { zh: details.captionZh?.trim() ?? "", en: details.captionEn?.trim() ?? "" };
  if (details.credit?.trim()) asset.credit = details.credit.trim();
  if (details.license?.trim()) asset.license = details.license.trim();
  if (details.sourceUrl !== undefined) asset.sourceUrl = details.sourceUrl.trim() || undefined;
}

export function createMockReferenceRepository(context: MockContext, entries: () => EntryRepository): ReferenceRepository {
  const usage = async (id: string) => {
    const published = await entries().listEntries();
    const rows: AssetRecord["usedBy"] = [];
    for (const entry of published) {
      const body = (await entries().getRevisionBody(`${entry.id}@r${entry.revision}`)) ?? "";
      if (entry.heroAssetId === id || bodyAssetIds(body).includes(id))
        rows.push({ id: entry.id, slug: entry.slug, published: true });
    }
    return rows;
  };
  const find = (id: string) => {
    const asset = context.assets.find((a) => a.id === id);
    if (!asset) throw new ServiceError("invalid", "asset_not_found");
    return asset;
  };
  return {
    listAuthors: async () => structuredClone(context.authors),
    listSources: async () => structuredClone(context.sources),
    listTags: async () => structuredClone(context.tags),
    async getAsset(id) {
      const asset = context.assets.find((a) => a.id === id && a.reviewStatus === "approved");
      return asset ? strip(asset) : null;
    },
    async listAssets() {
      const account = context.account();
      return context.assets
        .filter((a) => a.reviewStatus === "approved" || (account && a.ownerId === account.id))
        .map(strip);
    },
    async listAssetsForReview(query = {}) {
      context.requireActive(true);
      const text = query.text?.trim().toLowerCase() ?? "";
      const statuses = query.status ?? ["pending"];
      const rows = await Promise.all(
        context.assets
          .filter((a) => !statuses.length || statuses.includes(a.reviewStatus))
          .filter((a) => !text || [a.id, a.alt.zh, a.alt.en, a.credit, a.license].some((v) => v.toLowerCase().includes(text)))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(async (a) => ({ ...strip(a), reviewStatus: a.reviewStatus, reviewNote: a.reviewNote, ownerHandle: a.ownerHandle, createdAt: a.createdAt, usedBy: await usage(a.id) })),
      );
      return paginate(rows, query.limit ?? 24, query.offset);
    },
    async reviewAsset(id, decision, note, details) {
      context.requireActive(true);
      const asset = find(id);
      describe(asset, details);
      if (decision === "approved" && (!asset.alt.zh.trim() || !asset.alt.en.trim() || !asset.credit.trim() || !asset.license.trim()))
        throw new ServiceError("invalid", "asset_details_required");
      if (decision === "rejected" && !note?.trim()) throw new ServiceError("invalid", "reason_required");
      if (decision !== "approved" && (await usage(id)).length) throw new ServiceError("conflict", "asset_in_published_entry");
      const before = asset.reviewStatus;
      asset.reviewStatus = decision;
      asset.reviewNote = note?.trim() || undefined;
      context.audit(`review_${decision}`, "asset", id, { status: before }, { status: decision });
      return { ...strip(asset), reviewStatus: asset.reviewStatus, reviewNote: asset.reviewNote, createdAt: asset.createdAt, usedBy: await usage(id) };
    },
    async updateAssetDetails(id, details) {
      const account = context.requireActive();
      const asset = find(id);
      if (asset.ownerId !== account.id) throw new ServiceError("forbidden", "forbidden");
      if (asset.reviewStatus === "approved") throw new ServiceError("conflict", "asset_already_approved");
      describe(asset, details);
      asset.reviewStatus = "pending";
      return strip(asset);
    },
    async listOrphanFiles() {
      context.requireActive(true);
      return [];
    },
    async removeOrphanFile() {
      context.requireActive(true);
      throw new ServiceError("conflict", "file_in_use");
    },
    async uploadEntryAsset(image, details) {
      const account = context.requireActive();
      if (!account.authorId && account.role !== "admin") throw new ServiceError("forbidden", "author_required");
      const recent = context.assets.filter((a) => a.ownerId === account.id && Date.now() - Date.parse(a.createdAt) < 3_600_000);
      if (recent.length >= 30) throw new ServiceError("rate_limited", "rate_limited");
      await writeLocalImage(image);
      const id = `asset-${crypto.randomUUID()}`;
      const asset: MockAsset = {
        id,
        src: `/api/assets/${id}/file`,
        width: image.width,
        height: image.height,
        alt: { zh: "", en: "" },
        credit: account.handle,
        license: "CC BY 4.0",
        reviewStatus: "pending",
        ownerId: account.id,
        ownerHandle: account.handle,
        file: image.name,
        createdAt: new Date().toISOString(),
        usedBy: [],
      };
      describe(asset, details);
      context.assets.push(asset);
      context.audit("upload", "asset", id, null, { object: image.name });
      return strip(asset);
    },
    async readAssetFile(id) {
      const asset = context.assets.find((a) => a.id === id);
      const account = context.account();
      if (!asset?.file) return null;
      if (asset.reviewStatus !== "approved" && account?.role !== "admin" && asset.ownerId !== account?.id) return null;
      const data = await readLocalImage(asset.file);
      return data ? { data, cacheable: asset.reviewStatus === "approved" } : null;
    },
  };
}
