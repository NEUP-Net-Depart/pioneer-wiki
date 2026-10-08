-- Public writes must pass through the functions that enforce identity and lifecycle.
revoke insert, update, delete on public.entries from public, anon, authenticated;
revoke insert, update, delete on public.forum_threads, public.forum_posts from public, anon, authenticated;
drop policy if exists "authors manage own entries" on public.entries;
drop policy if exists "admins insert entries" on public.entries;
drop policy if exists "verified users create threads" on public.forum_threads;
drop policy if exists "verified users create posts" on public.forum_posts;

create or replace function public.pw_archive_entry(p_entry_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  before_row public.entries;
  after_row public.entries;
begin
  if not public.pw_verified() or not public.pw_can_manage() then raise exception 'admin_required' using errcode = '42501'; end if;
  select * into before_row from public.entries where id = p_entry_id for update;
  if not found then return null; end if;
  update public.entries set deleted_at = now() where id = p_entry_id returning * into after_row;
  perform public.pw_audit_insert('archive', 'entry', p_entry_id, to_jsonb(before_row), to_jsonb(after_row));
  return to_jsonb(after_row);
end;
$$;
revoke execute on function public.pw_archive_entry(text) from public, anon;
grant execute on function public.pw_archive_entry(text) to authenticated;

-- Same binding as the web API: author_id -> member, with unbound readers supported.
create or replace function public.pw_forum_identity()
returns table(author_name text, member_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pw_verified() then raise exception 'verified_account_required' using errcode = '42501'; end if;
  return query
    select coalesce(nullif(trim(m.name_zh), ''), nullif(trim(p.display_name_zh), ''), 'Reader'), m.id
    from public.profiles p
    left join lateral (
      select member.id, member.name_zh from public.members member
      where member.author_id = p.author_id order by member.id limit 1
    ) m on true
    where p.id = auth.uid();
  if not found then raise exception 'profile_required' using errcode = '42501'; end if;
end;
$$;
revoke execute on function public.pw_forum_identity() from public, anon, authenticated;

create or replace function public.pw_create_forum_thread(p_title text, p_body text, p_category text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  identity_row record;
  thread_row public.forum_threads;
  n integer;
  now_at timestamptz := now();
begin
  select * into identity_row from public.pw_forum_identity();
  if p_title is null or length(trim(p_title)) not between 1 and 120
    or p_body is null or length(trim(p_body)) not between 1 and 8000
    or p_category is null or p_category not in ('general', 'help', 'showcase', 'meta')
    then raise exception 'invalid_thread' using errcode = '22023'; end if;
  -- Coordinate allocation across sessions; existing seed numbers are included.
  perform pg_catalog.pg_advisory_xact_lock(812701);
  select coalesce(max(number), 0) + 1 into n from public.forum_threads;
  insert into public.forum_threads(id, number, title, category, author_name, member_id, created_at)
  values ('t-' || gen_random_uuid(), n, trim(p_title), p_category, identity_row.author_name, identity_row.member_id, now_at)
  returning * into thread_row;
  insert into public.forum_posts(id, thread_id, author_name, member_id, body, created_at)
  values ('p-' || gen_random_uuid(), thread_row.id, identity_row.author_name, identity_row.member_id, trim(p_body), now_at);
  return to_jsonb(thread_row) || jsonb_build_object('post_count', 1, 'excerpt', left(trim(p_body), 90), 'last_activity_at', now_at);
end;
$$;

create or replace function public.pw_reply_forum_thread(p_thread_id text, p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  identity_row record;
  post_row public.forum_posts;
begin
  select * into identity_row from public.pw_forum_identity();
  if p_body is null or length(trim(p_body)) not between 1 and 8000
    then raise exception 'invalid_post' using errcode = '22023'; end if;
  perform 1 from public.forum_threads where id = p_thread_id and deleted_at is null for share;
  if not found then return null; end if;
  insert into public.forum_posts(id, thread_id, author_name, member_id, body, created_at)
  values ('p-' || gen_random_uuid(), p_thread_id, identity_row.author_name, identity_row.member_id, trim(p_body), now())
  returning * into post_row;
  return to_jsonb(post_row);
end;
$$;
revoke execute on function public.pw_create_forum_thread(text, text, text), public.pw_reply_forum_thread(text, text) from public, anon;
grant execute on function public.pw_create_forum_thread(text, text, text), public.pw_reply_forum_thread(text, text) to authenticated;
