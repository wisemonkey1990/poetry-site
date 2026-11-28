/**
 * 书法标题字体（马善政楷书，OFL）：只裁出标题、章节名和界面用字，输出 public/fonts/MaShanZheng-subset.woff2。
 * 用法：node scripts/build-brush-font.mjs <MaShanZheng-Regular.ttf>
 * 母体字体约 5.7 MB，不进仓库；改了界面文字或标题时重跑一次即可。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 只在界面里用书法字体的文字（首页、导航、阅读页标签） */
export const BRUSH_UI_CHARS = '诗经詩經三百思无邪無首页篇章寻诗藏夜读昼晨暮展卷而阅览循句今日一随缘翻诵全风雅颂國風雅頌小大周鲁商颂魯十五国之六卷体三体注释今译译文眉批本篇上下前后第〇一二三四五六七八九十百零';

const CJK = /[㐀-鿿豈-﫿]/u;

export function brushFontChars(rootDir = root) {
  const chars = new Set(Array.from(BRUSH_UI_CHARS));
  const add = (text) => { for (const ch of Array.from(String(text ?? ''))) if (CJK.test(ch)) chars.add(ch); };
  const poems = JSON.parse(fs.readFileSync(path.join(rootDir, 'src/data/poems.json'), 'utf8'));
  for (const poem of poems) {
    [poem.title, poem.chapter, poem.section].forEach(add);
    try {
      const reading = JSON.parse(fs.readFileSync(path.join(rootDir, 'src/data/reading', `${poem.id}.json`), 'utf8'));
      add(reading.title);
    } catch { /* 没有繁体数据的篇目只用简体 */ }
  }
  // 首页和导航里写死的中文（名句长廊、晨昼暮夜等）
  for (const file of ['src/pages/home.js', 'src/components/app-shell.js', 'src/components/bottom-tabs.js']) {
    const full = path.join(rootDir, file);
    if (fs.existsSync(full)) add(fs.readFileSync(full, 'utf8'));
  }
  return Array.from(chars).sort().join('');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const source = process.argv[2];
  if (!source) { console.error('用法：node scripts/build-brush-font.mjs <MaShanZheng-Regular.ttf>'); process.exit(1); }
  const chars = brushFontChars();
  const out = await subsetFont(fs.readFileSync(source), chars, { targetFormat: 'woff2' });
  const dest = path.join(root, 'public/fonts/MaShanZheng-subset.woff2');
  fs.writeFileSync(dest, out);
  console.log(`${chars.length} 字 → ${path.relative(root, dest)}（${(out.length / 1024).toFixed(1)} KB）`);
}
