// 诗文唯一数据源：src/data/poems.json（随站点打包）。
// 构建时拆成三种按需加载的模块（见 scripts/poem-data-plugin.mjs）：
// - getPoemIndex()：轻量目录（标题、篇章、首句），首页、篇章页、翻篇用
// - getPoemById()：只加载这一首的完整数据
// - getPoems()：全部完整数据，只在全文搜索时才需要
export function normalizePoem(poem) {
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

const normalizeList = (poems) => poems.map(normalizePoem).sort((a, b) => a.sort_order - b.sort_order);

function cached(loader) {
  let promise = null;
  return () => {
    if (!promise) promise = loader().catch((error) => { promise = null; throw error; });
    return promise;
  };
}

/** 全部诗篇的完整数据（约 450KB），仅全文搜索使用 */
export const getPoems = cached(() => import("../data/poems.json").then((m) => normalizeList(m.default)));

/** 轻量目录：每首只有 id、标题、篇章、首句 */
export const getPoemIndex = cached(() => import("virtual:poem-index").then((m) => normalizeList(m.default)));

const poemCache = new Map();

/** 单篇完整数据；不存在时返回 null */
export async function getPoemById(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return null;
  if (!poemCache.has(numericId)) {
    const { default: loaders } = await import("virtual:poem-loaders");
    const load = loaders[String(numericId)];
    if (!load) return null;
    const promise = load().then((m) => normalizePoem(m.default)).catch((error) => { poemCache.delete(numericId); throw error; });
    poemCache.set(numericId, promise);
  }
  return poemCache.get(numericId);
}
