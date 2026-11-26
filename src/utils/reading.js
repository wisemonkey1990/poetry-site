/**
 * 详情页阅读数据：优先使用构建期预计算的拼音表与繁体文本，
 * 仅当内容不匹配（如云端编辑过的诗文）时才动态加载 pinyin-pro / opencc-js。
 */
import { HAN_CHAR, renderRuby } from "./pinyin-ruby.js";
import { hashLines, hashText } from "./reading-hash.js";
import pinyinTable from "../data/pinyin-table.json";

// 每首诗一个懒加载分块，只有切换繁体时才会请求当前诗篇的那一个
const readingChunks = import.meta.glob("../data/reading/*.json", { import: "default" });

async function loadPrecomputed(id) {
  const load = readingChunks[`../data/reading/${id}.json`];
  if (!load) return null;
  try { return await load(); } catch { return null; }
}

/**
 * 获取繁体标题与正文。
 * @param {{ id: number, title: string, content: string[] }} poem
 * @returns {Promise<{ title: string, lines: string[] }>}
 */
export async function getTraditionalText(poem) {
  const data = await loadPrecomputed(poem.id);
  const lines = data && data.h === hashLines(poem.content) ? data.lines : null;
  const title = data && data.th === hashText(String(poem.title)) ? data.title : null;
  if (lines && title != null) return { title, lines };
  const { convertLines } = await import("./text-convert.js");
  const [body, head] = await Promise.all([
    lines ? { lines } : convertLines(poem.content, "s2t"),
    title != null ? { lines: [title] } : convertLines([poem.title], "s2t")
  ]);
  return { title: head.lines[0], lines: body.lines };
}

/**
 * 获取这首诗每句的注音（国学梦数据 + 纸质书校正，预计算在 reading/<id>.json 的 py 字段）。
 * 诗文哈希对不上（内容被改过但没重新生成）时返回 null，渲染回退到拼音表。
 * @param {{ id: number, content: string[] }} poem
 * @returns {Promise<string[][] | null>} 每句一个音节数组，与简体正文的汉字逐一对应
 */
export async function getPoemPinyin(poem) {
  const data = await loadPrecomputed(poem.id);
  if (!data || data.h !== hashLines(poem.content) || !Array.isArray(data.py)) return null;
  return data.py.map((line) => line.split(" "));
}

/**
 * 将若干诗句渲染为 ruby HTML。
 * @param {string[]} lines
 * @param {string[][] | null} [pinyinLines] 每句的注音（getPoemPinyin）；某句汉字数对不上时该句回退到拼音表
 * @returns {Promise<string[]>}
 */
export async function renderRubyLines(lines, pinyinLines = null) {
  const missing = lines.some((line) => Array.from(String(line)).some((ch) => HAN_CHAR.test(ch) && !(ch in pinyinTable)));
  let fallback = null;
  if (missing) fallback = (await import("./pinyin.js")).charPinyin;
  const getTone = (ch) => pinyinTable[ch] ?? fallback(ch);
  return lines.map((line, i) => renderRuby(String(line), getTone, pinyinLines?.[i]));
}
