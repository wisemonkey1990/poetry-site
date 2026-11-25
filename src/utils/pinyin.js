/* 拼音与诗句排版工具 — 基于 pinyin-pro（运行时路径；详情页仅在预计算数据缺失时动态加载本模块） */
import { pinyin } from "pinyin-pro";
import { groupPoemText, renderRuby } from "./pinyin-ruby.js";

export { groupPoemText };

/** 单字拼音（带声调符号），与预计算数据使用同一配置。 */
export function charPinyin(char) {
  return pinyin(char, { toneType: "symbol" });
}

/** 将诗句转为带拼音标注、可按语义词组换行的 HTML。 */
export function toRubyHTML(text) {
  return renderRuby(text, charPinyin);
}

/** 获取拼音数组。 */
export function getPinyinArray(text) {
  return pinyin(text, { type: "array", toneType: "symbol" });
}
