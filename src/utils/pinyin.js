/**
 * 拼音工具 — 基于 pinyin-pro
 */
import { pinyin } from "pinyin-pro";

/**
 * 将诗句转为带拼音标注的 HTML（使用 <ruby> 标签）
 * @param {string} text - 汉字文本
 * @param {boolean} withPinyin - 是否显示拼音
 * @returns {string} HTML 字符串
 */
export function toRubyHTML(text, withPinyin = true) {
  const py = pinyin(text, { type: "array", toneType: "none" });
  let result = "";
  let i = 0;
  for (const ch of text) {
    if (/[\u4e00-\u9fff]/.test(ch)) {
      const tone = pinyin(ch, { toneType: "symbol" });
      result += `<ruby class="ruby-text">${ch}<rt>${tone}</rt></ruby>`;
    } else if (/[\u3000-\u303f\uff00-\uffef]/.test(ch)) {
      // 标点符号
      result += `<span class="punct">${ch}</span>`;
    } else {
      result += ch;
    }
    i++;
  }
  return result;
}

/**
 * 获取拼音数组
 */
export function getPinyinArray(text) {
  return pinyin(text, { type: "array", toneType: "symbol" });
}
