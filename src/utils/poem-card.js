/**
 * 古风诗经分享卡片：版式计算（纯函数，可测试）+ canvas 绘制。
 * 竖排、右起左行，题名居右，下缘淡墨远山，朱印落款，与站内「远山」纸色一致。
 */

const SENTENCE_END = /(?<=[。！？；])/u;
const MINOR_PAUSE = /[，、：]/u;
const PUNCT = /[，、：。！？；“”‘’《》（）\s]/u;
export const MAX_COLUMN_CHARS = 12;
export const MAX_COLUMNS = 12;

/** 一句拆成若干「列」，每列是字符数组 [{ ch, gap }]；gap 表示该字后有停顿（逗号）。 */
function sentenceToColumns(sentence, maxChars) {
  const chars = [];
  for (const ch of Array.from(sentence)) {
    if (PUNCT.test(ch)) { if (chars.length && MINOR_PAUSE.test(ch)) chars[chars.length - 1].gap = true; continue; }
    chars.push({ ch, gap: false });
  }
  return splitChars(chars, maxChars);
}

function splitChars(chars, maxChars) {
  if (chars.length) chars[chars.length - 1].gap = false;
  if (chars.length <= maxChars) return chars.length ? [chars] : [];
  // 过长：在最靠近中间的逗号处断开，否则硬切
  const breaks = chars.map((c, i) => (c.gap ? i : -1)).filter((i) => i >= 0);
  const mid = chars.length / 2;
  const at = breaks.length ? breaks.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a)) + 1 : Math.ceil(mid);
  const left = chars.slice(0, at); const right = chars.slice(at);
  return [...splitChars(left, maxChars), ...splitChars(right, maxChars)];
}

/**
 * 把诗文（每个元素是一章）排成列。过长时节录前若干章，最多 maxColumns 列。
 * 返回 { stanzas: [[column,...],...], truncated }
 */
export function layoutPoemColumns(content, { maxColumns = MAX_COLUMNS, maxChars = MAX_COLUMN_CHARS } = {}) {
  const stanzas = [];
  let used = 0;
  let truncated = false;
  for (const stanza of content) {
    const columns = String(stanza).split(SENTENCE_END).flatMap((s) => sentenceToColumns(s, maxChars));
    if (!columns.length) continue;
    if (used + columns.length > maxColumns) {
      truncated = true;
      const room = maxColumns - used;
      if (room > 0 && stanzas.length === 0) stanzas.push(columns.slice(0, room));
      break;
    }
    stanzas.push(columns);
    used += columns.length;
  }
  return { stanzas, truncated };
}

export function cardFileName(poem) { return `诗经-${poem.title}-${String(poem.id).padStart(3, "0")}.png`; }

function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

const W = 1080;
const INK = "#24221f";
const INK_SOFT = "#575149";
const VERMILION = "#9f2f24";
const SERIF = '"Noto Serif SC","Source Han Serif SC","Noto Serif CJK SC","Songti SC","STSong","SimSun","WenQuanYi Zen Hei",serif';

