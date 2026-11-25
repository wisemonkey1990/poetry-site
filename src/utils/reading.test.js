import { describe, expect, it, vi } from "vitest";
import { Converter } from "opencc-js/cn2t";
import poems from "../data/poems.json";
import { toRubyHTML, charPinyin } from "./pinyin.js";
import { getTraditionalText, renderRubyLines } from "./reading.js";

const toTraditional = Converter({ from: "cn", to: "twp" });

describe("预计算阅读数据与运行时输出一致", () => {
  it("全部 305 首：繁体标题/正文与 opencc 运行时转换相同", async () => {
    expect(poems).toHaveLength(305);
    for (const poem of poems) {
      const result = await getTraditionalText(poem);
      expect(result.lines, `poem ${poem.id}`).toEqual(poem.content.map((line) => toTraditional(line)));
      expect(result.title, `poem ${poem.id}`).toBe(toTraditional(poem.title));
    }
  });

  it("全部 305 首：简体与繁体 ruby HTML 与 toRubyHTML 完全一致", async () => {
    for (const poem of poems) {
      const simplified = await renderRubyLines(poem.content);
      expect(simplified, `poem ${poem.id}`).toEqual(poem.content.map((line) => toRubyHTML(line)));
      const trad = poem.content.map((line) => toTraditional(line));
      expect(await renderRubyLines(trad), `poem ${poem.id}`).toEqual(trad.map((line) => toRubyHTML(line)));
    }
  });
});

describe("内容不匹配时回退到运行时路径", () => {
  it("正文被改动：对改动内容重新转换，不使用预计算繁体", async () => {
    const poem = { ...poems[0], content: ["关关雎鸠，在河之洲。", "云端编辑过的新句子。"] };
    const result = await getTraditionalText(poem);
    expect(result.lines).toEqual(poem.content.map((line) => toTraditional(line)));
    expect(result.title).toBe(toTraditional(poem.title));
  });

  it("标题被改动：仅标题重新转换", async () => {
    const poem = { ...poems[0], title: "关雎（新）" };
    const result = await getTraditionalText(poem);
    expect(result.title).toBe(toTraditional("关雎（新）"));
    expect(result.lines).toEqual(poem.content.map((line) => toTraditional(line)));
  });

  it("未知诗篇 id：回退转换", async () => {
    const poem = { id: 99999, title: "关雎", content: ["关关雎鸠"] };
    expect(await getTraditionalText(poem)).toEqual({ title: toTraditional("关雎"), lines: [toTraditional("关关雎鸠")] });
  });

  it("拼音表缺字时回退 pinyin-pro，输出仍与 toRubyHTML 一致", async () => {
    const lines = ["关关雎鸠，𠀀龘。", "龘龘"];
    expect(await renderRubyLines(lines)).toEqual(lines.map((line) => toRubyHTML(line)));
    expect(charPinyin("龘")).toBeTruthy();
  });
});

describe("预计算路径不加载 pinyin-pro / opencc", () => {
  it("命中预计算数据时不会 import pinyin.js 或 text-convert.js", async () => {
    vi.resetModules();
    const pinyinLoaded = vi.fn();
    const convertLoaded = vi.fn();
    vi.doMock("./pinyin.js", () => { pinyinLoaded(); return { charPinyin: () => "" }; });
    vi.doMock("./text-convert.js", () => { convertLoaded(); return { convertLines: async () => ({ lines: [] }) }; });
    const reading = await import("./reading.js");
    const poem = poems[0];
    const trad = await reading.getTraditionalText(poem);
    await reading.renderRubyLines(poem.content);
    await reading.renderRubyLines(trad.lines);
    expect(pinyinLoaded).not.toHaveBeenCalled();
    expect(convertLoaded).not.toHaveBeenCalled();
    vi.doUnmock("./pinyin.js");
    vi.doUnmock("./text-convert.js");
  });
});
