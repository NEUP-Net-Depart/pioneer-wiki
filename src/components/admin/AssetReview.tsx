"use client";

import { useState } from "react";
import type { AssetRecord } from "@/lib/model/types";
import { useI18n } from "@/lib/i18n/client";
import { api, ConfirmAction, failureText, NoticeLine, useAction } from "./actions";
import { StateTag } from "./desk";

/**
 * One image on the review desk: the picture as uploaded (served with the
 * administrator's session), its description and licence, where it is used,
 * and the decision. Approval needs both alternative texts, a credit and a licence.
 */
export function AssetCard({ asset }: { asset: AssetRecord }) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const { notice, succeed } = useAction();
  const [altZh, setAltZh] = useState(asset.alt.zh);
  const [altEn, setAltEn] = useState(asset.alt.en);
  const [credit, setCredit] = useState(asset.credit);
  const [license, setLicense] = useState(asset.license);
  const [sourceUrl, setSourceUrl] = useState(asset.sourceUrl ?? "");
  const details = { altZh, altEn, credit, license, sourceUrl };
  const complete = Boolean(altZh.trim() && altEn.trim() && credit.trim() && license.trim());
  const published = asset.usedBy.filter((use) => use.published);
  return (
    <article className="pw-sheet flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-meta break-all text-ink-3">{asset.id}</p>
          <p className="text-meta text-ink-3">
            {asset.ownerHandle ? `@${asset.ownerHandle} · ` : ""}
            {asset.width}×{asset.height}
          </p>
        </div>
        <StateTag
          tone={asset.reviewStatus === "approved" ? "ok" : asset.reviewStatus === "rejected" ? "danger" : "pending"}
        >
          {asset.reviewStatus === "approved"
            ? zh
              ? "已批准"
              : "Approved"
            : asset.reviewStatus === "rejected"
              ? zh
                ? "已拒绝"
                : "Rejected"
              : zh
                ? "待审核"
                : "Pending"}
        </StateTag>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- private review images are served per session by /api/assets, outside next/image */}
      <img
        src={asset.src}
        alt={altZh || altEn || asset.id}
        loading="lazy"
        className="pw-well aspect-[4/3] w-full object-contain"
      />
      <div className="grid gap-3">
        <label className="flex flex-col gap-1">
          <span className="pw-label">{zh ? "替代文本（中）" : "Alt text (zh)"}</span>
          <input
            value={altZh}
            onChange={(event) => setAltZh(event.target.value)}
            maxLength={300}
            className="pw-field text-small"
            aria-invalid={!altZh.trim() || undefined}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="pw-label">{zh ? "替代文本（英）" : "Alt text (en)"}</span>
          <input
            value={altEn}
            onChange={(event) => setAltEn(event.target.value)}
            maxLength={300}
            className="pw-field text-small"
            aria-invalid={!altEn.trim() || undefined}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="pw-label">{zh ? "署名" : "Credit"}</span>
            <input
              value={credit}
              onChange={(event) => setCredit(event.target.value)}
              maxLength={120}
              className="pw-field text-small"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="pw-label">{zh ? "许可" : "Licence"}</span>
            <input
              value={license}
              onChange={(event) => setLicense(event.target.value)}
              maxLength={80}
              className="pw-field text-small"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="pw-label">{zh ? "来源地址（可选）" : "Source (optional)"}</span>
          <input
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            inputMode="url"
            className="pw-field font-mono text-small"
          />
        </label>
      </div>
      <div className="text-meta text-ink-2">
        {asset.usedBy.length ? (
          <>
            {zh ? "使用于：" : "Used in: "}
            {asset.usedBy.map((use, index) => (
              <span key={use.id}>
                {index ? ", " : ""}
                <a className="pw-link" href={`/editor/${use.slug}`}>
                  {use.id}
                </a>
                {use.published ? (zh ? "（已公开）" : " (public)") : ""}
              </span>
            ))}
          </>
        ) : zh ? (
          "尚未被任何条目引用。"
        ) : (
          "No entry uses it yet."
        )}
      </div>
      {asset.reviewNote ? <p className="text-meta text-ink-3">{asset.reviewNote}</p> : null}
      <div className="pw-ink-over flex flex-wrap items-center gap-x-5 gap-y-2">
        <ConfirmAction
          disabled={!complete}
          trigger={
            zh
              ? asset.reviewStatus === "approved"
                ? "保存说明"
                : "批准"
              : asset.reviewStatus === "approved"
                ? "Save details"
                : "Approve"
          }
          title={zh ? "批准这张图片？" : "Approve this image?"}
          description={
            zh
              ? "批准后，引用它的条目可以发布，读者能够看到这张图片并获得长期缓存。"
              : "Entries using it can be published, and readers can see it (cached long-term)."
          }
          confirmLabel={zh ? "批准图片" : "Approve image"}
          onConfirm={async () => {
            await api(`/api/admin/assets/${asset.id}`, "POST", { decision: "approved", details });
            succeed(zh ? "已批准。" : "Approved.");
          }}
        />
        {asset.reviewStatus !== "rejected" ? (
          <ConfirmAction
            tone="danger"
            disabled={published.length > 0}
            trigger={zh ? "拒绝" : "Reject"}
            title={zh ? "拒绝这张图片？" : "Reject this image?"}
            description={
              zh
                ? "上传者会看到原因，可以修改说明后重新提交。被已发布条目使用的图片不能拒绝。"
                : "The uploader sees the reason and can fix and resubmit. An image a published entry uses cannot be rejected."
            }
            reason={{ label: zh ? "拒绝原因（上传者可见）" : "Reason (shown to the uploader)", required: true }}
            confirmLabel={zh ? "拒绝图片" : "Reject image"}
            onConfirm={async (reason) => {
              await api(`/api/admin/assets/${asset.id}`, "POST", { decision: "rejected", note: reason, details });
              succeed(zh ? "已拒绝。" : "Rejected.");
            }}
          />
        ) : null}
        {!complete ? (
          <span className="text-meta text-brick-ink">
            {zh
              ? "批准前请补齐中英文替代文本、署名与许可。"
              : "Fill both alt texts, the credit and the licence to approve."}
          </span>
        ) : null}
      </div>
      <NoticeLine notice={notice} className="text-meta" />
    </article>
  );
}

