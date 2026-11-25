/**
 * 预计算阅读数据：
 *  - src/data/pinyin-table.json     汉字 -> 拼音（单字，与 pinyin.js 的 charPinyin 一致）
 *  - src/data/reading/<id>.json     每首诗的繁体标题/正文（opencc cn -> twp），附内容哈希用于校验
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src/data");
const readingDir = path.join(dataDir, "reading");
const poems = JSON.parse(fs.readFileSync(path.join(dataDir, "poems.json"), "utf8"));
const toTraditional = Converter({ from: "cn", to: "twp" });

fs.rmSync(readingDir, { recursive: true, force: true });
fs.mkdirSync(readingDir, { recursive: true });

const chars = new Set();
const collect = (text) => { for (const ch of Array.from(text)) if (HAN_CHAR.test(ch)) chars.add(ch); };

for (const poem of poems) {
  const content = poem.content.map(String);
  const title = String(poem.title);
  const tradContent = content.map((line) => toTraditional(line));
  const tradTitle = toTraditional(title);
  content.forEach(collect);
  tradContent.forEach(collect);
  fs.writeFileSync(
    path.join(readingDir, `${poem.id}.json`),
    `${JSON.stringify({ h: hashLines(content), th: hashText(title), lines: tradContent, title: tradTitle })}\n`
  );
}

const table = {};
for (const ch of [...chars].sort()) table[ch] = charPinyin(ch);
fs.writeFileSync(path.join(dataDir, "pinyin-table.json"), `${JSON.stringify(table)}\n`);
console.log(`reading data: ${poems.length} poems, ${chars.size} unique characters`);
