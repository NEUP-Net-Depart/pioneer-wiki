import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey)
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding Supabase.");

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const importFrom = async (file) => import(new URL(file, import.meta.url));
const [{ entries, relations }, { authors, sources, tags }, community, { chronicles }, { families, categories }] =
  await Promise.all([
    importFrom("../src/mock/entries.ts"),
    importFrom("../src/mock/people.ts"),
    importFrom("../src/mock/community.ts"),
    importFrom("../src/mock/chronicles.ts"),
    importFrom("../src/mock/taxonomy.ts"),
  ]);
const { bodyAt } = await importFrom("../src/lib/services/mock/body.ts");
const { museumSnapshots } = await importFrom("../src/mock/museum.ts");
const sizes = JSON.parse(await readFile(join(process.cwd(), "public", "plates", "web", "sizes.json"), "utf8"));

const includeSamples = process.argv.includes("--include-samples");
if (includeSamples && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("--include-samples is restricted to an explicitly selected local Supabase.");
}
const productionRows = (rows) => rows.filter((row) => includeSamples || !row.sample);

async function upsert(table, rows, onConflict = "id") {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict, ignoreDuplicates: true });
  if (error) throw new Error(`${table}: ${error.message}`);
}

const assetSlugs = new Set(entries.map((entry) => entry.slug));
assetSlugs.add("frontispiece");
const assets = [...assetSlugs].map((slug) => ({
  id: `plate-${slug}`,
  src: `/plates/web/${slug}.webp`,
  width: sizes[slug]?.width ?? 1536,
  height: sizes[slug]?.height ?? 1024,
  alt_zh: `${slug} 的先锋维基标本图`,
  alt_en: `Pioneer Wiki specimen plate for ${slug}`,
  credit: "Pioneer Wiki specimen plate · generated with gpt-image-2",
  license: "CC BY 4.0",
}));

await upsert(
  "authors",
  authors.map((a) => ({
    id: a.id,
    handle: a.handle,
    name_zh: a.name.zh,
    name_en: a.name.en,
    affiliation_zh: a.affiliation?.zh,
    affiliation_en: a.affiliation?.en,
    role: a.role,
    sigil: a.sigil,
  })),
);
await upsert("sources", sources);
await upsert(
  "taxon_snapshots",
  museumSnapshots.map((snapshot) => ({
    scientific_name: snapshot.scientificName,
    rank: snapshot.rank,
    accepted_name: snapshot.acceptedName,
    authority: snapshot.authority,
    synonyms: snapshot.synonyms,
    sources: snapshot.sources,
    verified_at: snapshot.verifiedAt,
  })),
  "scientific_name",
);
await upsert(
  "tags",
  tags.map((tag) => ({ id: tag.id, label_zh: tag.label.zh, label_en: tag.label.en })),
);
await upsert("assets", assets);

const taxonRow = (taxon) => ({
  id: taxon.id,
  slug: taxon.slug,
  former_slugs: taxon.formerSlugs,
  name_zh: taxon.name.zh,
  name_en: taxon.name.en,
  scientific_name: taxon.scientificName,
  taxon_name_zh: taxon.taxonNameZh ?? null,
  intro_zh: taxon.intro.zh,
  intro_en: taxon.intro.en,
  essay: taxon.essay,
  emblem_asset_id: taxon.emblemAssetId ?? null,
  links: taxon.links,
  lead_id: taxon.leadId ?? null,
  collaborator_ids: taxon.collaboratorIds,
  sort_order: taxon.sortOrder,
  status: taxon.status,
  created_at: taxon.createdAt,
  updated_at: taxon.updatedAt,
  version: taxon.version,
});
const taxonVersion = (kind, row) => ({
  id: `${kind}:${row.id}@v${row.version}`,
  kind,
  taxon_id: row.id,
  number: row.version,
  data: row,
  note: "Catalogue imported",
  created_at: row.updated_at,
});
const familyRows = families.map(taxonRow);
const categoryRows = categories.map((category) => ({
  ...taxonRow(category),
  family_id: category.familyId,
  representative_slug: category.representativeSlug ?? null,
}));
await upsert("taxon_families", familyRows);
await upsert("taxon_categories", categoryRows);
await upsert("taxon_versions", [
  ...familyRows.map((row) => taxonVersion("family", row)),
  ...categoryRows.map((row) => taxonVersion("category", row)),
]);

