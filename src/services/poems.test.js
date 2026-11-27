import { describe, expect, it, vi, beforeEach } from "vitest";

const localPoemsFixture = vi.hoisted(() => [
  { id: 2, title: "葛覃", chapter: "国风", section: "周南", content: ["葛之覃兮，施于中谷。"], sort_order: 2 },
  { id: 1, title: "关雎", chapter: "国风", section: "周南", content: ["关关雎鸠，在河之洲。", "窈窕淑女，君子好逑。"], sort_order: 1 },
  { id: 3, title: "卷耳", chapter: "国风", section: "周南", content: JSON.stringify(["采采卷耳，不盈顷筐。"]), sort_order: 3 },
]);

vi.mock("../data/poems.json", () => ({ default: localPoemsFixture }));
vi.mock("virtual:poem-index", () => ({
  default: localPoemsFixture.map((p) => ({ ...p, content: typeof p.content === "string" ? p.content : p.content.slice(0, 1) })),
}));
vi.mock("virtual:poem-loaders", () => ({
  default: Object.fromEntries(localPoemsFixture.map((p) => [String(p.id), async () => ({ default: p })])),
}));

describe("poems service (local poems.json only)", () => {
  let poems;

  beforeEach(async () => {
    vi.resetModules();
    poems = await import("./poems.js");
  });

  describe("getPoems", () => {
    it("按 sort_order 排序并规范化", async () => {
      const list = await poems.getPoems();
      expect(list.map((p) => p.id)).toEqual([1, 2, 3]);
      expect(list[2].content).toEqual(["采采卷耳，不盈顷筐。"]);
      expect(list.every((p) => p.is_published === true)).toBe(true);
    });

    it("重复调用返回同一份缓存结果", async () => {
      const a = await poems.getPoems();
      const b = await poems.getPoems();
      expect(a).toBe(b);
    });

    it("不修改源数据顺序", async () => {
      await poems.getPoems();
      expect(localPoemsFixture.map((p) => p.id)).toEqual([2, 1, 3]);
    });
  });

  describe("getPoemIndex", () => {
    it("按 sort_order 排序，每首只带首句", async () => {
      const list = await poems.getPoemIndex();
      expect(list.map((p) => p.id)).toEqual([1, 2, 3]);
      expect(list[0].content).toEqual(["关关雎鸠，在河之洲。"]);
    });
  });

  describe("getPoemById", () => {
    it("返回单篇完整正文并缓存", async () => {
      const a = await poems.getPoemById(1);
      expect(a.content).toHaveLength(2);
      expect(await poems.getPoemById("1")).toBe(a);
    });

    it("找到诗篇（支持字符串 id）", async () => {
      expect((await poems.getPoemById(1)).title).toBe("关雎");
      expect((await poems.getPoemById("2")).title).toBe("葛覃");
    });

    it("不存在时返回 null", async () => {
      expect(await poems.getPoemById(9999)).toBeNull();
      expect(await poems.getPoemById("abc")).toBeNull();
    });
  });

  describe("normalizePoem", () => {
    it("null/undefined 返回 null", () => {
      expect(poems.normalizePoem(null)).toBeNull();
      expect(poems.normalizePoem(undefined)).toBeNull();
    });

    it("解析 JSON 字符串内容，过滤空行", () => {
      expect(poems.normalizePoem({ id: "5", content: '["甲","","乙"]' }).content).toEqual(["甲", "乙"]);
    });

    it("非 JSON 字符串按换行拆分", () => {
      expect(poems.normalizePoem({ id: 1, content: "甲\n乙" }).content).toEqual(["甲", "乙"]);
    });

    it("缺省 sort_order 取 id，is_published 默认 true，id 转数字", () => {
      const p = poems.normalizePoem({ id: "7", content: [] });
      expect(p.id).toBe(7);
      expect(p.sort_order).toBe(7);
      expect(p.is_published).toBe(true);
      expect(poems.normalizePoem({ id: 1, content: [], is_published: false }).is_published).toBe(false);
    });

    it("content 非数组/字符串时为空数组", () => {
      expect(poems.normalizePoem({ id: 1, content: 123 }).content).toEqual([]);
    });
  });
});
