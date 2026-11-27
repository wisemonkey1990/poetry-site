/**
 * 把 src/data/poems.json 拆成按需加载的虚拟模块，避免首页和阅读页下载全部 305 首（约 450KB）：
 * - virtual:poem-index    轻量目录：id、标题、篇章、首句（content 只留第一句），首页、篇章页、翻篇用
 * - virtual:poem-loaders  { [id]: () => import("virtual:poem/<id>") }
 * - virtual:poem/<id>     单篇完整数据（正文、注释、今译）
 * poems.json 仍是唯一数据源，仓库里不产生任何派生文件。
 */
import fs from "node:fs";
import path from "node:path";

const INDEX_ID = "virtual:poem-index";
const LOADERS_ID = "virtual:poem-loaders";
const POEM_RE = /^virtual:poem\/(\d+)$/;

export function toIndexEntry(poem) {
  const content = Array.isArray(poem.content) ? poem.content.slice(0, 1) : [];
  return { id: poem.id, title: poem.title, chapter: poem.chapter, section: poem.section, content, sort_order: poem.sort_order, is_published: poem.is_published };
}

export function poemDataPlugin({ root = process.cwd() } = {}) {
  const file = path.resolve(root, "src/data/poems.json");
  const read = () => JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    name: "shijing-poem-data",
    resolveId(id) {
      if (id === INDEX_ID || id === LOADERS_ID || POEM_RE.test(id)) return `\0${id}`;
      return null;
    },
    load(id) {
      if (!id.startsWith("\0virtual:poem")) return null;
      this.addWatchFile?.(file);
      const key = id.slice(1);
      const poems = read();
      if (key === INDEX_ID) return `export default ${JSON.stringify(poems.map(toIndexEntry))};`;
      if (key === LOADERS_ID) {
        const entries = poems.map((p) => `${JSON.stringify(String(p.id))}: () => import("virtual:poem/${p.id}")`);
        return `export default {\n${entries.join(",\n")}\n};`;
      }
      const poem = poems.find((p) => String(p.id) === POEM_RE.exec(key)[1]);
      return `export default ${JSON.stringify(poem ?? null)};`;
    },
  };
}
