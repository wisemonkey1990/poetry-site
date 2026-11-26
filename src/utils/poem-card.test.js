import { describe, expect, it } from "vitest";
import { layoutPoemColumns, cardFileName } from "./poem-card.js";

const text = (col) => col.map((c) => c.ch).join("");

describe("诗卡版式", () => {
  it("每句成一列，去掉标点，逗号记为停顿", () => {
    const { stanzas, truncated } = layoutPoemColumns(["关关雎鸠，在河之洲。窈窕淑女，君子好逑。"]);
    expect(truncated).toBe(false);
    expect(stanzas).toHaveLength(1);
    expect(stanzas[0].map(text)).toEqual(["关关雎鸠在河之洲", "窈窕淑女君子好逑"]);
    expect(stanzas[0][0][3].gap).toBe(true);
    expect(stanzas[0][0][7].gap).toBe(false);
  });

  it("过长的句子在逗号处拆成两列并保留停顿", () => {
    const { stanzas } = layoutPoemColumns(["一二三四五六七，八九十甲乙丙丁，戊己庚辛壬癸子。"], { maxChars: 8 });
    expect(stanzas[0].every((c) => c.length <= 8)).toBe(true);
    expect(stanzas[0].map(text).join("")).toBe("一二三四五六七八九十甲乙丙丁戊己庚辛壬癸子");
  });

  it("长诗节录整章，不截断半章", () => {
    const stanza = "甲乙丙丁，戊己庚辛。壬癸子丑，寅卯辰巳。";
    const content = Array.from({ length: 10 }, () => stanza);
    const { stanzas, truncated } = layoutPoemColumns(content, { maxColumns: 7 });
    expect(truncated).toBe(true);
    expect(stanzas).toHaveLength(3);
  });

  it("首章就超限时按列截取", () => {
    const { stanzas, truncated } = layoutPoemColumns(["甲乙丙丁。戊己庚辛。壬癸子丑。"], { maxColumns: 2 });
    expect(truncated).toBe(true);
    expect(stanzas[0]).toHaveLength(2);
  });

  it("文件名包含篇名与序号", () => {
    expect(cardFileName({ id: 1, title: "关雎" })).toBe("诗经-关雎-001.png");
  });
});
