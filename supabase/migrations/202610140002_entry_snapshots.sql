-- Entries: a stable identity (the entries row) and revisable content (the
-- revisions). Every revision now records the whole draft contract — bilingual
-- title and summary, body, catalogue place, sources, tags, contributors,
-- relations and cover — and the public columns of `entries` change only when a
-- revision is published or rolled back to. Drafts and submissions never reach
-- readers, search, the graph or listings.
--
-- History before this migration: revisions saved by earlier versions did not
-- record title and summary, and some metadata keys. Those fields are not
-- invented. The current published revision of an entry with no newer work is
-- backfilled from the public columns (they are exactly what readers see); any
-- other old revision keeps NULL title/summary, which publishing or rolling back
-- to it reads as "keep the current public value".

-- ── Columns ─────────────────────────────────────────────────────────────────

alter table public.entry_revisions add column if not exists title_zh text;
alter table public.entry_revisions add column if not exists title_en text;
alter table public.entry_revisions add column if not exists summary_zh text;
alter table public.entry_revisions add column if not exists summary_en text;
alter table public.entry_revisions add column if not exists actor_id uuid references auth.users(id) on delete set null;
alter table public.entries add column if not exists former_slugs text[] not null default '{}';
alter table public.entries add column if not exists edited_at timestamptz;
alter table public.entries add column if not exists published_at timestamptz;
alter table public.entries add column if not exists return_note text;
alter table public.entries add column if not exists returned_at timestamptz;
alter table public.entry_contributors add column if not exists position integer not null default 0;
alter table public.entry_sources add column if not exists position integer not null default 0;
alter table public.entry_tags add column if not exists position integer not null default 0;
update public.entries set edited_at = coalesce(edited_at, updated_at);
update public.entries set published_at = coalesce(published_at, updated_at) where published_revision_number is not null;
create index if not exists entries_edited_idx on public.entries (edited_at desc);
create index if not exists entries_former_slugs_idx on public.entries using gin (former_slugs);
create index if not exists entry_revisions_state_idx on public.entry_revisions (entry_id, state, number desc);

-- Backfill only what is certainly true: an entry whose latest revision is the
-- published one shows exactly that revision in its public columns.
update public.entry_revisions r set
  title_zh = e.title_zh, title_en = e.title_en, summary_zh = e.summary_zh, summary_en = e.summary_en,
  metadata = jsonb_build_object(
    'scale', e.scale, 'role', e.role, 'heroAssetId', e.hero_asset_id,
    'analogue', case when coalesce(e.analogue_name_zh, e.analogue_name_en) is null then null else jsonb_build_object(
      'name', jsonb_build_object('zh', coalesce(e.analogue_name_zh, ''), 'en', coalesce(e.analogue_name_en, '')),
      'note', jsonb_build_object('zh', coalesce(e.analogue_note_zh, ''), 'en', coalesce(e.analogue_note_en, ''))) end,
    'contributorIds', coalesce((select jsonb_agg(c.author_id order by c.author_id) from public.entry_contributors c where c.entry_id = e.id), '[]'::jsonb),
    'sourceIds', coalesce((select jsonb_agg(s.source_id order by s.source_id) from public.entry_sources s where s.entry_id = e.id), '[]'::jsonb),
    'tagIds', coalesce((select jsonb_agg(t.tag_id order by t.tag_id) from public.entry_tags t where t.entry_id = e.id), '[]'::jsonb),
    'relationDrafts', coalesce((select jsonb_agg(jsonb_build_object('to', x.to_entry_id, 'kind', x.kind, 'strength', x.strength,
      'note', jsonb_build_object('zh', coalesce(x.note_zh, ''), 'en', coalesce(x.note_en, ''))) order by x.id)
      from public.relations x where x.from_entry_id = e.id), '[]'::jsonb),
    'pendingSources', '[]'::jsonb, 'pendingTags', '[]'::jsonb, 'backfilled', true
  ) || r.metadata
from public.entries e
where r.entry_id = e.id and r.number = e.published_revision_number
  and e.latest_revision_number = e.published_revision_number and r.title_zh is null;

-- ── Reads: published content for everyone, the rest for its author and admins ──

alter table public.entry_contributors enable row level security;
alter table public.entry_sources enable row level security;
alter table public.entry_tags enable row level security;
revoke insert, update, delete on public.entry_contributors, public.entry_sources, public.entry_tags,
  public.relations, public.entry_revisions, public.entry_revision_bodies from anon, authenticated;
drop policy if exists "admins manage relations" on public.relations;

create or replace function public.pw_entry_public(p_entry_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.entries e where e.id = p_entry_id and e.deleted_at is null and e.published_revision_number is not null);
$$;

