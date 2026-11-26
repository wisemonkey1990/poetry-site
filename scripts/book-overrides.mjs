/**
 * 站长纸质《诗经》（PR #15 校对）确定的读音。优先级高于国学梦注音：生成预计算注音时最后套用。
 *  - 施于 → yì（施于中谷 等）
 *  - 害澣害否 / 害浣害否 → 两个「害」读 hé
 *  - 葛藟累之 / 甘瓠累之 → 累 léi
 *  - 语助词「只」→ zhǐ（全部「只」）
 * words: 词内按下标指定读音；chars: 该字所有出现处。
 */
export const BOOK_WORDS = {
  亦施于宇: [[1, "yì"]],
  施于中谷: [[0, "yì"]],
  施于孙子: [[0, "yì"]],
  施于条枚: [[0, "yì"]],
  施于松上: [[0, "yì"]],
  施于松柏: [[0, "yì"]],
  害浣害否: [[0, "hé"], [2, "hé"]],
  害澣害否: [[0, "hé"], [2, "hé"]],
  葛藟累之: [[2, "léi"]],
  甘瓠累之: [[2, "léi"]]
};
export const BOOK_CHARS = { 只: "zhǐ" };

/**
 * @param {string[]} chars 一行里的汉字（已去掉标点）
 * @returns {Map<number, string>} 汉字下标 -> 书上读音
 */
export function bookReadings(chars) {
  const result = new Map();
  const text = chars.join("");
  chars.forEach((ch, i) => { if (BOOK_CHARS[ch]) result.set(i, BOOK_CHARS[ch]); });
  for (const [word, tones] of Object.entries(BOOK_WORDS)) {
    for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
      for (const [k, tone] of tones) result.set(at + k, tone);
    }
  }
  return result;
}
