import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import { bodyChanges, fieldChanges } from "@/lib/entries/diff";
import { bodyAssetIds } from "@/lib/entries/lifecycle";
import { StatusBadge } from "@/components/archive/StatusBadge";
import { DeskHead, formatWhen, StateTag, tr } from "@/components/admin/desk";
import { BodyDiff, ReviewActions } from "@/components/admin/ReviewDesk";

export const metadata: Metadata = { title: "审核单 Review sheet" };

/**
 * One review sheet: the public revision against the one waiting, field by
 * field and line by line, the images it needs approved, and the decisions.
 * Publishing names the exact revision shown here.
 */
export default async function ReviewSheetPage({ params }: PageProps<"/admin/review/[id]">) {
  const { id } = await params;
  const lang = await getLang();
  const { entries, references, taxonomy } = getServices();
  const packet = await entries.getEditorial(id);
  if (!packet) notFound();
  const { entry, latest, published } = packet;
  const [authors, sources, tags, categories, revisions, assetPage] = await Promise.all([
    references.listAuthors(),
    references.listSources(),
    references.listTags(),
    taxonomy.listCategories({ includeArchived: true }),
    entries.listRevisions(entry.id, { scope: "editorial" }),
    references.listAssetsForReview({ status: [], limit: 100 }),
  ]);
  const fields = fieldChanges(published, latest, { authors, sources, tags, categories }, lang);
  const chunks = bodyChanges(published?.body ?? "", latest.body);
  const needed = [...bodyAssetIds(latest.body), ...(latest.metadata.heroAssetId ? [latest.metadata.heroAssetId] : [])];
  const images = needed.map((assetId) => ({
    id: assetId,
    record: assetPage.rows.find((asset) => asset.id === assetId),
  }));
  const blocked = images.filter((image) => image.record?.reviewStatus !== "approved");
  const rollbackTargets = revisions.filter((r) => r.state === "published");
  const author = authors.find((a) => a.id === latest.authorId);
  return (
    <>
      <Link href="/admin/review" className="pw-link w-fit text-small text-ink-2">
        ← {tr(lang, "返回审核队列", "Back to the review queue")}
      </Link>
      <DeskHead
        kicker={`${entry.id} · r${latest.number}`}
        title={latest.title[lang] || latest.title.zh}
        lede={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge state={entry.status} lang={lang} />
            {entry.archivedAt ? <StateTag tone="quiet">{tr(lang, "已归档", "Archived")}</StateTag> : null}
            <span>
              {tr(lang, "作者", "Author")} {entry.authorName[lang] || entry.authorId} ·{" "}
              {tr(lang, "最新修订由", "Latest revision by")} {author?.name[lang] ?? latest.authorId} ·{" "}
              <time dateTime={latest.createdAt}>{formatWhen(latest.createdAt, lang)}</time>
            </span>
          </div>
        }
      />
      <section aria-labelledby="note" className="pw-sheet grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
        <div>
          <p className="pw-label">{tr(lang, "修订说明", "Edit note")}</p>
          <p className="mt-1 text-small text-ink">{latest.note || "—"}</p>
        </div>
        <div>
          <p className="pw-label">{tr(lang, "公开版本", "Public revision")}</p>
          <p className="mt-1 text-small text-ink">
            {published
              ? `r${published.number} · ${formatWhen(published.createdAt, lang)}`
              : tr(lang, "尚无，此次为首次发布", "None — first publication")}
          </p>
        </div>
        <div>
          <p className="pw-label">{tr(lang, "审阅中的修订", "Revision under review")}</p>
          <p className="mt-1 text-small text-ink">
            r{latest.number} {entry.status !== "in_review" ? tr(lang, "（当前不在审核中）", "(not in review now)") : ""}
          </p>
        </div>
        <h2 id="note" className="sr-only">
          {tr(lang, "概要", "Summary")}
        </h2>
      </section>

      <section aria-labelledby="fields" className="flex flex-col gap-3">
        <h2 id="fields" className="pw-double-rule font-display text-h3">
          {tr(lang, "元数据差异", "Metadata changes")}
          <span className="ml-2 font-mono text-meta text-ink-3">{fields.length}</span>
        </h2>
        {fields.length === 0 ? (
          <p className="text-small text-ink-2">
            {tr(lang, "标题、摘要与全部元数据没有变化。", "Titles, summaries and metadata are unchanged.")}
          </p>
        ) : (
          <dl className="pw-sheet divide-y divide-rule">
            {fields.map((change) => (
              <div key={change.field} className="grid gap-2 px-5 py-3 md:grid-cols-[10rem_1fr_1fr] md:gap-6">
                <dt className="pw-label pt-0.5">{change.label}</dt>
                <dd className="text-small whitespace-pre-wrap break-words text-ink-3 line-through decoration-brick/50">
                  <span className="sr-only">{tr(lang, "原为：", "Was: ")}</span>
                  {change.before || "—"}
                </dd>
                <dd className="text-small whitespace-pre-wrap break-words text-ink">
                  <span className="sr-only">{tr(lang, "改为：", "Now: ")}</span>
                  {change.after || "—"}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {!latest.recorded ? (
          <p className="text-meta text-gold-ink">
            {tr(
              lang,
              "这个修订早于完整快照，未记录标题与摘要；发布时沿用当前公开的标题与摘要。",
              "This revision predates full snapshots and recorded no title or summary; publishing keeps the public ones.",
            )}
          </p>
        ) : null}
      </section>

      {images.length ? (
        <section aria-labelledby="images" className="flex flex-col gap-3">
          <h2 id="images" className="pw-double-rule font-display text-h3">
            {tr(lang, "引用的图片", "Images used")}
          </h2>
          <ul className="flex flex-col gap-2 text-small">
            {images.map(({ id: assetId, record }) => (
              <li key={assetId} className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-meta text-ink-3">{assetId}</span>
                {record?.reviewStatus === "approved" ? (
                  <StateTag tone="ok">{tr(lang, "已批准", "Approved")}</StateTag>
                ) : record?.reviewStatus === "rejected" ? (
                  <StateTag tone="danger">{tr(lang, "已拒绝", "Rejected")}</StateTag>
                ) : record ? (
                  <StateTag tone="pending">{tr(lang, "待审核", "Pending")}</StateTag>
                ) : (
                  <StateTag tone="danger">{tr(lang, "不存在", "Missing")}</StateTag>
                )}
                {record && record.reviewStatus !== "approved" ? (
                  <Link
                    href={`/admin/assets?q=${encodeURIComponent(assetId)}&status=all`}
                    className="pw-link text-indigo"
                  >
                    {tr(lang, "去审核图片", "Review the image")} →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="body" className="flex flex-col gap-3">
        <h2 id="body" className="pw-double-rule font-display text-h3">
          {tr(lang, "正文差异", "Body changes")}
        </h2>
        <BodyDiff chunks={chunks} lang={lang} />
      </section>

      <ReviewActions
        entryId={entry.id}
        title={latest.title[lang] || latest.title.zh}
        status={entry.status}
        archived={Boolean(entry.archivedAt)}
        expectedRevision={latest.number}
        blockedImages={blocked.map((image) => image.id)}
        rollbackTargets={rollbackTargets.map((r) => ({
          id: r.id,
          number: r.number,
          note: r.note,
          createdAt: r.createdAt,
        }))}
        publishedRevision={published?.number}
      />
    </>
  );
}
