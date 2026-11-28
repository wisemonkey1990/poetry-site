import { describe, expect, it } from "vitest";
import poems from "./poems.json";
import commentary from "./commentary.json";

describe("诗旨", () => {
  it("三百零五篇都有大意和《毛诗序》，且与篇目对应", () => {
    expect(Object.keys(commentary)).toHaveLength(poems.length);
    for (const poem of poems) {
      const item = commentary[String(poem.id)];
      expect(item, poem.title).toBeTruthy();
      expect(item.gist.length, poem.title).toBeGreaterThan(20);
      expect(item.mao.startsWith(`《${poem.title}》`), poem.title).toBe(true);
      expect(Array.isArray(item.legacy)).toBe(true);
    }
  });

  it("名篇的流传写到了后世的引用", () => {
    expect(commentary["161"].legacy.join("")).toContain("曹操《短歌行》");
    expect(commentary["167"].legacy.join("")).toContain("杨柳依依");
    expect(commentary["129"].mao).toBe("《蒹葭》，刺襄公也。未能用周礼，将无以固其国焉。");
  });

  it("不含繁体残留或生僻的扩展区字", () => {
    const text = JSON.stringify(commentary);
    expect([...text].filter((ch) => ch.codePointAt(0) > 0xffff)).toEqual([]);
  });
});
