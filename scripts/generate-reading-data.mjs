/**
 * 预计算阅读数据：
 *  - src/data/pinyin-table.json     汉字 -> 拼音（单字，与 pinyin.js 的 charPinyin 一致）
 *  - src/data/reading/<id>.json     每首诗的繁体标题/正文（opencc cn -> twp），附内容哈希用于校验
 *    同时含 py：国学梦注音（data-sources/guoxuemeng-shijing.json），每行一个字符串、音节以空格分隔，与简体正文逐字对应；
 *    站长纸质书的校正（scripts/book-overrides.mjs）最后套用。繁体正文汉字数与简体一致时同样使用这份注音。
 * 详情页仅在诗文哈希匹配时使用；否则回退到运行时 pinyin-pro / opencc-js。
 * 用法：npm run reading:generate（改动 poems.json 后重新运行并提交产物）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Converter } from "opencc-js/cn2t";
import { charPinyin } from "../src/utils/pinyin.js";
import { HAN_CHAR } from "../src/utils/pinyin-ruby.js";
import { hashLines, hashText } from "../src/utils/reading-hash.js";
import { findOverrides } from "../src/utils/pinyin-overrides.js";
import { bookReadings, TITLE_READINGS } from "./book-overrides.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src/data");
const readingDir = path.join(dataDir, "reading");
const poems = JSON.parse(fs.readFileSync(path.join(dataDir, "poems.json"), "utf8"));
const toTraditional = Converter({ from: "cn", to: "twp" });
const gxm = JSON.parse(fs.readFileSync(path.join(root, "data-sources/guoxuemeng-shijing.json"), "utf8"));
const gxmById = new Map(gxm.poems.map((p) => [p.id, p]));

/**
 * 国学梦注音按每行汉字数切分，再套用纸质书校正。
 * 读者纠错（apply-correction）改过的字：与国学梦原字不同的位置用拼音表 + 多音字校正取读音，不沿用旧字的注音；
 * 汉字总数变了就整首不带 py（详情页回退到拼音表），不猜。
 */
function poemPinyin(poem) {
  const source = gxmById.get(poem.id);
  if (!source) throw new Error(`诗 ${poem.id} ${poem.title} 在国学梦数据里没有对应项`);
  const sourceChars = Array.from(source.text).filter((ch) => HAN_CHAR.test(ch));
  const total = poem.content.reduce((n, line) => n + Array.from(line).filter((ch) => HAN_CHAR.test(ch)).length, 0);
  if (total !== sourceChars.length) {
    console.warn(`诗 ${poem.id} ${poem.title}: 汉字数与国学梦不同（${total} / ${sourceChars.length}），不使用国学梦注音`);
    return null;
  }
  let at = 0;
  return poem.content.map((line) => {
    const all = Array.from(line);
    const chars = all.filter((ch) => HAN_CHAR.test(ch));
    const overrides = findOverrides(all);
    const hanAt = all.map((ch, i) => (HAN_CHAR.test(ch) ? i : -1)).filter((i) => i >= 0);
    const syllables = chars.map((ch, k) => (ch === sourceChars[at + k] ? source.pinyin[at + k] : overrides.get(hanAt[k]) ?? charPinyin(ch)));
    at += chars.length;
    for (const [i, tone] of bookReadings(chars)) syllables[i] = tone;
    return syllables.join(" ");
  });
}

/** 篇名注音：篇名校正表 > 多音字词规则 > 单字拼音；字数简繁一致，繁体标题共用 */
function titlePinyin(title) {
  const chars = Array.from(title);
  const fixed = TITLE_READINGS[title];
  if (fixed) {
    const syllables = fixed.split(" ");
    if (syllables.length !== chars.length) throw new Error(`篇名校正字数不符：${title}`);
    return syllables.join(" ");
  }
  const overrides = findOverrides(chars);
  return chars.map((ch, i) => (HAN_CHAR.test(ch) ? overrides.get(i) ?? charPinyin(ch) : ch)).join(" ");
}

fs.rmSync(readingDir, { recursive: true, force: true });
fs.mkdirSync(readingDir, { recursive: true });

const chars = new Set();
const collect = (text) => { for (const ch of Array.from(text)) if (HAN_CHAR.test(ch)) chars.add(ch); };

for (const poem of poems) {
  const content = poem.content.map(String);
  const title = String(poem.title);
  const tradContent = content.map((line) => toTraditional(line));
  const tradTitle = toTraditional(title);
  collect(title);
  collect(tradTitle);
  content.forEach(collect);
  tradContent.forEach(collect);
  const py = poemPinyin(poem);
  fs.writeFileSync(
    path.join(readingDir, `${poem.id}.json`),
    `${JSON.stringify({ h: hashLines(content), th: hashText(title), lines: tradContent, title: tradTitle, tp: titlePinyin(title), ...(py ? { py } : {}) })}\n`
  );
}

const table = {};
for (const ch of [...chars].sort()) table[ch] = charPinyin(ch);
fs.writeFileSync(path.join(dataDir, "pinyin-table.json"), `${JSON.stringify(table)}\n`);
console.log(`reading data: ${poems.length} poems, ${chars.size} unique characters`);
