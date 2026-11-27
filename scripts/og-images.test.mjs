import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { buildOgSvg, pickExcerpt, renderOgPng } from "./og-images.mjs";

const poem = { id: 1, title: "关雎", chapter: "国风", section: "周南", content: ["关关雎鸠，在河之洲。窈窕淑女，君子好逑。", "参差荇菜，左右流之。窈窕淑女，寤寐求之。", "求之不得，寤寐思服。"] };

describe("og images", () => {
  it("节录前几句，每句一行", () => {
    expect(pickExcerpt(poem.content)).toEqual(["关关雎鸠，在河之洲。", "窈窕淑女，君子好逑。", "参差荇菜，左右流之。", "窈窕淑女，寤寐求之。"]);
  });
  it("过长的句子在逗号处拆开，且不超过每行字数", () => {
    const lines = pickExcerpt(["一二三四五六七八，九十一二三四五六，七八九十一二三四。"], { maxChars: 10 });
    expect(lines.every((l) => [...l].length <= 10)).toBe(true);
    expect(lines.join("")).toContain("九十一二三四五六");
  });
  it("SVG 中转义诗篇字段", () => {
    const svg = buildOgSvg({ ...poem, title: "<x>&" });
    expect(svg).toContain("&lt;x&gt;&amp;");
    expect(svg).not.toContain("<x>");
  });
  it("能渲染出 1200×630 的 PNG", () => {
    const font = fs.readFileSync(new URL("../src/assets/fonts/NotoSerifSC-poem-subset.ttf", import.meta.url));
    const png = renderOgPng(poem, font);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});
