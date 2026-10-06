import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { diffLines } from "diff";
import { getServices } from "@/lib/services";
import { getT } from "@/lib/i18n/server";
import { RunningHead } from "@/components/book/RunningHead";
import { ReviewQueue } from "@/components/admin/ReviewQueue";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";

export const metadata: Metadata = { title: "管理后台 Admin", robots: { index: false } };
type DiffChunk = { kind: "added" | "removed" | "context"; lines: string[] };

export default async function AdminPage() {
  const account = await getServices().auth.getCurrentAccount();
  if (!account || account.role !== "admin") notFound();
  const { lang } = await getT();
  const entries = await getServices().entries.listEntries({ status: ["in_review"] });
  const items = await Promise.all(
    entries.map(async (entry) => {
      const revisions = await getServices().entries.listRevisions(entry.id);
      const pending = revisions.find((revision) => revision.state === "in_review") ?? revisions[0];
      const published = revisions.find((revision) => revision.state === "published");
      const [before, after] = await Promise.all([
        published ? getServices().entries.getRevisionBody(published.id) : Promise.resolve(null),
        pending ? getServices().entries.getRevisionBody(pending.id) : Promise.resolve(null),
      ]);
      const changes: DiffChunk[] = diffLines(before ?? "", after ?? "").flatMap((change) => {
        const lines = change.value
          .replace(/\n$/, "")
          .split("\n")
          .filter((line, index, all) => line || index < all.length - 1);
        return lines.length ? [{ kind: change.added ? "added" : change.removed ? "removed" : "context", lines }] : [];
      });
      return {
        entry,
        revisions,
        pendingRevision: pending?.number ?? entry.revision,
        publishedRevision: published?.number ?? null,
        changes,
      };
    }),
  );
  return (
    <div className="flex flex-col gap-(--space-block)">
      <RunningHead
        left={`${lang === "zh" ? "先锋维基 · 管理后台" : "Pioneer Wiki · Admin"}`}
        right={`${lang === "zh" ? "待处理" : "Pending"} ${items.length}`}
      />
      <header>
        <p className="font-mono text-meta tracking-[0.14em] text-brick-ink uppercase">Editorial office</p>
        <h1 className="mt-2 font-display text-[clamp(2.5rem,6vw,4.75rem)] leading-none">
          {lang === "zh" ? "审核工作台" : "Review desk"}
        </h1>
        <p className="mt-4 max-w-prose text-small leading-relaxed text-ink-2">
          {lang === "zh"
            ? "逐行查看提交内容与公开版本的差异，发布合并后的版本，或把条目回滚到指定的历史版本。"
            : "Compare submissions line by line, publish the merged version, or roll an entry back to a selected historical revision."}
        </p>
      </header>
      <section aria-labelledby="review-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 id="review-heading" className="font-display text-h2">
            {lang === "zh" ? "审核队列" : "Review queue"}
          </h2>
          <span className="font-mono text-meta text-ink-3">
            {items.length} {lang === "zh" ? "项" : "items"}
          </span>
        </div>
        <ReviewQueue items={items} lang={lang} />
      </section>
      <section aria-labelledby="audit-heading" className="mt-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 id="audit-heading" className="font-display text-h2">
            {lang === "zh" ? "审计记录" : "Audit log"}
          </h2>
          <span className="font-mono text-meta text-ink-3">last 100</span>
        </div>
        <AuditLogPanel lang={lang} />
      </section>
    </div>
  );
}
