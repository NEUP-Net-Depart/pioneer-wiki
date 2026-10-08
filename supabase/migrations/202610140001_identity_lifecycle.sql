-- Accounts, wiki authors and public member pages are three different objects.
-- This migration gives accounts a lifecycle (active → suspended → active, or
-- closed), makes every database guard depend on it, and moves every change of
-- role, status and identity into audited, single-transaction functions.
--
-- Compatibility: existing profiles become 'active'. profiles.member_id becomes
-- the one record of which page an account owns; it is backfilled from
-- members.author_id. Rolling the application back is safe; rolling the
-- database back requires restoring a backup (see docs/operations).

-- ── Account state ───────────────────────────────────────────────────────────

alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'suspended', 'closed'));
alter table public.profiles add column if not exists status_reason text;
alter table public.profiles add column if not exists status_changed_at timestamptz;
alter table public.profiles add column if not exists closed_at timestamptz;

-- References to auth.users must never block removing an account, nor remove history with it.
alter table public.audit_logs drop constraint if exists audit_logs_actor_id_fkey;
alter table public.audit_logs add constraint audit_logs_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;
alter table public.media_assets drop constraint if exists media_assets_owner_id_fkey;
alter table public.media_assets add constraint media_assets_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;
alter table public.assets drop constraint if exists assets_owner_id_fkey;
alter table public.assets add constraint assets_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;

-- profiles.member_id is the owner record; members.author_id stays an attribution link.
update public.profiles p set member_id = m.id
from public.members m
where p.member_id is null and p.author_id is not null and m.author_id = p.author_id
  and not exists (select 1 from public.profiles other where other.member_id = m.id);
alter table public.profiles drop constraint if exists profiles_member_id_fkey;
alter table public.profiles add constraint profiles_member_id_fkey
  foreign key (member_id) references public.members(id) on delete set null;
alter table public.profiles drop constraint if exists profiles_author_id_fkey;
alter table public.profiles add constraint profiles_author_id_fkey
  foreign key (author_id) references public.authors(id) on delete set null;
create index if not exists profiles_status_idx on public.profiles (account_status, created_at desc);

-- Member pages are archived, never deleted; forum writes remember the account
-- that made them, so closing an account can remove its signature.
alter table public.members add column if not exists archived_at timestamptz;
alter table public.members add column if not exists former_handles text[] not null default '{}';
alter table public.forum_threads add column if not exists account_id uuid references auth.users(id) on delete set null;
alter table public.forum_posts add column if not exists account_id uuid references auth.users(id) on delete set null;
create index if not exists forum_threads_account_idx on public.forum_threads (account_id);
create index if not exists forum_posts_account_idx on public.forum_posts (account_id);

-- ── Guards: one definition of who may act ──────────────────────────────────

-- An account may write only while it is active and its email is verified.
create or replace function public.pw_account_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = auth.uid() and p.account_status = 'active' and u.email_confirmed_at is not null
  );
$$;

create or replace function public.pw_verified()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.pw_account_active();
$$;

create or replace function public.pw_can_manage()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = auth.uid() and p.account_role = 'admin' and p.account_status = 'active'
      and u.email_confirmed_at is not null
  );
$$;

create or replace function public.pw_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.pw_can_manage();
$$;

-- The author an active, verified account writes as; null otherwise.
create or replace function public.pw_bound_author()
returns text language sql stable security definer set search_path = '' as $$
  select p.author_id from public.profiles p join auth.users u on u.id = p.id
  where p.id = auth.uid() and p.account_status = 'active' and u.email_confirmed_at is not null;
$$;

-- The member page an active, verified account owns; null otherwise.
create or replace function public.pw_bound_member()
returns text language sql stable security definer set search_path = '' as $$
  select p.member_id from public.profiles p join auth.users u on u.id = p.id
  where p.id = auth.uid() and p.account_status = 'active' and u.email_confirmed_at is not null;
$$;
revoke execute on function public.pw_bound_member() from public, anon;
grant execute on function public.pw_bound_member() to authenticated;

-- Profiles change only through the functions below.
revoke insert, update, delete on public.profiles from anon, authenticated;

