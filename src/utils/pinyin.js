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
export function toRubyHTML(text) {
  let result = "";
  for (const ch of text) {
    if (/[\u3400-\u9fff]/.test(ch)) {
      const tone = pinyin(ch, { toneType: "symbol" });
      result += `<span class="ruby-unit"><ruby class="ruby-text">${ch}<rt>${tone}</rt></ruby></span>`;
    } else if (/[\u3000-\u303f\uff00-\uffef]/.test(ch)) {
      result += `<span class="punct">${ch}</span>`;
    } else {
      result += ch;
    }
  }
  return result;
}



/**
 * 获取拼音数组
 */
export function getPinyinArray(text) {
  return pinyin(text, { type: "array", toneType: "symbol" });
}
