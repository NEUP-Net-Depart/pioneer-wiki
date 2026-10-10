create or replace function public.pw_forum_identity()
returns table(author_name text, member_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pw_account_active() then raise exception 'verified_account_required' using errcode = '42501'; end if;
  return query
    select coalesce(nullif(trim(m.name_zh), ''), '@' || p.handle), m.id
    from public.profiles p
    left join public.members m on m.id = p.member_id and m.archived_at is null
    where p.id = auth.uid();
  if not found then raise exception 'profile_required' using errcode = '42501'; end if;
end;
$$;