create or replace function public.pw_protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id and not public.pw_is_admin() then
    new.account_role := old.account_role;
    new.author_id := old.author_id;
    new.member_id := old.member_id;
    new.email := old.email;
    new.account_status := old.account_status;
    new.status_reason := old.status_reason;
    new.closed_at := old.closed_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Audit rows are written only from inside the functions that make the change.
revoke execute on function public.pw_audit_insert(text, text, text, jsonb, jsonb) from public, anon, authenticated;

-- A small account picture for audit rows: never the email address.
create or replace function public.pw_profile_brief(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('handle', p.handle, 'role', p.account_role, 'status', p.account_status,
    'authorId', p.author_id, 'memberId', p.member_id)
  from public.profiles p where p.id = p_id;
$$;
revoke execute on function public.pw_profile_brief(uuid) from public, anon, authenticated;

create or replace function public.pw_raise_unless_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pw_can_manage() then raise exception 'admin_required' using errcode = '42501'; end if;
end;
$$;
revoke execute on function public.pw_raise_unless_admin() from public, anon, authenticated;

-- Ends every session of an account: refresh tokens die with their session, and
-- a ban stops new sign-ins. Database guards already refuse its writes.
create or replace function public.pw_revoke_sessions(p_user uuid, p_ban boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.sessions where user_id = p_user;
  delete from auth.refresh_tokens where user_id = p_user::text;
  update auth.users set banned_until = case when p_ban then now() + interval '200 years' else null end
  where id = p_user;
end;
$$;
revoke execute on function public.pw_revoke_sessions(uuid, boolean) from public, anon, authenticated;

-- Serialises every change that can remove an administrator.
create or replace function public.pw_assert_other_admin(p_target uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(812702);
  if exists (select 1 from public.profiles where id = p_target and account_role = 'admin' and account_status = 'active')
    and not exists (
      select 1 from public.profiles p join auth.users u on u.id = p.id
      where p.id <> p_target and p.account_role = 'admin' and p.account_status = 'active' and u.email_confirmed_at is not null
    )
  then raise exception 'last_admin' using errcode = '40001'; end if;
end;
$$;
revoke execute on function public.pw_assert_other_admin(uuid) from public, anon, authenticated;

-- ── Authors: every administrator can write ─────────────────────────────────

-- Gives an account an author record of its own when it has none, and binds it.
create or replace function public.pw_ensure_author(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  prof public.profiles;
  candidate text;
  suffix integer := 1;
begin
  select * into prof from public.profiles where id = p_user for update;
  if not found then raise exception 'profile_not_found' using errcode = '22023'; end if;
  if prof.author_id is not null then return prof.author_id; end if;
  candidate := prof.handle;
  while exists (select 1 from public.authors where id = 'a-' || candidate or handle = candidate) loop
    suffix := suffix + 1;
    candidate := left(prof.handle, 28) || '-' || suffix;
  end loop;
  insert into public.authors(id, handle, name_zh, name_en, role, sigil)
  values ('a-' || candidate, candidate, prof.display_name_zh, prof.display_name_en, 'editor', prof.sigil);
  update public.profiles set author_id = 'a-' || candidate where id = p_user;
  perform public.pw_audit_insert('create_author', 'author', 'a-' || candidate, null,
    jsonb_build_object('account', p_user, 'reason', 'administrator author'));
  return 'a-' || candidate;
end;
$$;
revoke execute on function public.pw_ensure_author(uuid) from public, anon, authenticated;

-- The first administrator is promoted by the operator with the service role (tools/bootstrap-admin.mjs).
create or replace function public.pw_bootstrap_admin(p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  author text;
begin
  select id into target from public.profiles where lower(email) = lower(trim(p_email));
  if target is null then raise exception 'profile_not_found' using errcode = '22023'; end if;
  if (select account_status from public.profiles where id = target) <> 'active' then
    raise exception 'account_not_active' using errcode = '40001';
  end if;
  update public.profiles set account_role = 'admin' where id = target;
  author := public.pw_ensure_author(target);
  insert into public.audit_logs(actor_id, action, object_type, object_id, before_data, after_data)
  values (null, 'bootstrap_admin', 'profile', target::text, null, public.pw_profile_brief(target));
  return jsonb_build_object('id', target, 'authorId', author,
    'verified', (select email_confirmed_at is not null from auth.users where id = target));
end;
$$;
revoke execute on function public.pw_bootstrap_admin(text) from public, anon, authenticated;
grant execute on function public.pw_bootstrap_admin(text) to service_role;

-- ── Self-service ────────────────────────────────────────────────────────────

create or replace function public.pw_update_own_profile(p_name_zh text, p_name_en text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  zh text := trim(coalesce(p_name_zh, ''));
  en text := trim(coalesce(p_name_en, ''));
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and account_status = 'active')
    then raise exception 'account_required' using errcode = '42501'; end if;
  if length(zh) not between 1 and 40 or length(en) not between 1 and 40 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;
  update public.profiles set display_name_zh = zh, display_name_en = en where id = auth.uid();
  return jsonb_build_object('zh', zh, 'en', en);
end;
$$;

create or replace function public.pw_request_account_closure(p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  prof public.profiles;
begin
  select * into prof from public.profiles where id = auth.uid() for update;
  if not found or prof.account_status = 'closed' then raise exception 'account_required' using errcode = '42501'; end if;
  if prof.deletion_requested_at is null then
    update public.profiles set deletion_requested_at = now(), status_reason = nullif(left(trim(coalesce(p_reason, '')), 500), '')
    where id = auth.uid() returning * into prof;
    perform public.pw_audit_insert('request_closure', 'profile', auth.uid()::text, null, jsonb_build_object('requestedAt', prof.deletion_requested_at));
  end if;
  return jsonb_build_object('requestedAt', prof.deletion_requested_at);
end;
$$;

create or replace function public.pw_cancel_account_closure()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  prof public.profiles;
begin
  select * into prof from public.profiles where id = auth.uid() for update;
  if not found or prof.account_status = 'closed' then raise exception 'account_required' using errcode = '42501'; end if;
  if prof.deletion_requested_at is not null then
    update public.profiles set deletion_requested_at = null, status_reason = null where id = auth.uid();
    perform public.pw_audit_insert('cancel_closure', 'profile', auth.uid()::text, null, null);
  end if;
  return jsonb_build_object('requestedAt', null);
end;
$$;

revoke execute on function public.pw_update_own_profile(text, text), public.pw_request_account_closure(text),
  public.pw_cancel_account_closure() from public, anon;
grant execute on function public.pw_update_own_profile(text, text), public.pw_request_account_closure(text),
  public.pw_cancel_account_closure() to authenticated;

-- ── Author and member applications ─────────────────────────────────────────

create table if not exists public.identity_applications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references auth.users(id) on delete cascade,
  kind text not null check (kind in ('author', 'member', 'both')),
  statement text not null check (length(statement) between 1 and 2000),
  proposed_handle text check (proposed_handle is null or proposed_handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  decision_reason text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists identity_applications_one_pending
  on public.identity_applications (account_id) where status = 'pending';
create index if not exists identity_applications_status_idx on public.identity_applications (status, created_at desc);
alter table public.identity_applications enable row level security;
revoke insert, update, delete on public.identity_applications from anon, authenticated;
drop policy if exists "own or admin applications" on public.identity_applications;
create policy "own or admin applications" on public.identity_applications for select to authenticated
  using (account_id = auth.uid() or public.pw_can_manage());

create or replace function public.pw_submit_application(p_kind text, p_statement text, p_handle text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  row_ public.identity_applications;
  v_handle text := nullif(lower(trim(coalesce(p_handle, ''))), '');
begin
  if not public.pw_account_active() then raise exception 'verified_account_required' using errcode = '42501'; end if;
  if p_kind not in ('author', 'member', 'both') then raise exception 'invalid_kind' using errcode = '22023'; end if;
  if length(trim(coalesce(p_statement, ''))) not between 1 and 2000 then raise exception 'invalid_statement' using errcode = '22023'; end if;
  if v_handle is not null and (v_handle !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_handle) > 32) then
    raise exception 'invalid_handle' using errcode = '22023';
  end if;
  if exists (select 1 from public.identity_applications where account_id = auth.uid() and status = 'pending') then
    raise exception 'application_pending' using errcode = '40001';
  end if;
  insert into public.identity_applications(account_id, kind, statement, proposed_handle)
  values (auth.uid(), p_kind, trim(p_statement), v_handle) returning * into row_;
  perform public.pw_audit_insert('submit_application', 'application', row_.id::text, null, jsonb_build_object('kind', p_kind));
  return to_jsonb(row_);
end;
$$;

create or replace function public.pw_withdraw_application(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  row_ public.identity_applications;
begin
  select * into row_ from public.identity_applications where id = p_id and account_id = auth.uid() for update;
  if not found then raise exception 'application_not_found' using errcode = '22023'; end if;
  if row_.status <> 'pending' then raise exception 'application_decided' using errcode = '40001'; end if;
  update public.identity_applications set status = 'withdrawn', updated_at = now() where id = p_id returning * into row_;
  perform public.pw_audit_insert('withdraw_application', 'application', p_id::text, null, null);
  return to_jsonb(row_);
end;
$$;
revoke execute on function public.pw_submit_application(text, text, text), public.pw_withdraw_application(uuid) from public, anon;
grant execute on function public.pw_submit_application(text, text, text), public.pw_withdraw_application(uuid) to authenticated;

-- ── Identity binding ────────────────────────────────────────────────────────

-- Creates an author record from administrator input; returns its id.
create or replace function public.pw_new_author(p_input jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_handle text := lower(trim(coalesce(p_input->>'handle', '')));
  zh text := trim(coalesce(p_input #>> '{name,zh}', ''));
  en text := trim(coalesce(p_input #>> '{name,en}', ''));
begin
  if v_handle !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_handle) > 32 then raise exception 'invalid_author_handle' using errcode = '22023'; end if;
  if length(zh) not between 1 and 60 or length(en) not between 1 and 60 then raise exception 'invalid_author_name' using errcode = '22023'; end if;
  if exists (select 1 from public.authors a where a.handle = v_handle or a.id = 'a-' || v_handle) then
    raise exception 'author_handle_taken' using errcode = '40001';
  end if;
  insert into public.authors(id, handle, name_zh, name_en, affiliation_zh, affiliation_en, role, sigil)
  values ('a-' || v_handle, v_handle, zh, en, nullif(trim(coalesce(p_input #>> '{affiliation,zh}', '')), ''),
    nullif(trim(coalesce(p_input #>> '{affiliation,en}', '')), ''), 'contributor', 'author:' || v_handle);
  return 'a-' || v_handle;
end;
$$;
revoke execute on function public.pw_new_author(jsonb) from public, anon, authenticated;

-- Creates a public member page from administrator input; returns its id.
create or replace function public.pw_new_member(p_input jsonb, p_author text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_handle text := lower(trim(coalesce(p_input->>'handle', '')));
  zh text := trim(coalesce(p_input #>> '{name,zh}', ''));
  en text := trim(coalesce(p_input #>> '{name,en}', ''));
  plate integer;
begin
  if v_handle !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_handle) > 32 then raise exception 'invalid_member_handle' using errcode = '22023'; end if;
  if length(zh) not between 1 and 40 or length(en) not between 1 and 40 then raise exception 'invalid_member_name' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(812704);
  if exists (select 1 from public.members m where m.handle = v_handle or m.id = 'm-' || v_handle or v_handle = any(m.former_handles)) then
    raise exception 'member_handle_taken' using errcode = '40001';
  end if;
  select coalesce(max(plate_number), 0) + 1 into plate from public.members;
  insert into public.members(id, handle, name_zh, name_en, role_zh, role_en, bio_zh, bio_en, about,
    plate_number, plate_emblem, plate_ink, plate_border, plate_motto, joined, author_id, links)
  values ('m-' || v_handle, v_handle, zh, en,
    coalesce(nullif(trim(p_input #>> '{role,zh}'), ''), '成员'), coalesce(nullif(trim(p_input #>> '{role,en}'), ''), 'Member'),
    coalesce(trim(p_input #>> '{bio,zh}'), ''), coalesce(trim(p_input #>> '{bio,en}'), ''), '',
    plate, coalesce(nullif(p_input #>> '{plate,emblem}', ''), 'ex-quill'), coalesce(nullif(p_input #>> '{plate,ink}', ''), 'prussian'),
    coalesce(nullif(p_input #>> '{plate,border}', ''), 'vine'), coalesce(p_input #>> '{plate,motto}', ''),
    current_date, p_author, '[]'::jsonb);
  return 'm-' || v_handle;
end;
$$;
revoke execute on function public.pw_new_member(jsonb, text) from public, anon, authenticated;

/*
 * Sets an account's author and member bindings in one step. p_patch holds
 * `authorId` and/or `memberId` (null unbinds); absent keys keep the binding.
 * A member page whose attribution names another author is refused; one with
 * no attribution takes the account's author.
 */
create or replace function public.pw_apply_identity(p_target uuid, p_patch jsonb, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  prof public.profiles;
  before_brief jsonb;
  next_author text;
  next_member text;
  member_row public.members;
begin
  select * into prof from public.profiles where id = p_target for update;
  if not found then raise exception 'profile_not_found' using errcode = '22023'; end if;
  if prof.account_status = 'closed' then raise exception 'account_closed' using errcode = '40001'; end if;
  before_brief := public.pw_profile_brief(p_target);
  next_author := case when p_patch ? 'authorId' then nullif(p_patch->>'authorId', '') else prof.author_id end;
  next_member := case when p_patch ? 'memberId' then nullif(p_patch->>'memberId', '') else prof.member_id end;
  if next_author is not null then
    if not exists (select 1 from public.authors where id = next_author) then raise exception 'author_not_found' using errcode = '22023'; end if;
    if exists (select 1 from public.profiles where author_id = next_author and id <> p_target) then
      raise exception 'author_already_bound' using errcode = '40001';
    end if;
  end if;
  if next_member is not null then
    select * into member_row from public.members where id = next_member for update;
    if not found then raise exception 'member_not_found' using errcode = '22023'; end if;
    if exists (select 1 from public.profiles where member_id = next_member and id <> p_target) then
      raise exception 'member_already_bound' using errcode = '40001';
    end if;
    if next_author is not null and member_row.author_id is not null and member_row.author_id <> next_author then
      raise exception 'member_author_mismatch' using errcode = '40001';
    end if;
    if next_author is not null and member_row.author_id is null then
      update public.members set author_id = next_author where id = next_member;
    end if;
  end if;
  if prof.account_role = 'admin' and next_author is null then
    raise exception 'admin_needs_author' using errcode = '40001';
  end if;
  update public.profiles set author_id = next_author, member_id = next_member where id = p_target;
  perform public.pw_audit_insert('bind_identity', 'profile', p_target::text, before_brief,
    public.pw_profile_brief(p_target) || jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), '')));
  return public.pw_profile_brief(p_target);
end;
$$;
revoke execute on function public.pw_apply_identity(uuid, jsonb, text) from public, anon, authenticated;

create or replace function public.pw_admin_set_identity(p_target uuid, p_patch jsonb, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.pw_raise_unless_admin();
  return public.pw_apply_identity(p_target, coalesce(p_patch, '{}'::jsonb), p_reason);
end;
$$;

-- The old two-step binders now go through the same checks.
create or replace function public.pw_bind_author(target_user uuid, target_author text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.pw_admin_set_identity(target_user, jsonb_build_object('authorId', target_author), null);
end;
$$;
create or replace function public.pw_bind_member(target_user uuid, target_member text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.pw_admin_set_identity(target_user, jsonb_build_object('memberId', target_member), null);
end;
$$;

/*
 * Decides an application. p_author / p_member are {"mode":"existing","id":…}
 * or {"mode":"create",…fields} or null. Everything — new records, bindings,
 * the decision and its audit — commits together or not at all.
 */
create or replace function public.pw_admin_decide_application(
  p_id uuid, p_decision text, p_reason text, p_author jsonb, p_member jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  app public.identity_applications;
  v_author text;
  v_member text;
  patch jsonb := '{}'::jsonb;
begin
  perform public.pw_raise_unless_admin();
  select * into app from public.identity_applications where id = p_id for update;
  if not found then raise exception 'application_not_found' using errcode = '22023'; end if;
  if app.status <> 'pending' then raise exception 'application_decided' using errcode = '40001'; end if;
  if p_decision = 'rejected' then
    if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'reason_required' using errcode = '22023'; end if;
  elsif p_decision = 'approved' then
    if app.account_id is null then raise exception 'account_closed' using errcode = '40001'; end if;
    if p_author is not null then
      v_author := case p_author->>'mode' when 'existing' then p_author->>'id' when 'create' then public.pw_new_author(p_author) end;
      if v_author is null then raise exception 'invalid_author_choice' using errcode = '22023'; end if;
      patch := patch || jsonb_build_object('authorId', v_author);
    end if;
    if p_member is not null then
      v_member := case p_member->>'mode' when 'existing' then p_member->>'id'
        when 'create' then public.pw_new_member(p_member, coalesce(v_author, (select p.author_id from public.profiles p where p.id = app.account_id))) end;
      if v_member is null then raise exception 'invalid_member_choice' using errcode = '22023'; end if;
      patch := patch || jsonb_build_object('memberId', v_member);
    end if;
    if patch = '{}'::jsonb then raise exception 'nothing_to_bind' using errcode = '22023'; end if;
    perform public.pw_apply_identity(app.account_id, patch, 'application ' || p_id);
  else
    raise exception 'invalid_decision' using errcode = '22023';
  end if;
  update public.identity_applications set status = p_decision, decision_reason = nullif(trim(coalesce(p_reason, '')), ''),
    decided_by = auth.uid(), decided_at = now(), updated_at = now()
  where id = p_id returning * into app;
  perform public.pw_audit_insert('decide_application', 'application', p_id::text, jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', p_decision, 'authorId', v_author, 'memberId', v_member));
  return to_jsonb(app);
end;
$$;

-- ── Roles, status and closure ───────────────────────────────────────────────

create or replace function public.pw_admin_set_role(p_target uuid, p_role text, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  prof public.profiles;
  before_brief jsonb;
begin
  perform public.pw_raise_unless_admin();
  if p_role not in ('reader', 'admin') then raise exception 'invalid_role' using errcode = '22023'; end if;
  if p_role = 'reader' then perform public.pw_assert_other_admin(p_target); end if;
  select * into prof from public.profiles where id = p_target for update;
  if not found then raise exception 'profile_not_found' using errcode = '22023'; end if;
  if prof.account_role = p_role then raise exception 'unchanged_role' using errcode = '40001'; end if;
  if p_role = 'admin' and (prof.account_status <> 'active'
    or not exists (select 1 from auth.users where id = p_target and email_confirmed_at is not null)) then
    raise exception 'account_not_active' using errcode = '40001';
  end if;
  before_brief := public.pw_profile_brief(p_target);
  update public.profiles set account_role = p_role where id = p_target;
  if p_role = 'admin' then perform public.pw_ensure_author(p_target); end if;
  perform public.pw_audit_insert('set_role', 'profile', p_target::text, before_brief,
    public.pw_profile_brief(p_target) || jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), '')));
  return public.pw_profile_brief(p_target);
end;
$$;

create or replace function public.pw_admin_set_status(p_target uuid, p_status text, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  prof public.profiles;
  before_brief jsonb;
begin
  perform public.pw_raise_unless_admin();
  if p_status not in ('active', 'suspended') then raise exception 'invalid_status' using errcode = '22023'; end if;
  if p_target = auth.uid() then raise exception 'cannot_change_own_status' using errcode = '40001'; end if;
  if p_status = 'suspended' then
    perform public.pw_assert_other_admin(p_target);
    if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'reason_required' using errcode = '22023'; end if;
  end if;
  select * into prof from public.profiles where id = p_target for update;
  if not found then raise exception 'profile_not_found' using errcode = '22023'; end if;
  if prof.account_status = 'closed' then raise exception 'account_closed' using errcode = '40001'; end if;
  if prof.account_status = p_status then raise exception 'unchanged_status' using errcode = '40001'; end if;
  before_brief := public.pw_profile_brief(p_target);
  update public.profiles set account_status = p_status, status_changed_at = now(),
    status_reason = case when p_status = 'suspended' then trim(p_reason) else null end
  where id = p_target;
  perform public.pw_revoke_sessions(p_target, p_status = 'suspended');
  perform public.pw_audit_insert(case when p_status = 'suspended' then 'suspend_account' else 'reactivate_account' end,
    'profile', p_target::text, before_brief,
    public.pw_profile_brief(p_target) || jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), '')));
  return public.pw_profile_brief(p_target);
end;
$$;

/*
 * Closes an account. The person disappears; the record stays. Personal data
 * (email, names, statements, private drafts, forum signature) is removed, the
 * sign-in is destroyed, and the public member page is archived. Published
 * revisions keep their wiki author, audit rows keep the account id, uploads
 * keep their content. Idempotent: a closed account answers with its state.
 */
create or replace function public.pw_admin_close_account(p_target uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  prof public.profiles;
  before_brief jsonb;
  placeholder text := 'closed+' || replace(p_target::text, '-', '') || '@closed.invalid';
begin
  perform public.pw_raise_unless_admin();
  if p_target = auth.uid() then raise exception 'cannot_close_own_account' using errcode = '40001'; end if;
  perform public.pw_assert_other_admin(p_target);
  select * into prof from public.profiles where id = p_target for update;
  if not found then raise exception 'profile_not_found' using errcode = '22023'; end if;
  if prof.account_status = 'closed' then return public.pw_profile_brief(p_target); end if;
  before_brief := public.pw_profile_brief(p_target);

  if prof.member_id is not null then
    update public.members set archived_at = coalesce(archived_at, now()) where id = prof.member_id;
  end if;
  update public.forum_threads set author_name = '已注销账号', member_id = null, account_id = null where account_id = p_target;
  update public.forum_posts set author_name = '已注销账号', member_id = null, account_id = null where account_id = p_target;
  delete from public.entry_working_drafts where owner_id = p_target;
  delete from public.identity_applications where account_id = p_target;
  update public.assets set owner_id = null where owner_id = p_target;
  update public.media_assets set owner_id = null where owner_id = p_target;

  update public.profiles set account_role = 'reader', account_status = 'closed', author_id = null, member_id = null,
    display_name_zh = '已注销读者', display_name_en = 'Closed account', handle = 'closed-' || left(replace(p_target::text, '-', ''), 12),
    sigil = 'closed:' || p_target::text, deletion_requested_at = coalesce(deletion_requested_at, now()),
    status_reason = null, status_changed_at = now(), closed_at = now()
  where id = p_target;
  delete from auth.identities where user_id = p_target;
  delete from auth.one_time_tokens where user_id = p_target;
  update auth.users set email = placeholder, encrypted_password = '', raw_user_meta_data = '{}'::jsonb,
    phone = null, email_change = '', email_change_token_new = '', email_change_token_current = '',
    recovery_token = '', confirmation_token = ''
  where id = p_target;
  update public.profiles set email = placeholder where id = p_target;
  perform public.pw_revoke_sessions(p_target, true);
  perform public.pw_audit_insert('close_account', 'profile', p_target::text, before_brief,
    jsonb_build_object('status', 'closed', 'note', nullif(trim(coalesce(p_note, '')), '')));
  return public.pw_profile_brief(p_target);
end;
$$;

-- One page of accounts for the administrators' register.
create or replace function public.pw_admin_list_accounts(
  p_text text default '', p_status text[] default '{}', p_role text[] default '{}', p_flag text default null,
  p_limit integer default 25, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  q text := lower(trim(coalesce(p_text, '')));
  result jsonb;
begin
  perform public.pw_raise_unless_admin();
  with base as (
    select p.*, u.email_confirmed_at, u.last_sign_in_at,
      a.name_zh author_zh, a.name_en author_en, m.handle member_handle, m.name_zh member_zh, m.name_en member_en,
      m.archived_at member_archived_at,
      (select ia.id from public.identity_applications ia where ia.account_id = p.id and ia.status = 'pending') pending_application
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.authors a on a.id = p.author_id
    left join public.members m on m.id = p.member_id
    where (q = '' or strpos(lower(concat_ws(' ', p.email, p.handle, p.display_name_zh, p.display_name_en, a.name_zh, a.name_en, m.handle)), q) > 0)
      and (coalesce(cardinality(p_status), 0) = 0 or p.account_status = any(p_status))
      and (coalesce(cardinality(p_role), 0) = 0 or p.account_role = any(p_role))
      and (p_flag is null
        or (p_flag = 'closure' and p.deletion_requested_at is not null and p.account_status <> 'closed')
        or (p_flag = 'unverified' and u.email_confirmed_at is null)
        or (p_flag = 'bound' and (p.author_id is not null or p.member_id is not null))
        or (p_flag = 'unbound' and p.author_id is null and p.member_id is null)
        or (p_flag = 'applicant' and exists (select 1 from public.identity_applications ia where ia.account_id = p.id and ia.status = 'pending')))
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(row_data order by created_at desc, id) from (
      select b.created_at, b.id, jsonb_build_object(
        'id', b.id, 'email', b.email, 'handle', b.handle, 'name', jsonb_build_object('zh', b.display_name_zh, 'en', b.display_name_en),
        'role', b.account_role, 'status', b.account_status, 'statusReason', b.status_reason, 'emailVerified', b.email_confirmed_at is not null,
        'authorId', b.author_id, 'authorName', case when b.author_id is null then null else jsonb_build_object('zh', b.author_zh, 'en', b.author_en) end,
        'memberId', b.member_id, 'memberHandle', b.member_handle, 'memberArchived', b.member_archived_at is not null,
        'memberName', case when b.member_id is null then null else jsonb_build_object('zh', b.member_zh, 'en', b.member_en) end,
        'closureRequestedAt', b.deletion_requested_at, 'closedAt', b.closed_at, 'pendingApplicationId', b.pending_application,
        'createdAt', b.created_at, 'lastSignInAt', b.last_sign_in_at) row_data
      from base b order by b.created_at desc, b.id
      limit greatest(1, least(coalesce(p_limit, 25), 100)) offset greatest(0, coalesce(p_offset, 0))
    ) page), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- Applications with their accounts, for the review queue.
create or replace function public.pw_admin_list_applications(p_status text[] default '{pending}', p_limit integer default 25, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  perform public.pw_raise_unless_admin();
  with base as (
    select ia.*, p.handle, p.email, p.display_name_zh, p.display_name_en, p.author_id, p.member_id, p.account_status
    from public.identity_applications ia left join public.profiles p on p.id = ia.account_id
    where coalesce(cardinality(p_status), 0) = 0 or ia.status = any(p_status)
  )
  select jsonb_build_object('total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(row_data order by created_at desc, id) from (
      select b.created_at, b.id, jsonb_build_object('id', b.id, 'accountId', b.account_id, 'kind', b.kind, 'statement', b.statement,
        'proposedHandle', b.proposed_handle, 'status', b.status, 'decisionReason', b.decision_reason, 'decidedAt', b.decided_at,
        'createdAt', b.created_at, 'account', case when b.account_id is null then null else jsonb_build_object('handle', b.handle,
          'email', b.email, 'name', jsonb_build_object('zh', b.display_name_zh, 'en', b.display_name_en),
          'authorId', b.author_id, 'memberId', b.member_id, 'status', b.account_status) end) row_data
      from base b order by b.created_at desc, b.id
      limit greatest(1, least(coalesce(p_limit, 25), 100)) offset greatest(0, coalesce(p_offset, 0))
    ) page), '[]'::jsonb)) into result;
  return result;
end;
$$;

-- Counts for the administrators' desk: only what needs someone's attention.
create or replace function public.pw_admin_todo()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.pw_raise_unless_admin();
  return jsonb_build_object(
    'reviews', (select count(*) from public.entries where status = 'in_review' and deleted_at is null),
    'applications', (select count(*) from public.identity_applications where status = 'pending'),
    'closures', (select count(*) from public.profiles where deletion_requested_at is not null and account_status <> 'closed'),
    'assets', (select count(*) from public.assets where review_status = 'pending'),
    'suspended', (select count(*) from public.profiles where account_status = 'suspended')
  );
end;
$$;

revoke execute on function public.pw_admin_set_identity(uuid, jsonb, text), public.pw_admin_decide_application(uuid, text, text, jsonb, jsonb),
  public.pw_admin_set_role(uuid, text, text), public.pw_admin_set_status(uuid, text, text), public.pw_admin_close_account(uuid, text),
  public.pw_admin_list_accounts(text, text[], text[], text, integer, integer), public.pw_admin_list_applications(text[], integer, integer),
  public.pw_admin_todo() from public, anon;
grant execute on function public.pw_admin_set_identity(uuid, jsonb, text), public.pw_admin_decide_application(uuid, text, text, jsonb, jsonb),
  public.pw_admin_set_role(uuid, text, text), public.pw_admin_set_status(uuid, text, text), public.pw_admin_close_account(uuid, text),
  public.pw_admin_list_accounts(text, text[], text[], text, integer, integer), public.pw_admin_list_applications(text[], integer, integer),
  public.pw_admin_todo() to authenticated;
