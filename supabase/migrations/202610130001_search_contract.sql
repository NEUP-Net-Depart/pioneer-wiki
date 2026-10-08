-- Versioned RPC keeps older application versions deployable during migration.
-- Every source uses RLS, including the visible revision body.
create or replace function public.pw_search_entries_v2(
  p_text text default '', p_domain text[] default '{}', p_scale text[] default '{}',
  p_status text[] default '{}', p_lang text[] default '{}', p_author text[] default '{}',
  p_family text[] default '{}', p_category text[] default '{}', p_limit integer default 50, p_offset integer default 0
) returns jsonb language sql stable security invoker set search_path = '' as $$
with terms as (
  select term from regexp_split_to_table(lower(trim(coalesce(p_text, ''))), '\s+') term where term <> ''
), source as (
  select e.*, c.family_id,
    coalesce(r.number, e.published_revision_number) visible_revision,
    case when e.author_id = (select public.pw_bound_author()) or (select public.pw_can_manage()) then e.status else 'published' end visible_status,
    coalesce(b.body, '') body,
    case when coalesce(b.body, '') ~ '(^|\n):::zh' or coalesce(b.body, '') ~ '(^|\n):::en'
      then array_remove(array[case when b.body ~ '(^|\n):::zh' then 'zh' end, case when b.body ~ '(^|\n):::en' then 'en' end], null)
      else array['zh', 'en']::text[] end body_languages,
    coalesce((select string_agg(t.label_zh || ' ' || t.label_en, ' ') from public.entry_tags et join public.tags t on t.id = et.tag_id where et.entry_id = e.id), '') tag_text,
    coalesce((select string_agg(a.handle || ' ' || a.name_zh || ' ' || a.name_en, ' ') from public.authors a where a.id = e.author_id or exists (select 1 from public.entry_contributors ec where ec.entry_id = e.id and ec.author_id = a.id)), '') author_text,
    coalesce((select string_agg(s.title || ' ' || s.creators, ' ') from public.entry_sources es join public.sources s on s.id = es.source_id where es.entry_id = e.id), '') source_text
  from public.entries e
  left join public.taxon_categories c on c.id = e.category_id
  left join public.entry_revisions r on r.entry_id = e.id and r.number = case when e.author_id = (select public.pw_bound_author()) or (select public.pw_can_manage()) then e.latest_revision_number else e.published_revision_number end
  left join public.entry_revision_bodies b on b.revision_id = e.id || '@r' || coalesce(r.number, e.published_revision_number)
  where e.deleted_at is null
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
      'contributorIds', coalesce((select jsonb_agg(author_id) from public.entry_contributors where entry_id = page.id), '[]'::jsonb),
      'sourceIds', coalesce((select jsonb_agg(source_id) from public.entry_sources where entry_id = page.id), '[]'::jsonb),
      'tagIds', coalesce((select jsonb_agg(tag_id) from public.entry_tags where entry_id = page.id), '[]'::jsonb),
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
