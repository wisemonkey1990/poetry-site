/**
 * 构建时为每首诗生成分享预览图（og:image，1200×630）。
 * 纸色底、朱色竖线、题名、篇章、前几句诗文，与站内「远山」风格一致。
 * 字体用仓库内的思源宋体子集（src/assets/fonts/NotoSerifSC-poem-subset.ttf）。
 */
import { Resvg } from "@resvg/resvg-js";
import { escapeHtml } from "./static-pages.mjs";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
const FONT_FAMILY = "Noto Serif SC";

/** 取能放进卡片的前几句（按句号等断句，最多 maxLines 行、每行最多 maxChars 字） */
export function pickExcerpt(content, { maxLines = 4, maxChars = 18 } = {}) {
  const sentences = (Array.isArray(content) ? content : [])
    .flatMap((stanza) => String(stanza).split(/(?<=[。！？；])/u))
    .map((s) => s.trim())
    .filter(Boolean);
  const lines = [];
  for (const sentence of sentences) {
    if (lines.length >= maxLines) break;
    if ([...sentence].length <= maxChars) { lines.push(sentence); continue; }
    // 过长的句子在逗号处拆开
    let current = "";
    for (const part of sentence.split(/(?<=[，、：])/u)) {
      if ([...current + part].length > maxChars && current) { lines.push(current); current = ""; if (lines.length >= maxLines) break; }
      current += part;
    }
    if (current && lines.length < maxLines) lines.push([...current].slice(0, maxChars).join(""));
  }
  return lines;
}

export function buildOgSvg(poem) {
  const title = [...String(poem.title)];
  const titleSize = title.length <= 3 ? 96 : title.length <= 5 ? 80 : 64;
  const lines = pickExcerpt(poem.content);
  const text = lines.map((line, i) => `<text x="300" y="${300 + i * 62}" font-size="40" letter-spacing="6" fill="#3a332b">${escapeHtml(line)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <rect width="100%" height="100%" fill="#f3eddf"/>
  <rect x="28" y="28" width="${OG_WIDTH - 56}" height="${OG_HEIGHT - 56}" fill="none" stroke="#b8a98f" stroke-width="2"/>
  <rect x="40" y="40" width="${OG_WIDTH - 80}" height="${OG_HEIGHT - 80}" fill="none" stroke="#d6cab3" stroke-width="1"/>
  <path d="M40 520 C 200 470, 320 500, 460 470 S 760 430, 900 480 S 1100 470, 1160 450 L1160 590 L40 590 Z" fill="#e7dcc7" opacity=".7"/>
  <g font-family="${FONT_FAMILY}">
    <rect x="200" y="96" width="6" height="150" fill="#9f2f24"/>
    <text x="236" y="${170 + titleSize / 3}" font-size="${titleSize}" letter-spacing="${Math.round(titleSize / 4)}" fill="#24221f">${escapeHtml(poem.title)}</text>
    <text x="${OG_WIDTH - 120}" y="140" font-size="30" letter-spacing="8" fill="#9f2f24" text-anchor="end">${escapeHtml(poem.chapter)} · ${escapeHtml(poem.section)}</text>
    ${text}
    <rect x="${OG_WIDTH - 186}" y="${OG_HEIGHT - 150}" width="78" height="78" fill="#9f2f24" rx="4"/>
    <text x="${OG_WIDTH - 147}" y="${OG_HEIGHT - 96}" font-size="44" fill="#f3eddf" text-anchor="middle">诗</text>
    <text x="300" y="${OG_HEIGHT - 82}" font-size="26" letter-spacing="6" fill="#7a6f60">诗经 · 诗三百</text>
  </g>
</svg>`;
}

export function renderOgPng(poem, fontBuffer) {
  const resvg = new Resvg(buildOgSvg(poem), {
    font: { fontBuffers: [fontBuffer], defaultFontFamily: FONT_FAMILY, loadSystemFonts: false },
    fitTo: { mode: "width", value: OG_WIDTH },
  });
  return resvg.render().asPng();
}