type Orphan = { bucket: string; name: string; createdAt: string; size?: number };

/** Stored files nothing references: listed on request, removed one at a time. */
export function OrphanFiles() {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const [files, setFiles] = useState<Orphan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setFiles((await api<{ files: Orphan[] }>("/api/admin/assets/orphans", "GET")).files);
    } catch (cause) {
      setError(failureText(cause, lang));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="orphans" className="flex flex-col gap-3">
      <h2 id="orphans" className="pw-double-rule font-display text-h3">
        {zh ? "孤立文件" : "Orphan files"}
      </h2>
      <p className="max-w-prose text-small text-ink-2">
        {zh
          ? "上传后没有写入记录、或被替换后无人引用的存储文件（一天以上）。被任何修订或版本引用的文件不会出现在这里。"
          : "Stored files with no record, or replaced and referenced by nothing, older than a day. Files any revision or version references never appear here."}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void load()}
        className="pw-link min-h-11 self-start text-small text-ink disabled:opacity-45"
      >
        {busy ? (zh ? "正在检查…" : "Checking…") : zh ? "检查孤立文件" : "Check for orphan files"}
      </button>
      {error ? (
        <p role="alert" className="text-small text-brick-ink">
          {error}
        </p>
      ) : null}
      {files && !files.length ? (
        <p className="text-small text-ink-3">{zh ? "没有孤立文件。" : "No orphan files."}</p>
      ) : null}
      {files?.length ? (
        <ul className="pw-sheet divide-y divide-rule">
          {files.map((file) => (
            <li
              key={`${file.bucket}/${file.name}`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-small"
            >
              <span className="font-mono text-meta break-all">
                {file.bucket}/{file.name}
              </span>
              <ConfirmAction
                tone="danger"
                trigger={zh ? "删除文件" : "Remove file"}
                title={zh ? "删除这个存储文件？" : "Remove this stored file?"}
                description={
                  zh
                    ? "文件将从存储中永久删除。删除前会再次确认它没有被引用。"
                    : "The file is removed from storage for good; it is checked again for references first."
                }
                confirmLabel={zh ? "删除文件" : "Remove file"}
                onConfirm={async () => {
                  await api("/api/admin/assets/orphans", "DELETE", { bucket: file.bucket, name: file.name });
                  setFiles((list) => list?.filter((f) => f !== file) ?? null);
                }}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
