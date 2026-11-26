import { describe, expect, it, vi } from "vitest";
import { validateFeedback, buildFeedbackPayload, submitFeedback } from "./feedback.js";

describe("validateFeedback", () => {
  it("requires enough content", () => {
    expect(validateFeedback({ content: "" }).errors.content).toBeTruthy();
    expect(validateFeedback({ content: "好" }).errors.content).toBeTruthy();
    expect(validateFeedback({ content: "希望增加夜间模式" }).ok).toBe(true);
  });
  it("limits length and falls back on unknown category", () => {
    expect(validateFeedback({ content: "字".repeat(1001) }).ok).toBe(false);
    expect(validateFeedback({ category: "bogus", content: "希望增加夜间模式" }).values.category).toBe("其他");
  });
});

describe("submitFeedback", () => {
  it("posts to /api/feedback", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, issueNumber: 3 })));
    const res = await submitFeedback(buildFeedbackPayload({ category: "其他", content: "希望增加夜间模式", token: "t" }), fetchImpl);
    expect(res).toEqual({ ok: true, issueNumber: 3 });
    expect(fetchImpl.mock.calls[0][0]).toBe("/api/feedback");
  });
});
