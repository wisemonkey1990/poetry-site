/* 多音字人工校正（不依赖 pinyin-pro，拼音表与运行时共用）
 *
 * 数据来自 src/data/pinyin-overrides.json，由 scripts/generate-pinyin-overrides.mjs 生成
 * （npm run pinyin:overrides -- <apply-rules.json>），已包含繁体写法（opencc 会把「参」转成「參」、「于」转成「於」）。
 *
 * 数据格式：
 *   words: { 词: [下标, 拼音, 下标, 拼音, ...] }  词内只校正列出的下标，其余字不受影响
 *   chars: { 字: [拼音] | [拼音, [except 词...]] }  该字所有出现处都用此读音，位于 except 词内的出现处除外
 *
 * 优先级（确定性）：
 *   1. 词规则优先于字规则；
 *   2. 多个词规则同时覆盖同一位置时，更长的词优先；等长时取起点更靠前（最左）的匹配；
 *   3. 字规则不作用于 except 词内的出现处——这些位置不校正，回退到拼音表读音；
 *   4. 都不命中则由调用方用拼音表（getTone）。
 */
import data from "../data/pinyin-overrides.json" with { type: "json" };

// 按首字索引词规则，匹配时只检查以当前字开头的词
const wordsByFirst = new Map();
for (const [word, flat] of Object.entries(data.words)) {
  const chars = Array.from(word);
  const tones = [];
  for (let i = 0; i < flat.length; i += 2) tones.push([flat[i], flat[i + 1]]);
  const list = wordsByFirst.get(chars[0]) ?? [];
  list.push({ chars, tones });
  wordsByFirst.set(chars[0], list);
}

const charRules = new Map();
for (const [char, [tone, except = []]] of Object.entries(data.chars)) {
  charRules.set(char, { tone, except: /** @type {string[]} */ (except).map((w) => Array.from(w)) });
}

function matchesAt(chars, start, target) {
  if (start < 0 || start + target.length > chars.length) return false;
  for (let k = 0; k < target.length; k += 1) if (chars[start + k] !== target[k]) return false;
  return true;
}

/**
 * 计算一段文字中被词级校正覆盖的位置（更长的词优先，等长取最左）。
 * @param {string[]} chars 按码点拆分的文字
 * @returns {Map<number, string>} 字符下标 -> 校正后的拼音
 */
export function findWordOverrides(chars) {
  const result = new Map();
  const bestLength = new Map();
  for (let i = 0; i < chars.length; i += 1) {
    const candidates = wordsByFirst.get(chars[i]);
    if (!candidates) continue;
    for (const { chars: target, tones } of candidates) {
      if (!matchesAt(chars, i, target)) continue;
      for (const [k, tone] of tones) {
        if (target.length > (bestLength.get(i + k) ?? 0)) {
          bestLength.set(i + k, target.length);
          result.set(i + k, tone);
        }
      }
    }
  }
  return result;
}

function insideExceptWord(chars, index, except) {
  for (const target of except) {
    for (let start = index - target.length + 1; start <= index; start += 1) if (matchesAt(chars, start, target)) return true;
  }
  return false;
}

/**
 * 计算整段文字的全部校正：词规则优先，其次字规则（except 词内的出现处不校正）。
 * @param {string[]} chars 按码点拆分的文字
 * @returns {Map<number, string>} 字符下标 -> 校正后的拼音；不在其中的字使用拼音表读音
 */
export function findOverrides(chars) {
  const result = findWordOverrides(chars);
  chars.forEach((char, index) => {
    if (result.has(index)) return;
    const rule = charRules.get(char);
    if (rule && !insideExceptWord(chars, index, rule.except)) result.set(index, rule.tone);
  });
  return result;
}
