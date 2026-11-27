import { describe, expect, it } from "vitest";
import { shouldReport } from "./error-reporting.js";

describe("error reporting filter", () => {
  const origin = "https://poetry.lightos.wiki";
  it("上报本站脚本的错误", () => {
    expect(shouldReport({ message: "x is undefined", stack: `at f (${origin}/assets/detail-abc.js:1:2)`, origin })).toBe(true);
    expect(shouldReport({ message: "boom", stack: "", origin })).toBe(true);
  });
  it("忽略扩展、第三方脚本、网络抖动与噪声", () => {
    expect(shouldReport({ message: "err", stack: "at chrome-extension://abc/x.js:1", origin })).toBe(false);
    expect(shouldReport({ message: "err", stack: "at https://other.example/x.js:1:1", origin })).toBe(false);
    expect(shouldReport({ message: "ResizeObserver loop completed with undelivered notifications.", origin })).toBe(false);
    expect(shouldReport({ message: "Failed to fetch", origin })).toBe(false);
    expect(shouldReport({ message: "", origin })).toBe(false);
  });
});
