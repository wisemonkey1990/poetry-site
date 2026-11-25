import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validateCorrection, submitCorrection, buildPayload, clampQuote,
  throttleRemaining, markSubmitted, resetThrottleForTests, THROTTLE_MS,
} from "./corrections.js";

const res = (status, body, raw) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (raw) throw new Error("bad json"); return body; } });

describe("validateCorrection", () => {
  it("accepts valid input and trims", () => {
    const r = validateCorrection({ quote: "  关关雎鸠 ", suggestion: " 關關雎鳩\n", reason: "  见毛传 " });
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ quote: "关关雎鸠", suggestion: "關關雎鳩", reason: "见毛传" });
  });
  it("requires quote and suggestion, reason optional", () => {
    const r = validateCorrection({ quote: "  ", suggestion: "" });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors)).toEqual(["quote", "suggestion"]);
    expect(validateCorrection({ quote: "a", suggestion: "b" }).ok).toBe(true);
  });
  it("enforces length limits", () => {
    expect(validateCorrection({ quote: "a".repeat(200), suggestion: "b".repeat(200), reason: "c".repeat(500) }).ok).toBe(true);
    const r = validateCorrection({ quote: "a".repeat(201), suggestion: "b".repeat(201), reason: "c".repeat(501) });
    expect(Object.keys(r.errors).sort()).toEqual(["quote", "reason", "suggestion"]);
  });
  it("rejects control characters but allows newlines in reason", () => {
    expect(validateCorrection({ quote: "a\u0000b", suggestion: "x" }).errors.quote).toBeTruthy();
    expect(validateCorrection({ quote: "a\nb", suggestion: "x" }).errors.quote).toBeTruthy();
    expect(validateCorrection({ quote: "a", suggestion: "x\u0007" }).errors.suggestion).toBeTruthy();
    expect(validateCorrection({ quote: "a", suggestion: "b", reason: "l1\nl2" }).ok).toBe(true);
    expect(validateCorrection({ quote: "a", suggestion: "b", reason: "l1\u0001" }).errors.reason).toBeTruthy();
  });
  it("rejects quote equal to suggestion (after trimming)", () => {
    expect(validateCorrection({ quote: "鳩", suggestion: " 鳩 " }).errors.suggestion).toBeTruthy();
  });
  it("handles missing input", () => {
    expect(validateCorrection().ok).toBe(false);
  });
});

describe("clampQuote", () => {
  it("collapses whitespace and limits to 200", () => {
    expect(clampQuote("  关关\n 雎鸠 ")).toBe("关关 雎鸠");
    expect(clampQuote("字".repeat(300))).toHaveLength(200);
    expect(clampQuote(null)).toBe("");
  });
});

describe("submitCorrection", () => {
  const payload = buildPayload({ poemId: "1", quote: " 甲 ", suggestion: "乙", reason: "", token: "tok" });

  it("builds the exact contract payload with empty honeypot", () => {
    expect(payload).toEqual({ poemId: 1, quote: "甲", suggestion: "乙", reason: "", token: "tok", website: "" });
    expect(Object.keys(payload).sort()).toEqual(["poemId", "quote", "reason", "suggestion", "token", "website"]);
  });
  it("POSTs JSON to /api/correction", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { ok: true, issueNumber: 7 }));
    const out = await submitCorrection(payload, fetchImpl);
    expect(out).toEqual({ ok: true, issueNumber: 7 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/correction");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual(payload);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it("handles duplicate", async () => {
    const out = await submitCorrection(payload, async () => res(200, { ok: true, duplicate: true }));
    expect(out).toEqual({ ok: true, duplicate: true });
  });
  it.each([400, 403, 405, 413, 429, 502, 503])("shows server error for %i", async (status) => {
    const out = await submitCorrection(payload, async () => res(status, { ok: false, error: `错误${status}` }));
    expect(out).toEqual({ ok: false, error: `错误${status}`, status });
  });
  it("uses generic message for non-JSON and missing error", async () => {
    const a = await submitCorrection(payload, async () => res(502, null, true));
    expect(a.ok).toBe(false);
    expect(a.error).toMatch(/失败/);
    const b = await submitCorrection(payload, async () => res(500, { ok: false }));
    expect(b.error).toMatch(/失败/);
  });
  it("does not treat ok:true with HTTP failure as success", async () => {
    const out = await submitCorrection(payload, async () => res(500, { ok: true }));
    expect(out.ok).toBe(false);
  });
  it("maps network failure", async () => {
    const out = await submitCorrection(payload, async () => { throw new TypeError("Failed to fetch"); });
    expect(out).toEqual({ ok: false, error: expect.stringMatching(/网络/) });
  });
  it("aborts on timeout", async () => {
    const fetchImpl = (_u, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    const out = await submitCorrection(payload, fetchImpl, 10);
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/超时/);
  });
});

describe("throttle", () => {
  beforeEach(() => resetThrottleForTests());
  const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

  it("allows first submission then blocks for 20s", () => {
    const s = store();
    expect(throttleRemaining(1000, s)).toBe(0);
    markSubmitted(1000, s);
    expect(throttleRemaining(6000, s)).toBe(THROTTLE_MS - 5000);
    expect(throttleRemaining(1000 + THROTTLE_MS, s)).toBe(0);
  });
  it("persists via storage across module state", () => {
    const s = store();
    markSubmitted(5000, s);
    resetThrottleForTests();
    expect(throttleRemaining(6000, s)).toBe(THROTTLE_MS - 1000);
  });
  it("survives broken storage", () => {
    const bad = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); } };
    markSubmitted(100, bad);
    expect(throttleRemaining(200, bad)).toBe(THROTTLE_MS - 100);
  });
});
