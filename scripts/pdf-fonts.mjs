/**
 * PDF 字体：每首诗单独裁一份只含本篇用字（简体、繁体、注音字母、版式文字）的小字体，
 * 构建时输出到 dist/fonts/pdf/<id>.ttf（几十 KB），下载 PDF 时才取用。
 * 母体是 scripts/build-pdf-font.py 生成的完整子集（src/assets/fonts/NotoSerifSC-poem-subset.ttf）。
 */
import fs from 'node:fs';
import path from 'node:path';
import subsetFont from 'subset-font';

/** 版式文字：印章、页脚、繁体章节名、缺字占位（与 build-pdf-font.py 保持一致） */
export const PDF_EXTRA_CHARS = '诗经三百序篇·《》「」『』□ 國風邶鄘衛王鄭齊魏唐秦陳檜曹豳小雅大周魯商頌詩經序篇';

export function poemFontChars(poem, reading = null) {
  const chars = new Set(Array.from(PDF_EXTRA_CHARS));
  for (let code = 32; code < 127; code += 1) chars.add(String.fromCharCode(code));
  const add = (text) => { for (const ch of Array.from(String(text ?? ''))) chars.add(ch); };
  [poem.title, poem.chapter, poem.section, ...poem.content].forEach(add);
  if (reading) [reading.title, ...(reading.lines ?? []), ...(reading.py ?? []), reading.tp].forEach(add);
  return Array.from(chars).join('');
}

export function readReading(root, id) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'src/data/reading', `${id}.json`), 'utf8')); }
  catch { return null; }
}

export async function buildPoemFont(sharedFont, poem, reading) {
  return subsetFont(sharedFont, poemFontChars(poem, reading), { targetFormat: 'truetype' });
}
