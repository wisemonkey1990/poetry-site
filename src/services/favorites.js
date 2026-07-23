import { supabase } from "../lib/supabase.js";
import { getCurrentUser } from "./auth.js";

const LEGACY_KEY = "shijing_favorites";
const MIGRATED_KEY = "shijing_favorites_migrated";

function requireUser() {
  const user = getCurrentUser();
  if (!user) throw new Error("请先登录后再收藏诗篇");
  if (!supabase) throw new Error("Supabase 尚未配置");
  return user;
}

export async function getFavoriteIds() {
  const user = requireUser();
  const { data, error } = await supabase.from("favorites").select("poem_id").eq("user_id", user.id);
  if (error) throw error;
  return data.map((item) => item.poem_id);
}

export async function getFavoritePoems() {
  const user = requireUser();
  const { data, error } = await supabase
    .from("favorites")
    .select("id, poem_id, created_at, poem:poems(id, slug, title, chapter, section, content, annotation, translation, sort_order, is_published)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).filter((item) => item.poem?.is_published !== false);
}

export async function isFavorite(poemId) {
  const user = getCurrentUser();
  if (!user || !supabase) return false;
  const { data, error } = await supabase.from("favorites").select("id").eq("user_id", user.id).eq("poem_id", poemId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function addFavorite(poemId) {
  const user = requireUser();
  const { error } = await supabase.from("favorites").upsert({ user_id: user.id, poem_id: poemId }, { onConflict: "user_id,poem_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeFavorite(poemId) {
  const user = requireUser();
  const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq("poem_id", poemId);
  if (error) throw error;
}

export async function toggleFavorite(poemId, currentlyFavorite) {
  if (currentlyFavorite) await removeFavorite(poemId);
  else await addFavorite(poemId);
  return !currentlyFavorite;
}

export async function migrateLegacyFavorites() {
  const user = getCurrentUser();
  if (!user || !supabase || localStorage.getItem(`${MIGRATED_KEY}:${user.id}`)) return 0;
  const stored = localStorage.getItem(LEGACY_KEY) || "[]";
  const ids = (() => { try { return JSON.parse(stored).filter(Number.isInteger); } catch { return []; } })();
  if (ids.length) {
    const rows = [...new Set(ids)].map((poemId) => ({ user_id: user.id, poem_id: poemId }));
    const { error } = await supabase.from("favorites").upsert(rows, { onConflict: "user_id,poem_id", ignoreDuplicates: true });
    if (error) throw error;
  }
  localStorage.setItem(`${MIGRATED_KEY}:${user.id}`, "true");
  localStorage.removeItem(LEGACY_KEY);
  return ids.length;
}
