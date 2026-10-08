begin;
create extension if not exists pgtap with schema extensions;
select plan(104);

-- Accounts: author A, author B, admin A, admin B (no author yet), reader, unverified.
insert into auth.users(id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000a001', 'life-author-a@example.test', now()),
  ('00000000-0000-0000-0000-00000000a002', 'life-author-b@example.test', now()),
  ('00000000-0000-0000-0000-00000000a003', 'life-admin-a@example.test', now()),
  ('00000000-0000-0000-0000-00000000a004', 'life-admin-b@example.test', now()),
  ('00000000-0000-0000-0000-00000000a005', 'life-reader@example.test', now()),
  ('00000000-0000-0000-0000-00000000a006', 'life-unverified@example.test', null),
  ('00000000-0000-0000-0000-00000000a007', 'life-poster@example.test', now());
insert into public.authors(id, handle, name_zh, name_en, role, sigil) values
  ('life-a', 'life-a', '作者甲', 'Author A', 'contributor', 'test'),
  ('life-b', 'life-b', '作者乙', 'Author B', 'contributor', 'test'),
  ('life-c', 'life-c', '作者丙', 'Author C', 'contributor', 'test');
update public.profiles set author_id = 'life-a' where id = '00000000-0000-0000-0000-00000000a001';
update public.profiles set author_id = 'life-b' where id = '00000000-0000-0000-0000-00000000a002';
update public.profiles set account_role = 'admin', author_id = 'life-c' where id = '00000000-0000-0000-0000-00000000a003';
update public.profiles set account_role = 'admin' where id = '00000000-0000-0000-0000-00000000a004';
-- Every other administrator in this database stops counting, so the last-admin rule is tested exactly.
update public.profiles set account_role = 'reader' where account_role = 'admin'
  and id not in ('00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-00000000a004');
insert into public.taxon_families(id, slug, name_zh, name_en, scientific_name) values ('life-family', 'life-family', '科', 'Family', 'Lifeidae');
insert into public.taxon_categories(id, family_id, slug, name_zh, name_en, scientific_name) values ('life-genus', 'life-family', 'life-genus', '属', 'Genus', 'Lifea');
insert into public.tags(id, label_zh, label_en) values ('life-tag-old', '旧标签', 'Old tag'), ('life-tag-new', '新标签', 'New tag');
insert into public.sources(id, kind, title, creators) values ('life-src-old', 'web', 'Old source', 'X'), ('life-src-new', 'web', 'New source', 'Y');
insert into public.assets(id, src, width, height, alt_zh, alt_en, credit, license, owner_id, review_status)
values ('life-pending-image', '/api/assets/life-pending-image/file', 10, 10, '图', 'Figure', 'A', 'CC BY 4.0', '00000000-0000-0000-0000-00000000a001', 'pending');
insert into public.members(id, handle, name_zh, name_en, role_zh, role_en, bio_zh, bio_en, about,
  plate_number, plate_emblem, plate_ink, plate_border, plate_motto, joined, author_id)
values ('life-member', 'life-member', '成员甲', 'Member A', '成员', 'Member', '简介', 'Bio', '', 900, 'ex-quill', 'prussian', 'vine', '', current_date, 'life-a');
update public.profiles set member_id = 'life-member' where id = '00000000-0000-0000-0000-00000000a001';
create temp table r(kind text primary key, data jsonb);
grant all on r to authenticated, anon;

create function pg_temp.as_user(p_id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_id, true), set_config('role', case when p_id = '' then 'anon' else 'authenticated' end, true);
$$;
create function pg_temp.body(p_zh text, p_en text) returns text language sql immutable as $$
  select E':::zh\n' || p_zh || E'\n:::\n\n:::en\n' || p_en || E'\n:::';
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- ── 1. Drafts never reach readers ─────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
insert into r values ('v1', public.pw_save_draft(null, null, '旧标题', 'Lifecycle Original', '旧摘要', 'Old summary',
  pg_temp.body('旧正文', 'old-body-needle'), 'First', null,
  '{"tagIds":["life-tag-old"],"sourceIds":["life-src-old"],"scale":"micro","role":"host"}', 'life-genus'));
select is((select data->>'state' from r where kind = 'v1'), 'draft', 'author saves a new entry as a draft');
select ok((select data->>'slug' from r where kind = 'v1') = 'lifecycle-original', 'slug comes from the English title');
insert into r values ('v1b', public.pw_save_draft(null, null, '撞名', 'Lifecycle Original', '摘要', 'Summary', pg_temp.body('a', 'b'), 'Twin', null, '{}', 'life-genus'));
select ok((select data->>'slug' from r where kind = 'v1b') = 'lifecycle-original-2', 'a second entry with the same title gets its own slug');
select pg_temp.as_user('');
select is((select count(*) from public.entries where title_en = 'Lifecycle Original'), 0::bigint, 'an unpublished entry is invisible to anonymous readers');

select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
insert into r values ('submit1', public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'submit', null, null, null));
select is((select data->>'state' from r where kind = 'submit1'), 'in_review', 'author submits');
select throws_ok($$select public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'publish', (select (data->>'number')::integer from r where kind = 'submit1'), null, null)$$,
  '42501', 'admin_required', 'an author cannot publish');

