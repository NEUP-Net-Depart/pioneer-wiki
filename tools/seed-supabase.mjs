import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey)
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding Supabase.");

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const importFrom = async (file) => import(new URL(file, import.meta.url));
const [{ entries, relations }, { authors, sources, tags }, community] = await Promise.all([
  importFrom("../src/mock/entries.ts"),
  importFrom("../src/mock/people.ts"),
  importFrom("../src/mock/community.ts"),
]);
const { bodyAt } = await importFrom("../src/lib/services/mock/body.ts");
const sizes = JSON.parse(await readFile(join(process.cwd(), "public", "plates", "web", "sizes.json"), "utf8"));

async function upsert(table, rows, onConflict = "id") {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
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
  "tags",
  tags.map((tag) => ({ id: tag.id, label_zh: tag.label.zh, label_en: tag.label.en })),
);
await upsert("assets", assets);

for (const entry of entries) {
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
      domain: entry.domain,
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
}

await upsert(
  "relations",
  relations.map((relation) => ({
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
  community.links.map((link) => ({
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
  community.members.map((member) => ({
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
  community.threadSeeds.map((thread) => ({
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
  community.postSeeds.map((post) => ({
    id: post.id,
    thread_id: post.threadId,
    author_name: post.authorName,
    member_id: post.memberId,
    body: post.body,
    created_at: post.createdAt,
  })),
  "id",
);

console.log(
  `Seeded ${entries.length} entries, ${relations.length} relations, ${community.members.length} members and ${community.threadSeeds.length} forum threads.`,
);
