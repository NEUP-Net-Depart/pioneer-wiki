-- Friend links, member pages and the annals become administrable on-site:
-- every save is validated and versioned, deletion is archiving, and the old
-- table-level write policies give way to functions that audit what they do.
-- The forum gains moderation (hide, lock) and per-account write limits that
-- hold for direct database calls, not only for the website.

-- ── Versions ────────────────────────────────────────────────────────────────

create table if not exists public.content_versions (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('member', 'link', 'chronicle')),
  object_id text not null,
  number integer not null check (number > 0),
  data jsonb not null,
  note text not null default '',
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, object_id, number)
);
create index if not exists content_versions_object_idx on public.content_versions (kind, object_id, number desc);
alter table public.content_versions enable row level security;
revoke insert, update, delete on public.content_versions from anon, authenticated;
drop policy if exists "admins and owners read versions" on public.content_versions;
create policy "admins and owners read versions" on public.content_versions for select to authenticated using (
  (select public.pw_can_manage()) or (kind = 'member' and object_id = (select public.pw_bound_member()))
);

create or replace function public.pw_record_content_version(p_kind text, p_id text, p_data jsonb, p_note text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  select coalesce(max(number), 0) + 1 into n from public.content_versions where kind = p_kind and object_id = p_id;
  insert into public.content_versions(kind, object_id, number, data, note, actor_id)
  values (p_kind, p_id, n, p_data, left(coalesce(p_note, ''), 500), auth.uid());
  return n;
end;
$$;
revoke execute on function public.pw_record_content_version(text, text, jsonb, text) from public, anon, authenticated;

-- The fields every localized pair must satisfy.
create or replace function public.pw_localized_ok(p_value jsonb, p_min integer, p_max integer)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_value) = 'object'
    and length(trim(coalesce(p_value->>'zh', ''))) between p_min and p_max
    and length(trim(coalesce(p_value->>'en', ''))) between p_min and p_max;
$$;

create or replace function public.pw_http_url_ok(p_url text, p_max integer)
returns boolean language sql immutable set search_path = '' as $$
  select p_url is not null and length(p_url) <= p_max and p_url ~* '^https?://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?(/[^\s]*)?$';
$$;

-- ── Friend links ────────────────────────────────────────────────────────────

alter table public.friend_links add column if not exists archived_at timestamptz;
alter table public.friend_links add column if not exists sort_order integer not null default 0;
alter table public.friend_links add column if not exists created_at timestamptz not null default now();
alter table public.friend_links add column if not exists updated_at timestamptz not null default now();
alter table public.friend_links add column if not exists version integer not null default 1;
create unique index if not exists friend_links_active_url_idx on public.friend_links (lower(rtrim(url, '/'))) where archived_at is null;

drop policy if exists "admins manage links" on public.friend_links;
drop policy if exists "public link reads" on public.friend_links;
create policy "public link reads" on public.friend_links for select using (archived_at is null or (select public.pw_can_manage()));
revoke insert, update, delete on public.friend_links from anon, authenticated;

/*
 * Creates (p_id null) or saves a friend link. p_patch: name, url,
 * description, emblem, since, sortOrder, sample. Public at once.
 */
