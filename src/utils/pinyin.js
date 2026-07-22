/* 拼音与诗句排版工具 — 基于 pinyin-pro */
import { pinyin } from "pinyin-pro";

const HAN_CHAR = /[\u3400-\u9fff]/;
const HAN_WORD = /^[\u3400-\u9fff]+$/;
const CJK_PUNCT = /[\u3000-\u303f\uff00-\uffef]/;
const OPENING_PUNCT = /^[「『（《〈【〔［｛“‘]+$/;
const TERMINAL_PUNCT = /[，。！？；：、…」』）】》〉]$/;

let wordSegmenter = null;
try { wordSegmenter = new Intl.Segmenter("zh-CN", { granularity: "word" }); } catch { /* 旧浏览器使用双字分组 */ }

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function splitLongToken(token) {
  const chars = Array.from(token);
  if (!HAN_WORD.test(token) || chars.length <= 4) return [token];
  const chunks = [];
  for (let index = 0; index < chars.length;) {
    const remaining = chars.length - index;
    const size = remaining === 5 ? 3 : Math.min(4, remaining);
    chunks.push(chars.slice(index, index + size).join(""));
    index += size;
  }
  return chunks;
}

function rawTokens(text) {
  if (wordSegmenter) return Array.from(wordSegmenter.segment(text), ({ segment }) => segment).flatMap(splitLongToken);
  const chars = Array.from(text);
  const tokens = [];
  for (let index = 0; index < chars.length;) {
    if (!HAN_CHAR.test(chars[index])) { tokens.push(chars[index]); index += 1; continue; }
    const remaining = chars.slice(index).findIndex((char) => !HAN_CHAR.test(char));
    const runLength = remaining === -1 ? chars.length - index : remaining;
    const size = runLength === 3 ? 3 : Math.min(2, runLength);
    tokens.push(chars.slice(index, index + size).join(""));
    index += size;
  }
  return tokens;
}

/** 将诗句拆成不可断开的语义词组，并把标点绑定到相邻文字。 */
export function groupPoemText(text) {
  const phrases = [];
  let prefix = "";
  for (const token of rawTokens(String(text))) {
    if (/^\s+$/.test(token)) { prefix += token; continue; }
    if (Array.from(token).every((char) => CJK_PUNCT.test(char))) {
      if (OPENING_PUNCT.test(token) || !phrases.length) prefix += token;
      else phrases[phrases.length - 1] += token;
      continue;
    }
    phrases.push(prefix + token);
    prefix = "";
  }
  if (prefix && phrases.length) phrases[phrases.length - 1] += prefix;
  else if (prefix) phrases.push(prefix);

  for (let index = 0; index < phrases.length; index += 1) {
    const hanCount = Array.from(phrases[index]).filter((char) => HAN_CHAR.test(char)).length;
    if (hanCount !== 1 || phrases.length === 1) continue;
    if ((TERMINAL_PUNCT.test(phrases[index]) || index === phrases.length - 1) && index > 0) {
      phrases[index - 1] += phrases[index];
      phrases.splice(index, 1);
      index -= 1;
    } else if (index + 1 < phrases.length) {
      phrases[index] += phrases[index + 1];
      phrases.splice(index + 1, 1);
    } else if (index > 0) {
      phrases[index - 1] += phrases[index];
      phrases.splice(index, 1);
      index -= 1;
    }
  }
  return phrases;
}

/** 将诗句转为带拼音标注、可按语义词组换行的 HTML。 */
export function toRubyHTML(text) {
  return groupPoemText(text).map((phrase) => {
    const content = Array.from(phrase).map((char) => {
      if (HAN_CHAR.test(char)) {
        const tone = pinyin(char, { toneType: "symbol" });
        return `<span class="ruby-unit"><ruby class="ruby-text">${char}<rt>${escapeHTML(tone)}</rt></ruby></span>`;
      }
      if (CJK_PUNCT.test(char)) return `<span class="punct">${char}</span>`;
      return escapeHTML(char);
    }).join("");
    return `<span class="poem-phrase">${content}</span>`;
  }).join("");
}

/** 获取拼音数组。 */
export function getPinyinArray(text) {
  return pinyin(text, { type: "array", toneType: "symbol" });
}