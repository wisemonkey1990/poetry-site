// 诗文唯一数据源：src/data/poems.json（随站点打包）。
// 懒加载以避免 480KB+ JSON 常驻首屏 bundle。
let localPoemsPromise = null;
function loadLocalPoems() {
  if (!localPoemsPromise) localPoemsPromise = import("../data/poems.json").then((m) => m.default);
  return localPoemsPromise;
}

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

let poemsPromise = null;

export function getPoems() {
  if (!poemsPromise) {
    poemsPromise = loadLocalPoems()
      .then((poems) => poems.map(normalizePoem).sort((a, b) => a.sort_order - b.sort_order))
      .catch((error) => { poemsPromise = null; throw error; });
  }
  return poemsPromise;
}

export async function getPoemById(id) {
  const numericId = Number(id);
  const poems = await getPoems();
  return poems.find((poem) => poem.id === numericId) ?? null;
}
