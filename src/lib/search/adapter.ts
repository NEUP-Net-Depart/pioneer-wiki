import type { EntrySummary } from "@/lib/model/types";
import type {
  SearchAdapter,
  SearchField,
  SearchHit,
  SearchQuery,
  SearchResult,
  SearchSnippet,
} from "@/lib/services/contracts";
import { bodyAt } from "@/lib/services/mock/body";
import { entries, type EntryFixture } from "@/mock/entries";
import { authors, sources, tags } from "@/mock/people";

const weights: Record<SearchField, number> = {
  id: 100,
  title: 60,
  tags: 35,
  summary: 25,
  author: 15,
  source: 15,
  body: 5,
};
const summaryOf = (entry: EntryFixture): EntrySummary => {
  const { revisions, ...summary } = entry;
  void revisions;
  return summary;
};
const stripMarkdown = (value: string) =>
  value
    .replace(/<[^>]*>|[#*_~\[\]()>\x60]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const count = <T extends string>(values: T[]): Partial<Record<T, number>> =>
  values.reduce(
    (result, value) => {
      result[value] = (result[value] ?? 0) + 1;
      return result;
    },
    {} as Partial<Record<T, number>>,
  );

function snippet(value: string, terms: string[], field: SearchField): SearchSnippet {
  const lower = value.toLocaleLowerCase();
  const positions = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0);
  const first = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, first - 35);
  const excerpt = value.slice(start, start + 100);
  const excerptLower = excerpt.toLocaleLowerCase();
  const highlights: Array<[number, number]> = [];
  for (const term of terms) {
    let from = 0;
    while (from < excerpt.length) {
      const index = excerptLower.indexOf(term, from);
      if (index < 0) break;
      highlights.push([index, index + term.length]);
      from = index + term.length;
    }
  }
  return { field, text: excerpt, highlights };
}

export function createMockSearchAdapter(): SearchAdapter {
  return {
    async search({ text, filters = {}, limit = 50, offset = 0 }: SearchQuery): Promise<SearchResult> {
      const terms = text.toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const textMatched: Array<{ entry: EntryFixture; hit: SearchHit }> = [];
      for (const entry of entries) {
        const body = stripMarkdown(bodyAt(entry.slug, entry.revision));
        const fields: Record<SearchField, string> = {
          id: entry.id,
          title: `${entry.title.zh} ${entry.title.en}`,
          tags: tags
            .filter((tag) => entry.tagIds.includes(tag.id))
            .map((tag) => `${tag.label.zh} ${tag.label.en}`)
            .join(" "),
          summary: `${entry.summary.zh} ${entry.summary.en}`,
          author: authors
            .filter((author) => [entry.authorId, ...entry.contributorIds].includes(author.id))
            .map((author) => `${author.handle} ${author.name.zh} ${author.name.en}`)
            .join(" "),
          source: sources
            .filter((source) => entry.sourceIds.includes(source.id))
            .map((source) => `${source.title} ${source.creators}`)
            .join(" "),
          body,
        };
        const matchedFields = (Object.keys(fields) as SearchField[]).filter((field) =>
          terms.some((term) => fields[field].toLocaleLowerCase().includes(term)),
        );
        if (!terms.every((term) => Object.values(fields).some((value) => value.toLocaleLowerCase().includes(term))))
          continue;
        const bodyHasHit = terms.some((term) => body.toLocaleLowerCase().includes(term));
        const excerpt = bodyHasHit ? body : `${entry.summary.zh} ${entry.summary.en}`;
        const hit: SearchHit = {
          entry: summaryOf(entry),
          score: matchedFields.reduce((score, field) => score + weights[field], 0),
          matchedFields,
          snippet: terms.length ? snippet(excerpt, terms, bodyHasHit ? "body" : "summary") : null,
        };
        textMatched.push({ entry, hit });
      }
      const filtered = textMatched.filter(
        ({ entry }) =>
          (!filters.domain?.length || filters.domain.includes(entry.domain)) &&
          (!filters.scale?.length || filters.scale.includes(entry.scale)) &&
          (!filters.status?.length || filters.status.includes(entry.status)) &&
          (!filters.lang?.length || filters.lang.some((lang) => entry.bodyLanguages.includes(lang))) &&
          (!filters.author?.length || filters.author.includes(entry.authorId)),
      );
      filtered.sort((a, b) => b.hit.score - a.hit.score || b.entry.updatedAt.localeCompare(a.entry.updatedAt));
      const boundedOffset = Math.max(0, offset);
      const boundedLimit = Math.max(0, Math.min(limit, 100));
      return {
        hits: filtered.slice(boundedOffset, boundedOffset + boundedLimit).map(({ hit }) => hit),
        total: filtered.length,
        facets: {
          domain: count(textMatched.map(({ entry }) => entry.domain)),
          scale: count(textMatched.map(({ entry }) => entry.scale)),
          status: count(textMatched.map(({ entry }) => entry.status)),
          lang: count(textMatched.flatMap(({ entry }) => entry.bodyLanguages)),
        },
      };
    },
  };
}
