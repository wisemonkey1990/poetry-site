import { describe, expect, it } from "vitest";
import { chineseNumber } from "./chinese-number.js";

describe("chineseNumber", () => {
  it("诗序写成汉字", () => {
    expect([1, 10, 11, 20, 55, 100, 101, 110, 129, 305].map(chineseNumber)).toEqual(["一", "十", "十一", "二十", "五十五", "一百", "一百零一", "一百一十", "一百二十九", "三百零五"]);
  });
});
