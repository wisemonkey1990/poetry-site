import { describe, expect, it } from "vitest";
import { classifySwipe } from "./swipe.js";

describe("滑动方向判定", () => {
  it("明显的左滑、右滑分别返回 left / right", () => {
    expect(classifySwipe({ dx: -120, dy: 10, duration: 200 })).toBe("left");
    expect(classifySwipe({ dx: 120, dy: -10, duration: 200 })).toBe("right");
  });

  it("位移不足时忽略", () => {
    expect(classifySwipe({ dx: -30, dy: 0, duration: 100 })).toBeNull();
  });

  it("斜向或竖向滚动时忽略", () => {
    expect(classifySwipe({ dx: -100, dy: 80, duration: 200 })).toBeNull();
    expect(classifySwipe({ dx: 20, dy: 200, duration: 200 })).toBeNull();
  });

  it("停留过久（拖动、长按）时忽略", () => {
    expect(classifySwipe({ dx: -150, dy: 0, duration: 1200 })).toBeNull();
  });
});
