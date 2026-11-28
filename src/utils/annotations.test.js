import { describe, expect, it } from "vitest";
import poems from "../data/poems.json";
import { locateNotes, parseAnnotations } from "./annotations.js";

describe("parseAnnotations", () => {
  it("拆出词头、去掉拼音括注，一行多条也能分开", () => {
    const notes = parseAnnotations("关关：象声词，雌雄二鸟相互应和的叫声。雎鸠(jū jiū)：一种水鸟名，即王鴡。\n洲：水中的陆地。\n窈窕(yǎo tiǎo)淑女：贤良美好的女子。");
    expect(notes.map((n) => n.term)).toEqual(["关关", "雎鸠", "洲", "窈窕淑女"]);
    expect(notes[1].gloss).toBe("一种水鸟名，即王鴡。");
    expect(notes[3].gloss).toBe("贤良美好的女子。");
  });

  it("释义里的「一说：」不当作词头", () => {
    const notes = parseAnnotations("游：顺流而下。一说：直流的水道。");
    expect(notes).toEqual([{ term: "游", gloss: "顺流而下。一说：直流的水道。" }]);
  });

  it("给出诗文时，诗里没有的引书名并入上一条", () => {
    const notes = parseAnnotations("洲：水中的陆地。毛传：水中可居者曰洲。", "在河之洲");
    expect(notes).toEqual([{ term: "洲", gloss: "水中的陆地。毛传：水中可居者曰洲。" }]);
  });

  it("没有注释时返回空", () => {
    expect(parseAnnotations("")).toEqual([]);
    expect(parseAnnotations(undefined)).toEqual([]);
  });
});

describe("locateNotes", () => {
  it("按顺序定位；多字词重章处都标，单字词只标一次", () => {
    const lines = ["蒹葭苍苍，白露为霜。所谓伊人，在水一方。", "蒹葭萋萋，白露未晞。所谓伊人，在水之湄。"];
    const notes = parseAnnotations("蒹(jiān)葭(jiā)：芦苇。\n伊人：那个人。\n方：边。\n湄(méi)：岸边。");
    const marks = locateNotes(lines, notes);
    expect(marks[0].get(0)).toBe(0);
    expect(marks[0].get(1)).toBe(0);
    expect(marks[1].get(0)).toBe(0); // 第二章的「蒹葭」也标
    expect(marks[0].get(10)).toBe(1); // 伊
    expect(marks[1].get(10)).toBe(1);
    expect(marks[0].get(15)).toBe(2); // 方，只标一次
    expect(marks[1].get(15)).toBe(3); // 湄
    expect([...marks[1].values()].filter((v) => v === 2)).toHaveLength(0);
  });

  it("词不跨章", () => {
    const marks = locateNotes(["甲乙", "丙丁"], [{ term: "乙丙", gloss: "x" }]);
    expect(marks.every((m) => m.size === 0)).toBe(true);
  });

  it("全部 305 篇都能解析，每篇大多数注释词能在诗里找到", () => {
    let found = 0; let total = 0;
    for (const poem of poems) {
      const notes = parseAnnotations(poem.annotation, poem.content.join(""));
      const marks = locateNotes(poem.content, notes);
      const hit = new Set(marks.flatMap((m) => [...m.values()]));
      found += hit.size; total += notes.length;
    }
    expect(total).toBeGreaterThan(3000);
    expect(found / total).toBeGreaterThan(0.95);
  });
});
