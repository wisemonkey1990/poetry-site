/**
 * 用国学梦数据（data-sources/guoxuemeng-shijing.json，由 scripts/scrape-guoxuemeng.py 生成）更新 src/data/poems.json 的诗文。
 *
 * - 只替换 content（正文）；标题、分类、注释、今译保持不变。
 * - content 的分段沿用 poems.json 现有结构：按每段的汉字数把国学梦正文重新切开（标点用国学梦的）。
 * - 同时把每首诗的 id 写回数据文件（按「篇名」匹配，异体篇名按章内顺序匹配），供 generate-reading-data.mjs 取注音。
 * 用法：node scripts/import-guoxuemeng.mjs [--dry-run]
 * 之后运行 npm run reading:generate。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFile = path.join(root, "data-sources/guoxuemeng-shijing.json");
const poemsFile = path.join(root, "src/data/poems.json");
const HAN = /[㐀-鿿]/u;

const source = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
const poems = JSON.parse(fs.readFileSync(poemsFile, "utf8"));
const dryRun = process.argv.includes("--dry-run");

const sectionKey = (chapter, section) => `${chapter}|${chapter === "商颂" ? "" : section}`;

/** gid -> poem：先按已有 id，再按篇名，最后按章内顺序 */
function matchPoems() {
  const byId = new Map(poems.map((p) => [p.id, p]));
  const result = new Map();
  const groupsPoems = new Map();
  const groupsSrc = new Map();
  for (const p of poems) (groupsPoems.get(sectionKey(p.chapter, p.section)) ?? groupsPoems.set(sectionKey(p.chapter, p.section), []).get(sectionKey(p.chapter, p.section))).push(p);
  for (const s of source.poems) {
    if (s.id != null) { result.set(s.gid, byId.get(s.id)); continue; }
    const k = sectionKey(s.chapter, s.section);
    (groupsSrc.get(k) ?? groupsSrc.set(k, []).get(k)).push(s);
  }
  for (const [k, list] of groupsSrc) {
    const free = (groupsPoems.get(k) ?? []).filter((p) => ![...result.values()].includes(p));
    if (free.length !== list.length) throw new Error(`${k}: 诗篇数不一致 ${free.length} vs ${list.length}`);
    const rest = [];
    for (const s of list) {
      const hit = free.find((p) => p.title === s.title);
      if (hit) { result.set(s.gid, hit); free.splice(free.indexOf(hit), 1); } else rest.push(s);
    }
    rest.forEach((s, i) => result.set(s.gid, free[i]));
  }
  return result;
}

/** 把 text 切成「汉字 + 后随标点」单元；开头的标点并入第一个单元 */
function toUnits(text) {
  const units = [];
  let lead = "";
  for (const ch of Array.from(text)) {
    if (HAN.test(ch)) units.push({ ch, tail: "", lead });
    else if (units.length) units[units.length - 1].tail += ch;
    else lead += ch;
    if (HAN.test(ch)) lead = "";
  }
  return units;
}

const matched = matchPoems();
const hanCount = (s) => Array.from(s).filter((c) => HAN.test(c)).length;
let changedPoems = 0;
let lastPunctKept = 0;
const report = [];
for (const s of source.poems) {
  const poem = matched.get(s.gid);
  const units = toUnits(s.text);
  if (units.length !== s.pinyin.length) throw new Error(`${s.title}: 汉字 ${units.length} 与音节 ${s.pinyin.length} 不一致`);
  const total = poem.content.reduce((n, line) => n + hanCount(line), 0);
  if (total !== units.length) throw new Error(`${poem.id} ${poem.title}: 汉字数变化 ${total} -> ${units.length}，需要人工处理分段`);
  let at = 0;
  const content = poem.content.map((line) => {
    const n = hanCount(line);
    const part = units.slice(at, at + n);
    at += n;
    return part.map((u) => u.lead + u.ch + u.tail).join("");
  });
  // 国学梦有些章末缺句末标点：保留原本的句末标点，不让段落以裸字结尾
  content.forEach((line, i) => {
    const old = poem.content[i];
    if (!HAN.test(Array.from(line).at(-1))) return;
    const tail = Array.from(old).at(-1);
    if (!HAN.test(tail)) { content[i] = line + tail; lastPunctKept += 1; }
  });
  if (content.some((line, i) => line !== poem.content[i])) { changedPoems += 1; report.push(poem.id); }
  poem.content = content;
  s.id = poem.id;
}

console.log(`${source.poems.length} 首已对应，${changedPoems} 首正文有变化，${lastPunctKept} 段沿用原句末标点`);
if (!dryRun) {
  fs.writeFileSync(poemsFile, `${JSON.stringify(poems, null, 2)}\n`);
  fs.writeFileSync(sourceFile, `${JSON.stringify(source, null, 1)}\n`);
}
