/**
 * 用国学梦的今译和注释（data-sources/guoxuemeng-notes.json，由 scripts/scrape-guoxuemeng-notes.py 生成）更新 src/data/poems.json。
 *
 * - translation：全部换成国学梦第一种译文，每章一段（换行分隔）。
 * - annotation：国学梦有注释的篇目换成国学梦注释，一条一行；没有注释的篇目保留站内原注释。
 * - 每首诗记录出处 sources: { translation, annotation }（国学梦页面地址；annotation 为 null 表示仍是站内原注释）。
 * - 同时生成 docs/notes-pinyin-conflicts.md：注释里括号注明的读音和正文注音不一致的地方，供人工核对。
 *   正文注音按站长的规则（纸质书读音优先）不随注释改动。
 * 用法：node scripts/import-guoxuemeng-notes.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFile = path.join(root, "data-sources/guoxuemeng-notes.json");
const poemsFile = path.join(root, "src/data/poems.json");
const reportFile = path.join(root, "docs/notes-pinyin-conflicts.md");
const HAN = /[㐀-鿿]/gu;
const READING = /([㐀-鿿]{1,4})[(（]([a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüɡ ]+)[)）]/gu;

const dryRun = process.argv.includes("--dry-run");
const source = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
const poems = JSON.parse(fs.readFileSync(poemsFile, "utf8"));
const byId = new Map(poems.map((p) => [p.id, p]));
const normalize = (s) => s.normalize("NFC").trim().toLowerCase().replace(/ɡ/g, "g");

/** 这首诗正文里每个字显示的读音集合（取预计算的 reading/<id>.json） */
function displayedReadings(poem) {
  const file = path.join(root, "src/data/reading", `${poem.id}.json`);
  const map = new Map();
  if (!fs.existsSync(file)) return map;
  const { py = [] } = JSON.parse(fs.readFileSync(file, "utf8"));
  poem.content.forEach((line, i) => {
    const chars = line.match(HAN) ?? [];
    const syllables = String(py[i] ?? "").split(" ");
    chars.forEach((ch, k) => { if (syllables[k]) (map.get(ch) ?? map.set(ch, new Set()).get(ch)).add(normalize(syllables[k])); });
  });
  return map;
}

export function findConflicts(poem, notes) {
  const shown = displayedReadings(poem);
  const out = [];
  for (const note of notes) {
    for (const [, word, reading] of note.matchAll(READING)) {
      const syllables = reading.trim().split(/\s+/);
      const chars = Array.from(word);
      if (syllables.length !== chars.length) continue;
      chars.forEach((ch, k) => {
        const set = shown.get(ch);
        if (set && !set.has(normalize(syllables[k]))) out.push({ ch, note: syllables[k], shown: [...set].join(" / "), text: note });
      });
    }
  }
  return out;
}

let annotated = 0;
const conflicts = [];
for (const s of source.poems) {
  const poem = byId.get(s.id);
  if (!poem) throw new Error(`${s.title}: 找不到 id ${s.id}`);
  if (poem.title !== s.title && !/[芣苢秾鸤棣緜那烈玄长殷]/u.test(s.title)) console.warn(`篇名不同：站内 ${poem.title}，国学梦 ${s.title}`);
  poem.translation = s.translation.join("\n");
  if (s.notes.length) {
    poem.annotation = s.notes.join("\n");
    annotated += 1;
    for (const c of findConflicts(poem, s.notes)) conflicts.push({ id: poem.id, title: poem.title, ...c });
  }
  poem.sources = { translation: s.url, annotation: s.notes.length ? s.url : null };
}

const report = [
  "# 注释读音与正文注音不一致的地方",
  "",
  "由 `node scripts/import-guoxuemeng-notes.mjs` 生成。注释来自国学梦，正文注音按纸质书读音优先的规则，不随注释改动。",
  "下面这些字，注释括号里写的读音和正文上方显示的注音不同，需要人工核对：要么改正文注音（走 scripts/book-overrides.mjs），要么保持现状。",
  "",
  `共 ${conflicts.length} 处。`,
  "",
  "| 诗序 | 篇名 | 字 | 注释读音 | 正文注音 | 注释原文 |",
  "| --- | --- | --- | --- | --- | --- |",
  ...conflicts.map((c) => `| ${c.id} | ${c.title} | ${c.ch} | ${c.note} | ${c.shown} | ${c.text.replace(/\|/g, "｜").slice(0, 80)} |`),
  "",
].join("\n");

console.log(`今译 ${source.poems.length} 篇，注释 ${annotated} 篇（其余保留原注释），注音不一致 ${conflicts.length} 处`);
if (!dryRun) {
  fs.writeFileSync(poemsFile, `${JSON.stringify(poems, null, 2)}\n`);
  fs.writeFileSync(reportFile, report);
}
