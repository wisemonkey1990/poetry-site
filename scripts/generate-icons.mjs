/**
 * 由 favicon 的样式生成 PWA / iOS 主屏图标（PNG），输出到 public/icons/。
 * 用法：node scripts/generate-icons.mjs（图标设计改动后重新运行并提交产物）
 */
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const root = path.resolve(import.meta.dirname, "..");
const font = fs.readFileSync(path.join(root, "src/assets/fonts/NotoSerifSC-poem-subset.ttf"));
const outDir = path.join(root, "public/icons");

/** maskable：铺满底色、字放在安全区（中心 80%）内 */
function iconSvg({ maskable }) {
  const radius = maskable ? 0 : 12;
  const size = maskable ? 30 : 38;
  const y = maskable ? 42.5 : 45.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${radius}" fill="#2F5C3E"/><text x="32" y="${y}" font-size="${size}" text-anchor="middle" fill="#F9F6F0" font-family="Noto Serif SC">诗</text></svg>`;
}

function render(svg, size) {
  svg = svg.replace("<svg ", `<svg width="${size}" height="${size}" `);
  return new Resvg(svg, {
    // @ts-expect-error fontBuffers 在 resvg-js 2.5+ 运行时可用，但类型声明里还没有
    font: { fontBuffers: [font], defaultFontFamily: "Noto Serif SC", loadSystemFonts: false },
    fitTo: { mode: "width", value: size },
  }).render().asPng();
}

fs.mkdirSync(outDir, { recursive: true });
/** @type {Array<[string, string, number]>} */
const outputs = [
  ["icon-192.png", iconSvg({ maskable: false }), 192],
  ["icon-512.png", iconSvg({ maskable: false }), 512],
  ["maskable-512.png", iconSvg({ maskable: true }), 512],
  ["apple-touch-icon.png", iconSvg({ maskable: true }), 180],
];
for (const [name, svg, size] of outputs) {
  fs.writeFileSync(path.join(outDir, name), render(svg, size));
  console.log(`icons/${name}`);
}
