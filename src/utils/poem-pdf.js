/**
 * 诗篇 PDF：A4 竖版，宣纸底色，汉字上方逐字注音（可关闭），字体子集嵌入 PDF，任何设备都能正确显示。
 * 排版（分句、分页）是纯函数，度量字宽的函数由外部注入，便于测试；pdf-lib / fontkit 仅在点击下载时才加载。
 */

export const PAGE = { width: 595.28, height: 841.89 };
const COLORS = {
  paper: [0.953, 0.929, 0.875], // #f3eddf
  ink: [0.141, 0.133, 0.122],
  soft: [0.341, 0.318, 0.286],
  muted: [0.541, 0.502, 0.447],
  vermilion: [0.624, 0.184, 0.141],
  pinyin: [0.498, 0.255, 0.224],
  gold: [0.655, 0.537, 0.341]
};
const FRAME = 26; // 外框距页边
const SIDE = 68; // 正文左右边距
const SENTENCE_END = /[。！？；]/u;
const MINOR_PAUSE = /[，、：]/u;
const PUNCT_ADVANCE = 0.62; // 句读占位（相对字号）
const OPEN_ADVANCE = 0.5;

export const missingGlyph = "□";

/** 单元（一个汉字及其标点）宽度 */
function unitWidth(unit, m) {
  const cell = Math.max(m.hz, unit.py ? m.pyWidth(unit.py) : 0) + m.gap;
  return cell + Array.from(unit.after).length * m.hz * PUNCT_ADVANCE + Array.from(unit.before).length * m.hz * OPEN_ADVANCE;
}

const rowWidth = (units, m) => units.reduce((sum, unit) => sum + unitWidth(unit, m), 0);

/** 按句末标点（。！？；）把一章切成句；没有句末标点的整章为一句 */
export function splitSentences(units) {
  const rows = [];
  let current = [];
  for (const unit of units) {
    current.push(unit);
    if (SENTENCE_END.test(unit.after)) { rows.push(current); current = []; }
  }
  if (current.length) rows.push(current);
  return rows;
}

/** 一句超宽时，在最接近中点的逗号/顿号处折成两行；没有逗号则从中间折。 */
export function breakRow(units, maxWidth, m) {
  if (units.length < 2 || rowWidth(units, m) <= maxWidth) return [units];
  let best = -1;
  let bestScore = Infinity;
  for (let i = 1; i < units.length; i += 1) {
    if (!MINOR_PAUSE.test(units[i - 1].after)) continue;
    const score = Math.max(rowWidth(units.slice(0, i), m), rowWidth(units.slice(i), m));
    if (score < bestScore) { best = i; bestScore = score; }
  }
  if (best < 0) best = Math.ceil(units.length / 2);
  return [...breakRow(units.slice(0, best), maxWidth, m), ...breakRow(units.slice(best), maxWidth, m)];
}

/**
 * 排版：把各章切行，再按页高分页。
 * @param {object[][]} stanzas 每章的字单元（tokenizeLines 的结果）
 * @returns {{ pages: { rows: { units: object[], y: number, width: number }[] }[], m: Record<string, number>, fits: boolean }}
 */
export function paginate(stanzas, { hz, withPinyin, pyWidth, startY }) {
  const py = withPinyin ? hz * 0.4 : 0;
  const m = { hz, pyWidth: withPinyin ? pyWidth(py) : () => 0, gap: hz * 0.11 };
  const maxWidth = PAGE.width - SIDE * 2;
  const top = withPinyin ? hz * 0.92 + py * 1.15 : hz * 0.9;
  const rowAdvance = top + hz * 0.14 + (withPinyin ? hz * 0.52 : hz * 0.72);
  const stanzaGap = hz * (withPinyin ? 0.7 : 0.9);
  const bottomLimit = 92;
  const laterTop = PAGE.height - 78;

  const blocks = stanzas.map((units) => splitSentences(units).flatMap((s) => breakRow(s, maxWidth, m)));
  const pages = [{ rows: [], used: 0 }];
  let y = startY;
  const startOfPage = () => (pages.length === 1 ? startY : laterTop);
  const newPage = () => { pages.push({ rows: [], used: 0 }); y = laterTop; };

  blocks.forEach((rows, index) => {
    const height = rows.length * rowAdvance;
    if (index > 0) y -= stanzaGap;
    // 一章尽量不跨页：放不下、本页已有内容且剩余空间不多时另起一页，否则顺势接排
    if (y - height < bottomLimit && pages[pages.length - 1].rows.length && height < startOfPage() - bottomLimit && y - bottomLimit < (laterTop - bottomLimit) * 0.3) {
      newPage();
    }
    rows.forEach((units) => {
      if (y - rowAdvance < bottomLimit - rowAdvance * 0.2 && pages[pages.length - 1].rows.length) newPage();
      pages[pages.length - 1].rows.push({ units, y: y - top, width: rowWidth(units, m) - m.gap });
      y -= rowAdvance;
    });
  });
  // 单页诗篇：整体略往下移，使版心更居中
  if (pages.length === 1) {
    const free = y - bottomLimit;
    const shift = Math.max(0, Math.min(free * 0.4, 70));
    pages[0].rows.forEach((row) => { row.y -= shift; });
  }
  return { pages, m, fits: pages.length === 1 };
}