select pg_temp.as_user('00000000-0000-0000-0000-00000000a003');
select throws_ok($$select public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'publish', null, null, null)$$,
  '22023', 'expected_revision_required', 'publishing names the revision that was reviewed');
insert into r values ('pub1', public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'publish', (select (data->>'number')::integer from r where kind = 'submit1'), null, null));
select is((select data->>'state' from r where kind = 'pub1'), 'published', 'admin publishes the reviewed revision');

select pg_temp.as_user('');
select is((select title_en from public.entries where id = (select data->>'entryId' from r where kind = 'v1')), 'Lifecycle Original', 'published title is public');
select is((select count(*) from public.entry_tags where entry_id = (select data->>'entryId' from r where kind = 'v1') and tag_id = 'life-tag-old'), 1::bigint, 'published tags are public');
select is((public.pw_search_entries_v2('old-body-needle')->>'total')::integer, 1, 'published body is searchable');

-- ── 2. Editing a published entry keeps the public version whole ───────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
insert into r values ('v2', public.pw_save_draft((select data->>'entryId' from r where kind = 'v1'), null, '新标题', 'Lifecycle Revised', '新摘要', 'New summary',
  pg_temp.body('新正文', 'new-body-needle'), 'Revise', (select (data->>'number')::integer from r where kind = 'pub1'),
  jsonb_build_object('tagIds', jsonb_build_array('life-tag-new'), 'sourceIds', jsonb_build_array('life-src-new'), 'scale', 'macro', 'role', 'observer',
    'relationDrafts', jsonb_build_array(jsonb_build_object('to', (select data->>'entryId' from r where kind = 'v1b'), 'kind', 'contrast', 'strength', 2)),
    'pendingTags', jsonb_build_array('待定 / Proposed'), 'pendingSources', jsonb_build_array('A paper https://example.org/paper')), null));
select pg_temp.as_user('');
select is((select title_en from public.entries where id = (select data->>'entryId' from r where kind = 'v1')), 'Lifecycle Original', 'saving a draft leaves the public title');
select is((select summary_en || scale from public.entries where id = (select data->>'entryId' from r where kind = 'v1')), 'Old summarymicro', 'saving a draft leaves the public summary and metadata');
select is((select string_agg(tag_id, ',') from public.entry_tags where entry_id = (select data->>'entryId' from r where kind = 'v1')), 'life-tag-old', 'saving a draft leaves public tags');
select is((select string_agg(source_id, ',') from public.entry_sources where entry_id = (select data->>'entryId' from r where kind = 'v1')), 'life-src-old', 'saving a draft leaves public sources');
select is((select count(*) from public.relations where from_entry_id = (select data->>'entryId' from r where kind = 'v1')), 0::bigint, 'saving a draft leaves public relations');
select is((public.pw_search_entries_v2('new-body-needle')->>'total')::integer, 0, 'draft body is not searchable');
select is((public.pw_search_entries_v2('Lifecycle Revised')->>'total')::integer, 0, 'draft title is not searchable');
select is((select count(*) from public.entry_revisions where id = (select data->>'id' from r where kind = 'v2')), 0::bigint, 'draft revision row is private');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
select is((select title_en from public.entry_revisions where id = (select data->>'id' from r where kind = 'v2')), 'Lifecycle Revised', 'the revision records its title');
select is((public.pw_search_entries_v2('new-body-needle')->>'total')::integer, 0, 'search stays public even for the author');

