begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into public.authors(id, handle, name_zh, name_en, role, sigil) values
  ('audit-author', 'audit-author', 'Author', 'Author', 'contributor', 'test'),
  ('audit-admin', 'audit-admin', 'Admin', 'Admin', 'editor', 'test');
insert into auth.users(id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000101', 'audit-author@example.test', now()),
  ('00000000-0000-0000-0000-000000000102', 'audit-admin@example.test', now()),
  ('00000000-0000-0000-0000-000000000103', 'audit-reader@example.test', now()),
  ('00000000-0000-0000-0000-000000000104', 'audit-unverified@example.test', null);
update public.profiles set author_id = 'audit-author' where id = '00000000-0000-0000-0000-000000000101';
update public.profiles set author_id = 'audit-admin', account_role = 'admin' where id = '00000000-0000-0000-0000-000000000102';
insert into public.members(id, handle, name_zh, name_en, role_zh, role_en, bio_zh, bio_en, about,
  plate_number, plate_emblem, plate_ink, plate_border, plate_motto, joined, author_id)
values ('audit-member', 'audit-member', 'Member name', 'Member name', '', '', '', '', '', 100, 'oak', 'prussian', 'vine', '', current_date, 'audit-author');
-- The account owns the page through profiles.member_id; members.author_id is attribution.
update public.profiles set member_id = 'audit-member' where id = '00000000-0000-0000-0000-000000000101';
insert into public.taxon_families(id, slug, name_zh, name_en, scientific_name) values ('audit-family', 'audit-family', 'Test', 'Test', 'Test');
insert into public.taxon_categories(id, family_id, slug, name_zh, name_en, scientific_name)
values ('audit-category', 'audit-family', 'audit-category', 'Test', 'Test', 'Test');
create temp table audit_results(kind text primary key, data jsonb);
grant all on audit_results to authenticated, anon;

select ok(not has_table_privilege('authenticated', 'public.entries', 'INSERT'), 'no direct entry inserts');
select ok(not has_table_privilege('authenticated', 'public.entries', 'UPDATE'), 'no direct entry updates');
select ok(not has_table_privilege('authenticated', 'public.forum_threads', 'INSERT'), 'no direct thread inserts');
select ok(not has_table_privilege('authenticated', 'public.forum_posts', 'INSERT'), 'no direct post inserts');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
insert into audit_results values ('draft', public.pw_save_draft(null, null, '标题', 'Audit Entry', '摘要', 'Summary', ':::zh
中文
:::
:::en
English
:::', 'Draft', null, '{}', 'audit-category'));
select is((select data->>'state' from audit_results where kind = 'draft'), 'draft', 'owner saves through RPC');
select throws_ok($$update public.entries set published_revision_number = latest_revision_number$$, '42501', 'permission denied for table entries', 'cannot publish by pointer update');
select throws_ok($$insert into public.entries(id) values ('forged')$$, '42501', 'permission denied for table entries', 'cannot insert a published entry');
select throws_ok($$select public.pw_transition_entry((select data->>'entryId' from audit_results where kind = 'draft'), 'publish', null, null)$$, '42501', 'admin_required', 'owner cannot publish through RPC');
insert into audit_results values ('submit', public.pw_transition_entry((select data->>'entryId' from audit_results where kind = 'draft'), 'submit', null, null));
select is((select data->>'state' from audit_results where kind = 'submit'), 'in_review', 'owner submits');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*) from public.entry_revision_bodies where revision_id = (select data->>'id' from audit_results where kind = 'draft')), 0::bigint, 'draft body remains private');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
insert into audit_results values ('publish', public.pw_transition_entry((select data->>'entryId' from audit_results where kind = 'draft'), 'publish', null, null));
select is((select data->>'state' from audit_results where kind = 'publish'), 'published', 'admin publishes');
insert into audit_results values ('rollback', public.pw_transition_entry((select data->>'entryId' from audit_results where kind = 'draft'), 'rollback', (select data->>'id' from audit_results where kind = 'publish'), null));
select is((select data->>'state' from audit_results where kind = 'rollback'), 'published', 'admin rollback remains available');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*) from public.entry_revision_bodies where revision_id = (select data->>'id' from audit_results where kind = 'rollback')), 1::bigint, 'only published pointer body is public');
select throws_ok($$select public.pw_create_forum_thread('Title', 'Body', 'help')$$, '42501', 'permission denied for function pw_create_forum_thread', 'anonymous cannot post');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);
select throws_ok($$select public.pw_create_forum_thread('Title', 'Body', 'help')$$, '42501', 'verified_account_required', 'unverified cannot post');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select throws_ok($$insert into public.forum_threads(id) values ('forged')$$, '42501', 'permission denied for table forum_threads', 'cannot forge thread identity');
select throws_ok($$insert into public.forum_posts(id) values ('forged')$$, '42501', 'permission denied for table forum_posts', 'cannot forge post identity');
insert into audit_results values ('reader-thread', public.pw_create_forum_thread('Title', 'Body', 'help'));
select ok((select data->>'member_id' is null from audit_results where kind = 'reader-thread'), 'unbound reader posts without member attribution');
select is((select count(*) from public.forum_posts where thread_id = (select data->>'id' from audit_results where kind = 'reader-thread')), 1::bigint, 'opening post exists');
select throws_ok($$select public.pw_create_forum_thread('Title', repeat('x', 8001), 'help')$$, '22023', 'invalid_thread', 'reject oversized body');
select throws_ok($$select public.pw_create_forum_thread('Title', 'Body', 'bogus')$$, '22023', 'invalid_thread', 'reject unknown category');
select is(public.pw_reply_forum_thread('missing', 'Body'), null::jsonb, 'missing thread returns null');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
insert into audit_results values ('member-post', public.pw_reply_forum_thread((select data->>'id' from audit_results where kind = 'reader-thread'), 'Reply'));
select is((select data->>'member_id' from audit_results where kind = 'member-post'), 'audit-member', 'member derived from the owner binding');
select is((select data->>'author_name' from audit_results where kind = 'member-post'), 'Member name', 'member display name derived in database');

reset role;
create function pg_temp.fail_opening() returns trigger language plpgsql as $$
begin
  if new.body = 'fail-opening' then raise exception 'forced_failure' using errcode = '22023'; end if;
  return new;
end;
$$;
create trigger audit_fail_opening before insert on public.forum_posts for each row execute function pg_temp.fail_opening();
set local role authenticated;
select throws_ok($$select public.pw_create_forum_thread('Atomic title', 'fail-opening', 'help')$$, '22023', 'forced_failure', 'opening failure propagates');
select is((select count(*) from public.forum_threads where title = 'Atomic title'), 0::bigint, 'opening failure rolls back thread');
reset role;
update public.forum_threads set deleted_at = now() where id = (select data->>'id' from audit_results where kind = 'reader-thread');
set local role authenticated;
select is(public.pw_reply_forum_thread((select data->>'id' from audit_results where kind = 'reader-thread'), 'Reply'), null::jsonb, 'deleted thread returns null');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select ok(public.pw_archive_entry((select data->>'entryId' from audit_results where kind = 'draft'))->>'archivedAt' is not null, 'admin archives through RPC');
select is((select count(*) from public.audit_logs where object_id = (select data->>'entryId' from audit_results where kind = 'draft') and action = 'archive'), 1::bigint, 'archive audit is atomic');

select * from finish();
rollback;
