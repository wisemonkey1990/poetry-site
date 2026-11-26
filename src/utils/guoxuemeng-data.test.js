import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import poems from "../data/poems.json";
import source from "../../data-sources/guoxuemeng-shijing.json";
import { getPoemPinyin, renderRubyLines } from "./reading.js";
import { HAN_CHAR } from "./pinyin-ruby.js";

const han = (text) => Array.from(text).filter((ch) => HAN_CHAR.test(ch));
const readingDir = path.resolve(import.meta.dirname, "../data/reading");

describe("国学梦数据", () => {
  it("305 首诗都有对应项，音节数等于汉字数", () => {
    expect(source.poems).toHaveLength(305);
    for (const s of source.poems) expect(s.pinyin, s.title).toHaveLength(han(s.text).length);
  });

  it("poems.json 的汉字与国学梦正文一致", () => {
    for (const poem of poems) {
      const s = source.poems.find((item) => item.id === poem.id);
      expect(han(poem.content.join("")).join(""), poem.title).toBe(han(s.text).join(""));
    }
  });

  it("预计算注音与正文逐句、逐字对应", () => {
    for (const poem of poems) {
      const { py } = JSON.parse(fs.readFileSync(path.join(readingDir, `${poem.id}.json`), "utf8"));
      expect(py, poem.title).toHaveLength(poem.content.length);
      poem.content.forEach((line, i) => expect(py[i].split(" "), `${poem.title} #${i}`).toHaveLength(han(line).length));
    }
  });

  it("详情页渲染使用国学梦注音，纸质书校正（施于 yì、只 zhǐ、害 hé、累 léi）优先", async () => {
    const readingOf = async (id, word, offset = 0) => {
      const poem = poems.find((p) => p.id === id);
      const all = poem.content.join("");
      expect(all.indexOf(word), `${id} ${word}`).toBeGreaterThanOrEqual(0);
      const html = (await renderRubyLines(poem.content, await getPoemPinyin(poem))).join("");
      const tones = Array.from(html.matchAll(/ruby-text">(.)<rt>([^<]*)<\/rt>/gsu), (m) => m[2]);
      expect(tones).toHaveLength(han(all).length);
      return tones[han(all.slice(0, all.indexOf(word))).length + offset];
    };
    expect(await readingOf(2, "施于中谷")).toBe("yì");
    expect(await readingOf(2, "害浣害否")).toBe("hé");
    expect(await readingOf(2, "害浣害否", 2)).toBe("hé");
    expect(await readingOf(4, "乐只君子")).toBe("lè"); // 来自国学梦（乐 lè）
    expect(await readingOf(4, "只君子")).toBe("zhǐ");
    expect(await readingOf(4, "葛藟累之", 2)).toBe("léi");
  });
});
