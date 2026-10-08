-- Count writes under a per-account lock, including direct Storage requests.
create or replace function public.pw_create_forum_thread(p_title text, p_body text, p_category text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  identity_row record;
  thread_row public.forum_threads;
  n integer;
  now_at timestamptz := now();
begin
  select * into identity_row from public.pw_forum_identity();
  -- Serialize this account's quota checks across threads and replies.
  perform 1 from public.profiles where id = auth.uid() for update;
  if p_title is null or length(trim(p_title)) not between 1 and 120
    or p_body is null or length(trim(p_body)) not between 1 and 8000
    or p_category is null or p_category not in ('general', 'help', 'showcase', 'meta')
    then raise exception 'invalid_thread' using errcode = '22023'; end if;
  if (select count(*) from public.forum_threads where account_id = auth.uid() and created_at > now_at - interval '10 minutes') >= 5 then
    raise exception 'rate_limited' using errcode = 'PW429';
  end if;
  -- Coordinate allocation across sessions; existing seed numbers are included.
  perform pg_catalog.pg_advisory_xact_lock(812701);
  select coalesce(max(number), 0) + 1 into n from public.forum_threads;
  insert into public.forum_threads(id, number, title, category, author_name, member_id, account_id, created_at)
  values ('t-' || gen_random_uuid(), n, trim(p_title), p_category, identity_row.author_name, identity_row.member_id, auth.uid(), now_at)
  returning * into thread_row;
  insert into public.forum_posts(id, thread_id, author_name, member_id, account_id, body, created_at)
  values ('p-' || gen_random_uuid(), thread_row.id, identity_row.author_name, identity_row.member_id, auth.uid(), trim(p_body), now_at);
  return to_jsonb(thread_row) - 'account_id' || jsonb_build_object('post_count', 1, 'excerpt', left(trim(p_body), 90), 'last_activity_at', now_at);
end;
$$;

create or replace function public.pw_reply_forum_thread(p_thread_id text, p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  identity_row record;
  post_row public.forum_posts;
  thread_row public.forum_threads;
begin
  select * into identity_row from public.pw_forum_identity();
  -- Serialize this account's quota checks across threads and replies.
  perform 1 from public.profiles where id = auth.uid() for update;
  if p_body is null or length(trim(p_body)) not between 1 and 8000
    then raise exception 'invalid_post' using errcode = '22023'; end if;
  select * into thread_row from public.forum_threads where id = p_thread_id and deleted_at is null for share;
  if not found then return null; end if;
  if thread_row.locked_at is not null then raise exception 'thread_locked' using errcode = '40001'; end if;
  if (select count(*) from public.forum_posts where account_id = auth.uid() and created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'rate_limited' using errcode = 'PW429';
  end if;
  insert into public.forum_posts(id, thread_id, author_name, member_id, account_id, body, created_at)
  values ('p-' || gen_random_uuid(), p_thread_id, identity_row.author_name, identity_row.member_id, auth.uid(), trim(p_body), now())
  returning * into post_row;
  return to_jsonb(post_row) - 'account_id';
end;
$$;

create table public.upload_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  created_at timestamptz not null default now()
);
alter table public.upload_events enable row level security;
revoke all on public.upload_events from public, anon, authenticated;
create index upload_events_owner_window_idx on public.upload_events(owner_id, bucket, created_at);

create function public.pw_enforce_storage_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  quota integer;
begin
  if new.bucket_id not in ('entry-assets', 'member-covers') or auth.uid() is null then return new; end if;
  if not public.pw_account_active() then raise exception 'verified_account_required' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = auth.uid() for update;
  quota := case when new.bucket_id = 'entry-assets' then 30 else 12 end;
  if (select count(*) from public.upload_events where owner_id = auth.uid() and bucket = new.bucket_id
      and created_at > now() - interval '1 hour') >= quota then
    raise exception 'rate_limited' using errcode = 'PW429';
  end if;
  insert into public.upload_events(owner_id, bucket) values(auth.uid(), new.bucket_id);
  -- Events survive file removal, so failed registrations cannot reset the allowance.
  if random() < 0.02 then delete from public.upload_events where created_at < now() - interval '1 day'; end if;
  return new;
end;
$$;
revoke execute on function public.pw_enforce_storage_quota() from public, anon, authenticated;
create trigger pw_storage_upload_quota before insert on storage.objects
for each row execute function public.pw_enforce_storage_quota();
