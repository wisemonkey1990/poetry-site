import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { getCurrentUser } from "./auth.js";

function ensureConfigured() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase 尚未配置");
}

export async function isCurrentUserAdmin() {
  ensureConfigured();
  const user = getCurrentUser();
  if (!user) return false;
  const { data, error } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export async function requireAdmin({ redirect = true } = {}) {
  const allowed = await isCurrentUserAdmin();
  if (!allowed && redirect) window.location.hash = "#/admin/login";
  return allowed;
}

function unwrapRpc(data) {
  if (Array.isArray(data) && data.length === 1 && data[0]?.result) return data[0].result;
  return data ?? {};
}

export async function getDashboard(days = 7) {
  ensureConfigured();
  const safeDays = Number(days) === 30 ? 30 : 7;
  const { data, error } = await supabase.rpc("get_admin_dashboard", { p_days: safeDays });
  if (error) throw error;
  const value = unwrapRpc(data);
  return {
    days: safeDays,
    pv: Number(value.pv ?? 0), uv: Number(value.uv ?? 0),
    todayPv: Number(value.today_pv ?? value.todayPv ?? 0),
    todayUv: Number(value.today_uv ?? value.todayUv ?? 0),
    hotPoems: value.hot_poems ?? value.hotPoems ?? [],
    sources: value.sources ?? [], devices: value.devices ?? [],
  };
}

export async function getTimeseries(days = 7) {
  ensureConfigured();
  const safeDays = Number(days) === 30 ? 30 : 7;
  const { data, error } = await supabase.rpc("get_admin_timeseries", { p_days: safeDays });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : unwrapRpc(data)?.items ?? [];
  return rows.map((item) => ({ date: item.day ?? item.date, pv: Number(item.pv ?? 0), uv: Number(item.uv ?? 0) }));
}