-- 诗三百：后台用户资料管理（不创建或删除 Supabase Auth 登录账号）
-- 所有函数均校验管理员白名单；邮箱仅通过管理员 RPC 返回。

create or replace function public.admin_list_user_profiles(
  p_search text default '',
  p_status smallint default null,
  p_page integer default 1,
  p_page_size integer default 20
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_size integer := greatest(1, least(coalesce(p_page_size, 20), 100));
  v_search text := trim(coalesce(p_search, ''));
  v_total bigint;
  v_items jsonb;
begin
  if not public.is_admin() then raise exception 'permission denied'; end if;
  if p_status is not null and p_status not in (0, 1) then raise exception 'invalid status'; end if;

  select count(*) into v_total
  from public.user_profiles p join auth.users u on u.id = p.id
  where (p_status is null or p.status = p_status)
    and (v_search = '' or p.nickname ilike '%' || v_search || '%' or p.id::text ilike '%' || v_search || '%'
      or coalesce(u.email, '') ilike '%' || v_search || '%');

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) into v_items
  from (
    select p.id, u.email, p.nickname, p.avatar_url, p.bio, p.status, p.created_at, p.updated_at,
      count(f.id)::integer as favorite_count
    from public.user_profiles p join auth.users u on u.id = p.id
    left join public.favorites f on f.user_id = p.id
    where (p_status is null or p.status = p_status)
      and (v_search = '' or p.nickname ilike '%' || v_search || '%' or p.id::text ilike '%' || v_search || '%'
        or coalesce(u.email, '') ilike '%' || v_search || '%')
    group by p.id, u.email
    order by p.created_at desc
    limit v_size offset (v_page - 1) * v_size
  ) x;

  return jsonb_build_object('items', v_items, 'total', v_total, 'page', v_page, 'page_size', v_size);
end $$;

create or replace function public.admin_get_user_profile(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'permission denied'; end if;
  select to_jsonb(x) into v_result from (
    select p.id, u.email, p.nickname, p.avatar_url, p.bio, p.status, p.created_at, p.updated_at,
      count(f.id)::integer as favorite_count
    from public.user_profiles p join auth.users u on u.id = p.id
    left join public.favorites f on f.user_id = p.id
    where p.id = p_user_id group by p.id, u.email
  ) x;
  if v_result is null then raise exception 'profile not found'; end if;
  return v_result;
end $$;

create or replace function public.admin_upsert_user_profile(
  p_user_id uuid,
  p_nickname text,
  p_avatar_url text default null,
  p_bio text default null,
  p_status smallint default 1
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'permission denied'; end if;
  if p_user_id is null then raise exception 'user id is required'; end if;
  if not exists(select 1 from auth.users where id = p_user_id) then raise exception 'auth user not found'; end if;
  if trim(coalesce(p_nickname, '')) = '' or char_length(trim(p_nickname)) > 40 then raise exception 'invalid nickname'; end if;
  if p_status not in (0, 1) then raise exception 'invalid status'; end if;
  if char_length(coalesce(p_bio, '')) > 200 then raise exception 'bio too long'; end if;

  insert into public.user_profiles(id, nickname, avatar_url, bio, status)
  values (p_user_id, trim(p_nickname), nullif(trim(coalesce(p_avatar_url, '')), ''), nullif(trim(coalesce(p_bio, '')), ''), p_status)
  on conflict (id) do update set nickname = excluded.nickname, avatar_url = excluded.avatar_url,
    bio = excluded.bio, status = excluded.status, updated_at = now()
  returning to_jsonb(public.user_profiles.*) into v_result;
  return v_result;
end $$;

create or replace function public.admin_delete_user_profile(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'permission denied'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot delete your own profile'; end if;
  delete from public.user_profiles where id = p_user_id;
  if not found then raise exception 'profile not found'; end if;
end $$;

create or replace function public.update_own_profile(
  p_nickname text,
  p_avatar_url text default null,
  p_bio text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if trim(coalesce(p_nickname, '')) = '' or char_length(trim(p_nickname)) > 40 then raise exception 'invalid nickname'; end if;
  if char_length(coalesce(p_bio, '')) > 200 then raise exception 'bio too long'; end if;
  update public.user_profiles set nickname = trim(p_nickname),
    avatar_url = nullif(trim(coalesce(p_avatar_url, '')), ''),
    bio = nullif(trim(coalesce(p_bio, '')), ''), updated_at = now()
  where id = auth.uid()
  returning to_jsonb(public.user_profiles.*) into v_result;
  if v_result is null then raise exception 'profile not found'; end if;
  return v_result;
end $$;

drop policy if exists "users update own profile" on public.user_profiles;
revoke update on public.user_profiles from authenticated;

revoke all on function public.admin_list_user_profiles(text,smallint,integer,integer) from public, anon;
revoke all on function public.admin_get_user_profile(uuid) from public, anon;
revoke all on function public.admin_upsert_user_profile(uuid,text,text,text,smallint) from public, anon;
revoke all on function public.admin_delete_user_profile(uuid) from public, anon;
revoke all on function public.update_own_profile(text,text,text) from public, anon;
grant execute on function public.admin_list_user_profiles(text,smallint,integer,integer) to authenticated;
grant execute on function public.admin_get_user_profile(uuid) to authenticated;
grant execute on function public.admin_upsert_user_profile(uuid,text,text,text,smallint) to authenticated;
grant execute on function public.admin_delete_user_profile(uuid) to authenticated;

grant execute on function public.update_own_profile(text,text,text) to authenticated;