// Existing entries and every association/revision belonging to them stay untouched.
const existingEntries = new Set();
for (let offset = 0; ; offset += 1000) {
  const { data, error } = await supabase
    .from("entries")
    .select("id")
    .order("id")
    .range(offset, offset + 999);
  if (error) throw new Error(`entries: ${error.message}`);
  for (const row of data) existingEntries.add(row.id);
  if (data.length < 1000) break;
}
const importedEntries = new Set();
for (const entry of entries) {
  if (existingEntries.has(entry.id)) continue;
  importedEntries.add(entry.id);
  const latest = entry.revisions.at(-1);
  const published = [...entry.revisions].reverse().find((revision) => revision.state === "published");
  await upsert("entries", [
    {
      id: entry.id,
      slug: entry.slug,
      title_zh: entry.title.zh,
      title_en: entry.title.en,
      summary_zh: entry.summary.zh,
      summary_en: entry.summary.en,
      analogue_name_zh: entry.analogue?.name.zh,
      analogue_name_en: entry.analogue?.name.en,
      analogue_note_zh: entry.analogue?.note?.zh,
      analogue_note_en: entry.analogue?.note?.en,
      domain: entry.domain ?? null,
      category_id: entry.categoryId,
      species: entry.species ?? null,
      level: entry.level,
      content_role: entry.contentRole,
      scale: entry.scale,
      role: entry.role,
      status: latest?.state ?? "published",
      author_id: entry.authorId,
      hero_asset_id: entry.heroAssetId,
      featured: Boolean(entry.featured),
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
      latest_revision_number: latest?.number ?? 0,
      published_revision_number: published?.number ?? null,
    },
  ]);
  await upsert(
    "entry_revisions",
    entry.revisions.map((revision) => ({
      id: `${entry.id}@r${revision.number}`,
      entry_id: entry.id,
      number: revision.number,
      parent_id: revision.number > 1 ? `${entry.id}@r${revision.number - 1}` : null,
      author_id: revision.authorId,
      created_at: revision.createdAt,
      note: revision.note,
      state: revision.state,
      title_zh: entry.title.zh,
      title_en: entry.title.en,
      summary_zh: entry.summary.zh,
      summary_en: entry.summary.en,
      metadata: {
        scale: entry.scale,
        role: entry.role,
        analogue: entry.analogue ?? null,
        heroAssetId: entry.heroAssetId ?? null,
        contributorIds: entry.contributorIds,
        sourceIds: entry.sourceIds,
        tagIds: entry.tagIds,
        relationDrafts: relations
          .filter((r) => r.from === entry.id)
          .map((r) => ({
            to: r.to,
            kind: r.kind,
            strength: r.strength,
            note: r.note,
          })),
        pendingSources: [],
        pendingTags: [],
        importedFixtureMetadata: true,
        taxonomy: {
          categoryId: entry.categoryId,
          auxiliaryCategoryIds: entry.auxiliaryCategoryIds,
          species: entry.species,
          level: entry.level,
          contentRole: entry.contentRole,
        },
      },
    })),
    "entry_id,number",
  );
  await upsert(
    "entry_revision_bodies",
    entry.revisions.map((revision) => ({
      revision_id: `${entry.id}@r${revision.number}`,
      body: bodyAt(entry.slug, revision.number),
    })),
    "revision_id",
  );
  await upsert(
    "entry_contributors",
    entry.contributorIds.map((author_id) => ({ entry_id: entry.id, author_id })),
    "entry_id,author_id",
  );
  await upsert(
    "entry_sources",
    entry.sourceIds.map((source_id) => ({ entry_id: entry.id, source_id })),
    "entry_id,source_id",
  );
  await upsert(
    "entry_tags",
    entry.tagIds.map((tag_id) => ({ entry_id: entry.id, tag_id })),
    "entry_id,tag_id",
  );
  await upsert(
    "entry_auxiliary_categories",
    entry.auxiliaryCategoryIds.map((category_id) => ({ entry_id: entry.id, category_id })),
    "entry_id,category_id",
  );
}

await upsert(
  "relations",
  relations
    .filter((relation) => importedEntries.has(relation.from))
    .map((relation) => ({
      id: relation.id,
      from_entry_id: relation.from,
      to_entry_id: relation.to,
      kind: relation.kind,
      note_zh: relation.note?.zh,
      note_en: relation.note?.en,
      strength: relation.strength,
    })),
);
await upsert(
  "friend_links",
  productionRows(community.links).map((link) => ({
    id: link.id,
    name_zh: link.name.zh,
    name_en: link.name.en,
    url: link.url,
    description_zh: link.description.zh,
    description_en: link.description.en,
    emblem: link.emblem,
    since: link.since,
    sample: Boolean(link.sample),
  })),
);
await upsert(
  "members",
  productionRows(community.members).map((member) => ({
    id: member.id,
    name_zh: member.name.zh,
    name_en: member.name.en,
    handle: member.handle,
    role_zh: member.role.zh,
    role_en: member.role.en,
    bio_zh: member.bio.zh,
    bio_en: member.bio.en,
    about: member.about,
    plate_number: member.plate.number,
    plate_emblem: member.plate.emblem,
    plate_ink: member.plate.ink,
    plate_border: member.plate.border,
    plate_motto: member.plate.motto,
    cover_src: member.cover?.src,
    cover_width: member.cover?.width,
    cover_height: member.cover?.height,
    cover_print: member.cover?.print,
    joined: member.joined,
    author_id: member.authorId,
    links: member.links,
    github: member.github,
    sample: Boolean(member.sample),
  })),
);
await upsert(
  "forum_threads",
  (includeSamples ? community.threadSeeds : []).map((thread) => ({
    id: thread.id,
    number: thread.number,
    title: thread.title,
    category: thread.category,
    author_name: thread.authorName,
    member_id: thread.memberId,
    created_at: thread.createdAt,
  })),
  "id",
);
await upsert(
  "forum_posts",
  (includeSamples ? community.postSeeds : []).map((post) => ({
    id: post.id,
    thread_id: post.threadId,
    author_name: post.authorName,
    member_id: post.memberId,
    body: post.body,
    created_at: post.createdAt,
  })),
  "id",
);

await upsert(
  "chronicles",
  productionRows(chronicles).map((record) => ({
    id: record.id,
    number: record.number,
    date: record.date,
    kind: record.kind,
    title_zh: record.title.zh,
    title_en: record.title.en,
    summary_zh: record.summary.zh,
    summary_en: record.summary.en,
    body: record.body ?? null,
    host_ids: record.hostIds,
    resources: record.resources,
    gallery: record.gallery,
    tags: record.tags,
    sample: Boolean(record.sample),
  })),
);

console.log(
  `Insert-only import (existing entries untouched; samples ${includeSamples ? "included locally" : "excluded"}): ${families.length} families, ${categories.length} genera, ${museumSnapshots.length} name snapshots, ${entries.length} entries, ${relations.length} relations, ${community.members.length} members, ${community.threadSeeds.length} forum threads and ${chronicles.length} chronicles.`,
);
