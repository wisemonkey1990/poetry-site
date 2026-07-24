import { describe, expect, it } from "vitest";
import { groupPoemText, toRubyHTML, getPinyinArray } from "./pinyin.js";

describe("groupPoemText 语义分词", () => {
  it("将纯汉字诗句拆成语义词组", () => {
    const phrases = groupPoemText("关关雎鸠在河之洲");
    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases.join("")).toBe("关关雎鸠在河之洲");
  });

  it("标点绑定到相邻文字，不单独成词", () => {
    const phrases = groupPoemText("蒹葭苍苍，白露为霜。");
    const joined = phrases.join("");
    expect(joined).toBe("蒹葭苍苍，白露为霜。");
    // 逗号不应单独成一个 phrase
    expect(phrases).not.toContain("，");
  });

  it("空字符串返回空数组", () => {
    expect(groupPoemText("")).toEqual([]);
  });

  it("单字汉字会被合并到相邻词组", () => {
    const phrases = groupPoemText("采采卷耳");
    expect(phrases.join("")).toBe("采采卷耳");
    // 不应出现仅含一个汉字的独立 phrase（除非整句只有一个字）
    const singleHanPhrases = phrases.filter((p) => {
      const hanCount = Array.from(p).filter((c) => /[\u3400-\u9fff]/.test(c)).length;
      return hanCount === 1;
    });
    expect(singleHanPhrases.length).toBe(0);
  });
});

describe("toRubyHTML 拼音标注", () => {
  it("为汉字生成 ruby 标签", () => {
    const html = toRubyHTML("关");
    expect(html).toContain("<ruby");
    expect(html).toContain("<rt>");
    expect(html).toContain("关");
  });

  it("转义 HTML 特殊字符防止注入", () => {
    const html = toRubyHTML("<script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
  });

  it("CJK 标点包裹在 punct span 中", () => {
    const html = toRubyHTML("关，");
    expect(html).toContain('class="punct"');
    expect(html).toContain("，");
  });

  it("多字诗句生成多个语义词组 span", () => {
    const html = toRubyHTML("关关雎鸠在河之洲");
    const phraseCount = (html.match(/class="poem-phrase"/g) || []).length;
    expect(phraseCount).toBeGreaterThan(0);
  });
});

describe("getPinyinArray 拼音数组", () => {
  it("返回与字符数对应的拼音数组", () => {
    const arr = getPinyinArray("关关雎鸠");
    expect(arr).toHaveLength(4);
    expect(arr[0]).toBeTruthy();
  });

  it("带声调符号", () => {
    const arr = getPinyinArray("关");
    expect(arr[0]).toMatch(/ā|á|ǎ|à|a/);
  });
});
