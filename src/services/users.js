import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

function ensureConfigured() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase 尚未配置");
}

function translateError(error) {
  const message = error?.message || "用户资料操作失败";
  if (/could not find the function|schema cache|PGRST202/i.test(`${message} ${error?.code || ""}`)) return new Error("用户管理数据库迁移尚未生效：请在 Supabase SQL Editor 执行 005_admin_user_profiles.sql，然后刷新 API schema cache");
  if (/auth user not found/i.test(message)) return new Error("未找到对应的登录账号，请从 Supabase Authentication → Users 复制 User UID");
  if (/profile not found/i.test(message)) return new Error("用户资料不存在或已经删除");
  if (/cannot delete your own profile/i.test(message)) return new Error("不能删除当前管理员自己的用户资料");
  if (/invalid nickname/i.test(message)) return new Error("昵称不能为空且不能超过 40 个字符");
  if (/bio too long/i.test(message)) return new Error("个人简介不能超过 200 个字符");
  if (/user is disabled/i.test(message)) return new Error("该用户已停用，无法执行此操作");
  if (/permission denied/i.test(message)) return new Error("当前账号没有用户管理权限");
  return error instanceof Error ? error : new Error(message);
}

export async function listUserProfiles({ page = 1, pageSize = 20, search = "", status = null } = {}) {
  ensureConfigured();
  const { data, error } = await supabase.rpc("admin_list_user_profiles", {
    p_search: search.trim(), p_status: status, p_page: page, p_page_size: pageSize,
  });
  if (error) throw translateError(error);
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: Number(data?.total ?? 0),
    page: Number(data?.page ?? page),
    pageSize: Number(data?.page_size ?? pageSize),
  };
}

export async function getUserProfile(userId) {
  ensureConfigured();
  const { data, error } = await supabase.rpc("admin_get_user_profile", { p_user_id: userId });
  if (error) throw translateError(error);
  return data;
}

export async function saveUserProfile({ id, nickname, avatarUrl, bio, status }) {
  ensureConfigured();
  const { data, error } = await supabase.rpc("admin_upsert_user_profile", {
    p_user_id: id, p_nickname: nickname, p_avatar_url: avatarUrl || null,
    p_bio: bio || null, p_status: Number(status),
  });
  if (error) throw translateError(error);
  return data;
}

export async function deleteUserProfile(userId) {
  ensureConfigured();
  const { error } = await supabase.rpc("admin_delete_user_profile", { p_user_id: userId });
  if (error) throw translateError(error);
}