function drawMountains(ctx, H) {
  ctx.save();
  ctx.filter = "blur(3px)";
  const layers = [
    { y: H - 330, amp: 90, alpha: 0.13, seed: 3 },
    { y: H - 250, amp: 80, alpha: 0.2, seed: 8 },
    { y: H - 170, amp: 60, alpha: 0.28, seed: 5 },
  ];
  for (const layer of layers) {
    const r = rng(layer.seed);
    const grad = ctx.createLinearGradient(0, layer.y - layer.amp, 0, H);
    grad.addColorStop(0, `rgba(65,80,72,${layer.alpha})`);
    grad.addColorStop(1, "rgba(65,80,72,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, layer.y);
    let x = 0;
    while (x < W) {
      const step = 120 + r() * 120;
      const peak = layer.y - layer.amp * (0.2 + r() * 0.8);
      ctx.bezierCurveTo(x + step * 0.3, peak, x + step * 0.7, peak + 20, x + step, layer.y - r() * 30);
      x += step;
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPaper(ctx, H) {
  ctx.fillStyle = "#f3eddf";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H * 0.42, H * 0.75);
  glow.addColorStop(0, "rgba(255,253,244,.85)"); glow.addColorStop(1, "rgba(180,150,100,.16)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  const r = rng(11);
  for (let i = 0; i < 5200; i++) {
    ctx.fillStyle = `rgba(120,95,55,${(r() * 0.05).toFixed(3)})`;
    ctx.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
  }
  drawMountains(ctx, H);
  // 双线边框
  ctx.strokeStyle = "rgba(159,47,36,.5)"; ctx.lineWidth = 3; ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = "rgba(159,47,36,.28)"; ctx.lineWidth = 1.2; ctx.strokeRect(50, 50, W - 100, H - 100);
}

function verticalText(ctx, text, x, y, size, step) {
  ctx.font = `${size}px ${SERIF}`;
  Array.from(text).forEach((ch, i) => ctx.fillText(ch, x, y + i * step));
}

function drawSeal(ctx, x, y, size, font) {
  ctx.save();
  ctx.fillStyle = VERMILION;
  ctx.beginPath(); ctx.roundRect(x, y, size, size, 4); ctx.fill();
  ctx.fillStyle = "#f6efe0";
  ctx.font = `bold ${size * 0.4}px ${font}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const cx = x + size / 2; const q = size * 0.24;
  ctx.fillText("诗", cx + q, y + size * 0.3);
  ctx.fillText("三", cx + q, y + size * 0.7);
  ctx.fillText("百", cx - q, y + size * 0.3);
  ctx.restore();
}

/**
 * 绘制卡片，返回 canvas。poem: { id, chapter, section }；display: { title, content }
 * @param {any} poem
 * @param {{ title: string, content: string[] }} display
 * @param {{ url?: string, scale?: number, createCanvas?: (w: number, h: number) => any }} [options]
 */
export function renderPoemCard(poem, display, { url = "", scale = 1, createCanvas } = {}) {
  const { stanzas, truncated } = layoutPoemColumns(display.content);
  const tallest = Math.max(1, ...stanzas.flat().map((c) => c.reduce((n, ch) => n + 1 + (ch.gap ? 0.45 : 0), 0)));
  const colCount = stanzas.reduce((n, s) => n + s.length, 0);
  const gapCount = Math.max(0, stanzas.length - 1);
  const titleBlock = 200;
  const area = W - 2 * 110 - titleBlock;
  const pitch = Math.min(88, area / (colCount + gapCount * 0.6 + (truncated ? 1 : 0)));
  const fs = Math.round(pitch * 0.62);
  const step = Math.round(fs * 1.34);
  const textTop = 190;
  const H = Math.max(1120, Math.round(textTop + tallest * step + 340));

  const canvas = createCanvas ? createCanvas(W * scale, H * scale) : Object.assign(document.createElement("canvas"), { width: W * scale, height: H * scale });
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  drawPaper(ctx, H);

  // 题名（右）与出处
  const titleChars = Array.from(display.title);
  const tSize = Math.min(92, Math.floor(620 / titleChars.length / 1.25));
  const titleX = W - 110 - 60;
  ctx.fillStyle = INK;
  verticalText(ctx, display.title, titleX, textTop, tSize, Math.round(tSize * 1.25));
  ctx.fillStyle = INK_SOFT;
  verticalText(ctx, `诗经·${poem.chapter}·${poem.section}`, titleX - 88, textTop + 8, 30, 42);

  // 正文：右起
  let x = W - 110 - titleBlock - pitch / 2 + 10;
  ctx.fillStyle = INK;
  stanzas.forEach((columns, si) => {
    if (si > 0) x -= pitch * 0.6;
    for (const col of columns) {
      let y = textTop;
      ctx.font = `${fs}px ${SERIF}`;
      for (const { ch, gap } of col) {
        ctx.fillText(ch, x, y);
        y += step + (gap ? step * 0.45 : 0);
      }
      x -= pitch;
    }
  });
  if (truncated) {
    ctx.fillStyle = INK_SOFT;
    verticalText(ctx, "节录", x, textTop, Math.round(fs * 0.6), Math.round(fs * 0.8));
    verticalText(ctx, "⋮", x, textTop + fs * 2.1, fs, fs);
  }

  // 落款：朱印 + 站名网址
  const seal = 96;
  drawSeal(ctx, 110, H - 110 - seal, seal, SERIF);
  ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK; ctx.font = `34px ${SERIF}`;
  ctx.fillText("诗三百 · 思无邪", W - 110, H - 138);
  ctx.fillStyle = INK_SOFT; ctx.font = `24px ${SERIF}`;
  ctx.fillText(String(url).replace(/^https?:\/\//, ""), W - 110, H - 100);
  return canvas;
}
