import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import type { AssetReviewStatus } from "@/lib/model/types";
import { DeskHead, EmptyDrawer, Pager, ReadFailure, tr } from "@/components/admin/desk";
import { DeskFilters } from "@/components/admin/DeskFilters";
import { AssetCard, OrphanFiles } from "@/components/admin/AssetReview";

export const metadata: Metadata = { title: "素材 Images" };

const LIMIT = 12;
const STATUSES: AssetReviewStatus[] = ["pending", "approved", "rejected"];

/** Uploaded figures waiting for a decision, and the files nothing uses any more. */
export default async function AdminAssets({ searchParams }: PageProps<"/admin/assets">) {
  const lang = await getLang();
  const params = await searchParams;
  const raw = typeof params.status === "string" ? params.status : "";
  const status = raw === "all" ? [] : STATUSES.includes(raw as AssetReviewStatus) ? [raw as AssetReviewStatus] : (["pending"] as AssetReviewStatus[]);
  const q = typeof params.q === "string" ? params.q : "";
  const offset = Math.max(0, Number(typeof params.offset === "string" ? params.offset : 0) || 0);
  const page = await getServices()
    .references.listAssetsForReview({ status, text: q, limit: LIMIT, offset })
    .catch(() => null);
  return (
    <>
      <DeskHead
        kicker="Image review"
        title={tr(lang, "素材审核", "Image review")}
        lede={tr(
          lang,
          "作者上传的插图先进入待审状态：在批准之前，读者、搜索引擎和其他账号都无法打开它，引用它的条目也无法发布。",
          "Uploaded figures start as pending: until approved, no reader, crawler or other account can open them, and entries using them cannot be published.",
        )}
      />
      <DeskFilters
        text={{ value: q, placeholder: tr(lang, "编号、说明、署名或上传者", "Id, text, credit or uploader") }}
        filters={[
          {
            name: "status",
            label: tr(lang, "状态", "Status"),
            value: raw === "all" || STATUSES.includes(raw as AssetReviewStatus) ? raw : "",
            options: [
              ["", tr(lang, "待审核", "Pending")],
              ["approved", tr(lang, "已批准", "Approved")],
              ["rejected", tr(lang, "已拒绝", "Rejected")],
              ["all", tr(lang, "全部", "All")],
            ],
          },
        ]}
      />
      {!page ? (
        <ReadFailure lang={lang} />
      ) : page.rows.length === 0 ? (
        <EmptyDrawer title={tr(lang, "没有符合条件的图片。", "No images match.")} />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {page.rows.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
          <Pager lang={lang} path="/admin/assets" params={{ q, status: raw || undefined }} offset={offset} limit={LIMIT} total={page.total} />
        </>
      )}
      <OrphanFiles />
    </>
  );
}
