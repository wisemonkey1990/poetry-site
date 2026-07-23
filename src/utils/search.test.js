import { describe, expect, it } from "vitest";
import { searchPoems } from "./search.js";

const poems = [
  { id: 1, title: "关雎", author: "", chapter: "国风", section: "周南", content: ["关关雎鸠，在河之洲。"], annotation: "", translation: "" },
  { id: 2, title: "蒹葭", author: "", chapter: "国风", section: "秦风", content: ["蒹葭苍苍，白露为霜。"], annotation: "水草", translation: "" },
];

describe("诗篇搜索", () => {
  it("标题匹配优先", () => {
    expect(searchPoems(poems, "关雎")[0].id).toBe(1);
  });

  it("特殊正则字符不会抛错", () => {
    expect(() => searchPoems(poems, "[.*+")).not.toThrow();
  });

  it("空关键词返回空结果", () => {
    expect(searchPoems(poems, "   ")).toEqual([]);
  });
});