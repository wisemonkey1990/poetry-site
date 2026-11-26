/* 诗句分词与 ruby 排版（不依赖 pinyin-pro，拼音由调用方提供） */
import { escapeHtml as escapeHTML } from "./html.js";
import { findOverrides } from "./pinyin-overrides.js";

export const HAN_CHAR = /[\u3400-\u9fff]/;
const CJK_PUNCT = /[\u3000-\u303f\uff00-\uffef\u2018\u2019\u201c\u201d\u2026]/;
const OPENING_PUNCT = /^[「『（《〈【〔［｛“‘]+$/;
const TERMINAL_PUNCT = /[，。！？；：、…」』）】》〉”’]$/;

/**
 * 将诗句按分句（逗号、顿号、句号等标点）切开：一个分句是一个不可断开的单位，
 * 标点永远跟在它前面的字后面，起首的引号、书名号跟在它后面的字前面。
 * 这样换行只会发生在分句之间，不会把「窈窕淑女」之类的词组从中间劈开，也不会让标点落到行首。
 */
export function groupPoemText(text) {
  const phrases = [];
  let current = "";
  let hasHan = false;
  const flush = () => { if (current) phrases.push(current); current = ""; hasHan = false; };
  for (const char of Array.from(String(text))) {
    if (/\s/.test(char)) continue;
    if (CJK_PUNCT.test(char)) {
      // 起首标点：先收尾上一分句，再作为下一分句的开头
      if (OPENING_PUNCT.test(char)) { if (hasHan) flush(); current += char; continue; }
      current += char;
      // 分句以停顿标点结束；后面紧跟的收尾引号等会在下一轮并入
      continue;
    }
    // 遇到汉字：若当前分句已以停顿/收尾标点结束，则开启新分句
    if (hasHan && TERMINAL_PUNCT.test(current)) flush();
    current += char;
    if (HAN_CHAR.test(char)) hasHan = true;
  }
  flush();
  // 只有标点的残片并入前一分句
  for (let index = phrases.length - 1; index > 0; index -= 1) {
    if (!Array.from(phrases[index]).some((char) => HAN_CHAR.test(char))) {
      phrases[index - 1] += phrases[index];
      phrases.splice(index, 1);
    }
  }
  return phrases.flatMap(splitLongClause);
}

/** 超过 6 个字的分句（如「言告言归薄污我私」）：从中间平分，窄屏上带拼音一行放不下时可在中间折行，宽屏仍排在同一行。 */
function splitLongClause(clause) {
  const chars = Array.from(clause);
  const hanCount = chars.filter((char) => HAN_CHAR.test(char)).length;
  if (hanCount <= 6) return [clause];
  const half = Math.ceil(chars.length / 2);
  return [chars.slice(0, half).join(""), chars.slice(half).join("")];
}

/** 将相邻分句归并成「句」：一句收在 。！？；： 上，句内的分句不够放时才会折行。 */
function groupSentences(rendered) {
  const sentences = [];
  let current = [];
  for (const { text, html } of rendered) {
    current.push(html);
    if (/[。！？；：…][」』）】》〉”’]*$/.test(text)) { sentences.push(current); current = []; }
  }
  if (current.length) sentences.push(current);
  return sentences;
}

/**
 * 将诗句转为带拼音标注、可按语义词组换行的 HTML。
 * @param {string} text
 * @param {(char: string) => string} getTone 单字拼音（带声调符号）
 * @param {string[]} [lineTones] 这一句里每个汉字的注音（国学梦数据）；汉字数对不上时忽略，回退到 getTone + 多音字校正
 */
export function renderRuby(text, getTone, lineTones) {
  const source = String(text);
  const phrases = groupPoemText(source);
  // 多音字校正（词规则 > 字规则，见 pinyin-overrides.js）按全句下标匹配；
  // 下标与下面逐字遍历 phrases 的计数一致，因此对分词后的文字匹配
  const overrides = findOverrides(Array.from(phrases.join("")));
  const hanTotal = Array.from(source).filter((char) => HAN_CHAR.test(char)).length;
  const fixed = lineTones && lineTones.length === hanTotal ? lineTones : null;
  let position = 0;
  let hanIndex = 0;
  const rendered = phrases.map((phrase) => {
    const content = Array.from(phrase).map((char) => {
      const index = position++;
      if (HAN_CHAR.test(char)) {
        const tone = (fixed ? fixed[hanIndex] : null) ?? overrides.get(index) ?? getTone(char);
        hanIndex += 1;
        return `<span class="ruby-unit"><ruby class="ruby-text">${char}<rt>${escapeHTML(tone)}</rt></ruby></span>`;
      }
      if (CJK_PUNCT.test(char)) return `<span class="punct">${char}</span>`;
      return escapeHTML(char);
    }).join("");
    return { text: phrase, html: `<span class="poem-phrase">${content}</span>` };
  });
  return groupSentences(rendered).map((parts) => `<span class="poem-sentence">${parts.join("")}</span>`).join("");
}

/**
 * 将一句诗拆成「字单元」（供 PDF 等非 HTML 排版使用）：每个汉字带注音，
 * 标点依附于相邻汉字（起首标点挂在后一字的 before，其余挂在前一字的 after）。
 * 取音规则与 renderRuby 完全一致：句内注音 > 多音字校正 > 拼音表。
 * @returns {{ ch: string, py: string, before: string, after: string }[]}
 */
export function tokenizeLine(text, getTone, lineTones) {
  const chars = Array.from(String(text)).filter((char) => !/\s/.test(char));
  const overrides = findOverrides(chars);
  const hanTotal = chars.filter((char) => HAN_CHAR.test(char)).length;
  const fixed = lineTones && lineTones.length === hanTotal ? lineTones : null;
  const units = [];
  let before = "";
  let hanIndex = 0;
  chars.forEach((char, index) => {
    if (HAN_CHAR.test(char)) {
      const py = (fixed ? fixed[hanIndex] : null) ?? overrides.get(index) ?? getTone(char);
      hanIndex += 1;
      units.push({ ch: char, py, before, after: "" });
      before = "";
    } else if (OPENING_PUNCT.test(char) || !units.length) before += char;
    else units[units.length - 1].after += char;
  });
  return units;
}
