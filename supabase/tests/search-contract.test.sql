begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
insert into public.authors(id, handle, name_zh, name_en, role, sigil) values ('search-author', 'search-author', 'Writer', 'Writer', 'contributor', 'test');
insert into public.taxon_families(id, slug, name_zh, name_en, scientific_name) values ('search-family', 'search-family', 'Test', 'Test', 'Test');
insert into public.taxon_categories(id, family_id, slug, name_zh, name_en, scientific_name) values ('search-category', 'search-family', 'search-category', 'Test', 'Test', 'Test');
insert into public.entries(id, slug, title_zh, title_en, summary_zh, summary_en, scale, role, status, author_id, created_at, updated_at, published_revision_number, latest_revision_number, category_id)
select 'search-' || n, 'search-' || n, '标题', 'Search tree ' || n, '摘要', 'Summary', case when n = 1 then 'micro' else 'macro' end, 'observer', 'published', 'search-author', now(), now(), 1, 2, 'search-category'
from generate_series(1, 3) n;
insert into public.entry_revisions(id, entry_id, number, author_id, note, state)
select id || '@r' || n, id, n, 'search-author', 'Test', case when n = 1 then 'published' else 'draft' end
from public.entries cross join generate_series(1, 2) n where id like 'search-%';
insert into public.entry_revision_bodies(revision_id, body)
select id, case when number = 1 then E':::en\nOnly-body-needle 100%\n:::' else 'Private-unpublished-needle' end
from public.entry_revisions where entry_id like 'search-%';
insert into public.tags(id, label_zh, label_en) values ('search-tag', '标签', 'Tag-needle');
insert into public.entry_tags(entry_id, tag_id) values ('search-1', 'search-tag');
insert into public.sources(id, kind, title, creators, year) values ('search-source', 'web', 'Source-needle', 'Writer', 2026);
insert into public.entry_sources(entry_id, source_id) values ('search-1', 'search-source');
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is((public.pw_search_entries_v2('Search', p_limit => 1)->>'total')::integer, 3, 'total counts before pagination');
select is(jsonb_array_length(public.pw_search_entries_v2('Search', p_limit => 1)->'hits'), 1, 'page is bounded');
select is((public.pw_search_entries_v2('Search', p_scale => array['micro','macro'])->>'total')::integer, 3, 'multiple filter values are retained');
select is((public.pw_search_entries_v2('Search', p_scale => array['micro']) #>> '{facets,scale,macro}')::integer, 2, 'facets are computed before filters');
select is((public.pw_search_entries_v2('only-body-needle')->>'total')::integer, 3, 'visible body searchable');
select ok((public.pw_search_entries_v2('only-body-needle') #> '{hits,0,matchedFields}') ? 'body', 'actual matched field');
select is((public.pw_search_entries_v2('Private-unpublished-needle')->>'total')::integer, 0, 'unpublished body not searched');
select is((public.pw_search_entries_v2('Tag-needle')->>'total')::integer, 1, 'tag searchable');
select is((public.pw_search_entries_v2('Source-needle')->>'total')::integer, 1, 'source searchable');
select is((public.pw_search_entries_v2('100%')->>'total')::integer, 3, 'punctuation is a literal search term');
select is((public.pw_search_entries_v2('Search', p_lang => array['zh'])->>'total')::integer, 0, 'language filter follows visible body blocks');
select is((public.pw_search_entries_v2('Search', p_limit => 1, p_offset => 9)->>'total')::integer, 3, 'empty later page retains total');
select * from finish();
rollback;
