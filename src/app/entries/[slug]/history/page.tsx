import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { diffLines } from "diff";
import type { Revision } from "@/lib/model/types";
import { otherLang, pick } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { formatDateTime } from "@/lib/format";
import { AuthorSigil } from "@/components/archive/AuthorSigil";
import { StatusBadge } from "@/components/archive/StatusBadge";
import { RunningHead } from "@/components/book/RunningHead";

export const metadata: Metadata = { title: "版本历史 History" };

/** Growth rings: one per revision up to this one; the outermost is drawn darker. */
function Rings({ n, current }: { n: number; current: boolean }) {
  const shown = Math.min(n, 6);
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" className="size-7 shrink-0" fill="none" stroke="currentColor">
      {Array.from({ length: shown }, (_, i) => (
        <circle
          key={i}
          cx="14"
          cy="14"
          r={3 + i * 2}
          strokeWidth={i === shown - 1 ? 1.1 : 0.5}
          className={i === shown - 1 && current ? "text-moss" : "text-ink-3"}
        />
      ))}
    </svg>
  );
}

/**
 * 年轮 Revision history — the entry's growth rings on one side, the difference
 * between two rings on the other. ?from=&to= are revision numbers.
 */
export default async function HistoryPage({ params, searchParams }: PageProps<"/entries/[slug]/history">) {
  const { slug } = await params;
  const query = await searchParams;
  const { entries: repo, references } = getServices();
  const entry = await repo.getEntry(slug);
  if (!entry) notFound();

  const { lang, t } = await getT();
  const [revisions, authors] = await Promise.all([repo.listRevisions(entry.id), references.listAuthors()]);
  const byNumber = new Map<number, Revision>(revisions.map((r) => [r.number, r]));
  const newest = revisions[0];
  const to = byNumber.get(Number(query.to)) ?? newest;
  const from = byNumber.get(Number(query.from)) ?? revisions.find((r) => r.number < to.number) ?? to;
  const [fromBody, toBody] = await Promise.all([repo.getRevisionBody(from.id), repo.getRevisionBody(to.id)]);
  const changes = from.id === to.id ? [] : diffLines(fromBody ?? "", toBody ?? "");
  const added = changes.filter((c) => c.added).reduce((n, c) => n + (c.count ?? 0), 0);
  const removed = changes.filter((c) => c.removed).reduce((n, c) => n + (c.count ?? 0), 0);

  return (
    <div data-phylum={entry.domain} className="flex flex-col">
      <RunningHead
        left={
          <Link href={`/entries/${entry.slug}`} className="no-underline hover:text-ink">
            ← {pick(entry.title, lang)} · {entry.id}
          </Link>
        }
        right={`${revisions.length} ${t("entry.revision")}`}
      />

      <header className="mt-(--space-block)">
        <h1 className="font-display">
          <span className="block text-h2 font-[560]">{t("history.heading")}</span>
          <span className="mt-1 block text-h4 font-normal text-ink-3 italic">
            {pick(entry.title, lang)} · {pick(entry.title, otherLang(lang))}
          </span>
        </h1>
      </header>

      <div className="mt-(--space-block) grid gap-(--space-block) lg:grid-cols-12">
        <ol className="flex flex-col lg:col-span-4">
          {revisions.map((rev) => {
            const author = authors.find((a) => a.id === rev.authorId);
            const parent = revisions.find((r) => r.number < rev.number);
            const selected = rev.id === to.id;
            return (
              <li key={rev.id} className="relative border-l border-rule pb-6 pl-6 last:pb-0">
                <span className="absolute top-0 -left-3.5 bg-paper">
                  <Rings n={rev.number} current={rev.number === entry.revision} />
                </span>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-3">
                  <span className={selected ? "font-mono font-semibold text-ink" : "font-mono"}>r{rev.number}</span>
                  <time dateTime={rev.createdAt}>{formatDateTime(rev.createdAt, lang)}</time>
                  {rev.state !== "published" ? <StatusBadge state={rev.state} lang={lang} /> : null}
                </p>
                <p className="mt-1 text-small text-ink">{rev.note}</p>
                <p className="mt-1.5 flex items-center gap-2 text-meta text-ink-2">
                  {author ? <AuthorSigil seed={author.sigil} className="size-5" /> : null}
                  {author ? pick(author.name, lang) : null}
                  {parent ? (
                    <Link
                      href={`?from=${parent.number}&to=${rev.number}`}
                      scroll={false}
                      className="ml-auto text-indigo"
                    >
                      {t("history.compare")} r{parent.number}→r{rev.number}
                    </Link>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ol>

        <section
          aria-label={`${t("history.compare")} r${from.number} → r${to.number}`}
          className="min-w-0 lg:col-span-8"
        >
          <p className="mb-4 flex flex-wrap items-baseline gap-x-4 font-mono text-small text-ink-2">
            <span>
              r{from.number} → r{to.number}
            </span>
            <span className="text-moss-ink">
              +{added} {t("history.added")}
            </span>
            <span className="text-brick-ink">
              −{removed} {t("history.removed")}
            </span>
          </p>
          {changes.length === 0 ? (
            <p className="text-small text-ink-3 italic">{t("history.noChanges")}</p>
          ) : (
            <div className="pw-well overflow-x-auto font-mono text-[0.8125rem] leading-relaxed">
              {changes.map((c, i) => {
                const lines = c.value.replace(/\n$/, "").split("\n");
                if (!c.added && !c.removed && lines.length > 6) {
                  return (
                    <p key={i} className="border-y border-rule px-4 py-1 text-meta text-ink-3 italic">
                      ⋯ {lines.length}
                    </p>
                  );
                }
                return lines.map((line, j) => (
                  <div
                    key={`${i}-${j}`}
                    className={
                      c.added
                        ? "bg-moss/12 text-ink"
                        : c.removed
                          ? "bg-brick/10 text-ink-2 line-through decoration-brick/50"
                          : "text-ink-3"
                    }
                  >
                    <span aria-hidden="true" className="inline-block w-6 text-center select-none">
                      {c.added ? "+" : c.removed ? "−" : " "}
                    </span>
                    <span className="sr-only">
                      {c.added ? t("history.added") : c.removed ? t("history.removed") : ""}
                    </span>
                    <span className="whitespace-pre-wrap">{line || " "}</span>
                  </div>
                ));
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