-- ── 3. Review races ───────────────────────────────────────────────────────
insert into r values ('submit2', public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'submit', null, null, null));
insert into r values ('v3', public.pw_save_draft((select data->>'entryId' from r where kind = 'v1'), null, '新标题', 'Lifecycle Revised', '新摘要', 'New summary',
  pg_temp.body('新正文二', 'new-body-needle'), 'Edit during review', (select (data->>'number')::integer from r where kind = 'submit2'),
  (select metadata from public.entry_revisions where id = (select data->>'id' from r where kind = 'v2')), null));
select ok((select (data->>'withdrewReview')::boolean from r where kind = 'v3'), 'saving over a submission withdraws it');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a003');
select throws_ok($$select public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'publish', (select (data->>'number')::integer from r where kind = 'submit2'), null, null)$$,
  '40001', 'revision_conflict', 'an admin cannot publish a revision the author has since changed');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
insert into r values ('submit3', public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'submit', null, null, null));
select pg_temp.as_user('00000000-0000-0000-0000-00000000a003');
select throws_ok($$select public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'return', (select (data->>'number')::integer from r where kind = 'submit3'), null, '')$$,
  '22023', 'reason_required', 'returning needs a reason');
insert into r values ('ret', public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'return', (select (data->>'number')::integer from r where kind = 'submit3'), null, 'Cite the paper'));
select is((select return_note from public.entries where id = (select data->>'entryId' from r where kind = 'v1')), 'Cite the paper', 'the return reason is stored for the author');
select throws_ok($$select public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'publish', (select (data->>'number')::integer from r where kind = 'submit3'), null, null)$$,
  '40001', 'invalid_transition', 'a returned draft cannot be published');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
insert into r values ('submit4', public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'submit', null, null, null));
select is((select return_note from public.entries where id = (select data->>'entryId' from r where kind = 'v1')), null, 'resubmitting clears the return reason');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a003');
insert into r values ('pub2', public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'publish', (select (data->>'number')::integer from r where kind = 'submit4'), null, null));
select throws_ok($$select public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'publish', (select (data->>'number')::integer from r where kind = 'submit4'), null, null)$$,
  '40001', 'revision_conflict', 'a second administrator publishing the same revision is refused');

select pg_temp.as_user('');
select is((select title_en || '|' || summary_en || '|' || scale from public.entries where id = (select data->>'entryId' from r where kind = 'v1')), 'Lifecycle Revised|New summary|macro', 'publishing switches title, summary and metadata together');
select is((select string_agg(tag_id, ',' order by position) from public.entry_tags where entry_id = (select data->>'entryId' from r where kind = 'v1')), 'life-tag-new,tag-' || left(md5(lower('待定 / Proposed')), 10), 'publishing switches tags and creates proposed ones');
select is((select label_en from public.tags where id = 'tag-' || left(md5(lower('待定 / Proposed')), 10)), 'Proposed', 'a proposed tag keeps both labels');
select ok((select count(*) from public.entry_sources where entry_id = (select data->>'entryId' from r where kind = 'v1')) = 2, 'publishing switches sources and creates proposed ones');
select is((select count(*) from public.relations where from_entry_id = (select data->>'entryId' from r where kind = 'v1')), 0::bigint, 'a relation to an unpublished entry stays hidden');
select is((public.pw_search_entries_v2('new-body-needle')->>'total')::integer, 1, 'the new body is searchable once published');
select is((public.pw_search_entries_v2('old-body-needle')->>'total')::integer, 0, 'the old body is no longer searched');
select is((select count(*) from public.entry_revisions where entry_id = (select data->>'entryId' from r where kind = 'v1') and state = 'published'), 2::bigint, 'readers see only published revisions in history');