create or replace function public.pw_entry_editable(p_entry_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.pw_can_manage() or exists (
    select 1 from public.entries e where e.id = p_entry_id and e.author_id = public.pw_bound_author());
$$;

drop policy if exists "public reads published entries" on public.entries;
create policy "public reads published entries" on public.entries for select using (
  (deleted_at is null and published_revision_number is not null)
  or author_id = (select public.pw_bound_author()) or (select public.pw_can_manage())
);
drop policy if exists "visible revisions" on public.entry_revisions;
create policy "visible revisions" on public.entry_revisions for select using (
  (state = 'published' and public.pw_entry_public(entry_id)) or public.pw_entry_editable(entry_id)
);
drop policy if exists "visible revision bodies" on public.entry_revision_bodies;
create policy "visible revision bodies" on public.entry_revision_bodies for select using (
  exists (select 1 from public.entry_revisions r where r.id = revision_id
    and ((r.state = 'published' and public.pw_entry_public(r.entry_id)) or public.pw_entry_editable(r.entry_id)))
);
drop policy if exists "public relation reads" on public.relations;
create policy "public relation reads" on public.relations for select using (
  (public.pw_entry_public(from_entry_id) and public.pw_entry_public(to_entry_id)) or (select public.pw_can_manage())
);
drop policy if exists "public contributor reads" on public.entry_contributors;
create policy "public contributor reads" on public.entry_contributors for select using (public.pw_entry_public(entry_id) or public.pw_entry_editable(entry_id));
drop policy if exists "public entry source reads" on public.entry_sources;
create policy "public entry source reads" on public.entry_sources for select using (public.pw_entry_public(entry_id) or public.pw_entry_editable(entry_id));
drop policy if exists "public entry tag reads" on public.entry_tags;
create policy "public entry tag reads" on public.entry_tags for select using (public.pw_entry_public(entry_id) or public.pw_entry_editable(entry_id));
drop policy if exists "public auxiliary category reads" on public.entry_auxiliary_categories;
create policy "public auxiliary category reads" on public.entry_auxiliary_categories for select using (public.pw_entry_public(entry_id) or public.pw_entry_editable(entry_id));

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- The author an editing account writes as; administrators get one of their own.
create or replace function public.pw_editor_author()
returns text language plpgsql security definer set search_path = '' as $$
declare
  actor text := public.pw_bound_author();
begin
  if actor is null and public.pw_can_manage() then actor := public.pw_ensure_author(auth.uid()); end if;
  if actor is null then raise exception 'author_required' using errcode = '42501'; end if;
  return actor;
end;
$$;
revoke execute on function public.pw_editor_author() from public, anon, authenticated;

create or replace function public.pw_string_array(p_value jsonb, p_max_items integer, p_max_length integer, p_code text)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  result jsonb := '[]'::jsonb;
  item jsonb;
  value text;
begin
  if p_value is null or p_value = 'null'::jsonb then return result; end if;
  if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > p_max_items then raise exception '%', p_code using errcode = '22023'; end if;
  for item in select x from jsonb_array_elements(p_value) x loop
    if jsonb_typeof(item) <> 'string' then raise exception '%', p_code using errcode = '22023'; end if;
    value := trim(item #>> '{}');
    if value = '' then continue; end if;
    if length(value) > p_max_length then raise exception '%', p_code using errcode = '22023'; end if;
    if not result @> jsonb_build_array(value) then result := result || jsonb_build_array(value); end if;
  end loop;
  return result;
end;
$$;

/*
 * Normalises the editable metadata of a draft: known vocabulary, existing
 * references, bounded sizes. The catalogue place is checked separately by
 * pw_entry_filing.
 */
create or replace function public.pw_validate_entry_metadata(p_metadata jsonb, p_entry_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  m jsonb := coalesce(p_metadata, '{}'::jsonb);
  scale text := coalesce(nullif(m->>'scale', ''), 'micro');
  role_ text := coalesce(nullif(m->>'role', ''), 'observer');
  analogue jsonb := null;
  hero text := nullif(m->>'heroAssetId', '');
  contributors jsonb := public.pw_string_array(m->'contributorIds', 20, 80, 'invalid_contributors');
  sources jsonb := public.pw_string_array(m->'sourceIds', 120, 80, 'invalid_sources');
  tags jsonb := public.pw_string_array(m->'tagIds', 30, 80, 'invalid_tags');
  pending_sources jsonb := public.pw_string_array(m->'pendingSources', 20, 500, 'invalid_pending_sources');
  pending_tags jsonb := public.pw_string_array(m->'pendingTags', 20, 40, 'invalid_pending_tags');
  relations jsonb := '[]'::jsonb;
  item jsonb;
begin
  if jsonb_typeof(m) <> 'object' then raise exception 'invalid_metadata' using errcode = '22023'; end if;
  if scale not in ('macro', 'micro') then raise exception 'invalid_scale' using errcode = '22023'; end if;
  if role_ not in ('host', 'symbiont', 'decomposer', 'observer') then raise exception 'invalid_role' using errcode = '22023'; end if;
  if jsonb_typeof(m->'analogue') = 'object' and (trim(coalesce(m #>> '{analogue,name,zh}', '')) <> '' or trim(coalesce(m #>> '{analogue,name,en}', '')) <> '') then
    if length(coalesce(m #>> '{analogue,name,zh}', '')) > 80 or length(coalesce(m #>> '{analogue,name,en}', '')) > 80
      or length(coalesce(m #>> '{analogue,note,zh}', '')) > 600 or length(coalesce(m #>> '{analogue,note,en}', '')) > 600
    then raise exception 'invalid_analogue' using errcode = '22023'; end if;
    analogue := jsonb_build_object(
      'name', jsonb_build_object('zh', trim(coalesce(m #>> '{analogue,name,zh}', '')), 'en', trim(coalesce(m #>> '{analogue,name,en}', ''))),
      'note', jsonb_build_object('zh', trim(coalesce(m #>> '{analogue,note,zh}', '')), 'en', trim(coalesce(m #>> '{analogue,note,en}', ''))));
  end if;
  if hero is not null and not exists (
    select 1 from public.assets a where a.id = hero and (a.review_status = 'approved' or a.owner_id = auth.uid() or public.pw_can_manage())
  ) then raise exception 'unknown_hero_asset' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements_text(contributors) x where not exists (select 1 from public.authors a where a.id = x)) then
    raise exception 'unknown_contributor' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements_text(sources) x where not exists (select 1 from public.sources s where s.id = x)) then
    raise exception 'unknown_source' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements_text(tags) x where not exists (select 1 from public.tags t where t.id = x)) then
    raise exception 'unknown_tag' using errcode = '22023'; end if;
  if m->'relationDrafts' is not null and m->'relationDrafts' <> 'null'::jsonb then
    if jsonb_typeof(m->'relationDrafts') <> 'array' or jsonb_array_length(m->'relationDrafts') > 40 then
      raise exception 'invalid_relations' using errcode = '22023'; end if;
    for item in select x from jsonb_array_elements(m->'relationDrafts') x loop
      if nullif(item->>'to', '') is null then raise exception 'relation_target_required' using errcode = '22023'; end if;
      if item->>'to' = p_entry_id then raise exception 'relation_to_self' using errcode = '22023'; end if;
      if not exists (select 1 from public.entries e where e.id = item->>'to') then raise exception 'unknown_relation_target' using errcode = '22023'; end if;
      if coalesce(item->>'kind', '') not in ('symbiosis', 'source', 'taxonomy', 'contrast', 'dependency', 'dispute') then
        raise exception 'invalid_relation_kind' using errcode = '22023'; end if;
      if length(coalesce(item #>> '{note,zh}', '')) > 300 or length(coalesce(item #>> '{note,en}', '')) > 300 then
        raise exception 'invalid_relation_note' using errcode = '22023'; end if;
      if exists (select 1 from jsonb_array_elements(relations) r where r->>'to' = item->>'to' and r->>'kind' = item->>'kind') then continue; end if;
      relations := relations || jsonb_build_array(jsonb_build_object('to', item->>'to', 'kind', item->>'kind',
        'strength', greatest(1, least(3, coalesce(nullif(item->>'strength', '')::integer, 1))),
        'note', jsonb_build_object('zh', trim(coalesce(item #>> '{note,zh}', '')), 'en', trim(coalesce(item #>> '{note,en}', '')))));
    end loop;
  end if;
  return jsonb_build_object('scale', scale, 'role', role_, 'analogue', analogue, 'heroAssetId', hero,
    'contributorIds', contributors, 'sourceIds', sources, 'tagIds', tags, 'relationDrafts', relations,
    'pendingSources', pending_sources, 'pendingTags', pending_tags);
end;
$$;
revoke execute on function public.pw_validate_entry_metadata(jsonb, text) from public, anon, authenticated;

-- A URL segment that no entry uses now or used before.
create or replace function public.pw_unique_entry_slug(p_title text, p_id text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  base text := left(trim(both '-' from regexp_replace(lower(coalesce(p_title, '')), '[^a-z0-9]+', '-', 'g')), 64);
  candidate text;
  n integer := 1;
begin
  if base = '' then base := 'entry-' || lower(regexp_replace(p_id, '\D', '', 'g')); end if;
  candidate := base;
  while exists (select 1 from public.entries e where e.slug = candidate or candidate = any(e.former_slugs)) loop
    n := n + 1;
    candidate := left(base, 60) || '-' || n;
  end loop;
  return candidate;
end;
$$;
revoke execute on function public.pw_unique_entry_slug(text, text) from public, anon, authenticated;

create or replace function public.pw_bilingual_complete(p_title_zh text, p_title_en text, p_summary_zh text, p_summary_en text, p_body text)
returns boolean language sql immutable set search_path = '' as $$
  select trim(coalesce(p_title_zh, '')) <> '' and trim(coalesce(p_title_en, '')) <> ''
    and trim(coalesce(p_summary_zh, '')) <> '' and trim(coalesce(p_summary_en, '')) <> ''
    and coalesce(p_body, '') ~ '(^|\n):::zh' and coalesce(p_body, '') ~ '(^|\n):::en';
$$;

-- Asset ids a body places as ![…](asset:<id>).
create or replace function public.pw_body_asset_ids(p_body text)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct m[1]), '{}') from regexp_matches(coalesce(p_body, ''), '\]\(asset:([A-Za-z0-9_-]+)\)', 'g') m;
$$;

-- Readers may only be shown approved images.
create or replace function public.pw_assert_assets_public(p_hero text, p_body text)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  refs text[] := public.pw_body_asset_ids(p_body) || case when p_hero is null then '{}'::text[] else array[p_hero] end;
  blocked text;
begin
  select string_agg(ref, ', ') into blocked from unnest(refs) ref
  where not exists (select 1 from public.assets a where a.id = ref and a.review_status = 'approved');
  if blocked is not null then raise exception 'assets_not_approved' using errcode = '40001', detail = blocked; end if;
end;
$$;
revoke execute on function public.pw_assert_assets_public(text, text) from public, anon, authenticated;

/*
 * Fills the keys an older revision did not record from what readers see now,
 * so a published revision is always a complete snapshot.
 */
create or replace function public.pw_complete_metadata(p_entry public.entries, p_metadata jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'scale', p_entry.scale, 'role', p_entry.role, 'heroAssetId', p_entry.hero_asset_id,
    'analogue', case when coalesce(p_entry.analogue_name_zh, p_entry.analogue_name_en) is null then null else jsonb_build_object(
      'name', jsonb_build_object('zh', coalesce(p_entry.analogue_name_zh, ''), 'en', coalesce(p_entry.analogue_name_en, '')),
      'note', jsonb_build_object('zh', coalesce(p_entry.analogue_note_zh, ''), 'en', coalesce(p_entry.analogue_note_en, ''))) end,
    'contributorIds', coalesce((select jsonb_agg(c.author_id order by c.position, c.author_id) from public.entry_contributors c where c.entry_id = p_entry.id), '[]'::jsonb),
    'sourceIds', coalesce((select jsonb_agg(s.source_id order by s.position, s.source_id) from public.entry_sources s where s.entry_id = p_entry.id), '[]'::jsonb),
    'tagIds', coalesce((select jsonb_agg(t.tag_id order by t.position, t.tag_id) from public.entry_tags t where t.entry_id = p_entry.id), '[]'::jsonb),
    'relationDrafts', coalesce((select jsonb_agg(jsonb_build_object('to', x.to_entry_id, 'kind', x.kind, 'strength', x.strength,
      'note', jsonb_build_object('zh', coalesce(x.note_zh, ''), 'en', coalesce(x.note_en, ''))) order by x.id)
      from public.relations x where x.from_entry_id = p_entry.id), '[]'::jsonb),
    'pendingSources', '[]'::jsonb, 'pendingTags', '[]'::jsonb
  ) || coalesce(p_metadata, '{}'::jsonb);
$$;
revoke execute on function public.pw_complete_metadata(public.entries, jsonb) from public, anon, authenticated;

-- "中文 / English" or "中文 | English" gives both labels; one name serves both languages.
create or replace function public.pw_split_label(p_label text)
returns text[] language sql immutable set search_path = '' as $$
  select case when p_label ~ '\s[/|｜]\s|[|｜]'
    then array[trim(split_part(regexp_replace(p_label, '\s*[/|｜]\s*', '|', 'g'), '|', 1)), trim(split_part(regexp_replace(p_label, '\s*[/|｜]\s*', '|', 'g'), '|', 2))]
    else array[trim(p_label), trim(p_label)] end;
$$;

/*
 * Turns the names a draft proposed (pendingTags / pendingSources) into real
 * tags and sources when it is published, reusing an existing one with the
 * same label, title or address. Returns the metadata with ids in their place.
 */
create or replace function public.pw_materialize_pending(p_metadata jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := p_metadata;
  label text;
  labels text[];
  found_id text;
  line text;
  v_url text;
  v_title text;
begin
  for label in select jsonb_array_elements_text(coalesce(m->'pendingTags', '[]'::jsonb)) loop
    labels := public.pw_split_label(label);
    if coalesce(labels[1], '') = '' then continue; end if;
    select t.id into found_id from public.tags t
    where lower(t.label_zh) in (lower(labels[1]), lower(coalesce(nullif(labels[2], ''), labels[1])))
       or lower(t.label_en) in (lower(labels[1]), lower(coalesce(nullif(labels[2], ''), labels[1])))
    order by t.id limit 1;
    if found_id is null then
      found_id := 'tag-' || left(md5(lower(label)), 10);
      insert into public.tags(id, label_zh, label_en) values (found_id, labels[1], coalesce(nullif(labels[2], ''), labels[1]))
      on conflict (id) do nothing;
    end if;
    if not coalesce(m->'tagIds', '[]'::jsonb) @> jsonb_build_array(found_id) then
      m := jsonb_set(m, '{tagIds}', coalesce(m->'tagIds', '[]'::jsonb) || jsonb_build_array(found_id));
    end if;
    found_id := null;
  end loop;
  for line in select jsonb_array_elements_text(coalesce(m->'pendingSources', '[]'::jsonb)) loop
    v_url := substring(line from 'https?://[^\s<>"]+');
    v_title := trim(both ' .,;' from coalesce(nullif(trim(replace(line, coalesce(v_url, ''), '')), ''), v_url, line));
    select s.id into found_id from public.sources s
    where (v_url is not null and s.url = v_url) or lower(s.title) = lower(v_title)
    order by s.id limit 1;
    if found_id is null then
      found_id := 'src-' || left(md5(lower(line)), 10);
      insert into public.sources(id, kind, title, creators, url)
      values (found_id, case when v_url is null then 'book' else 'web' end, left(v_title, 500), '', v_url)
      on conflict (id) do nothing;
    end if;
    if not coalesce(m->'sourceIds', '[]'::jsonb) @> jsonb_build_array(found_id) then
      m := jsonb_set(m, '{sourceIds}', coalesce(m->'sourceIds', '[]'::jsonb) || jsonb_build_array(found_id));
    end if;
    found_id := null;
  end loop;
  return m || jsonb_build_object('pendingTags', '[]'::jsonb, 'pendingSources', '[]'::jsonb);
end;
$$;
revoke execute on function public.pw_materialize_pending(jsonb) from public, anon, authenticated;

/*
 * Makes a published revision what readers see: the public columns, the
 * catalogue place and every association, together.
 */
create or replace function public.pw_apply_entry_snapshot(p_entry_id text, p_revision_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.entry_revisions;
  e public.entries;
  m jsonb;
  filing jsonb;
  relation_item jsonb;
begin
  select * into r from public.entry_revisions where id = p_revision_id and entry_id = p_entry_id;
  select * into e from public.entries where id = p_entry_id;
  m := r.metadata;
  filing := coalesce(m->'taxonomy', '{}'::jsonb);
  update public.entries set
    title_zh = coalesce(r.title_zh, title_zh), title_en = coalesce(r.title_en, title_en),
    summary_zh = coalesce(r.summary_zh, summary_zh), summary_en = coalesce(r.summary_en, summary_en),
    scale = coalesce(m->>'scale', scale), role = coalesce(m->>'role', role),
    analogue_name_zh = case when m ? 'analogue' then nullif(m #>> '{analogue,name,zh}', '') else analogue_name_zh end,
    analogue_name_en = case when m ? 'analogue' then nullif(m #>> '{analogue,name,en}', '') else analogue_name_en end,
    analogue_note_zh = case when m ? 'analogue' then nullif(m #>> '{analogue,note,zh}', '') else analogue_note_zh end,
    analogue_note_en = case when m ? 'analogue' then nullif(m #>> '{analogue,note,en}', '') else analogue_note_en end,
    hero_asset_id = case when m ? 'heroAssetId' then nullif(m->>'heroAssetId', '') else hero_asset_id end,
    category_id = coalesce(filing->>'categoryId', category_id), species = case when filing ? 'species' then filing->>'species' else species end,
    level = coalesce(filing->>'level', level), content_role = coalesce(filing->>'contentRole', content_role),
    status = 'published', published_revision_number = r.number, published_at = now(), updated_at = now()
  where id = p_entry_id;
  if filing ? 'auxiliaryCategoryIds' then
    delete from public.entry_auxiliary_categories where entry_id = p_entry_id;
    insert into public.entry_auxiliary_categories(entry_id, category_id)
    select p_entry_id, value from jsonb_array_elements_text(filing->'auxiliaryCategoryIds')
    where exists (select 1 from public.taxon_categories c where c.id = value) on conflict do nothing;
  end if;
  if m ? 'contributorIds' then
    delete from public.entry_contributors where entry_id = p_entry_id;
    insert into public.entry_contributors(entry_id, author_id, position)
    select p_entry_id, x.value, x.ordinality from jsonb_array_elements_text(m->'contributorIds') with ordinality x
    where x.value <> e.author_id and exists (select 1 from public.authors a where a.id = x.value) on conflict do nothing;
  end if;
  if m ? 'sourceIds' then
    delete from public.entry_sources where entry_id = p_entry_id;
    insert into public.entry_sources(entry_id, source_id, position)
    select p_entry_id, x.value, x.ordinality from jsonb_array_elements_text(m->'sourceIds') with ordinality x
    where exists (select 1 from public.sources s where s.id = x.value) on conflict do nothing;
  end if;
  if m ? 'tagIds' then
    delete from public.entry_tags where entry_id = p_entry_id;
    insert into public.entry_tags(entry_id, tag_id, position)
    select p_entry_id, x.value, x.ordinality from jsonb_array_elements_text(m->'tagIds') with ordinality x
    where exists (select 1 from public.tags t where t.id = x.value) on conflict do nothing;
  end if;
  if m ? 'relationDrafts' then
    delete from public.relations where from_entry_id = p_entry_id;
    for relation_item in select value from jsonb_array_elements(m->'relationDrafts') loop
      if exists (select 1 from public.entries t where t.id = relation_item->>'to') and relation_item->>'to' <> p_entry_id then
        insert into public.relations(id, from_entry_id, to_entry_id, kind, note_zh, note_en, strength)
        values (concat('rel-', p_entry_id, '-', relation_item->>'to', '-', relation_item->>'kind'), p_entry_id, relation_item->>'to',
          relation_item->>'kind', nullif(relation_item #>> '{note,zh}', ''), nullif(relation_item #>> '{note,en}', ''),
          greatest(1, least(3, coalesce((relation_item->>'strength')::integer, 1))))
        on conflict (from_entry_id, to_entry_id, kind) do update set note_zh = excluded.note_zh, note_en = excluded.note_en, strength = excluded.strength;
      end if;
    end loop;
  end if;
end;
$$;
revoke execute on function public.pw_apply_entry_snapshot(text, text) from public, anon, authenticated;

-- The revision row as the application reads it.
create or replace function public.pw_revision_json(p_revision_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'entryId', r.entry_id, 'number', r.number, 'parentId', r.parent_id, 'authorId', r.author_id,
    'createdAt', r.created_at, 'note', r.note, 'state', r.state, 'taxonomy', r.metadata->'taxonomy',
    'stats', jsonb_build_object('added', r.added_lines, 'removed', r.removed_lines))
  from public.entry_revisions r where r.id = p_revision_id;
$$;
revoke execute on function public.pw_revision_json(text) from public, anon, authenticated;

-- ── Saving a revision ───────────────────────────────────────────────────────

/*
 * Saves the draft contract as a new revision. It never changes what readers
 * see: only publishing does. Saving over a submission withdraws it (the entry
 * returns to draft) so an administrator cannot publish text they did not read.
 */
create or replace function public.pw_save_draft(
  p_entry_id text, p_domain text, p_title_zh text, p_title_en text,
  p_summary_zh text, p_summary_en text, p_body text, p_note text,
  p_base_revision integer, p_metadata jsonb default '{}'::jsonb, p_category_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e public.entries;
  n integer;
  rid text;
  now_at timestamptz := now();
  actor text;
  metadata jsonb;
  filing jsonb;
  withdrew boolean := false;
  new_id text;
  prev_body text;
begin
  if not public.pw_account_active() then raise exception 'verified_account_required' using errcode = '42501'; end if;
  actor := public.pw_editor_author();
  if length(coalesce(p_title_zh, '')) > 200 or length(coalesce(p_title_en, '')) > 200 then raise exception 'title_too_long' using errcode = '22023'; end if;
  if length(coalesce(p_summary_zh, '')) > 2000 or length(coalesce(p_summary_en, '')) > 2000 then raise exception 'summary_too_long' using errcode = '22023'; end if;
  if length(coalesce(p_body, '')) > 400000 then raise exception 'body_too_long' using errcode = '22023'; end if;
  if trim(coalesce(p_title_zh, '')) = '' and trim(coalesce(p_title_en, '')) = '' then raise exception 'title_required' using errcode = '22023'; end if;
  if p_entry_id is null then
    if p_domain is not null and p_domain not in ('algorithms', 'theory', 'languages', 'systems', 'architecture', 'networking', 'distributed', 'databases', 'ml', 'security') then raise exception 'invalid_domain' using errcode = '22023'; end if;
    filing := public.pw_entry_filing(p_metadata, jsonb_build_object('categoryId', coalesce(p_category_id, public.pw_legacy_domain_category(p_domain))));
    perform pg_catalog.pg_advisory_xact_lock(812703);
    new_id := 'PW-' || lpad((coalesce((select max(nullif(regexp_replace(id, '\D', '', 'g'), '')::integer) from public.entries), 0) + 1)::text, 4, '0');
    metadata := public.pw_validate_entry_metadata(p_metadata, new_id);
    -- A new entry is not public until a revision is published; its row holds the first draft for the editorial lists.
    insert into public.entries(id, slug, title_zh, title_en, summary_zh, summary_en, domain, category_id, species, level, content_role,
      scale, role, status, author_id, created_at, updated_at, edited_at, latest_revision_number, hero_asset_id)
    values (new_id, public.pw_unique_entry_slug(p_title_en, new_id), coalesce(p_title_zh, ''), coalesce(p_title_en, ''),
      coalesce(p_summary_zh, ''), coalesce(p_summary_en, ''), p_domain, filing->>'categoryId', filing->>'species', filing->>'level',
      filing->>'contentRole', metadata->>'scale', metadata->>'role', 'draft', actor, now_at, now_at, now_at, 0, metadata->>'heroAssetId')
    returning * into e;
  else
    select * into e from public.entries where id = p_entry_id for update;
    if not found then raise exception 'entry_not_found' using errcode = '22023'; end if;
    if e.author_id <> actor and not public.pw_can_manage() then raise exception 'forbidden' using errcode = '42501'; end if;
    if e.deleted_at is not null then raise exception 'entry_archived' using errcode = '40001'; end if;
    if p_base_revision is not null and p_base_revision <> e.latest_revision_number then raise exception 'revision_conflict' using errcode = '40001'; end if;
    filing := public.pw_entry_filing(p_metadata, public.pw_revision_filing(e, e.id || '@r' || e.latest_revision_number));
    metadata := public.pw_validate_entry_metadata(p_metadata, e.id);
    withdrew := e.status = 'in_review';
  end if;
  metadata := metadata || jsonb_build_object('taxonomy', filing);
  n := e.latest_revision_number + 1;
  rid := e.id || '@r' || n;
  select b.body into prev_body from public.entry_revision_bodies b where b.revision_id = e.id || '@r' || e.latest_revision_number;
  insert into public.entry_revisions(id, entry_id, number, parent_id, author_id, actor_id, note, state, metadata,
    title_zh, title_en, summary_zh, summary_en, added_lines, removed_lines)
  values (rid, e.id, n, case when n > 1 then e.id || '@r' || (n - 1) end, actor, auth.uid(),
    left(coalesce(nullif(trim(p_note), ''), 'Save draft'), 500), 'draft', metadata,
    coalesce(p_title_zh, ''), coalesce(p_title_en, ''), coalesce(p_summary_zh, ''), coalesce(p_summary_en, ''),
    (select count(*) from unnest(string_to_array(coalesce(p_body, ''), E'\n')) l where not l = any(string_to_array(coalesce(prev_body, ''), E'\n'))),
    (select count(*) from unnest(string_to_array(coalesce(prev_body, ''), E'\n')) l where not l = any(string_to_array(coalesce(p_body, ''), E'\n'))));
  insert into public.entry_revision_bodies(revision_id, body) values (rid, coalesce(p_body, ''));
  update public.entries set latest_revision_number = n, status = 'draft', edited_at = now_at where id = e.id;
  perform public.pw_audit_insert(case when withdrew then 'save_over_review' else 'save_revision' end, 'entry', e.id,
    jsonb_build_object('status', e.status, 'latest', e.latest_revision_number), jsonb_build_object('revision', rid, 'status', 'draft'));
  return public.pw_revision_json(rid) || jsonb_build_object('withdrewReview', withdrew, 'slug', e.slug);
end;
$$;
revoke execute on function public.pw_save_draft(text, text, text, text, text, text, text, text, integer, jsonb, text) from public, anon;
grant execute on function public.pw_save_draft(text, text, text, text, text, text, text, text, integer, jsonb, text) to authenticated;

-- ── Lifecycle ───────────────────────────────────────────────────────────────

/*
 * submit   author/admin  draft → in_review, copying the latest revision
 * withdraw author/admin  in_review → draft
 * return   admin         in_review → draft, with a reason the author sees
 * publish  admin         in_review → published, exactly the revision reviewed
 * rollback admin         draft/published → published, a published revision's content as a new revision
 *
 * p_expected_revision is the latest revision the caller looked at; any other
 * write since then is a conflict, never silently published.
 */
create or replace function public.pw_entry_lifecycle(
  p_entry_id text, p_action text, p_expected_revision integer, p_target_revision_id text, p_note text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e public.entries;
  src public.entry_revisions;
  src_body text;
  n integer;
  rid text;
  actor text;
  metadata jsonb;
  filing jsonb;
  next_state text;
  note text := nullif(left(trim(coalesce(p_note, '')), 2000), '');
begin
  if not public.pw_account_active() then raise exception 'verified_account_required' using errcode = '42501'; end if;
  actor := public.pw_editor_author();
  select * into e from public.entries where id = p_entry_id for update;
  if not found then raise exception 'entry_not_found' using errcode = '22023'; end if;
  if e.deleted_at is not null then raise exception 'entry_archived' using errcode = '40001'; end if;
  if p_action in ('submit', 'withdraw') then
    if e.author_id <> actor and not public.pw_can_manage() then raise exception 'forbidden' using errcode = '42501'; end if;
  elsif p_action in ('return', 'publish', 'rollback') then
    if not public.pw_can_manage() then raise exception 'admin_required' using errcode = '42501'; end if;
  else
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  if p_action in ('return', 'publish') and p_expected_revision is null then raise exception 'expected_revision_required' using errcode = '22023'; end if;
  if p_expected_revision is not null and p_expected_revision <> e.latest_revision_number then raise exception 'revision_conflict' using errcode = '40001'; end if;

  if p_action = 'withdraw' or p_action = 'return' then
    if e.status <> 'in_review' then raise exception 'invalid_transition' using errcode = '40001'; end if;
    if p_action = 'return' and note is null then raise exception 'reason_required' using errcode = '22023'; end if;
    update public.entries set status = 'draft', edited_at = now(),
      return_note = case when p_action = 'return' then note else null end,
      returned_at = case when p_action = 'return' then now() else null end
    where id = e.id;
    perform public.pw_audit_insert(p_action, 'entry', e.id, jsonb_build_object('status', e.status),
      jsonb_build_object('status', 'draft', 'revision', e.latest_revision_number, 'note', note));
    return public.pw_revision_json(e.id || '@r' || e.latest_revision_number) || jsonb_build_object('entryStatus', 'draft');
  end if;

  if p_action = 'submit' then
    if e.status <> 'draft' then raise exception 'invalid_transition' using errcode = '40001'; end if;
    select * into src from public.entry_revisions where id = e.id || '@r' || e.latest_revision_number;
    next_state := 'in_review';
  elsif p_action = 'publish' then
    if e.status <> 'in_review' then raise exception 'invalid_transition' using errcode = '40001'; end if;
    select * into src from public.entry_revisions where id = e.id || '@r' || e.latest_revision_number;
    next_state := 'published';
  else
    if e.status = 'in_review' then raise exception 'review_pending' using errcode = '40001'; end if;
    select * into src from public.entry_revisions where id = p_target_revision_id and entry_id = e.id;
    if not found then raise exception 'revision_not_found' using errcode = '22023'; end if;
    if src.state <> 'published' then raise exception 'rollback_target_unpublished' using errcode = '22023'; end if;
    next_state := 'published';
  end if;
  if src.id is null then raise exception 'revision_not_found' using errcode = '22023'; end if;
  select b.body into src_body from public.entry_revision_bodies b where b.revision_id = src.id;

  -- Re-check the stored place: its genus may have been archived since the draft was saved.
  filing := public.pw_entry_filing(null, public.pw_revision_filing(e, src.id));
  metadata := coalesce(src.metadata, '{}'::jsonb) || jsonb_build_object('taxonomy', filing);
  if next_state = 'published' then
    metadata := public.pw_complete_metadata(e, metadata - 'backfilled');
    metadata := public.pw_materialize_pending(metadata);
  end if;
  if not public.pw_bilingual_complete(coalesce(src.title_zh, e.title_zh), coalesce(src.title_en, e.title_en),
    coalesce(src.summary_zh, e.summary_zh), coalesce(src.summary_en, e.summary_en), src_body) then
    raise exception 'bilingual_incomplete' using errcode = '22023';
  end if;
  if next_state = 'published' then perform public.pw_assert_assets_public(nullif(metadata->>'heroAssetId', ''), src_body); end if;

  n := e.latest_revision_number + 1;
  rid := e.id || '@r' || n;
  insert into public.entry_revisions(id, entry_id, number, parent_id, author_id, actor_id, note, state, metadata,
    title_zh, title_en, summary_zh, summary_en)
  values (rid, e.id, n, e.id || '@r' || e.latest_revision_number, actor, auth.uid(),
    coalesce(note, case p_action when 'rollback' then 'Rollback to r' || src.number else initcap(p_action) end), next_state, metadata,
    coalesce(src.title_zh, e.title_zh), coalesce(src.title_en, e.title_en), coalesce(src.summary_zh, e.summary_zh), coalesce(src.summary_en, e.summary_en));
  insert into public.entry_revision_bodies(revision_id, body) values (rid, coalesce(src_body, ''));
  update public.entries set latest_revision_number = n, status = next_state, edited_at = now(),
    return_note = null, returned_at = null where id = e.id;
  if next_state = 'published' then perform public.pw_apply_entry_snapshot(e.id, rid); end if;
  perform public.pw_audit_insert(p_action, 'entry', e.id,
    jsonb_build_object('status', e.status, 'latest', e.latest_revision_number, 'published', e.published_revision_number),
    jsonb_build_object('status', next_state, 'revision', rid, 'source', src.id));
  return public.pw_revision_json(rid) || jsonb_build_object('entryStatus', next_state);
end;
$$;
revoke execute on function public.pw_entry_lifecycle(text, text, integer, text, text) from public, anon;
grant execute on function public.pw_entry_lifecycle(text, text, integer, text, text) to authenticated;

-- The previous signature: the caller's latest revision is whatever is latest now.
create or replace function public.pw_transition_entry(p_entry_id text, p_action text, p_target_revision_id text, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return public.pw_entry_lifecycle(p_entry_id, p_action,
    (select latest_revision_number from public.entries where id = p_entry_id), p_target_revision_id, p_note);
end;
$$;

-- ── Archive and restore ─────────────────────────────────────────────────────

create or replace function public.pw_set_entry_archived(p_entry_id text, p_archived boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e public.entries;
begin
  perform public.pw_raise_unless_admin();
  select * into e from public.entries where id = p_entry_id for update;
  if not found then raise exception 'entry_not_found' using errcode = '22023'; end if;
  if (e.deleted_at is not null) = p_archived then raise exception 'unchanged_status' using errcode = '40001'; end if;
  update public.entries set deleted_at = case when p_archived then now() else null end where id = p_entry_id returning * into e;
  perform public.pw_audit_insert(case when p_archived then 'archive' else 'restore' end, 'entry', p_entry_id, null,
    jsonb_build_object('archivedAt', e.deleted_at, 'reason', nullif(trim(coalesce(p_reason, '')), '')));
  return jsonb_build_object('id', e.id, 'slug', e.slug, 'archivedAt', e.deleted_at, 'status', e.status);
end;
$$;
create or replace function public.pw_archive_entry(p_entry_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.entries where id = p_entry_id) then
    perform public.pw_raise_unless_admin();
    return null;
  end if;
  return public.pw_set_entry_archived(p_entry_id, true, null);
end;
$$;

-- Renames an entry's URL segment; the old one keeps resolving.
create or replace function public.pw_admin_rename_entry_slug(p_entry_id text, p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e public.entries;
  next_slug text := lower(trim(coalesce(p_slug, '')));
begin
  perform public.pw_raise_unless_admin();
  if next_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(next_slug) > 80 then raise exception 'invalid_slug' using errcode = '22023'; end if;
  select * into e from public.entries where id = p_entry_id for update;
  if not found then raise exception 'entry_not_found' using errcode = '22023'; end if;
  if e.slug = next_slug then return jsonb_build_object('slug', e.slug, 'formerSlugs', e.former_slugs); end if;
  if exists (select 1 from public.entries x where x.id <> e.id and (x.slug = next_slug or next_slug = any(x.former_slugs))) then
    raise exception 'slug_taken' using errcode = '40001';
  end if;
  update public.entries set former_slugs = array_append(array_remove(former_slugs, next_slug), slug), slug = next_slug
  where id = e.id returning * into e;
  perform public.pw_audit_insert('rename_slug', 'entry', e.id, null, jsonb_build_object('slug', e.slug, 'formerSlugs', e.former_slugs));
  return jsonb_build_object('slug', e.slug, 'formerSlugs', e.former_slugs);
end;
$$;
revoke execute on function public.pw_set_entry_archived(text, boolean, text), public.pw_admin_rename_entry_slug(text, text) from public, anon;
grant execute on function public.pw_set_entry_archived(text, boolean, text), public.pw_admin_rename_entry_slug(text, text) to authenticated;

-- ── Editorial lists ─────────────────────────────────────────────────────────

/*
 * Entries as their editors see them: the latest revision's title, the
 * workflow state and the public pointer. p_scope 'mine' lists the caller's
 * own entries; 'all' is for administrators. p_view: active | archived | all.
 * p_status may include 'returned' (a draft sent back with a reason).
 */
create or replace function public.pw_list_editorial_entries(
  p_scope text default 'mine', p_text text default '', p_status text[] default '{}', p_view text default 'active',
  p_limit integer default 25, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  actor text := public.pw_bound_author();
  admin boolean := public.pw_can_manage();
  q text := lower(trim(coalesce(p_text, '')));
  result jsonb;
begin
  if p_scope = 'all' and not admin then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_scope = 'mine' and actor is null then
    return jsonb_build_object('total', 0, 'rows', '[]'::jsonb);
  end if;
  with base as (
    select e.*, r.title_zh r_title_zh, r.title_en r_title_en, r.summary_zh r_summary_zh, r.summary_en r_summary_en,
      a.name_zh author_zh, a.name_en author_en
    from public.entries e
    left join public.entry_revisions r on r.id = e.id || '@r' || e.latest_revision_number
    left join public.authors a on a.id = e.author_id
    where (p_scope = 'all' or e.author_id = actor)
      and (coalesce(p_view, 'active') = 'all' or (p_view = 'archived') = (e.deleted_at is not null))
      and (q = '' or strpos(lower(concat_ws(' ', e.id, e.slug, e.title_zh, e.title_en, r.title_zh, r.title_en)), q) > 0)
      and (coalesce(cardinality(p_status), 0) = 0 or e.status = any(p_status)
        or ('returned' = any(p_status) and e.status = 'draft' and e.return_note is not null)
        or ('unpublished' = any(p_status) and e.published_revision_number is null))
  )
  select jsonb_build_object('total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(row_data order by edited desc nulls last, id) from (
      select coalesce(b.edited_at, b.updated_at) edited, b.id, jsonb_build_object('id', b.id, 'slug', b.slug,
        'title', jsonb_build_object('zh', coalesce(b.r_title_zh, b.title_zh), 'en', coalesce(b.r_title_en, b.title_en)),
        'summary', jsonb_build_object('zh', coalesce(b.r_summary_zh, b.summary_zh), 'en', coalesce(b.r_summary_en, b.summary_en)),
        'status', b.status, 'latestRevision', b.latest_revision_number, 'publishedRevision', b.published_revision_number,
        'authorId', b.author_id, 'authorName', jsonb_build_object('zh', coalesce(b.author_zh, ''), 'en', coalesce(b.author_en, '')),
        'categoryId', b.category_id, 'editedAt', coalesce(b.edited_at, b.updated_at), 'publishedAt', b.published_at,
        'archivedAt', b.deleted_at, 'returnNote', b.return_note, 'returnedAt', b.returned_at) row_data
      from base b order by coalesce(b.edited_at, b.updated_at) desc nulls last, b.id
      limit greatest(1, least(coalesce(p_limit, 25), 100)) offset greatest(0, coalesce(p_offset, 0))
    ) page), '[]'::jsonb)) into result;
  return result;
end;
$$;
revoke execute on function public.pw_list_editorial_entries(text, text, text[], text, integer, integer) from public, anon;
grant execute on function public.pw_list_editorial_entries(text, text, text[], text, integer, integer) to authenticated;

-- ── Working drafts: autosave without losing a newer save ────────────────────

alter table public.entry_working_drafts add column if not exists version integer not null default 1;
drop policy if exists "owners write working drafts" on public.entry_working_drafts;
drop policy if exists "owners update working drafts" on public.entry_working_drafts;
revoke insert, update on public.entry_working_drafts from anon, authenticated;

/*
 * Autosaves the editor. p_known_version is the version this editor last
 * loaded or saved; a newer one (another tab or device) is returned instead of
 * being overwritten, with conflict = true.
 */
create or replace function public.pw_save_working_draft(p_id uuid, p_entry_id text, p_base_revision integer, p_payload jsonb, p_known_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor text;
  row_ public.entry_working_drafts;
begin
  if not public.pw_account_active() then raise exception 'verified_account_required' using errcode = '42501'; end if;
  actor := public.pw_editor_author();
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 2000000 then
    raise exception 'invalid_draft_payload' using errcode = '22023';
  end if;
  if p_entry_id is not null and not public.pw_entry_editable(p_entry_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_id is not null then
    select * into row_ from public.entry_working_drafts where id = p_id and owner_id = auth.uid() for update;
  elsif p_entry_id is not null then
    select * into row_ from public.entry_working_drafts where entry_id = p_entry_id and owner_id = auth.uid() for update;
  end if;
  if row_.id is not null then
    if p_known_version is not null and row_.version > p_known_version then
      return jsonb_build_object('conflict', true, 'id', row_.id, 'version', row_.version, 'savedAt', row_.updated_at, 'payload', row_.payload);
    end if;
    update public.entry_working_drafts set payload = p_payload, base_revision = p_base_revision, entry_id = coalesce(p_entry_id, entry_id),
      version = version + 1, updated_at = now() where id = row_.id returning * into row_;
  else
    insert into public.entry_working_drafts(id, entry_id, owner_id, author_id, base_revision, payload)
    values (gen_random_uuid(), p_entry_id, auth.uid(), actor, p_base_revision, p_payload)
    on conflict (owner_id, entry_id) do update set payload = excluded.payload, base_revision = excluded.base_revision,
      version = public.entry_working_drafts.version + 1, updated_at = now()
    returning * into row_;
  end if;
  return jsonb_build_object('conflict', false, 'id', row_.id, 'version', row_.version, 'savedAt', row_.updated_at);
end;
$$;
revoke execute on function public.pw_save_working_draft(uuid, text, integer, jsonb, integer) from public, anon;
grant execute on function public.pw_save_working_draft(uuid, text, integer, jsonb, integer) to authenticated;

-- ── Search: published content only ──────────────────────────────────────────

drop function if exists public.pw_search_entries(text, text, text, text, text, text, integer, integer, text, text);

create or replace function public.pw_search_entries_v2(
  p_text text default '', p_domain text[] default '{}', p_scale text[] default '{}',
  p_status text[] default '{}', p_lang text[] default '{}', p_author text[] default '{}',
  p_family text[] default '{}', p_category text[] default '{}', p_limit integer default 50, p_offset integer default 0
) returns jsonb language sql stable security invoker set search_path = '' as $$
with terms as (
  select term from regexp_split_to_table(lower(trim(coalesce(p_text, ''))), '\s+') term where term <> ''
), source as (
  select e.*, c.family_id,
    e.published_revision_number visible_revision,
    'published'::text visible_status,
    coalesce(b.body, '') body,
    case when coalesce(b.body, '') ~ '(^|\n):::zh' or coalesce(b.body, '') ~ '(^|\n):::en'
      then array_remove(array[case when b.body ~ '(^|\n):::zh' then 'zh' end, case when b.body ~ '(^|\n):::en' then 'en' end], null)
      else array['zh', 'en']::text[] end body_languages,
    coalesce((select string_agg(t.label_zh || ' ' || t.label_en, ' ') from public.entry_tags et join public.tags t on t.id = et.tag_id where et.entry_id = e.id), '') tag_text,
    coalesce((select string_agg(a.handle || ' ' || a.name_zh || ' ' || a.name_en, ' ') from public.authors a where a.id = e.author_id or exists (select 1 from public.entry_contributors ec where ec.entry_id = e.id and ec.author_id = a.id)), '') author_text,
    coalesce((select string_agg(s.title || ' ' || s.creators, ' ') from public.entry_sources es join public.sources s on s.id = es.source_id where es.entry_id = e.id), '') source_text
  from public.entries e
  left join public.taxon_categories c on c.id = e.category_id
  left join public.entry_revision_bodies b on b.revision_id = e.id || '@r' || e.published_revision_number
  where e.deleted_at is null and e.published_revision_number is not null
), text_matched as materialized (
  select s.*, matched.fields matched_fields, matched.score,
    case when 'body' = any(matched.fields) then s.body else s.summary_zh || ' ' || s.summary_en end snippet_text
  from source s
  cross join lateral (
    select coalesce(array_agg(field order by weight desc), '{}'::text[]) fields, coalesce(sum(weight), 0) score
    from (values ('id', s.id, 100), ('title', s.title_zh || ' ' || s.title_en, 60),
      ('tags', s.tag_text, 35), ('summary', s.summary_zh || ' ' || s.summary_en, 25),
      ('author', s.author_text, 15), ('source', s.source_text, 15), ('body', s.body, 5)) f(field, content, weight)
    where exists (select 1 from terms where strpos(lower(f.content), term) > 0)
  ) matched
  where not exists (
    select 1 from terms where strpos(lower(concat_ws(' ', s.id, s.title_zh, s.title_en, s.summary_zh, s.summary_en, s.body, s.tag_text, s.author_text, s.source_text)), term) = 0
  )
), filtered as (
  select * from text_matched s
  where (coalesce(cardinality(p_domain), 0) = 0 or s.domain = any(p_domain))
    and (coalesce(cardinality(p_scale), 0) = 0 or s.scale = any(p_scale))
    and (coalesce(cardinality(p_status), 0) = 0 or s.visible_status = any(p_status))
    and (coalesce(cardinality(p_author), 0) = 0 or s.author_id = any(p_author))
    and (coalesce(cardinality(p_family), 0) = 0 or s.family_id = any(p_family))
    and (coalesce(cardinality(p_category), 0) = 0 or s.category_id = any(p_category))
    and (coalesce(cardinality(p_lang), 0) = 0 or s.body_languages && p_lang)
), page as (
  select * from filtered order by score desc, updated_at desc, id limit greatest(0, least(p_limit, 100)) offset greatest(0, p_offset)
), facet_rows as (
  select 'family' kind, family_id key, count(*) value from text_matched where family_id is not null group by family_id
  union all select 'category', category_id, count(*) from text_matched where category_id is not null group by category_id
  union all select 'domain', domain, count(*) from text_matched where domain is not null group by domain
  union all select 'scale', scale, count(*) from text_matched group by scale
  union all select 'status', visible_status, count(*) from text_matched group by visible_status
  union all select 'lang', language, count(*) from text_matched cross join lateral unnest(body_languages) language group by language
), facets as (
  select coalesce(jsonb_object_agg(kind, counts), '{}'::jsonb) data from (
    select kind, jsonb_object_agg(key, value) counts from facet_rows group by kind
  ) grouped
)
select jsonb_build_object(
  'hits', coalesce((select jsonb_agg(jsonb_build_object(
    'entry', jsonb_build_object('id', id, 'slug', slug, 'title', jsonb_build_object('zh', title_zh, 'en', title_en), 'summary', jsonb_build_object('zh', summary_zh, 'en', summary_en),
      'domain', domain, 'categoryId', category_id, 'species', species, 'level', level, 'contentRole', content_role, 'scale', scale, 'role', role, 'status', visible_status, 'authorId', author_id,
      'contributorIds', coalesce((select jsonb_agg(author_id order by position, author_id) from public.entry_contributors where entry_id = page.id), '[]'::jsonb),
      'sourceIds', coalesce((select jsonb_agg(source_id order by position, source_id) from public.entry_sources where entry_id = page.id), '[]'::jsonb),
      'tagIds', coalesce((select jsonb_agg(tag_id order by position, tag_id) from public.entry_tags where entry_id = page.id), '[]'::jsonb),
      'auxiliaryCategoryIds', coalesce((select jsonb_agg(category_id) from public.entry_auxiliary_categories where entry_id = page.id), '[]'::jsonb),
      'bodyLanguages', body_languages, 'heroAssetId', hero_asset_id, 'createdAt', created_at, 'updatedAt', updated_at, 'revision', coalesce(visible_revision, 0)),
    'familyId', family_id, 'score', score, 'matchedFields', matched_fields,
    'snippet', case when coalesce(trim(p_text), '') = '' then null else jsonb_build_object(
      'field', case when 'body' = any(matched_fields) then 'body' else 'summary' end,
      'text', left(snippet_text, 100), 'highlights', '[]'::jsonb) end
  ) order by score desc, updated_at desc, id) from page), '[]'::jsonb),
  'total', (select count(*) from filtered),
  'facets', '{"family":{},"category":{},"domain":{},"scale":{},"status":{},"lang":{}}'::jsonb || (select data from facets)
);
$$;
revoke execute on function public.pw_search_entries_v2(text, text[], text[], text[], text[], text[], text[], text[], integer, integer) from public;
grant execute on function public.pw_search_entries_v2(text, text[], text[], text[], text[], text[], text[], text[], integer, integer) to anon, authenticated;
