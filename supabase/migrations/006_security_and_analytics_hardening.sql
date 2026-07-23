-- 诗三百：用户停用状态约束与匿名统计治理
-- 幂等迁移，不破坏已有数据；不修改现有迁移文件。
-- 变更摘要：
--   1. is_active_user() — 判断当前用户是否启用
--   2. update_own_profile — 拒绝停用（status=0）用户
--   3. favorites INSERT/DELETE 策略收紧为仅 active user
--   4. track_visitor_event — 同一会话+页面 30 秒内去重
--   5. admin_cleanup_visitor_events — 管理员清理旧事件
--   6. revoke/grant 精细化授权

-- ============================================================
-- 1. is_active_user()
--    返回 true 当且仅当当前认证用户存在 user_profiles
--    且 status = 1（启用）。
-- ============================================================
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.user_profiles
    where id = auth.uid() and status = 1
  )
$$;

-- ============================================================
-- 2. update_own_profile
--    在原有校验基础上，拒绝 status = 0（停用）的用户。
--    幂等替换：create or replace 不改变已有授权。
-- ============================================================
create or replace function public.update_own_profile(
  p_nickname text,
  p_avatar_url text default null,
  p_bio text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not public.is_active_user() then
    raise exception 'user is disabled';
  end if;

  if trim(coalesce(p_nickname, '')) = '' or char_length(trim(p_nickname)) > 40 then
    raise exception 'invalid nickname';
  end if;

  if char_length(coalesce(p_bio, '')) > 200 then
    raise exception 'bio too long';
  end if;

  update public.user_profiles
  set nickname    = trim(p_nickname),
      avatar_url  = nullif(trim(coalesce(p_avatar_url, '')), ''),
      bio         = nullif(trim(coalesce(p_bio, '')), ''),
      updated_at  = now()
  where id = auth.uid()
  returning to_jsonb(public.user_profiles.*) into v_result;

  if v_result is null then
    raise exception 'profile not found';
  end if;

  return v_result;
end $$;

-- ============================================================
-- 3. 收紧 favorites 策略——仅 active user 可写入/删除
-- ============================================================
drop policy if exists "users add own favorites" on public.favorites;
create policy "users add own favorites" on public.favorites
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and status = 1
    )
  );

drop policy if exists "users remove own favorites" on public.favorites;
create policy "users remove own favorites" on public.favorites
  for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and status = 1
    )
  );

-- ============================================================
-- 4. track_visitor_event — 去重增强
--    同一 session_id + page_path 在 30 秒内的重复事件
--    仅保留第一条，后续静默跳过。
-- ============================================================
create or replace function public.track_visitor_event(
  p_session_id uuid,
  p_path text,
  p_poem_id integer default null,
  p_referrer_host text default null,
  p_device_type text default 'desktop'
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_session_id is null or p_path is null or left(p_path, 1) <> '/' then
    raise exception 'invalid analytics payload';
  end if;

  if p_device_type not in ('desktop', 'tablet', 'mobile') then
    raise exception 'invalid device type';
  end if;

  -- 30 秒短时间去重：同一会话+路径在时间窗口内已存在则跳过
  if not exists (
    select 1
    from public.visitor_events
    where session_id = p_session_id
      and page_path = left(p_path, 200)
      and created_at > now() - interval '30 seconds'
  ) then
    insert into public.visitor_events
      (event_type, page_path, session_id, poem_id, referrer_host, device_type)
    values
      ('page_view',
       left(p_path, 200),
       p_session_id,
       p_poem_id,
       left(nullif(p_referrer_host, ''), 120),
       p_device_type);
  end if;
end $$;

-- ============================================================
-- 5. admin_cleanup_visitor_events
--    管理员按天清理历史事件记录。
--    p_older_than_days：默认 90 天，范围 1~730。
--    返回实际删除的行数。
-- ============================================================
create or replace function public.admin_cleanup_visitor_events(
  p_older_than_days integer default 90
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days    integer := greatest(1, least(coalesce(p_older_than_days, 90), 730));
  v_deleted bigint;
begin
  if not public.is_admin() then
    raise exception 'permission denied';
  end if;

  delete from public.visitor_events
  where created_at < now() - make_interval(days => v_days);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;

-- ============================================================
-- 6. revoke / grant
--    新函数授权；已有函数（update_own_profile、
--    track_visitor_event）显式重授确保状态清晰。
-- ============================================================

-- is_active_user() — 仅供已认证用户使用
revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

-- update_own_profile — 重新授权（原有 005 授权不变，显式重申）
revoke all on function public.update_own_profile(text,text,text) from public, anon;
grant execute on function public.update_own_profile(text,text,text) to authenticated;

-- track_visitor_event — 匿名&已认证均可调用（同 003）
revoke all on function public.track_visitor_event(uuid,text,integer,text,text) from public, anon;
grant execute on function public.track_visitor_event(uuid,text,integer,text,text) to anon, authenticated;

-- admin_cleanup_visitor_events — 仅已认证（函数内再校验 is_admin）
revoke all on function public.admin_cleanup_visitor_events(integer) from public, anon;
grant execute on function public.admin_cleanup_visitor_events(integer) to authenticated;