-- ── 4. Rollback restores everything as a new revision ─────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000a003');
insert into r values ('rb', public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'rollback', (select (data->>'number')::integer from r where kind = 'pub2'), (select data->>'id' from r where kind = 'pub1'), null));
select ok((select (data->>'number')::integer from r where kind = 'rb') > (select (data->>'number')::integer from r where kind = 'pub2'), 'rollback appends a revision');
select throws_ok($$select public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'rollback', null, (select data->>'id' from r where kind = 'v2'), null)$$,
  '22023', 'rollback_target_unpublished', 'rollback cannot publish a draft that was never reviewed');
select pg_temp.as_user('');
select is((select title_en || '|' || summary_en || '|' || scale from public.entries where id = (select data->>'entryId' from r where kind = 'v1')), 'Lifecycle Original|Old summary|micro', 'rollback restores title, summary and metadata');
select is((select string_agg(tag_id, ',') from public.entry_tags where entry_id = (select data->>'entryId' from r where kind = 'v1')), 'life-tag-old', 'rollback restores tags');

-- ── 5. Authority ──────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000a002');
select throws_ok($$select public.pw_save_draft((select data->>'entryId' from r where kind = 'v1'), null, 'x', 'Hijack', 'x', 'x', 'x', 'x', null, '{}', null)$$,
  '42501', 'forbidden', 'author B cannot edit author A''s entry');
select throws_ok($$select public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'v1'), 'submit', null, null, null)$$,
  '42501', 'forbidden', 'author B cannot submit author A''s entry');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a005');
select throws_ok($$select public.pw_save_draft(null, null, 'x', 'Reader entry', 'x', 'x', 'x', 'x', null, '{}', 'life-genus')$$,
  '42501', 'author_required', 'an unbound reader cannot write');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a006');
select throws_ok($$select public.pw_save_draft(null, null, 'x', 'Unverified entry', 'x', 'x', 'x', 'x', null, '{}', 'life-genus')$$,
  '42501', 'verified_account_required', 'an unverified account cannot write');
select throws_ok($$insert into public.entry_tags(entry_id, tag_id) values ((select id from public.entries limit 1), 'life-tag-new')$$,
  '42501', null, 'entry associations cannot be written directly');
select pg_temp.as_user('');
select throws_ok($$select public.pw_save_draft(null, null, 'x', 'Anon', 'x', 'x', 'x', 'x', null, '{}', 'life-genus')$$,
  '42501', null, 'anonymous callers cannot reach the RPC');

-- An administrator without an author record writes as one of their own.
select pg_temp.as_user('00000000-0000-0000-0000-00000000a004');
insert into r values ('admin-draft', public.pw_save_draft(null, null, '管理员', 'Admin entry', '摘要', 'Summary', pg_temp.body('甲', 'b'), 'x', null, '{}', 'life-genus'));
select ok((select author_id from public.profiles where id = '00000000-0000-0000-0000-00000000a004') is not null, 'an administrator gets an author record on first write');

-- Images.
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
insert into r values ('img', public.pw_save_draft(null, null, '图片', 'Image entry', '摘要', 'Summary', pg_temp.body('图', '![x](asset:life-pending-image)'), 'x', null, '{}', 'life-genus'));
insert into r values ('img-submit', public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'img'), 'submit', null, null, null));
select throws_ok($$update public.assets set review_status = 'approved' where id = 'life-pending-image'$$, '42501', null, 'an owner cannot approve their own image');
select throws_ok($$select public.pw_admin_review_asset('life-pending-image', 'approved', null, null)$$, '42501', 'admin_required', 'an owner cannot approve through the RPC');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a003');
select throws_ok($$select public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'img'), 'publish', (select (data->>'number')::integer from r where kind = 'img-submit'), null, null)$$,
  '40001', 'assets_not_approved', 'an entry cannot be published with an unapproved image');
