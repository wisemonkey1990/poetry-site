import { describe, expect, it, vi, beforeEach } from "vitest";
import { getConverter, convertLines } from "./text-convert.js";

// 使用 vi.hoisted 提升 mock 变量到 vi.mock 之前
const { mockCn2tConverter, mockT2cnConverter } = vi.hoisted(() => ({
  mockCn2tConverter: vi.fn(() => (text) => `[繁]${text}`),
  mockT2cnConverter: vi.fn(() => (text) => `[简]${text}`),
}));

vi.mock("opencc-js/cn2t", () => ({
  Converter: mockCn2tConverter,
}));

vi.mock("opencc-js/t2cn", () => ({
  Converter: mockT2cnConverter,
}));

describe("繁简转换模块", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getConverter('s2t') 正确加载 cn2t 模块，并用 { from: 'cn', to: 'twp' } 调用 Converter", async () => {
    const converter = await getConverter("s2t");

    expect(mockCn2tConverter).toHaveBeenCalledTimes(1);
    expect(mockCn2tConverter).toHaveBeenCalledWith({ from: "cn", to: "twp" });
    expect(converter("原诗")).toBe("[繁]原诗");
  });

  it("getConverter('t2s') 正确加载 t2cn 模块，并用 { from: 'tw', to: 'cn' } 调用 Converter", async () => {
    const converter = await getConverter("t2s");

    expect(mockT2cnConverter).toHaveBeenCalledTimes(1);
    expect(mockT2cnConverter).toHaveBeenCalledWith({ from: "tw", to: "cn" });
    expect(converter("原诗")).toBe("[简]原诗");
  });

  it("getConverter 对同一 mode 的重复调用返回缓存实例（不重复加载）", async () => {
    const c1 = await getConverter("s2t");
    const c2 = await getConverter("s2t");

    // 返回同一实例（引用相同）
    expect(c1).toBe(c2);
    // 没有重新调用 Converter 构造器（缓存命中）
    expect(mockCn2tConverter).not.toHaveBeenCalled();
  });

  it("convertLines 正确转换诗句数组", async () => {
    const result = await convertLines(["关关雎鸠", "在河之洲"], "s2t");

    expect(result.lines).toEqual(["[繁]关关雎鸠", "[繁]在河之洲"]);
    expect(result.mode).toBe("s2t");
  });

  it("convertLines 默认 mode 为 s2t", async () => {
    const result = await convertLines(["关关雎鸠"]);

    expect(result.mode).toBe("s2t");
    expect(result.lines).toEqual(["[繁]关关雎鸠"]);
  });

  it("空数组边界情况", async () => {
    const result = await convertLines([], "s2t");

    expect(result.lines).toEqual([]);
    expect(result.mode).toBe("s2t");
  });

  it("空字符串边界情况", async () => {
    const result = await convertLines(["", "关关雎鸠", ""], "s2t");

    expect(result.lines).toEqual(["[繁]", "[繁]关关雎鸠", "[繁]"]);
    expect(result.mode).toBe("s2t");
  });
});
