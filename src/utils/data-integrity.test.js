// 数据一致性总检：诗目、篇章目录、预计算阅读数据彼此对得上，防止后续改动悄悄破坏数据。
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import poems from "../data/poems.json";
import categories from "../data/categories.json";
import { hashLines, hashText } from "./reading-hash.js";

const readingDir = new URL("../data/reading/", import.meta.url);

describe("数据一致性", () => {
  it("305 首，id 为 1..305 且不重复", () => {
    expect(poems).toHaveLength(305);
    expect(poems.map((p) => p.id)).toEqual(Array.from({ length: 305 }, (_, i) => i + 1));
  });

  it("每首都有标题、篇章、正文、注释和今译，正文无空句、无首尾空白、无半角标点", () => {
    for (const p of poems) {
      const where = `${p.id} ${p.title}`;
      for (const key of ["title", "chapter", "section", "annotation", "translation"]) {
        expect(typeof p[key] === "string" && p[key].trim().length > 0, `${where} 缺 ${key}`).toBe(true);
      }
      expect(Array.isArray(p.content) && p.content.length > 0, `${where} 无正文`).toBe(true);
      for (const line of p.content) {
        expect(line, where).toBe(line.trim());
        expect(line.length, where).toBeGreaterThan(0);
        expect(/[,.;:?!"'()]/.test(line), `${where} 含半角标点：${line}`).toBe(false);
      }
    }
  });

  it("篇章目录与诗篇一一对应：每首恰好出现一次，篇数与归属正确", () => {
    const seen = new Map();
    let total = 0;
    for (const cat of categories) {
      let catCount = 0;
      for (const sec of cat.sections) {
        expect(sec.poemIds, `${cat.key}·${sec.key}`).toHaveLength(sec.poemCount);
        for (const id of sec.poemIds) {
          expect(seen.has(id), `第 ${id} 首重复出现在目录中`).toBe(false);
          seen.set(id, true);
          const poem = poems.find((p) => p.id === id);
          expect(poem, `目录里的 ${id} 不存在`).toBeTruthy();
          expect([poem.chapter, poem.section], `${id} ${poem.title}`).toEqual([cat.key, sec.key]);
        }
        catCount += sec.poemCount;
      }
      expect(catCount, cat.key).toBe(cat.poemCount);
      total += catCount;
    }
    expect(total).toBe(poems.length);
  });

  it("每首都有预计算阅读数据，且与当前正文、标题同步（改了 poems.json 要运行 npm run reading:generate）", () => {
    const files = fs.readdirSync(readingDir).filter((f) => f.endsWith(".json"));
    expect(files).toHaveLength(poems.length);
    for (const p of poems) {
      const data = JSON.parse(fs.readFileSync(new URL(`${p.id}.json`, readingDir), "utf8"));
      expect(data.h, `${p.id} ${p.title} 正文已改但阅读数据未重新生成`).toBe(hashLines(p.content));
      expect(data.th, `${p.id} ${p.title} 标题已改但阅读数据未重新生成`).toBe(hashText(String(p.title)));
      expect(data.lines, `${p.id}`).toHaveLength(p.content.length);
    }
  });
});
