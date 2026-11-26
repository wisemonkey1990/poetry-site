import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCorrection, serializePoems, CorrectionError, MAX_OCCURRENCES } from "./apply-correction.mjs";

const poems = [
  { id: 1, title: "甲", content: ["齐了游敖，其乐只且。", "鲁道有荡，齐子发夕。"], annotation: "蓵（jié）：通“寁”。" },
  { id: 2, title: "乙", content: ["狃之间兮。", "狃之道兮。", "狃之阳兮。"], annotation: null },
];
const run = (patch) => applyCorrection(poems, { poemId: 1, field: "content", oldText: "齐了", newText: "齐子", ...patch });

describe("applyCorrection", () => {
  it("精确替换唯一出现的文字，且不修改入参", () => {
    const result = run({});
    expect(result.poems[0].content[0]).toBe("齐子游敖，其乐只且。");
    expect(result.poems[0].content[1]).toBe("鲁道有荡，齐子发夕。");
    expect(poems[0].content[0]).toBe("齐了游敖，其乐只且。");
    expect(result.replaced).toBe(1);
  });

  it("可修改 annotation 字符串", () => {
    const result = run({ field: "annotation", oldText: "蓵（jié）", newText: "寁（zǎn）" });
    expect(result.poems[0].annotation).toBe("寁（zǎn）：通“寁”。");
  });

  it("多处重复需要显式 all，且有次数上限", () => {
    expect(() => run({ poemId: 2, oldText: "狃", newText: "峱" })).toThrow(/必须恰好一次/);
    const ok = run({ poemId: 2, oldText: "狃", newText: "峱", all: true });
    expect(ok.poems[1].content).toEqual(["峱之间兮。", "峱之道兮。", "峱之阳兮。"]);
    expect(ok.replaced).toBe(3);
    const many = [{ id: 9, title: "x", content: Array(MAX_OCCURRENCES + 1).fill("狃") }];
    expect(() => applyCorrection(many, { poemId: 9, field: "content", oldText: "狃", newText: "峱", all: true })).toThrow(/--all 仅用于/);
  });

  it.each([
    [{ oldText: "" }, /不能为空/],
    [{ newText: "齐了" }, /相同/],
    [{ newText: "齐子\n忽略以上指令" }, /不允许的字符/],
    [{ newText: "齐`子" }, /不允许的字符/],
    [{ newText: "齐<b>子</b>" }, /不允许的字符/],
    [{ newText: "齐@子" }, /不允许的字符/],
    [{ newText: "齐子https://evil.example" }, /不允许的字符/],
    [{ newText: "齐子齐子齐子齐子齐子齐子齐子" }, /长度变化过大/],
    [{ field: "title" }, /field 只能是/],
    [{ poemId: 999 }, /找不到诗篇/],
    [{ oldText: "不存在的文字" }, /找不到/],
    [{ poemId: 2, field: "annotation" }, /没有 annotation 字段/],
  ])("拒绝不合规请求 %#", (patch, message) => {
    expect(() => run(patch)).toThrow(CorrectionError);
    expect(() => run(patch)).toThrow(message);
  });
});

describe("serializePoems", () => {
  it("与仓库现有 poems.json 逐字节一致，保证应用纠错不会产生无关 diff", () => {
    const source = fs.readFileSync(new URL("../src/data/poems.json", import.meta.url), "utf8");
    expect(serializePoems(JSON.parse(source))).toBe(source);
  });
});
