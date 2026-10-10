-- Member role and one-line bio are optional in the editor. Keep the database
-- validator aligned with the HTTP and mock adapters so blank values can save.
create or replace function public.pw_member_patch_ok(p jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare
  link jsonb;
begin
  if p ? 'name' and not public.pw_localized_ok(p->'name', 1, 40) then raise exception 'invalid_member_name' using errcode = '22023'; end if;
  if p ? 'role' and not public.pw_localized_ok(p->'role', 0, 40) then raise exception 'invalid_member_role' using errcode = '22023'; end if;
  if p ? 'bio' and not public.pw_localized_ok(p->'bio', 0, 160) then raise exception 'invalid_member_bio' using errcode = '22023'; end if;
  if p ? 'about' and (jsonb_typeof(p->'about') <> 'string' or length(p->>'about') > 20000) then raise exception 'invalid_member_about' using errcode = '22023'; end if;
  if p ? 'links' then
    if jsonb_typeof(p->'links') <> 'array' or jsonb_array_length(p->'links') > 8 then raise exception 'invalid_member_links' using errcode = '22023'; end if;
    for link in select x from jsonb_array_elements(p->'links') x loop
      if length(trim(coalesce(link->>'label', ''))) not between 1 and 32
        or not (public.pw_http_url_ok(link->>'url', 300) or coalesce(link->>'url', '') ~* '^mailto:[^\s@]+@[^\s@]+$')
      then raise exception 'invalid_member_links' using errcode = '22023'; end if;
    end loop;
  end if;
  if p ? 'github' and p->'github' <> 'null'::jsonb and coalesce(p->>'github', '') !~* '^([a-z\d][a-z\d-]{0,38})?$' then raise exception 'invalid_member_github' using errcode = '22023'; end if;
  if p ? 'projects' and (jsonb_typeof(p->'projects') <> 'array' or jsonb_array_length(p->'projects') > 8) then raise exception 'invalid_member_projects' using errcode = '22023'; end if;
  if p ? 'plate' then
    if p #>> '{plate,emblem}' is not null and (p #>> '{plate,emblem}') !~ '^ex-[a-z0-9-]+$' then raise exception 'invalid_member_plate' using errcode = '22023'; end if;
    if p #>> '{plate,ink}' is not null and p #>> '{plate,ink}' not in ('prussian', 'madder', 'sepia', 'verdigris', 'vermilion', 'violet', 'lampblack', 'ochre') then raise exception 'invalid_member_plate' using errcode = '22023'; end if;
    if p #>> '{plate,border}' is not null and p #>> '{plate,border}' not in ('vine', 'meander', 'rope', 'fleuron') then raise exception 'invalid_member_plate' using errcode = '22023'; end if;
    if length(coalesce(p #>> '{plate,motto}', '')) > 48 then raise exception 'invalid_member_plate' using errcode = '22023'; end if;
  end if;
  if p ? 'coverPrint' and coalesce(p->>'coverPrint', '') not in ('original', 'ink') then raise exception 'invalid_member_cover' using errcode = '22023'; end if;
end;
$$;
