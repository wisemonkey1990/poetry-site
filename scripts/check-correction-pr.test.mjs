import { describe, expect, it } from "vitest";
import { checkCorrectionPr, MAX_POEMS_JSON_LINES } from "./check-correction-pr.mjs";

describe("checkCorrectionPr", () => {
  it("accepts allowlisted files", () => {
    const r = checkCorrectionPr([
      "src/data/poems.json", "src/data/pinyin-table.json", "src/data/pinyin-overrides.json", "src/data/reading/1.json",
    ], 4);
    expect(r).toEqual({ ok: true, violations: [] });
  });
  it("accepts an empty diff", () => {
    expect(checkCorrectionPr([]).ok).toBe(true);
  });
  it("rejects files outside the allowlist", () => {
    const r = checkCorrectionPr(["src/data/poems.json", "worker/index.js", ".github/workflows/ci.yml"]);
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(2);
  });
  it("rejects nested reading paths and lookalikes", () => {
    expect(checkCorrectionPr(["src/data/reading/a/b.json"]).ok).toBe(false);
    expect(checkCorrectionPr(["src/data/reading/1.js"]).ok).toBe(false);
    expect(checkCorrectionPr(["src/data/poems.json.bak"]).ok).toBe(false);
  });
  it("enforces the poems.json line limit", () => {
    expect(checkCorrectionPr(["src/data/poems.json"], MAX_POEMS_JSON_LINES).ok).toBe(true);
    const r = checkCorrectionPr(["src/data/poems.json"], MAX_POEMS_JSON_LINES + 1);
    expect(r.ok).toBe(false);
    expect(r.violations[0]).toContain("poems.json");
  });
});
