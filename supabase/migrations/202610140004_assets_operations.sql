-- Article images: a record that is reviewed, and an object whose access
-- follows that review. The entry-assets bucket becomes private; the website
-- serves an image through /api/assets/<id>/file with the reader's session, so
-- a pending or rejected image is never public, while an approved one is cached
-- like any public file. Owners describe their uploads; only administrators
-- decide them. Also: database-backed request throttles that hold across
-- processes, the readiness probe and the administrators' audit reader.

-- ── Asset records ───────────────────────────────────────────────────────────

alter table public.assets add column if not exists bucket text;
alter table public.assets add column if not exists object_path text;
alter table public.assets add column if not exists review_note text;
alter table public.assets add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.assets add column if not exists reviewed_at timestamptz;
alter table public.assets add column if not exists created_at timestamptz not null default now();
create unique index if not exists assets_object_idx on public.assets (bucket, object_path) where object_path is not null;
create index if not exists assets_review_idx on public.assets (review_status, created_at desc);

-- Uploads recorded by earlier versions pointed at the public bucket URL.
update public.assets set bucket = 'entry-assets', object_path = substring(src from '/entry-assets/([^/?#]+)$'),
  src = '/api/assets/' || id || '/file'
where object_path is null and src ~ '/storage/v1/object/public/entry-assets/[^/?#]+$';

drop policy if exists "authors upload pending assets" on public.assets;
drop policy if exists "owners update pending assets" on public.assets;
drop policy if exists "admins manage assets" on public.assets;
revoke insert, update, delete on public.assets from anon, authenticated;

-- ── Storage access follows the review ───────────────────────────────────────

update storage.buckets set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/webp'] where id = 'entry-assets';
update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/webp'] where id = 'member-covers';

drop policy if exists "entry assets read" on storage.objects;
create policy "entry assets read" on storage.objects for select using (
  bucket_id = 'entry-assets' and (
    owner_id = (select auth.uid())::text
    or exists (select 1 from public.assets a where a.bucket = 'entry-assets' and a.object_path = name
      and (a.review_status = 'approved' or (select public.pw_can_manage())))
  )
);
drop policy if exists "entry assets owner upload" on storage.objects;
create policy "entry assets owner upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'entry-assets' and owner_id = (select auth.uid())::text and (select public.pw_account_active())
  and ((select public.pw_bound_author()) is not null or (select public.pw_can_manage()))
);
drop policy if exists "entry assets cleanup" on storage.objects;
create policy "entry assets cleanup" on storage.objects for delete to authenticated using (
  bucket_id = 'entry-assets' and (
    (select public.pw_can_manage())
    or (owner_id = (select auth.uid())::text and not exists (select 1 from public.assets a where a.bucket = 'entry-assets' and a.object_path = name))
  )
);
drop policy if exists "member covers owner upload" on storage.objects;
create policy "member covers owner upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'member-covers' and owner_id = (select auth.uid())::text and (select public.pw_account_active())
  and ((select public.pw_bound_member()) is not null or (select public.pw_can_manage()))
);
drop policy if exists "member covers owner delete" on storage.objects;
create policy "member covers owner delete" on storage.objects for delete to authenticated using (
  bucket_id = 'member-covers' and (owner_id = (select auth.uid())::text or (select public.pw_can_manage()))
);

-- ── Upload allowance ────────────────────────────────────────────────────────

/*
 * Raises rate_limited when an account has uploaded too much in the last hour:
 * 30 article images, 12 page images. Checked before the file is stored and
 * again when its record is written, so direct calls meet the same limit.
 */
