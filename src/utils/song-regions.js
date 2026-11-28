/* 画中寻诗：马和之画里哪一处画的是哪一句诗。
   区域坐标是相对画心（public/images/song/<id>.webp）的比例 [x0, y0, x1, y1]，见 src/data/song-regions.json。 */
import regions from "../data/song-regions.json";

const HAN = /[㐀-鿿]/u;
const STOP = /[，。！？；：、,.!?;:]/u;

/** @typedef {{ q: string, label: string, box: [number, number, number, number] }} SongRegion */

/**
 * 这首诗在画里标了哪几处
 * @param {number|string} id
 * @returns {SongRegion[]}
 */
export function regionsFor(id) {
  return /** @type {SongRegion[]} */ (regions[String(id)] ?? []);
}

/**
 * 诗句 q 在正文里的位置：取 q 所在的整个分句，返回汉字下标（与 .ruby-unit 一一对应）
 * @param {string[]} lines 简体正文（每章一行）
 * @param {string} q
 * @returns {{ line: number, from: number, to: number }[]} to 不含
 */
export function locateVerse(lines, q) {
  const target = Array.from(q);
  const found = [];
  lines.forEach((text, line) => {
    const chars = Array.from(String(text));
    for (let i = 0; i + target.length <= chars.length; i++) {
      if (!target.every((ch, k) => chars[i + k] === ch)) continue;
      let start = i;
      while (start > 0 && !STOP.test(chars[start - 1])) start -= 1;
      let end = i + target.length;
      while (end < chars.length && !STOP.test(chars[end])) end += 1;
      const han = (upto) => chars.slice(0, upto).filter((ch) => HAN.test(ch)).length;
      found.push({ line, from: han(start), to: han(end) });
      i = end;
    }
  });
  return found;
}
