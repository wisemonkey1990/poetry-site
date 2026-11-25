import { describe, expect, it } from "vitest";
import { generatePassword, validatePassword } from "./password.js";

describe("password utils", () => {
  it("生成指定长度、只含无歧义字符的随机密码", () => {
    const pw = generatePassword(16);
    expect(pw).toHaveLength(16);
    expect(pw).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
    expect(generatePassword(16)).not.toBe(pw);
  });

  it("丢弃会造成取模偏差的字节后仍能凑够长度", () => {
    let calls = 0;
    const impl = { getRandomValues: (arr) => { calls++; arr.fill(calls < 3 ? 255 : 0); return arr; } };
    const pw = generatePassword(6, impl);
    expect(pw).toHaveLength(6);
    expect(calls).toBe(3);
  });

  it("validatePassword 校验长度范围", () => {
    expect(validatePassword("short")).toMatch("至少 8 位");
    expect(validatePassword("a".repeat(73))).toMatch("不能超过 72 位");
    expect(validatePassword("goodpass1")).toBe("");
    expect(validatePassword(undefined)).toMatch("至少");
  });
});
