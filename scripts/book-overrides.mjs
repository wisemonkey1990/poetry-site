/**
 * 站长纸质《诗经》（PR #15 校对）确定的读音。优先级高于国学梦注音：生成预计算注音时最后套用。
 *  - 施于 → yì（施于中谷 等）
 *  - 害澣害否 / 害浣害否 → 两个「害」读 hé
 *  - 葛藟累之 / 甘瓠累之 → 累 léi
 *  - 语助词「只」→ zhǐ（全部「只」）
 * words: 词内按下标指定读音；chars: 该字所有出现处。
 */
/** @type {Record<string, Array<[number, string]>>} */
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

/**
 * 篇名注音校正：篇名按「标题 -> 逐字读音」整体指定，优先于拼音库。
 * 来源是通行诗经注本的读法（未经站长纸质书核对），有出入时以纸质书为准，再来这里改。
 * 篇名字数简繁一致，繁体标题共用这份注音。
 */
export const TITLE_READINGS = {
  氓: "méng",
  还: "xuán",
  摽有梅: "biào yǒu méi",
  卢令: "lú líng",
  蓼萧: "lù xiāo",
  蓼莪: "lù é",
  行苇: "xíng wěi",
  卷阿: "juǎn ē",
  瞻卬: "zhān áng",
  渐渐之石: "jiān jiān zhī shí",
  假乐: "jiā lè",
  皇皇者华: "huáng huáng zhě huā",
  裳裳者华: "cháng cháng zhě huā",
  白华: "bái huā",
  苕之华: "tiáo zhī huā"
};