create or replace function public.pw_upload_allowance(p_kind text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pw_account_active() then raise exception 'verified_account_required' using errcode = '42501'; end if;
  if p_kind = 'entry' and (select count(*) from public.assets where owner_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'PW429';
  end if;
  if p_kind = 'cover' and (select count(*) from public.media_assets where owner_id = auth.uid() and created_at > now() - interval '1 hour') >= 12 then
    raise exception 'rate_limited' using errcode = 'PW429';
  end if;
  if p_kind not in ('entry', 'cover') then raise exception 'invalid_kind' using errcode = '22023'; end if;
end;
$$;

create or replace function public.pw_asset_details_ok(p jsonb)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if length(coalesce(p->>'altZh', '')) > 300 or length(coalesce(p->>'altEn', '')) > 300
    or length(coalesce(p->>'captionZh', '')) > 300 or length(coalesce(p->>'captionEn', '')) > 300
    or length(coalesce(p->>'credit', '')) > 120 or length(coalesce(p->>'license', '')) > 80
    or (nullif(p->>'sourceUrl', '') is not null and not public.pw_http_url_ok(p->>'sourceUrl', 500))
  then raise exception 'invalid_asset_details' using errcode = '22023'; end if;
end;
$$;

-- Records an uploaded article image (pending review). The object must already be stored and owned by the caller.
create or replace function public.pw_register_entry_asset(p_object_path text, p_width integer, p_height integer, p_details jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d jsonb := coalesce(p_details, '{}'::jsonb);
  asset public.assets;
  asset_id text := 'asset-' || gen_random_uuid();
begin
  perform public.pw_upload_allowance('entry');
  if public.pw_bound_author() is null and not public.pw_can_manage() then raise exception 'author_required' using errcode = '42501'; end if;
  perform public.pw_asset_details_ok(d);
  if p_width not between 1 and 10000 or p_height not between 1 and 10000 then raise exception 'invalid_asset_size' using errcode = '22023'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'entry-assets' and o.name = p_object_path and o.owner_id = auth.uid()::text) then
    raise exception 'object_not_found' using errcode = '22023';
  end if;
  insert into public.assets(id, src, width, height, alt_zh, alt_en, caption_zh, caption_en, credit, license, source_url,
    owner_id, review_status, bucket, object_path)
  values (asset_id, '/api/assets/' || asset_id || '/file', p_width, p_height,
    coalesce(nullif(trim(d->>'altZh'), ''), ''), coalesce(nullif(trim(d->>'altEn'), ''), ''),
    nullif(trim(d->>'captionZh'), ''), nullif(trim(d->>'captionEn'), ''),
    coalesce(nullif(trim(d->>'credit'), ''), (select handle from public.profiles where id = auth.uid())),
    coalesce(nullif(trim(d->>'license'), ''), 'CC BY 4.0'), nullif(trim(d->>'sourceUrl'), ''),
    auth.uid(), 'pending', 'entry-assets', p_object_path)
  returning * into asset;
  perform public.pw_audit_insert('upload', 'asset', asset_id, null, jsonb_build_object('object', p_object_path));
  return to_jsonb(asset);
end;
$$;

-- Owners describe their own pending or rejected images; a rejected image goes back to pending.
create or replace function public.pw_update_asset_details(p_id text, p_details jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d jsonb := coalesce(p_details, '{}'::jsonb);
  asset public.assets;
begin
  if not public.pw_account_active() then raise exception 'verified_account_required' using errcode = '42501'; end if;
  perform public.pw_asset_details_ok(d);
  select * into asset from public.assets where id = p_id for update;
  if not found then raise exception 'asset_not_found' using errcode = '22023'; end if;
  if asset.owner_id is distinct from auth.uid() then raise exception 'forbidden' using errcode = '42501'; end if;
  if asset.review_status = 'approved' then raise exception 'asset_already_approved' using errcode = '40001'; end if;
  update public.assets set alt_zh = coalesce(trim(d->>'altZh'), alt_zh), alt_en = coalesce(trim(d->>'altEn'), alt_en),
    caption_zh = case when d ? 'captionZh' then nullif(trim(d->>'captionZh'), '') else caption_zh end,
    caption_en = case when d ? 'captionEn' then nullif(trim(d->>'captionEn'), '') else caption_en end,
    credit = coalesce(nullif(trim(d->>'credit'), ''), credit), license = coalesce(nullif(trim(d->>'license'), ''), license),
    source_url = case when d ? 'sourceUrl' then nullif(trim(d->>'sourceUrl'), '') else source_url end,
    review_status = 'pending'
  where id = p_id returning * into asset;
  perform public.pw_audit_insert('describe', 'asset', p_id, null, jsonb_build_object('status', asset.review_status));
  return to_jsonb(asset);
end;
$$;

/*
 * The decision on an image: approved (readers may see it), rejected (with a
 * reason the owner sees) or back to pending. Approval needs alternative text
 * in both languages, a credit and a licence.
 */
create or replace function public.pw_admin_review_asset(p_id text, p_decision text, p_note text, p_details jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d jsonb := coalesce(p_details, '{}'::jsonb);
  asset public.assets;
  before_status text;
begin
  perform public.pw_raise_unless_admin();
  if p_decision not in ('approved', 'rejected', 'pending') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  perform public.pw_asset_details_ok(d);
  select * into asset from public.assets where id = p_id for update;
  if not found then raise exception 'asset_not_found' using errcode = '22023'; end if;
  before_status := asset.review_status;
  update public.assets set alt_zh = coalesce(trim(d->>'altZh'), alt_zh), alt_en = coalesce(trim(d->>'altEn'), alt_en),
    caption_zh = case when d ? 'captionZh' then nullif(trim(d->>'captionZh'), '') else caption_zh end,
    caption_en = case when d ? 'captionEn' then nullif(trim(d->>'captionEn'), '') else caption_en end,
    credit = coalesce(nullif(trim(d->>'credit'), ''), credit), license = coalesce(nullif(trim(d->>'license'), ''), license),
    source_url = case when d ? 'sourceUrl' then nullif(trim(d->>'sourceUrl'), '') else source_url end
  where id = p_id returning * into asset;
  if p_decision = 'approved' and (trim(asset.alt_zh) = '' or trim(asset.alt_en) = '' or trim(asset.credit) = '' or trim(asset.license) = '') then
    raise exception 'asset_details_required' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and length(trim(coalesce(p_note, ''))) = 0 then raise exception 'reason_required' using errcode = '22023'; end if;
  if p_decision = 'approved' and before_status = 'approved' then null;
  elsif p_decision <> 'approved' and exists (select 1 from public.entries e where e.deleted_at is null and e.published_revision_number is not null
    and (e.hero_asset_id = p_id or exists (select 1 from public.entry_revision_bodies b where b.revision_id = e.id || '@r' || e.published_revision_number
      and b.body like '%](asset:' || p_id || ')%'))) then
    raise exception 'asset_in_published_entry' using errcode = '40001';
  end if;
  update public.assets set review_status = p_decision, review_note = nullif(trim(coalesce(p_note, '')), ''),
    reviewed_by = auth.uid(), reviewed_at = now() where id = p_id returning * into asset;
  perform public.pw_audit_insert('review_' || p_decision, 'asset', p_id, jsonb_build_object('status', before_status),
    jsonb_build_object('status', p_decision, 'note', nullif(trim(coalesce(p_note, '')), '')));
  return to_jsonb(asset);
end;
$$;

-- Images for the review desk, with the entries that place them.
create or replace function public.pw_admin_list_assets(p_status text[] default '{pending}', p_text text default '', p_limit integer default 24, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  q text := lower(trim(coalesce(p_text, '')));
  result jsonb;
begin
  perform public.pw_raise_unless_admin();
  with base as (
    select a.*, p.handle owner_handle from public.assets a left join public.profiles p on p.id = a.owner_id
    where (coalesce(cardinality(p_status), 0) = 0 or a.review_status = any(p_status))
      and (q = '' or strpos(lower(concat_ws(' ', a.id, a.alt_zh, a.alt_en, a.credit, a.license, p.handle)), q) > 0)
  )
  select jsonb_build_object('total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(row_data order by created_at desc, id) from (
      select b.created_at, b.id, to_jsonb(b) || jsonb_build_object('usedBy', coalesce(used.list, '[]'::jsonb)) row_data
      from base b
      left join lateral (
        select jsonb_agg(jsonb_build_object('id', e.id, 'slug', e.slug,
          'published', e.published_revision_number is not null and (e.hero_asset_id = b.id or exists (
            select 1 from public.entry_revision_bodies pb
            where pb.revision_id = e.id || '@r' || e.published_revision_number and pb.body like '%](asset:' || b.id || ')%')))
          order by e.id) list
        from public.entries e
        where e.hero_asset_id = b.id
          or exists (select 1 from public.entry_revision_bodies lb
            where lb.revision_id in (e.id || '@r' || e.latest_revision_number, e.id || '@r' || e.published_revision_number)
              and lb.body like '%](asset:' || b.id || ')%')
          or exists (select 1 from public.entry_revisions lr
            where lr.id = e.id || '@r' || e.latest_revision_number and lr.metadata->>'heroAssetId' = b.id)
      ) used on true
      order by b.created_at desc, b.id
      limit greatest(1, least(coalesce(p_limit, 24), 100)) offset greatest(0, coalesce(p_offset, 0))
    ) page), '[]'::jsonb)) into result;
  return result;
end;
$$;

/*
 * Stored files nothing points at any more: article images without a record,
 * older than a day, and page images no member and no member version uses.
 * Files any revision or version references are never listed.
 */
create or replace function public.pw_admin_orphan_objects()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.pw_raise_unless_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'name', o.name, 'createdAt', o.created_at,
      'size', (o.metadata->>'size')::bigint) order by o.created_at)
    from storage.objects o
    where o.created_at < now() - interval '1 day' and (
      (o.bucket_id = 'entry-assets' and not exists (select 1 from public.assets a where a.bucket = 'entry-assets' and a.object_path = o.name))
      or (o.bucket_id = 'member-covers'
        and not exists (select 1 from public.members m where m.cover_src like '%/' || o.name)
        and not exists (select 1 from public.content_versions v where v.kind = 'member' and v.data->>'cover_src' like '%/' || o.name))
    )), '[]'::jsonb);
