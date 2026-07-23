import localPoems from "../data/poems.json";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

let publicCache = null;
let publicDataState = { source: isSupabaseConfigured ? "cloud" : "local", stale: false, message: "" };

function normalizePoem(poem) {
  if (!poem) return null;
  let content = poem.content;
  if (typeof content === "string") {
    try { content = JSON.parse(content); } catch { content = content.split(/\r?\n/); }
  }
  return {
    ...poem,
    id: Number(poem.id),
    content: Array.isArray(content) ? content.filter(Boolean) : [],
    sort_order: Number(poem.sort_order ?? poem.id ?? 0),
    is_published: poem.is_published !== false,
  };
}

function localPublished() {
  return localPoems.map(normalizePoem).sort((a, b) => a.sort_order - b.sort_order);
}

function useLocalFallback() {
  publicDataState = {
    source: "local",
    stale: isSupabaseConfigured,
    message: isSupabaseConfigured ? "网络暂不可用，当前显示离线典藏版本。" : "",
  };
  return localPublished();
}

export function getPoemDataState() { return { ...publicDataState }; }
export function clearPoemCache() { publicCache = null; }

export async function getPoems({ refresh = false } = {}) {
  if (!refresh && publicCache) return publicCache;
  if (!isSupabaseConfigured) return useLocalFallback();
  const { data, error } = await supabase.from("poems").select("*")
    .eq("is_published", true).order("sort_order").order("id");
  if (error) {
    console.warn("诗篇云端数据暂不可用，已读取本地数据。");
    return useLocalFallback();
  }
  publicCache = (data ?? []).map(normalizePoem);
  publicDataState = { source: "cloud", stale: false, message: "" };
  return publicCache;
}

export async function getPoemById(id) {
  const numericId = Number(id);
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from("poems").select("*")
      .eq("id", numericId).eq("is_published", true).maybeSingle();
    if (!error) {
      publicDataState = { source: "cloud", stale: false, message: "" };
      return data ? normalizePoem(data) : null;
    }
    console.warn("诗篇云端详情暂不可用，已读取本地数据。");
    useLocalFallback();
  }
  return localPublished().find((poem) => poem.id === numericId) ?? null;
}

export async function adminListPoems({ page = 1, pageSize = 20, search = "", isPublished } = {}) {
  if (!isSupabaseConfigured) throw new Error("Supabase 尚未配置");
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
  let query = supabase.from("poems").select("*", { count: "exact" })
    .order("sort_order").order("id");
  const term = String(search).trim().replace(/[%_,()]/g, "");
  if (term) query = query.or(`title.ilike.%${term}%,chapter.ilike.%${term}%,section.ilike.%${term}%`);
  if (typeof isPublished === "boolean") query = query.eq("is_published", isPublished);
  const from = (safePage - 1) * safeSize;
  const { data, error, count } = await query.range(from, from + safeSize - 1);
  if (error) throw error;
  return { data: (data ?? []).map(normalizePoem), total: count ?? 0, page: safePage, pageSize: safeSize };
}

export async function getAdminPoemById(id) {
  if (!isSupabaseConfigured) throw new Error("Supabase 尚未配置");
  const { data, error } = await supabase.from("poems").select("*").eq("id", Number(id)).maybeSingle();
  if (error) throw error;
  return normalizePoem(data);
}
function validatePoem(poem) {
  const title = String(poem.title ?? "").trim();
  const chapter = String(poem.chapter ?? "").trim();
  const section = String(poem.section ?? "").trim();
  const content = Array.isArray(poem.content)
    ? poem.content.map((line) => String(line).trim()).filter(Boolean)
    : String(poem.content ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!title) throw new Error("请填写诗篇题目");
  if (!chapter || !section) throw new Error("请填写所属章卷和小节");
  if (!content.length) throw new Error("正文至少需要一行");
  return {
    title: title.slice(0, 100), chapter: chapter.slice(0, 20), section: section.slice(0, 50), content,
    annotation: String(poem.annotation ?? "").trim() || null,
    translation: String(poem.translation ?? "").trim() || null,
    sort_order: Math.max(0, Number(poem.sort_order) || 0),
    is_published: Boolean(poem.is_published),
  };
}

function slugFromPoem(poem, id = Date.now()) {
  const slug = String(poem.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return slug || `poem-${id}`;
}

export async function savePoem(poem) {
  if (!isSupabaseConfigured) throw new Error("Supabase 尚未配置");
  const record = validatePoem(poem);
  record.updated_at = new Date().toISOString();
  if (poem.id) {
    record.slug = slugFromPoem(poem, poem.id);
    const { data, error } = await supabase.from("poems").update(record).eq("id", Number(poem.id)).select().single();
    if (error) throw error;
    clearPoemCache();
    return normalizePoem(data);
  }
  record.slug = slugFromPoem(poem);
  const { data, error } = await supabase.from("poems").insert(record).select().single();
  if (error) throw error;
  clearPoemCache();
  return normalizePoem(data);
}

export async function deletePoem(id) {
  if (!isSupabaseConfigured) throw new Error("Supabase 尚未配置");
  const poem = await getAdminPoemById(id);
  if (!poem) throw new Error("诗篇不存在");
  if (poem.is_published) throw new Error("已发布诗篇不能删除，请先取消发布");
  const { error } = await supabase.from("poems").delete().eq("id", Number(id));
  if (error) throw error;
  clearPoemCache();
}

export { validatePoem };