/* 注释查字：把「词(拼音)：释义」一条条拆出来，再在诗文里找到每个词的位置，阅读页据此点字看注。 */

const HAN = /[㐀-鿿]/u;
/** 词头：汉字与夹在中间的拼音括注，如「窈窕(yǎo tiǎo)淑女」 */
const TERM = /((?:[㐀-鿿]|[（(][^（()）：:\n]{0,24}[）)])+)[：:]/gu;
/** 释义里常见、却不是词头的冒号前缀 */
const NOT_TERMS = new Set(["一说", "又说", "或说", "按", "即", "指", "注", "今按"]);

/**
 * @param {string} annotation 注释原文（多行）
 * @param {string} [poemText] 诗文；给出时，诗里没有的「词头」（如释义里引的「毛传：」「郑笺：」）并入上一条释义
 * @returns {{ term: string, gloss: string }[]} 按原文顺序
 */
export function parseAnnotations(annotation, poemText) {
  const text = String(annotation ?? "");
  const inPoem = poemText == null ? null : Array.from(String(poemText)).filter((ch) => HAN.test(ch)).join("");
  const heads = [];
  for (const match of text.matchAll(TERM)) {
    const term = match[1].replace(/[（(][^）)]*[）)]/gu, "");
    if (!term || NOT_TERMS.has(term) || Array.from(term).length > 8) continue;
    if (inPoem != null && !inPoem.includes(term)) continue;
    heads.push({ term, start: match.index, bodyStart: match.index + match[0].length });
  }
  return heads.map((head, index) => {
    const end = index + 1 < heads.length ? heads[index + 1].start : text.length;
    const gloss = text.slice(head.bodyStart, end).replace(/\s+/gu, " ").trim();
    return { term: head.term, gloss };
  }).filter((entry) => entry.gloss);
}

/**
 * 在诗文里给注释词定位。注释大体按诗句顺序排列，所以从上一个词的位置往后找；
 * 多字词在重章叠句里每次出现都标上，单字词只标第一次出现，免得满篇都是注点。
 * @param {string[]} lines 每章一行（简体，与注释同字）
 * @param {{ term: string, gloss: string }[]} notes
 * @returns {Map<string, number>[]} 每章：汉字下标 → 注释序号
 */
export function locateNotes(lines, notes) {
  const hanLines = lines.map((line) => Array.from(String(line)).filter((ch) => HAN.test(ch)).join(""));
  const marks = hanLines.map(() => new Map());
  const offsets = [];
  let total = 0;
  for (const line of hanLines) { offsets.push(total); total += Array.from(line).length; }
  const flat = hanLines.join("");
  const flatChars = Array.from(flat);
  const toLine = (pos) => { let i = offsets.length - 1; while (i > 0 && offsets[i] > pos) i -= 1; return i; };
  const free = (pos, len) => { for (let k = 0; k < len; k++) { const li = toLine(pos + k); if (marks[li].has(pos + k - offsets[li])) return false; } return true; };
  const mark = (pos, len, noteIndex) => { for (let k = 0; k < len; k++) { const li = toLine(pos + k); marks[li].set(pos + k - offsets[li], noteIndex); } };
  const find = (term, from) => {
    const target = Array.from(term);
    for (let i = from; i + target.length <= flatChars.length; i++) {
      let ok = true;
      for (let k = 0; k < target.length; k++) if (flatChars[i + k] !== target[k]) { ok = false; break; }
      if (ok && toLine(i) === toLine(i + target.length - 1) && free(i, target.length)) return i;
    }
    return -1;
  };
  let cursor = 0;
  notes.forEach((note, index) => {
    const len = Array.from(note.term).length;
    let pos = find(note.term, cursor);
    if (pos < 0) pos = find(note.term, 0);
    if (pos < 0) return;
    mark(pos, len, index);
    cursor = pos + len;
    if (len < 2) return;
    for (let next = find(note.term, 0); next >= 0; next = find(note.term, next + len)) mark(next, len, index);
  });
  return marks;
}