select lives_ok($$select public.pw_admin_review_asset('life-pending-image', 'approved', null, null)$$, 'an administrator approves the image');
select lives_ok($$select public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'img'), 'publish', (select (data->>'number')::integer from r where kind = 'img-submit'), null, null)$$, 'then the entry publishes');
select throws_ok($$select public.pw_admin_review_asset('life-pending-image', 'rejected', 'no', null)$$, '40001', 'asset_in_published_entry', 'an image a published entry uses cannot be withdrawn');

-- Bilingual submission.
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
insert into r values ('mono', public.pw_save_draft(null, null, '', 'English only', '', 'Summary', 'No blocks', 'x', null, '{}', 'life-genus'));
select throws_ok($$select public.pw_entry_lifecycle((select data->>'entryId' from r where kind = 'mono'), 'submit', null, null, null)$$,
  '22023', 'bilingual_incomplete', 'submission requires both languages');

-- ── 6. Archive and restore ────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000a003');
select lives_ok($$select public.pw_set_entry_archived((select data->>'entryId' from r where kind = 'v1'), true, 'Duplicate')$$, 'administrator archives');
select pg_temp.as_user('');
select is((select count(*) from public.entries where id = (select data->>'entryId' from r where kind = 'v1')), 0::bigint, 'archived entries leave public reads');
select is((public.pw_search_entries_v2('Lifecycle Original')->>'total')::integer, 0, 'archived entries leave search');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
select throws_ok($$select public.pw_save_draft((select data->>'entryId' from r where kind = 'v1'), null, 'x', 'x', 'x', 'x', 'x', 'x', null, '{}', null)$$,
  '40001', 'entry_archived', 'an archived entry cannot be edited');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a003');
select lives_ok($$select public.pw_set_entry_archived((select data->>'entryId' from r where kind = 'v1'), false, null)$$, 'administrator restores');
select pg_temp.as_user('');
select is((select title_en from public.entries where id = (select data->>'entryId' from r where kind = 'v1')), 'Lifecycle Original', 'restored entry keeps its public version');

-- ── 7. Accounts: applications, roles, suspension, closure ─────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000a005');
insert into r values ('app', public.pw_submit_application('both', 'I write about compilers.', 'reader-x'));
select throws_ok($$select public.pw_submit_application('author', 'Again', null)$$, '40001', 'application_pending', 'one pending application per account');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a003');
insert into r values ('decide', public.pw_admin_decide_application((select (data->>'id')::uuid from r where kind = 'app'), 'approved', null,
  '{"mode":"create","handle":"reader-x","name":{"zh":"读者","en":"Reader X"}}', '{"mode":"create","handle":"reader-x","name":{"zh":"读者","en":"Reader X"}}'));
select is((select author_id || '|' || member_id from public.profiles where id = '00000000-0000-0000-0000-00000000a005'), 'a-reader-x|m-reader-x', 'approval creates and binds author and member');
select is((select author_id from public.members where id = 'm-reader-x'), 'a-reader-x', 'the new page is attributed to the new author');
select throws_ok($$select public.pw_admin_decide_application((select (data->>'id')::uuid from r where kind = 'app'), 'approved', null, '{"mode":"existing","id":"life-b"}', null)$$,
  '40001', 'application_decided', 'deciding twice is refused');
select throws_ok($$select public.pw_admin_set_identity('00000000-0000-0000-0000-00000000a002', '{"memberId":"life-member"}', null)$$,
  '40001', 'member_already_bound', 'a page bound to one account cannot be bound to another');
select throws_ok($$select public.pw_admin_set_identity('00000000-0000-0000-0000-00000000a005', '{"memberId":"life-member"}', null)$$,
  '40001', 'member_already_bound', 'binding checks run before anything changes');
select is((select member_id from public.profiles where id = '00000000-0000-0000-0000-00000000a005'), 'm-reader-x', 'a refused binding leaves the old one');

