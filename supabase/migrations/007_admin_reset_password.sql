-- 诗三百：后台重置用户密码
-- 需要在 Supabase SQL Editor 中手动执行一次。
-- 说明：前端不能持有 service_role 密钥，因此用 security definer 函数在数据库内完成重置，
--      并强制校验调用者是管理员。需要 pgcrypto 扩展（Supabase 默认安装在 extensions schema）。

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_reset_user_password(
  p_user_id uuid,
  p_new_password text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'permission denied'; end if;
  if p_user_id is null then raise exception 'user id is required'; end if;
  if char_length(coalesce(p_new_password, '')) < 8 or char_length(p_new_password) > 72 then
    raise exception 'invalid password';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'auth user not found'; end if;
  -- 不允许管理员重置其他管理员的密码，避免管理员之间越权
  if p_user_id <> auth.uid() and exists (select 1 from public.admin_users where user_id = p_user_id) then
    raise exception 'cannot reset another admin password';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_user_id;

  -- 让该用户已有的登录会话全部失效，必须用新密码重新登录
  delete from auth.sessions where user_id = p_user_id;
end $$;

revoke all on function public.admin_reset_user_password(uuid, text) from public, anon;
grant execute on function public.admin_reset_user_password(uuid, text) to authenticated;
