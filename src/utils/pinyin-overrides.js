/* 多音字人工校正（不依赖 pinyin-pro，拼音表与运行时共用）
 * 词级校正按上下文匹配，优先于单字拼音；单字校正用于该字在诗中读音基本固定的情况。
 * 繁体写法需单独列出（opencc 会把「参」转成「參」）。 */

export const WORD_OVERRIDES = [
  { word: "参差", tones: ["cēn", "cī"] },
  { word: "參差", tones: ["cēn", "cī"] },
  { word: "差池", tones: ["cī", "chí"] },
  { word: "于差", tones: ["yú", "chāi"] },
  { word: "既差", tones: ["jì", "chāi"] },
  { word: "覃耜", tones: ["tǎn", "sì"] }, // 与《大田》注释「覃耜（tǎn sì）」一致
];

export const CHAR_OVERRIDES = {
  覃: "tán",
};

/**
 * 计算一段文字中被词级校正覆盖的位置。
 * @param {string[]} chars 按码点拆分的文字
 * @returns {Map<number, string>} 字符下标 -> 校正后的拼音
 */
export function findWordOverrides(chars) {
  const result = new Map();
  for (const { word, tones } of WORD_OVERRIDES) {
    const target = Array.from(word);
    for (let i = 0; i + target.length <= chars.length; i += 1) {
      if (target.every((ch, k) => chars[i + k] === ch)) target.forEach((_, k) => result.set(i + k, tones[k]));
    }
  }
  return result;
}