select throws_ok($$select public.pw_admin_set_role('00000000-0000-0000-0000-00000000a005', 'owner', null)$$, '22023', 'invalid_role', 'roles are a closed set');
select lives_ok($$select public.pw_admin_set_role('00000000-0000-0000-0000-00000000a004', 'reader', 'Handover')$$, 'one of two administrators can be demoted');
select throws_ok($$select public.pw_admin_set_role('00000000-0000-0000-0000-00000000a003', 'reader', null)$$, '40001', 'last_admin', 'the last administrator cannot be demoted');
select throws_ok($$select public.pw_admin_close_account('00000000-0000-0000-0000-00000000a003', null)$$, '40001', 'cannot_close_own_account', 'an administrator cannot close their own account');

select lives_ok($$select public.pw_admin_set_status('00000000-0000-0000-0000-00000000a002', 'suspended', 'Spam')$$, 'administrator suspends author B');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a002');
select throws_ok($$select public.pw_save_draft(null, null, 'x', 'Suspended entry', 'x', 'x', 'x', 'x', null, '{}', 'life-genus')$$,
  '42501', 'verified_account_required', 'a suspended account cannot write with an old session');
select throws_ok($$select public.pw_create_forum_thread('Title', 'Body', 'help')$$, '42501', 'verified_account_required', 'a suspended account cannot post');
reset role;
select ok((select banned_until > now() from auth.users where id = '00000000-0000-0000-0000-00000000a002'), 'suspension stops new sign-ins');

-- Closure keeps history and removes the person.
select pg_temp.as_user('00000000-0000-0000-0000-00000000a005');
insert into r values ('closer-thread', public.pw_create_forum_thread('Closer', 'My post', 'general'));
select lives_ok($$select public.pw_request_account_closure('Leaving')$$, 'a reader requests closure');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a003');
select lives_ok($$select public.pw_admin_close_account('00000000-0000-0000-0000-00000000a005', 'Requested')$$, 'administrator processes the closure');
select lives_ok($$select public.pw_admin_close_account('00000000-0000-0000-0000-00000000a005', 'Requested')$$, 'processing is idempotent');
reset role;
select ok((select email like 'closed+%@closed.invalid' from auth.users where id = '00000000-0000-0000-0000-00000000a005'), 'the sign-in email is removed');
select is((select count(*) from auth.identities where user_id = '00000000-0000-0000-0000-00000000a005'), 0::bigint, 'sign-in identities are removed');
select is((select author_name from public.forum_posts where thread_id = (select data->>'id' from r where kind = 'closer-thread')), '已注销账号', 'forum signature is removed');
select ok((select archived_at is not null from public.members where id = 'm-reader-x'), 'the public page is archived');
select is((select account_status || '|' || coalesce(author_id, '-') from public.profiles where id = '00000000-0000-0000-0000-00000000a005'), 'closed|-', 'the profile is closed and unbound');
select ok(exists (select 1 from public.authors where id = 'a-reader-x'), 'the author record stays for attribution');