export const sizesFor = (withPinyin) => (withPinyin ? [27, 25, 23, 21, 19, 17] : [31, 29, 27, 25, 23, 21, 19]);

/** 选尽可能大的字号：先试一页放下，放不下的长诗按固定字号分页 */
export function chooseLayout(stanzas, opts) {
  for (const hz of sizesFor(opts.withPinyin)) {
    const layout = paginate(stanzas, { ...opts, hz });
    if (layout.fits) return { ...layout, hz };
  }
  const hz = opts.withPinyin ? 20 : 22;
  return { ...paginate(stanzas, { ...opts, hz }), hz };
}

export function pdfFileName(poem, title, withPinyin) {
  return `诗经-${title}-${String(poem.id).padStart(3, "0")}${withPinyin ? "-注音" : ""}.pdf`;
}

const fontCache = new Map();
async function loadFont(url) {
  if (!fontCache.has(url)) {
    fontCache.set(url, fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`字体加载失败 ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    }).catch((error) => { fontCache.delete(url); throw error; }));
  }
  return fontCache.get(url);
}

/**
 * 生成诗篇 PDF。fonts 按顺序尝试：先用只含本篇用字的小字体（几十 KB），
 * 若本篇有字不在其中（例如云端改过的诗文），再换完整子集字体。
 * @param {object} args
 * @param {{ id: number, chapter: string, section: string }} args.poem
 * @param {{ title: string, chapter?: string, section?: string }} args.display 标题等展示文字（简/繁）
 * @param {object[][]} args.stanzas 正文各章的字单元
 * @param {object[]} args.titleUnits 标题字单元
 * @param {boolean} args.withPinyin
 * @param {(string | Uint8Array)[]} args.fonts 字体地址或字节
 * @returns {Promise<Uint8Array>}
 */
export async function buildPoemPdf({ fonts, ...rest }) {
  const sources = Array.isArray(fonts) ? fonts : [fonts];
  let lastError = null;
  for (let i = 0; i < sources.length; i += 1) {
    try {
      const bytes = typeof sources[i] === "string" ? await loadFont(sources[i]) : sources[i];
      const result = await renderPdf({ ...rest, fontBytes: bytes });
      if (!result.missing || i === sources.length - 1) return result.bytes;
    } catch (error) {
      lastError = error;
      if (i === sources.length - 1) throw error;
    }
  }
  throw lastError ?? new Error("没有可用字体");
}

async function renderPdf({ poem, display, stanzas, titleUnits, withPinyin, fontBytes, siteName = "诗三百" }) {
  const [{ PDFDocument, rgb, degrees }, fontkitModule] = await Promise.all([import("pdf-lib"), import("@pdf-lib/fontkit")]);
  const fontkit = fontkitModule.default ?? fontkitModule;
  let missing = false;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: false });
  const glyphs = new Set(font.getCharacterSet());
  const safe = (text) => Array.from(text).map((ch) => (glyphs.has(ch.codePointAt(0)) || /\s/.test(ch) ? ch : ((missing = true), missingGlyph))).join("");
  const color = (c) => rgb(c[0], c[1], c[2]);
  const widthOf = (text, size) => font.widthOfTextAtSize(safe(text), size);

  pdf.setTitle(`诗经·${display.title}`);
  pdf.setAuthor(siteName);
  pdf.setSubject(`${poem.chapter} · ${poem.section}`);
  pdf.setCreator(siteName);

  // 标题区：篇名（可带注音）、出处、装饰线
  const titleSize = 36;
  const titlePy = titleSize * 0.3;
  const titleGap = titleSize * 0.32;
  const titleCells = titleUnits.map((u) => Math.max(titleSize, withPinyin && u.py ? widthOf(u.py, titlePy) : 0) + titleGap);
  const headerTop = PAGE.height - 118;
  const startY = PAGE.height - (withPinyin ? 232 : 222);
  const { pages, hz } = chooseLayout(stanzas, { withPinyin, pyWidth: (size) => (syllable) => widthOf(syllable, size), startY });
  const pySize = hz * 0.4;
  const gap = hz * 0.11;

  const drawUnit = (page, unit, x, baseline, size, pinySize) => {
    const cell = Math.max(size, withPinyin && unit.py ? widthOf(unit.py, pinySize) : 0);
    if (unit.before) {
      page.drawText(safe(unit.before), { x: x - size * 0.08, y: baseline, size, font, color: color(COLORS.ink) });
      x += Array.from(unit.before).length * size * OPEN_ADVANCE;
    }
    const hanW = widthOf(unit.ch, size);
    page.drawText(safe(unit.ch), { x: x + (cell - hanW) / 2, y: baseline, size, font, color: color(COLORS.ink) });
    if (withPinyin && unit.py) {
      const w = widthOf(unit.py, pinySize);
      page.drawText(safe(unit.py), { x: x + (cell - w) / 2, y: baseline + size * 0.92 + pinySize * 0.15, size: pinySize, font, color: color(COLORS.pinyin) });
    }
    // 句读单独占一格，位于汉字行上，不会压到邻字的注音
    if (unit.after) page.drawText(safe(unit.after), { x: x + cell + size * 0.02, y: baseline, size, font, color: color(COLORS.ink) });
    return cell + gap + Array.from(unit.after).length * size * PUNCT_ADVANCE + (unit.before ? Array.from(unit.before).length * size * OPEN_ADVANCE : 0);
  };

  const decorate = (page, index, total) => {
    const { width, height } = PAGE;
    page.drawRectangle({ x: 0, y: 0, width, height, color: color(COLORS.paper) });
    page.drawRectangle({ x: FRAME, y: FRAME, width: width - FRAME * 2, height: height - FRAME * 2, borderColor: color(COLORS.vermilion), borderWidth: 0.9, opacity: 0, borderOpacity: 0.75 });
    page.drawRectangle({ x: FRAME + 5, y: FRAME + 5, width: width - FRAME * 2 - 10, height: height - FRAME * 2 - 10, borderColor: color(COLORS.ink), borderWidth: 0.3, opacity: 0, borderOpacity: 0.5 });
    for (const [cx, cy] of [[FRAME, FRAME], [width - FRAME, FRAME], [FRAME, height - FRAME], [width - FRAME, height - FRAME]]) {
      page.drawRectangle({ x: cx - 3, y: cy - 3, width: 6, height: 6, color: color(COLORS.vermilion) });
    }
    const footer = total > 1 ? `${siteName} · ${index + 1} / ${total}` : siteName;
    const fw = widthOf(footer, 9);
    page.drawText(safe(footer), { x: (width - fw) / 2, y: FRAME + 22, size: 9, font, color: color(COLORS.muted) });
  };

  pages.forEach((entry, index) => {
    const page = pdf.addPage([PAGE.width, PAGE.height]);
    decorate(page, index, pages.length);
    if (index === 0) {
      // 篇名
      const total = titleCells.reduce((a, b) => a + b, 0) - titleGap;
      let x = (PAGE.width - total) / 2;
      titleUnits.forEach((u, i) => {
        const cell = titleCells[i] - titleGap;
        const hanW = widthOf(u.ch, titleSize);
        page.drawText(safe(u.ch), { x: x + (cell - hanW) / 2, y: headerTop, size: titleSize, font, color: color(COLORS.ink) });
        if (withPinyin && u.py) {
          const w = widthOf(u.py, titlePy);
          page.drawText(safe(u.py), { x: x + (cell - w) / 2, y: headerTop + titleSize * 0.92 + titlePy * 0.15, size: titlePy, font, color: color(COLORS.pinyin) });
        }
        x += titleCells[i];
      });
      const sub = `${display.chapter ?? poem.chapter} · ${display.section ?? poem.section}\u3000诗序 ${String(poem.id).padStart(3, "0")}`;
      const sw = widthOf(sub, 11);
      const subY = headerTop - 30;
      page.drawText(safe(sub), { x: (PAGE.width - sw) / 2, y: subY, size: 11, font, color: color(COLORS.soft) });
      // 装饰线：两侧细线夹一枚朱砂菱形
      const lineY = subY - 20;
      const cx = PAGE.width / 2;
      const line = (x1, x2) => page.drawLine({ start: { x: x1, y: lineY }, end: { x: x2, y: lineY }, thickness: 0.6, color: color(COLORS.gold) });
      line(cx - 90, cx - 10); line(cx + 10, cx + 90);
      page.drawSquare({ x: cx, y: lineY - 3.5, size: 5, rotate: degrees(45), color: color(COLORS.vermilion) });
    } else {
      const label = `《${display.title}》`;
      const w = widthOf(label, 10);
      page.drawText(safe(label), { x: (PAGE.width - w) / 2, y: PAGE.height - FRAME - 30, size: 10, font, color: color(COLORS.muted) });
    }
    entry.rows.forEach((row) => {
      let x = (PAGE.width - row.width) / 2;
      row.units.forEach((unit) => { x += drawUnit(page, unit, x, row.y, hz, pySize); });
    });
    if (index === pages.length - 1) {
      // 朱砂印章：「诗三百」竖排三字
      const sw = 26;
      const sh = 62;
      const sx = PAGE.width - SIDE - sw + 6;
      const sy = FRAME + 38;
      page.drawRectangle({ x: sx, y: sy, width: sw, height: sh, color: color(COLORS.vermilion), opacity: 0.92 });
      const fs = 15;
      Array.from("诗三百").forEach((ch, i) => {
        const w = widthOf(ch, fs);
        page.drawText(safe(ch), { x: sx + (sw - w) / 2, y: sy + sh - 17 - i * 18.5, size: fs, font, color: color(COLORS.paper) });
      });
    }
  });
  return { bytes: await pdf.save(), missing };
}