end;
$$;

revoke execute on function public.pw_upload_allowance(text), public.pw_register_entry_asset(text, integer, integer, jsonb),
  public.pw_update_asset_details(text, jsonb), public.pw_admin_review_asset(text, text, text, jsonb),
  public.pw_admin_list_assets(text[], text, integer, integer), public.pw_admin_orphan_objects() from public, anon;
grant execute on function public.pw_upload_allowance(text), public.pw_register_entry_asset(text, integer, integer, jsonb),
  public.pw_update_asset_details(text, jsonb), public.pw_admin_review_asset(text, text, text, jsonb),
  public.pw_admin_list_assets(text[], text, integer, integer), public.pw_admin_orphan_objects() to authenticated;

-- Member page images keep a record, so cleaning can tell what is in use.
drop policy if exists "owner media insert" on public.media_assets;
drop policy if exists "owner media update" on public.media_assets;
revoke insert, update, delete on public.media_assets from anon, authenticated;
create or replace function public.pw_register_cover_media(p_object_path text, p_width integer, p_height integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.pw_upload_allowance('cover');
  insert into public.media_assets(owner_id, object_path, bucket, width, height, content_type)
  values (auth.uid(), p_object_path, 'member-covers', p_width, p_height, 'image/webp')
  on conflict (object_path) do nothing;
end;
$$;
revoke execute on function public.pw_register_cover_media(text, integer, integer) from public, anon;
grant execute on function public.pw_register_cover_media(text, integer, integer) to authenticated;

-- ── Request throttles ───────────────────────────────────────────────────────

/*
 * Fixed-window counters for requests that send email or try passwords. The
 * key is a server-side hash of the client address, never the address itself;
 * limits live here so a caller cannot choose its own. One row per key, so the
 * table stays small; stale windows are cleared as they are touched.
 */
create table if not exists public.request_throttle (
  bucket text not null,
  key text not null,
  window_start timestamptz not null,
  hits integer not null,
  primary key (bucket, key)
);
alter table public.request_throttle enable row level security;
revoke all on public.request_throttle from anon, authenticated;

create or replace function public.pw_throttle(p_bucket text, p_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  max_hits integer;
  span interval;
  row_ public.request_throttle;
begin
  select l.max_hits, l.span into max_hits, span from (values
    ('signup', 5, interval '1 hour'), ('resend', 5, interval '1 hour'), ('recover', 5, interval '1 hour'),
    ('login', 20, interval '10 minutes'), ('email_change', 5, interval '1 hour'), ('password', 10, interval '10 minutes')
  ) l(bucket, max_hits, span) where l.bucket = p_bucket;
  if max_hits is null or p_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid_throttle' using errcode = '22023'; end if;
  insert into public.request_throttle(bucket, key, window_start, hits) values (p_bucket, p_key, now(), 1)
  on conflict (bucket, key) do update set
    hits = case when public.request_throttle.window_start < now() - span then 1 else public.request_throttle.hits + 1 end,
    window_start = case when public.request_throttle.window_start < now() - span then now() else public.request_throttle.window_start end
  returning * into row_;
  if random() < 0.02 then delete from public.request_throttle where window_start < now() - interval '1 day'; end if;
  return row_.hits <= max_hits;
end;
$$;
revoke execute on function public.pw_throttle(text, text) from public;
grant execute on function public.pw_throttle(text, text) to anon, authenticated;

-- ── Readiness and audit ─────────────────────────────────────────────────────

-- The schema the application expects; the readiness probe compares it.
create or replace function public.pw_ready()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('schema', '202610140004');
$$;
revoke execute on function public.pw_ready() from public;
grant execute on function public.pw_ready() to anon, authenticated;

create index if not exists audit_logs_object_idx on public.audit_logs (object_type, object_id, created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

create or replace function public.pw_admin_list_audit(
  p_object_type text default null, p_object_id text default null, p_action text default null,
  p_limit integer default 50, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  perform public.pw_raise_unless_admin();
  with base as (
    select l.*, p.handle actor_handle, p.display_name_zh actor_zh, p.display_name_en actor_en
    from public.audit_logs l left join public.profiles p on p.id = l.actor_id
    where (p_object_type is null or l.object_type = p_object_type)
      and (p_object_id is null or l.object_id = p_object_id)
      and (p_action is null or l.action = p_action)
  )
  select jsonb_build_object('total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(row_data order by created_at desc, id desc) from (
      select b.created_at, b.id, jsonb_build_object('id', b.id, 'action', b.action, 'objectType', b.object_type, 'objectId', b.object_id,
        'actorId', b.actor_id, 'actorHandle', b.actor_handle,
        'actorName', case when b.actor_id is null then null else jsonb_build_object('zh', b.actor_zh, 'en', b.actor_en) end,
        'before', b.before_data, 'after', b.after_data, 'createdAt', b.created_at) row_data
      from base b order by b.created_at desc, b.id desc
      limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0))
    ) page), '[]'::jsonb)) into result;
  return result;
end;
$$;
revoke execute on function public.pw_admin_list_audit(text, text, text, integer, integer) from public, anon;
grant execute on function public.pw_admin_list_audit(text, text, text, integer, integer) to authenticated;