-- ── 8. Community: members, links, chronicles, forum ───────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
select lives_ok($$select public.pw_save_member('life-member', '{"bio":{"zh":"新简介","en":"New bio"}}', null)$$, 'a member edits their own page');
select throws_ok($$select public.pw_save_member('life-member', '{"handle":"stolen"}', null)$$, '42501', 'forbidden_fields', 'a member cannot rename their page');
select throws_ok($$select public.pw_save_member('m-reader-x', '{"bio":{"zh":"x","en":"x"}}', null)$$, '42501', 'forbidden', 'a member cannot edit another page');
-- The read policy names pw_bound_member(), which row level security evaluates as
-- the calling role: an anonymous reader must be able to run it, and must still
-- see only the unarchived pages.
select pg_temp.as_user('');
select lives_ok($$select count(*) from public.members$$, 'anonymous readers list the member directory');
select is((select count(*) from public.members where id = 'life-member'), 1::bigint, 'an active page is in the anonymous directory');
select is((select count(*) from public.members where id = 'm-reader-x'), 0::bigint, 'an archived page stays out of it');
-- The same failure hides in any policy that names a function anon may not
-- execute, and it only shows once the table holds a row. public.profiles and
-- public.audit_logs stay out: anon holds no select on either by design.
select lives_ok($$
  select count(*) from public.entries
  union all select count(*) from public.entry_revisions
  union all select count(*) from public.entry_revision_bodies
  union all select count(*) from public.entry_contributors
  union all select count(*) from public.entry_sources
  union all select count(*) from public.entry_tags
  union all select count(*) from public.entry_auxiliary_categories
  union all select count(*) from public.relations
  union all select count(*) from public.members
  union all select count(*) from public.friend_links
  union all select count(*) from public.chronicles
  union all select count(*) from public.forum_threads
  union all select count(*) from public.forum_posts
  union all select count(*) from public.taxon_families
  union all select count(*) from public.taxon_categories
  union all select count(*) from public.taxon_versions
  union all select count(*) from public.taxon_snapshots
  union all select count(*) from public.authors
  union all select count(*) from public.sources
  union all select count(*) from public.tags
  union all select count(*) from public.assets
$$, 'anonymous readers reach every table the public pages read');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a003');
select throws_ok($$select public.pw_admin_save_link(null, '{"name":{"zh":"坏","en":"Bad"},"url":"javascript:alert(1)"}', null)$$, '22023', 'invalid_link_url', 'links must be http(s)');
insert into r values ('link', public.pw_admin_save_link(null, '{"name":{"zh":"友站","en":"Friend Site"},"url":"https://friend.example.org/","description":{"zh":"简介","en":"About"},"emblem":"geo-ship","since":"2026-10-01"}', null));
select throws_ok($$select public.pw_admin_save_link(null, '{"name":{"zh":"重","en":"Dup"},"url":"https://FRIEND.example.org"}', null)$$, '40001', 'link_url_taken', 'a link address is listed once');
select lives_ok($$select public.pw_admin_set_link_archived((select data->>'id' from r where kind = 'link'), true, null)$$, 'administrator archives a link');
select pg_temp.as_user('');
select is((select count(*) from public.friend_links where id = (select data->>'id' from r where kind = 'link')), 0::bigint, 'archived links leave the public directory');

select pg_temp.as_user('00000000-0000-0000-0000-00000000a003');
insert into r values ('chron', public.pw_admin_save_chronicle(null, '{"date":"2026-10-08","kind":"meeting","title":{"zh":"例会","en":"Meeting"},"summary":{"zh":"摘要","en":"Summary"}}', null));
select ok((select data->>'id' from r where kind = 'chron') like 'ch-%', 'administrator adds a chronicle');
select is((select count(*) from public.content_versions where kind = 'chronicle' and object_id = (select data->>'id' from r where kind = 'chron')), 1::bigint, 'the chronicle keeps a version');

select pg_temp.as_user('00000000-0000-0000-0000-00000000a007');
insert into r values ('t', public.pw_create_forum_thread('Thread', 'Opening', 'help'));
select pg_temp.as_user('00000000-0000-0000-0000-00000000a003');
select lives_ok($$select public.pw_admin_moderate_thread((select data->>'id' from r where kind = 't'), 'lock', 'Resolved')$$, 'administrator locks a thread');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a007');
select throws_ok($$select public.pw_reply_forum_thread((select data->>'id' from r where kind = 't'), 'Late')$$, '40001', 'thread_locked', 'a locked thread takes no replies');
select lives_ok($$select public.pw_create_forum_thread('T2', 'B', 'help'), public.pw_create_forum_thread('T3', 'B', 'help'), public.pw_create_forum_thread('T4', 'B', 'help'), public.pw_create_forum_thread('T5', 'B', 'help')$$, 'five threads in ten minutes are allowed');
select throws_ok($$select public.pw_create_forum_thread('T6', 'B', 'help')$$, 'PW429', 'rate_limited', 'the sixth is refused in the database');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a003');
select lives_ok($$select public.pw_admin_moderate_thread((select data->>'id' from r where kind = 't'), 'hide', 'Off topic')$$, 'administrator hides a thread');
select pg_temp.as_user('');
select is((select count(*) from public.forum_threads where id = (select data->>'id' from r where kind = 't')), 0::bigint, 'hidden threads leave public reads');
select is((select count(*) from public.forum_posts where thread_id = (select data->>'id' from r where kind = 't')), 0::bigint, 'and so do their posts');

select * from finish();
rollback;
