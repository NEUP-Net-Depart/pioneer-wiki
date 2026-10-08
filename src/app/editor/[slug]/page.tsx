import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pick } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { RunningHead } from "@/components/book/RunningHead";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { AccessGate, gateReason } from "@/components/states/AccessGate";
import { cataloguePlate } from "@/lib/taxonomy/plates";

export const metadata: Metadata = { title: "Edit 编辑条目", robots: { index: false } };

/** The entry's accessioned species plate, if any, for the editor's plate sheet. */
function speciesPlateOf(slug: string) {
  const plate = cataloguePlate("species", slug);
  return plate ? { [slug]: { src: plate.src, width: plate.width, height: plate.height, alt: plate.alt } } : {};
}

/**
 * Opens the entry's latest revision — which may be unpublished — for its
 * author or an administrator. ?from=<n> starts from an older revision instead
 * (opened from the history), saved as a new revision on top of the latest.
 */
export default async function EditEntryPage({ params, searchParams }: PageProps<"/editor/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const { entries, references, taxonomy, auth } = getServices();
  const { lang, t } = await getT();
  const account = await auth.getCurrentAccount();
  const refused = gateReason(account, "author");
  if (refused) return <AccessGate reason={refused} lang={lang} next={`/editor/${slug}`} />;
  const packet = await entries.getEditorial(slug);
  if (!packet) {
    // Someone else's entry, or no entry at all: say which without revealing drafts.
    if (await entries.getEntry(slug)) return <AccessGate reason="not_owner" lang={lang} next={`/editor/${slug}`} />;
    notFound();
  }
  const { entry, latest } = packet;
  const fromNumber = Number(query.from);
  const start =
    Number.isInteger(fromNumber) && fromNumber > 0 && fromNumber !== latest.number
      ? await entries.getRevision(`${entry.id}@r${fromNumber}`)
      : null;
  const shown = start ?? latest;
  const [sources, tags, authors, allEntries, assets, families, categories, serverDraft] = await Promise.all([
    references.listSources(),
    references.listTags(),
    references.listAuthors(),
    entries.listEntries(),
    references.listAssets(),
    taxonomy.listFamilies(),
    taxonomy.listCategories(),
    entries.getWorkingDraft({ entryId: entry.id }).catch(() => null),
  ]);

  return (
    <div className="flex flex-col gap-(--space-block)">
      <RunningHead
        left={
          <Link href={entry.publishedRevision ? `/entries/${entry.slug}` : "/account/entries"} className="no-underline hover:text-ink">
            ← {t("editor.headingEdit")} · {pick(entry.title, lang)}
          </Link>
        }
        right={entry.id}
      />
      <h1 className="sr-only">
        {t("editor.headingEdit")} — {pick(entry.title, lang)}
      </h1>
      <MarkdownEditor
        accountId={account!.id}
        admin={account!.role === "admin"}
        entryId={entry.id}
        slug={entry.slug}
        workflow={{
          status: entry.status,
          latestRevision: entry.latestRevision,
          publishedRevision: entry.publishedRevision,
          returnNote: entry.returnNote,
          archived: Boolean(entry.archivedAt),
          startedFrom: start ? start.number : undefined,
        }}
        initial={{
          title: shown.title,
          summary: shown.summary,
          body: shown.body,
          state: entry.status,
          metadata: shown.metadata,
        }}
        serverDraft={serverDraft}
        options={{
          sources,
          tags,
          authors,
          entries: allEntries.filter((e) => e.id !== entry.id),
          assets,
          families,
          categories,
          speciesPlates: speciesPlateOf(entry.slug),
        }}
        baseRevision={latest.number}
      />
    </div>
  );
}