create or replace function public.pw_admin_save_link(p_id text, p_patch jsonb, p_base_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  patch jsonb := coalesce(p_patch, '{}'::jsonb);
  link public.friend_links;
  link_id text := p_id;
  base text;
  n integer := 1;
  next_url text;
begin
  perform public.pw_raise_unless_admin();
  if patch ? 'name' and not public.pw_localized_ok(patch->'name', 1, 60) then raise exception 'invalid_link_name' using errcode = '22023'; end if;
  if patch ? 'description' and not public.pw_localized_ok(patch->'description', 0, 240) then raise exception 'invalid_link_description' using errcode = '22023'; end if;
  if patch ? 'url' and not public.pw_http_url_ok(trim(patch->>'url'), 300) then raise exception 'invalid_link_url' using errcode = '22023'; end if;
  if patch ? 'emblem' and coalesce(patch->>'emblem', '') !~ '^geo-[a-z0-9-]+$' then raise exception 'invalid_link_emblem' using errcode = '22023'; end if;
  if patch ? 'since' and (patch->>'since') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_link_since' using errcode = '22023'; end if;
  if patch ? 'sortOrder' and (patch->>'sortOrder')::integer not between 0 and 100000 then raise exception 'invalid_sort_order' using errcode = '22023'; end if;
  next_url := nullif(trim(patch->>'url'), '');
  if link_id is null then
    if not (patch ? 'name' and patch ? 'url') then raise exception 'link_incomplete' using errcode = '22023'; end if;
    base := left(trim(both '-' from regexp_replace(lower(patch #>> '{name,en}'), '[^a-z0-9]+', '-', 'g')), 40);
    if base = '' then base := 'friend'; end if;
    link_id := 'l-' || base;
    while exists (select 1 from public.friend_links where id = link_id) loop
      n := n + 1;
      link_id := 'l-' || base || '-' || n;
    end loop;
    if exists (select 1 from public.friend_links where archived_at is null and lower(rtrim(url, '/')) = lower(rtrim(next_url, '/'))) then
      raise exception 'link_url_taken' using errcode = '40001';
    end if;
    insert into public.friend_links(id, name_zh, name_en, url, description_zh, description_en, emblem, since, sort_order, sample, version)
    values (link_id, trim(patch #>> '{name,zh}'), trim(patch #>> '{name,en}'), next_url,
      coalesce(trim(patch #>> '{description,zh}'), ''), coalesce(trim(patch #>> '{description,en}'), ''),
      coalesce(nullif(patch->>'emblem', ''), 'geo-compass'), coalesce((patch->>'since')::date, current_date),
      coalesce((patch->>'sortOrder')::integer, 0), coalesce((patch->>'sample')::boolean, false), 1)
    returning * into link;
  else
    select * into link from public.friend_links where id = link_id for update;
    if not found then raise exception 'link_not_found' using errcode = '22023'; end if;
    if p_base_version is not null and p_base_version <> link.version then raise exception 'version_conflict' using errcode = '40001'; end if;
    if next_url is not null and exists (select 1 from public.friend_links where id <> link_id and archived_at is null
      and lower(rtrim(url, '/')) = lower(rtrim(next_url, '/'))) then
      raise exception 'link_url_taken' using errcode = '40001';
    end if;
    update public.friend_links set
      name_zh = coalesce(trim(patch #>> '{name,zh}'), name_zh), name_en = coalesce(trim(patch #>> '{name,en}'), name_en),
      url = coalesce(next_url, url),
      description_zh = coalesce(trim(patch #>> '{description,zh}'), description_zh),
      description_en = coalesce(trim(patch #>> '{description,en}'), description_en),
      emblem = coalesce(nullif(patch->>'emblem', ''), emblem), since = coalesce((patch->>'since')::date, since),
      sort_order = coalesce((patch->>'sortOrder')::integer, sort_order), sample = coalesce((patch->>'sample')::boolean, sample),
      version = version + 1, updated_at = now()
    where id = link_id returning * into link;
  end if;
  perform public.pw_record_content_version('link', link_id, to_jsonb(link), case when p_id is null then 'Created' else 'Saved' end);
  perform public.pw_audit_insert(case when p_id is null then 'create' else 'update' end, 'link', link_id, null,
    jsonb_build_object('version', link.version, 'url', link.url));
  return to_jsonb(link);
end;
$$;

create or replace function public.pw_admin_set_link_archived(p_id text, p_archived boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  link public.friend_links;
begin
  perform public.pw_raise_unless_admin();
  select * into link from public.friend_links where id = p_id for update;
  if not found then raise exception 'link_not_found' using errcode = '22023'; end if;
  if (link.archived_at is not null) = p_archived then raise exception 'unchanged_status' using errcode = '40001'; end if;
  if not p_archived and exists (select 1 from public.friend_links where id <> p_id and archived_at is null
    and lower(rtrim(url, '/')) = lower(rtrim(link.url, '/'))) then
    raise exception 'link_url_taken' using errcode = '40001';
  end if;
  update public.friend_links set archived_at = case when p_archived then now() else null end, version = version + 1, updated_at = now()
  where id = p_id returning * into link;
  perform public.pw_record_content_version('link', p_id, to_jsonb(link), case when p_archived then 'Archived' else 'Restored' end);
  perform public.pw_audit_insert(case when p_archived then 'archive' else 'restore' end, 'link', p_id, null,
    jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), '')));
  return to_jsonb(link);
end;
$$;

-- ── Member pages ────────────────────────────────────────────────────────────

alter table public.members add column if not exists version integer not null default 1;
alter table public.members add column if not exists updated_at timestamptz not null default now();
drop policy if exists "owners update members" on public.members;
drop policy if exists "public member reads" on public.members;
create policy "public member reads" on public.members for select using (
  archived_at is null or (select public.pw_can_manage()) or id = (select public.pw_bound_member())
);
revoke insert, update, delete on public.members from anon, authenticated;

create or replace function public.pw_member_patch_ok(p jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare
  link jsonb;
begin
  if p ? 'name' and not public.pw_localized_ok(p->'name', 1, 40) then raise exception 'invalid_member_name' using errcode = '22023'; end if;
  if p ? 'role' and not public.pw_localized_ok(p->'role', 1, 40) then raise exception 'invalid_member_role' using errcode = '22023'; end if;
  if p ? 'bio' and not public.pw_localized_ok(p->'bio', 1, 160) then raise exception 'invalid_member_bio' using errcode = '22023'; end if;
  if p ? 'about' and (jsonb_typeof(p->'about') <> 'string' or length(p->>'about') > 20000) then raise exception 'invalid_member_about' using errcode = '22023'; end if;
  if p ? 'links' then
    if jsonb_typeof(p->'links') <> 'array' or jsonb_array_length(p->'links') > 8 then raise exception 'invalid_member_links' using errcode = '22023'; end if;
    for link in select x from jsonb_array_elements(p->'links') x loop
      if length(trim(coalesce(link->>'label', ''))) not between 1 and 32
        or not (public.pw_http_url_ok(link->>'url', 300) or coalesce(link->>'url', '') ~* '^mailto:[^\s@]+@[^\s@]+$')
      then raise exception 'invalid_member_links' using errcode = '22023'; end if;
    end loop;
  end if;
  if p ? 'github' and p->'github' <> 'null'::jsonb and coalesce(p->>'github', '') !~* '^([a-z\d][a-z\d-]{0,38})?$' then
    raise exception 'invalid_member_github' using errcode = '22023'; end if;
  if p ? 'projects' and (jsonb_typeof(p->'projects') <> 'array' or jsonb_array_length(p->'projects') > 8) then
    raise exception 'invalid_member_projects' using errcode = '22023'; end if;
  if p ? 'plate' then
    if p #>> '{plate,emblem}' is not null and (p #>> '{plate,emblem}') !~ '^ex-[a-z0-9-]+$' then raise exception 'invalid_member_plate' using errcode = '22023'; end if;
    if p #>> '{plate,ink}' is not null and (p #>> '{plate,ink}') not in ('prussian', 'madder', 'sepia', 'verdigris', 'vermilion', 'violet', 'lampblack', 'ochre') then
      raise exception 'invalid_member_plate' using errcode = '22023'; end if;
    if p #>> '{plate,border}' is not null and (p #>> '{plate,border}') not in ('vine', 'meander', 'rope', 'fleuron') then
      raise exception 'invalid_member_plate' using errcode = '22023'; end if;
    if length(coalesce(p #>> '{plate,motto}', '')) > 48 then raise exception 'invalid_member_plate' using errcode = '22023'; end if;
  end if;
  if p ? 'coverPrint' and coalesce(p->>'coverPrint', '') not in ('original', 'ink') then raise exception 'invalid_member_cover' using errcode = '22023'; end if;
end;
$$;

/*
 * Saves a member page. The member edits their own page (public at once, as
 * before); administrators may edit any page and also its handle, joining
 * date, sample flag and author attribution. Every save is a version.
 */
create or replace function public.pw_save_member(p_member_id text, p_patch jsonb, p_base_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  patch jsonb := coalesce(p_patch, '{}'::jsonb);
  admin boolean := public.pw_can_manage();
  own boolean := p_member_id is not null and p_member_id = public.pw_bound_member();
  m public.members;
  next_handle text := nullif(lower(trim(coalesce(patch->>'handle', ''))), '');
begin
  if not (admin or own) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not admin and (patch ?| array['handle', 'joined', 'sample', 'authorId']) then raise exception 'forbidden_fields' using errcode = '42501'; end if;
  perform public.pw_member_patch_ok(patch);
  select * into m from public.members where id = p_member_id for update;
  if not found then raise exception 'member_not_found' using errcode = '22023'; end if;
  if m.archived_at is not null and not admin then raise exception 'member_archived' using errcode = '40001'; end if;
  if p_base_version is not null and p_base_version <> m.version then raise exception 'version_conflict' using errcode = '40001'; end if;
  if next_handle is not null and next_handle <> m.handle then
    if next_handle !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(next_handle) > 32 then raise exception 'invalid_member_handle' using errcode = '22023'; end if;
    if exists (select 1 from public.members x where x.id <> m.id and (x.handle = next_handle or next_handle = any(x.former_handles))) then
      raise exception 'member_handle_taken' using errcode = '40001';
    end if;
  end if;
  if patch ? 'authorId' and nullif(patch->>'authorId', '') is not null and not exists (select 1 from public.authors where id = patch->>'authorId') then
    raise exception 'author_not_found' using errcode = '22023';
  end if;
  update public.members set
    former_handles = case when next_handle is not null and next_handle <> handle then array_append(array_remove(former_handles, next_handle), handle) else former_handles end,
    handle = coalesce(next_handle, handle),
    name_zh = coalesce(trim(patch #>> '{name,zh}'), name_zh), name_en = coalesce(trim(patch #>> '{name,en}'), name_en),
    role_zh = coalesce(trim(patch #>> '{role,zh}'), role_zh), role_en = coalesce(trim(patch #>> '{role,en}'), role_en),
    bio_zh = coalesce(trim(patch #>> '{bio,zh}'), bio_zh), bio_en = coalesce(trim(patch #>> '{bio,en}'), bio_en),
    about = coalesce(patch->>'about', about),
    links = coalesce(patch->'links', links),
    github = case when patch ? 'github' then nullif(trim(coalesce(patch->>'github', '')), '') else github end,
    projects = coalesce(patch->'projects', projects),
    plate_emblem = coalesce(patch #>> '{plate,emblem}', plate_emblem), plate_ink = coalesce(patch #>> '{plate,ink}', plate_ink),
    plate_border = coalesce(patch #>> '{plate,border}', plate_border), plate_motto = coalesce(patch #>> '{plate,motto}', plate_motto),
    cover_print = case when patch ? 'coverPrint' and cover_src is not null then patch->>'coverPrint' else cover_print end,
    joined = coalesce((patch->>'joined')::date, joined), sample = coalesce((patch->>'sample')::boolean, sample),
    author_id = case when patch ? 'authorId' then nullif(patch->>'authorId', '') else author_id end,
    version = version + 1, updated_at = now()
  where id = m.id returning * into m;
  perform public.pw_record_content_version('member', m.id, to_jsonb(m), coalesce(nullif(trim(patch->>'note'), ''), 'Saved'));
  perform public.pw_audit_insert('update', 'member', m.id, null, jsonb_build_object('version', m.version, 'fields',
    (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(patch) k), 'by', case when own then 'owner' else 'admin' end));
  return to_jsonb(m);
end;
$$;

-- Sets or removes a member's large page image; the old file is removed by the caller after this commits.
create or replace function public.pw_set_member_cover(p_member_id text, p_cover jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m public.members;
begin
  if not (public.pw_can_manage() or (p_member_id is not null and p_member_id = public.pw_bound_member())) then
    raise exception 'forbidden' using errcode = '42501'; end if;
  if p_cover is not null and (coalesce(p_cover->>'src', '') = '' or (p_cover->>'width')::integer <= 0 or (p_cover->>'height')::integer <= 0
    or coalesce(p_cover->>'print', 'original') not in ('original', 'ink')) then
    raise exception 'invalid_member_cover' using errcode = '22023'; end if;
  select * into m from public.members where id = p_member_id for update;
  if not found then raise exception 'member_not_found' using errcode = '22023'; end if;
  if m.archived_at is not null and not public.pw_can_manage() then raise exception 'member_archived' using errcode = '40001'; end if;
  update public.members set cover_src = p_cover->>'src', cover_width = (p_cover->>'width')::integer, cover_height = (p_cover->>'height')::integer,
    cover_print = case when p_cover is null then null else coalesce(p_cover->>'print', 'original') end, version = version + 1, updated_at = now()
  where id = m.id returning * into m;
  perform public.pw_record_content_version('member', m.id, to_jsonb(m), case when p_cover is null then 'Removed page image' else 'New page image' end);
  perform public.pw_audit_insert('set_cover', 'member', m.id, null, jsonb_build_object('version', m.version, 'cover', p_cover is not null));
  return to_jsonb(m);
end;
$$;

create or replace function public.pw_admin_create_member(p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  member_id text;
  m public.members;
begin
  perform public.pw_raise_unless_admin();
  perform public.pw_member_patch_ok(p_patch - 'handle');
  if nullif(p_patch->>'authorId', '') is not null and not exists (select 1 from public.authors where id = p_patch->>'authorId') then
    raise exception 'author_not_found' using errcode = '22023'; end if;
  member_id := public.pw_new_member(p_patch, nullif(p_patch->>'authorId', ''));
  select * into m from public.members where id = member_id;
  perform public.pw_record_content_version('member', member_id, to_jsonb(m), 'Created');
  perform public.pw_audit_insert('create', 'member', member_id, null, jsonb_build_object('handle', m.handle));
  return to_jsonb(m);
end;
$$;

create or replace function public.pw_admin_set_member_archived(p_id text, p_archived boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m public.members;
begin
  perform public.pw_raise_unless_admin();
  select * into m from public.members where id = p_id for update;
  if not found then raise exception 'member_not_found' using errcode = '22023'; end if;
  if (m.archived_at is not null) = p_archived then raise exception 'unchanged_status' using errcode = '40001'; end if;
  update public.members set archived_at = case when p_archived then now() else null end, version = version + 1, updated_at = now()
  where id = p_id returning * into m;
  perform public.pw_record_content_version('member', p_id, to_jsonb(m), case when p_archived then 'Archived' else 'Restored' end);
  perform public.pw_audit_insert(case when p_archived then 'archive' else 'restore' end, 'member', p_id, null,
    jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), '')));
  return to_jsonb(m);
end;
$$;

-- ── The annals ──────────────────────────────────────────────────────────────

alter table public.chronicles add column if not exists archived_at timestamptz;
alter table public.chronicles add column if not exists version integer not null default 1;
alter table public.chronicles add column if not exists updated_at timestamptz not null default now();
drop policy if exists "admins manage chronicles" on public.chronicles;
drop policy if exists "public chronicle reads" on public.chronicles;
create policy "public chronicle reads" on public.chronicles for select using (archived_at is null or (select public.pw_can_manage()));
revoke insert, update, delete on public.chronicles from anon, authenticated;

create or replace function public.pw_chronicle_patch_ok(p jsonb)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  item jsonb;
begin
  if p ? 'title' and not public.pw_localized_ok(p->'title', 1, 120) then raise exception 'invalid_chronicle_title' using errcode = '22023'; end if;
  if p ? 'summary' and not public.pw_localized_ok(p->'summary', 1, 400) then raise exception 'invalid_chronicle_summary' using errcode = '22023'; end if;
  if p ? 'date' and (p->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_chronicle_date' using errcode = '22023'; end if;
  if p ? 'kind' and coalesce(p->>'kind', '') not in ('meeting', 'archive', 'material', 'milestone') then raise exception 'invalid_chronicle_kind' using errcode = '22023'; end if;
  if p ? 'body' and p->'body' <> 'null'::jsonb and (jsonb_typeof(p->'body') <> 'string' or length(p->>'body') > 40000) then
    raise exception 'invalid_chronicle_body' using errcode = '22023'; end if;
  if p ? 'hostIds' then
    if jsonb_typeof(p->'hostIds') <> 'array' or jsonb_array_length(p->'hostIds') > 20 then raise exception 'invalid_chronicle_hosts' using errcode = '22023'; end if;
    if exists (select 1 from jsonb_array_elements_text(p->'hostIds') h where not exists (select 1 from public.members m where m.id = h)) then
      raise exception 'unknown_chronicle_host' using errcode = '22023'; end if;
  end if;
  if p ? 'resources' then
    if jsonb_typeof(p->'resources') <> 'array' or jsonb_array_length(p->'resources') > 20 then raise exception 'invalid_chronicle_resources' using errcode = '22023'; end if;
    for item in select x from jsonb_array_elements(p->'resources') x loop
      if coalesce(item->>'kind', '') not in ('video', 'document', 'slides', 'code', 'link')
        or not public.pw_localized_ok(item->'label', 1, 80) or not public.pw_http_url_ok(item->>'url', 500)
        or length(coalesce(item->>'detail', '')) > 40
      then raise exception 'invalid_chronicle_resources' using errcode = '22023'; end if;
    end loop;
  end if;
  if p ? 'tags' and (jsonb_typeof(p->'tags') <> 'array' or jsonb_array_length(p->'tags') > 12
    or exists (select 1 from jsonb_array_elements_text(p->'tags') t where length(t) not between 1 and 32)) then
    raise exception 'invalid_chronicle_tags' using errcode = '22023'; end if;
  if p ? 'gallery' and (jsonb_typeof(p->'gallery') <> 'array' or jsonb_array_length(p->'gallery') > 12) then
    raise exception 'invalid_chronicle_gallery' using errcode = '22023'; end if;
end;
$$;
revoke execute on function public.pw_chronicle_patch_ok(jsonb) from public, anon, authenticated;

create or replace function public.pw_admin_save_chronicle(p_id text, p_patch jsonb, p_base_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  patch jsonb := coalesce(p_patch, '{}'::jsonb);
  c public.chronicles;
  n integer;
begin
  perform public.pw_raise_unless_admin();
  perform public.pw_chronicle_patch_ok(patch);
  if p_id is null then
    if not (patch ? 'title' and patch ? 'summary' and patch ? 'date' and patch ? 'kind') then raise exception 'chronicle_incomplete' using errcode = '22023'; end if;
    perform pg_catalog.pg_advisory_xact_lock(812705);
    select coalesce(max(number), 0) + 1 into n from public.chronicles;
    insert into public.chronicles(id, number, date, kind, title_zh, title_en, summary_zh, summary_en, body, host_ids, resources, gallery, tags, sample)
    values ('ch-' || lpad(n::text, 4, '0'), n, (patch->>'date')::date, patch->>'kind', trim(patch #>> '{title,zh}'), trim(patch #>> '{title,en}'),
      trim(patch #>> '{summary,zh}'), trim(patch #>> '{summary,en}'), nullif(patch->>'body', ''), coalesce(patch->'hostIds', '[]'::jsonb),
      coalesce(patch->'resources', '[]'::jsonb), coalesce(patch->'gallery', '[]'::jsonb), coalesce(patch->'tags', '[]'::jsonb),
      coalesce((patch->>'sample')::boolean, false))
    returning * into c;
  else
    select * into c from public.chronicles where id = p_id for update;
    if not found then raise exception 'chronicle_not_found' using errcode = '22023'; end if;
    if p_base_version is not null and p_base_version <> c.version then raise exception 'version_conflict' using errcode = '40001'; end if;
    update public.chronicles set
      date = coalesce((patch->>'date')::date, date), kind = coalesce(patch->>'kind', kind),
      title_zh = coalesce(trim(patch #>> '{title,zh}'), title_zh), title_en = coalesce(trim(patch #>> '{title,en}'), title_en),
      summary_zh = coalesce(trim(patch #>> '{summary,zh}'), summary_zh), summary_en = coalesce(trim(patch #>> '{summary,en}'), summary_en),
      body = case when patch ? 'body' then nullif(patch->>'body', '') else body end,
      host_ids = coalesce(patch->'hostIds', host_ids), resources = coalesce(patch->'resources', resources),
      gallery = coalesce(patch->'gallery', gallery), tags = coalesce(patch->'tags', tags),
      sample = coalesce((patch->>'sample')::boolean, sample), version = version + 1, updated_at = now()
    where id = p_id returning * into c;
  end if;
  perform public.pw_record_content_version('chronicle', c.id, to_jsonb(c), case when p_id is null then 'Created' else 'Saved' end);
  perform public.pw_audit_insert(case when p_id is null then 'create' else 'update' end, 'chronicle', c.id, null, jsonb_build_object('version', c.version));
  return to_jsonb(c);
end;
$$;

create or replace function public.pw_admin_set_chronicle_archived(p_id text, p_archived boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.chronicles;
begin
  perform public.pw_raise_unless_admin();
  select * into c from public.chronicles where id = p_id for update;
  if not found then raise exception 'chronicle_not_found' using errcode = '22023'; end if;
  if (c.archived_at is not null) = p_archived then raise exception 'unchanged_status' using errcode = '40001'; end if;
  update public.chronicles set archived_at = case when p_archived then now() else null end, version = version + 1, updated_at = now()
  where id = p_id returning * into c;
  perform public.pw_record_content_version('chronicle', p_id, to_jsonb(c), case when p_archived then 'Archived' else 'Restored' end);
  perform public.pw_audit_insert(case when p_archived then 'archive' else 'restore' end, 'chronicle', p_id, null,
    jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), '')));
  return to_jsonb(c);
end;
$$;

-- Makes an older version current again, as a new version. Archive state is not restored.
create or replace function public.pw_restore_content_version(p_kind text, p_id text, p_number integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d jsonb;
begin
  select data into d from public.content_versions where kind = p_kind and object_id = p_id and number = p_number;
  if d is null then raise exception 'version_not_found' using errcode = '22023'; end if;
  if p_kind = 'member' then
    return public.pw_save_member(p_id, jsonb_build_object(
      'name', jsonb_build_object('zh', d->>'name_zh', 'en', d->>'name_en'), 'role', jsonb_build_object('zh', d->>'role_zh', 'en', d->>'role_en'),
      'bio', jsonb_build_object('zh', d->>'bio_zh', 'en', d->>'bio_en'), 'about', d->'about', 'links', d->'links',
      'github', d->'github', 'projects', coalesce(d->'projects', '[]'::jsonb),
      'plate', jsonb_build_object('emblem', d->>'plate_emblem', 'ink', d->>'plate_ink', 'border', d->>'plate_border', 'motto', d->>'plate_motto'),
      'note', 'Restored version ' || p_number), null);
  elsif p_kind = 'link' then
    return public.pw_admin_save_link(p_id, jsonb_build_object(
      'name', jsonb_build_object('zh', d->>'name_zh', 'en', d->>'name_en'), 'url', d->>'url',
      'description', jsonb_build_object('zh', d->>'description_zh', 'en', d->>'description_en'),
      'emblem', d->>'emblem', 'since', d->>'since', 'sortOrder', coalesce((d->>'sort_order')::integer, 0)), null);
  elsif p_kind = 'chronicle' then
    return public.pw_admin_save_chronicle(p_id, jsonb_build_object(
      'date', d->>'date', 'kind', d->>'kind', 'title', jsonb_build_object('zh', d->>'title_zh', 'en', d->>'title_en'),
      'summary', jsonb_build_object('zh', d->>'summary_zh', 'en', d->>'summary_en'), 'body', coalesce(d->'body', 'null'::jsonb),
      'hostIds', d->'host_ids', 'resources', d->'resources', 'gallery', d->'gallery', 'tags', d->'tags'), null);
  end if;
  raise exception 'invalid_kind' using errcode = '22023';
end;
$$;

revoke execute on function public.pw_admin_save_link(text, jsonb, integer), public.pw_admin_set_link_archived(text, boolean, text),
  public.pw_save_member(text, jsonb, integer), public.pw_set_member_cover(text, jsonb), public.pw_admin_create_member(jsonb),
  public.pw_admin_set_member_archived(text, boolean, text), public.pw_admin_save_chronicle(text, jsonb, integer),
  public.pw_admin_set_chronicle_archived(text, boolean, text), public.pw_restore_content_version(text, text, integer) from public, anon;
grant execute on function public.pw_admin_save_link(text, jsonb, integer), public.pw_admin_set_link_archived(text, boolean, text),
  public.pw_save_member(text, jsonb, integer), public.pw_set_member_cover(text, jsonb), public.pw_admin_create_member(jsonb),
  public.pw_admin_set_member_archived(text, boolean, text), public.pw_admin_save_chronicle(text, jsonb, integer),
  public.pw_admin_set_chronicle_archived(text, boolean, text), public.pw_restore_content_version(text, text, integer) to authenticated;

-- ── Forum: moderation, limits, identity from the owner binding ──────────────

alter table public.forum_threads add column if not exists locked_at timestamptz;
alter table public.forum_threads add column if not exists moderation_note text;
alter table public.forum_posts add column if not exists moderation_note text;
create index if not exists forum_threads_created_idx on public.forum_threads (created_at desc);

drop policy if exists "public thread reads" on public.forum_threads;
create policy "public thread reads" on public.forum_threads for select using (deleted_at is null or (select public.pw_can_manage()));
drop policy if exists "public post reads" on public.forum_posts;
create policy "public post reads" on public.forum_posts for select using (
  (deleted_at is null and exists (select 1 from public.forum_threads t where t.id = thread_id and t.deleted_at is null))
  or (select public.pw_can_manage())
);

-- The signature a verified, active account posts under: its member page, or its display name.
create or replace function public.pw_forum_identity()
returns table(author_name text, member_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pw_account_active() then raise exception 'verified_account_required' using errcode = '42501'; end if;
  return query
    select coalesce(nullif(trim(m.name_zh), ''), nullif(trim(p.display_name_zh), ''), 'Reader'), m.id
    from public.profiles p
    left join public.members m on m.id = p.member_id and m.archived_at is null
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
revoke execute on function public.pw_create_forum_thread(text, text, text), public.pw_reply_forum_thread(text, text) from public, anon;
grant execute on function public.pw_create_forum_thread(text, text, text), public.pw_reply_forum_thread(text, text) to authenticated;

-- One page of threads with their counts, in one query (no per-thread round trips).
create or replace function public.pw_list_threads(p_category text default null, p_view text default 'public', p_limit integer default 100, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  admin boolean := public.pw_can_manage();
  result jsonb;
begin
  if p_view <> 'public' and not admin then raise exception 'admin_required' using errcode = '42501'; end if;
  with base as (
    select t.*,
      (select count(*) from public.forum_posts p where p.thread_id = t.id and p.deleted_at is null) post_count,
      (select count(*) from public.forum_posts p where p.thread_id = t.id and p.deleted_at is not null) hidden_posts,
      (select left(p.body, 90) from public.forum_posts p where p.thread_id = t.id and p.deleted_at is null order by p.created_at limit 1) excerpt,
      coalesce((select max(p.created_at) from public.forum_posts p where p.thread_id = t.id and p.deleted_at is null), t.created_at) last_activity_at
    from public.forum_threads t
    where (p_category is null or t.category = p_category)
      and case p_view when 'public' then t.deleted_at is null when 'hidden' then t.deleted_at is not null
        when 'locked' then t.locked_at is not null else true end
  )
  select jsonb_build_object('total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(row_data order by last_activity_at desc, id) from (
      select b.last_activity_at, b.id, (to_jsonb(b) - 'account_id') row_data
      from base b order by b.last_activity_at desc, b.id
      limit greatest(1, least(coalesce(p_limit, 100), 200)) offset greatest(0, coalesce(p_offset, 0))
    ) page), '[]'::jsonb)) into result;
  return result;
end;
$$;
revoke execute on function public.pw_list_threads(text, text, integer, integer) from public;
grant execute on function public.pw_list_threads(text, text, integer, integer) to anon, authenticated;

create or replace function public.pw_admin_moderate_thread(p_id text, p_action text, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.forum_threads;
begin
  perform public.pw_raise_unless_admin();
  select * into t from public.forum_threads where id = p_id for update;
  if not found then raise exception 'thread_not_found' using errcode = '22023'; end if;
  if p_action = 'hide' then
    if t.deleted_at is not null then raise exception 'unchanged_status' using errcode = '40001'; end if;
    if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'reason_required' using errcode = '22023'; end if;
    update public.forum_threads set deleted_at = now(), moderation_note = trim(p_reason) where id = p_id returning * into t;
  elsif p_action = 'restore' then
    if t.deleted_at is null then raise exception 'unchanged_status' using errcode = '40001'; end if;
    update public.forum_threads set deleted_at = null, moderation_note = null where id = p_id returning * into t;
  elsif p_action = 'lock' then
    if t.locked_at is not null then raise exception 'unchanged_status' using errcode = '40001'; end if;
    update public.forum_threads set locked_at = now(), moderation_note = nullif(trim(coalesce(p_reason, '')), '') where id = p_id returning * into t;
  elsif p_action = 'unlock' then
    if t.locked_at is null then raise exception 'unchanged_status' using errcode = '40001'; end if;
    update public.forum_threads set locked_at = null where id = p_id returning * into t;
  else
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  perform public.pw_audit_insert('moderate_' || p_action, 'thread', p_id, null, jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), '')));
  return to_jsonb(t) - 'account_id';
end;
$$;

create or replace function public.pw_admin_moderate_post(p_id text, p_action text, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p public.forum_posts;
begin
  perform public.pw_raise_unless_admin();
  select * into p from public.forum_posts where id = p_id for update;
  if not found then raise exception 'post_not_found' using errcode = '22023'; end if;
  if p_action = 'hide' then
    if p.deleted_at is not null then raise exception 'unchanged_status' using errcode = '40001'; end if;
    if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'reason_required' using errcode = '22023'; end if;
    if p.id = (select x.id from public.forum_posts x where x.thread_id = p.thread_id order by x.created_at, x.id limit 1) then
      raise exception 'hide_thread_instead' using errcode = '40001'; end if;
    update public.forum_posts set deleted_at = now(), moderation_note = trim(p_reason) where id = p_id returning * into p;
  elsif p_action = 'restore' then
    if p.deleted_at is null then raise exception 'unchanged_status' using errcode = '40001'; end if;
    update public.forum_posts set deleted_at = null, moderation_note = null where id = p_id returning * into p;
  else
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  perform public.pw_audit_insert('moderate_post_' || p_action, 'post', p_id, null,
    jsonb_build_object('thread', p.thread_id, 'reason', nullif(trim(coalesce(p_reason, '')), '')));
  return to_jsonb(p) - 'account_id';
end;
$$;
revoke execute on function public.pw_admin_moderate_thread(text, text, text), public.pw_admin_moderate_post(text, text, text) from public, anon;
grant execute on function public.pw_admin_moderate_thread(text, text, text), public.pw_admin_moderate_post(text, text, text) to authenticated;
