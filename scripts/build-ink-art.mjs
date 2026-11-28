/**
 * 水墨画素材：程序生成 SVG（峰形 + 位移滤镜毛边 + 皴笔 + 水纹 + 芦苇……），
 * 用 resvg 预先渲染成透明 WebP，放在 public/images/ink/。
 * 网页里把墨色素材当作 CSS 遮罩（mask-image），墨色随晨昼暮夜变化；滤镜只在这里算一次，手机上不再实时渲染。
 *
 * 用法：node scripts/build-ink-art.mjs        （约半分钟；改了画法再重跑，产物提交进仓库）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public/images/ink");

/** 线性同余随机数：同一个种子永远画出同一幅 */
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const f = (n) => Number(n.toFixed(1));
const attrs = (a) => Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(" ");
const tag = (name, a, inner = "") => (inner ? `<${name} ${attrs(a)}>${inner}</${name}>` : `<${name} ${attrs(a)}/>`);
const INK = "#121212";

const FILTERS = `
  <filter id="inkEdge" x="-10%" y="-10%" width="120%" height="130%">
    <feTurbulence type="fractalNoise" baseFrequency="0.011 0.035" numOctaves="4" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.035 0.012" numOctaves="4" seed="3" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.6 1.55" result="ga"/>
    <feComposite in="d" in2="ga" operator="in" result="tex"/>
    <feGaussianBlur in="tex" stdDeviation="0.6"/>
  </filter>
  <filter id="inkWash" x="-10%" y="-20%" width="120%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves="3" seed="11" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="60" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="5"/>
  </filter>
  <filter id="softBrush" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="4"/>
  </filter>
  <filter id="dryBrush" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.04 0.9" numOctaves="2" seed="5" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -3 2.1" result="ga"/>
    <feComposite in="SourceGraphic" in2="ga" operator="in" result="c"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="2" result="n"/>
    <feDisplacementMap in="c" in2="n" scale="5"/>
  </filter>
  <filter id="blot" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="8" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="7"/>
    <feGaussianBlur stdDeviation="0.8"/>
  </filter>`;

function gradient(id, top, bottom, color = INK) {
  return tag("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 },
    [[0, top], [0.18, top * 0.7], [0.5, top * 0.3], [1, bottom]].map(([o, op]) => tag("stop", { offset: o, "stop-color": color, "stop-opacity": f(op * 100) / 100 })).join(""));
}

/** 峰：x 中心, w 半宽（wl/wr 左右不对称）, h 高, s 尖度 */
export function ridgePath({ width, base, peaks, seed, jag = 10, sharp = 1.6 }) {
  const r = rng(seed); const pts = [];
  for (let x = -20; x <= width + 20; x += 6) {
    let y = 0;
    for (const p of peaks) {
      const w = x < p.x ? (p.wl || p.w) : (p.wr || p.w); const t = 1 - Math.abs(x - p.x) / w;
      if (t > 0) y = Math.max(y, p.h * Math.pow(t, p.s || sharp) * (1 + 0.08 * Math.sin(x * 0.09 + p.x)));
    }
    y += (r() - 0.5) * jag * 0.5 + Math.sin(x * 0.021 + seed) * jag + Math.sin(x * 0.067 + seed * 2) * jag * 0.5;
    pts.push([x, base - Math.max(0, y)]);
  }
  let d = `M${pts[0][0]},${base + 400} L${pts[0][0]},${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += ` L${f(pts[i][0])},${f(pts[i][1])}`;
  return `${d} L${width + 20},${base + 400} Z`;
}

/** 皴笔：峰体内的短竖弧 */
function cun({ peaks, base, seed, count = 40, op = 0.5 }) {
  const r = rng(seed); let out = "";
  for (const p of peaks) for (let i = 0; i < count * (p.w || p.wl || 100) / 200; i++) {
    const w = p.w || (p.wl + p.wr) / 2;
    const t = r(); const x = p.x + (r() - 0.5) * w * 1.2 * (1 - t * 0.5);
    const top = base - p.h * Math.pow(Math.max(0, 1 - Math.abs(x - p.x) / w), p.s || 1.6) + 10 + r() * 30;
    const len = 30 + r() * 90; const bend = (x < p.x ? -1 : 1) * (8 + r() * 18);
    out += tag("path", { d: `M${f(x)},${f(top)} q${f(bend)},${f(len * 0.5)} ${f(bend * 0.4)},${f(len)}`, stroke: INK, "stroke-width": f(1 + r() * 2.6), fill: "none", "stroke-linecap": "round", opacity: f(op * (0.4 + r() * 0.6) * 100) / 100 });
  }
  return tag("g", { filter: "url(#dryBrush)" }, out);
}

/** 远近山：每层一条峰线，峰浓脚淡，近层加皴 */
function mountains(layers, prefix = "m", fade = null) {
  let defs = ""; let body = "";
  layers.forEach((L, i) => {
    const id = `${prefix}${i}`;
    defs += gradient(id, L.top, L.bottom ?? 0);
    let g = tag("path", { d: ridgePath(L), fill: `url(#${id})`, filter: L.wash ? "url(#inkWash)" : "url(#inkEdge)" });
    if (L.cun) g += cun({ ...L, seed: L.seed + 99, count: L.cun });
    body += tag("g", { opacity: L.opacity ?? 1 }, g);
  });
  if (fade) {
    // 山脚隐入云气：底部渐隐，避免一条齐平的底边
    const [y0, y1] = fade;
    defs += tag("linearGradient", { id: `${prefix}fadeG`, x1: 0, y1: y0, x2: 0, y2: y1, gradientUnits: "userSpaceOnUse" }, tag("stop", { offset: 0, "stop-color": "#fff" }) + tag("stop", { offset: 1, "stop-color": "#000" }));
    defs += tag("mask", { id: `${prefix}fade`, maskUnits: "userSpaceOnUse", x: -100, y: -100, width: 4000, height: 4000 }, tag("rect", { x: -100, y: -100, width: 4000, height: 4000, fill: `url(#${prefix}fadeG)` }));
    body = tag("g", { mask: `url(#${prefix}fade)` }, body);
  }
  return { defs, body };
}

/** 水纹：长短横笔 */
function water({ y0, y1, x0 = 0, width, n, seed, op = 1 }) {
  const r = rng(seed); let out = "";
  for (let i = 0; i < n; i++) {
    const y = y0 + r() * (y1 - y0); const x = x0 + r() * width; const len = 60 + r() * 220;
    out += tag("path", { d: `M${f(x)},${f(y)} q${f(len / 2)},${f(-3 - r() * 4)} ${f(len)},0`, stroke: INK, "stroke-width": f(0.8 + r() * 1.2), fill: "none", opacity: f((0.25 + r() * 0.4) * op * 100) / 100 });
  }
  return tag("g", { filter: "url(#dryBrush)" }, out);
}

/** 芦苇：弯秆、穗、叶 */
function reeds({ x0, x1, base, n, seed, h = 160 }) {
  const r = rng(seed); let out = "";
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0); const hh = h * (0.5 + r() * 0.7); const lean = (r() - 0.35) * 70;
    out += tag("path", { d: `M${f(x)},${base} q${f(lean * 0.3)},${f(-hh * 0.6)} ${f(lean)},${f(-hh)}`, stroke: INK, "stroke-width": f(1.2 + r() * 2), fill: "none", "stroke-linecap": "round", opacity: f(55 + r() * 40) / 100 });
    if (r() > 0.45) out += tag("path", { d: `M${f(x + lean)},${f(base - hh)} q${f(4 + r() * 8)},10 ${f(2 + r() * 12)},${f(26 + r() * 20)}`, stroke: INK, "stroke-width": f(4 + r() * 4), fill: "none", "stroke-linecap": "round", opacity: 0.5 });
    if (r() > 0.5) out += tag("path", { d: `M${f(x + lean * 0.4)},${f(base - hh * 0.45)} q${f(-30 - r() * 30)},-20 ${f(-50 - r() * 40)},${f(10 + r() * 20)}`, stroke: INK, "stroke-width": f(1 + r() * 1.5), fill: "none", opacity: 0.5 });
  }
  return tag("g", { filter: "url(#softBrush)" }, out);
}

/** 一片叶：两笔弧合成的柳叶形 */
function leaf(x, y, len, width, angle, op) {
  const d = `M0,0 Q${f(len * 0.45)},${f(-width)} ${f(len)},0 Q${f(len * 0.45)},${f(width * 0.55)} 0,0Z`;
  return tag("path", { d, fill: INK, opacity: f(op * 100) / 100, transform: `translate(${f(x)},${f(y)}) rotate(${f(angle)})` });
}

/** 竹：分节竹竿 + 成簇竹叶 */
function bamboo({ width, height, seed }) {
  const r = rng(seed); let stalks = ""; let leaves = "";
  const count = 5;
  for (let i = 0; i < count; i++) {
    const x = width * (0.18 + i * 0.16 + (r() - 0.5) * 0.08); const lean = (r() - 0.5) * 60; const w = 9 + r() * 9; const op = i % 2 ? 0.5 : 0.9;
    let y = height + 10;
    while (y > 40 + r() * 120) {
      const seg = 70 + r() * 60; const t = 1 - y / height;
      const xa = x + lean * (1 - y / height); const xb = x + lean * (1 - (y - seg) / height);
      stalks += tag("path", { d: `M${f(xa)},${f(y - 4)} L${f(xb)},${f(y - seg + 4)}`, stroke: INK, "stroke-width": f(w * (1 - t * 0.35)), "stroke-linecap": "butt", fill: "none", opacity: op });
      if (r() > 0.45 && y < height * 0.8) {
        const dir = r() > 0.5 ? 1 : -1; const n = 3 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) leaves += leaf(xb, y - seg, 70 + r() * 60, 9 + r() * 6, dir > 0 ? 10 + k * 22 + r() * 10 : 170 - k * 22 - r() * 10, op * (0.7 + r() * 0.3));
      }
      y -= seg;
    }
  }
  return tag("g", { filter: "url(#dryBrush)" }, stalks) + tag("g", { filter: "url(#blot)" }, leaves);
}

/** 柳：自左上斜出的老枝，垂下随风弯的长条，条上点叶 */
function willow({ width, height, seed }) {
  const r = rng(seed); let branches = ""; let strands = ""; let leaves = "";
  const limb = (x0, y0, x1, y1, bend, w, op) => tag("path", { d: `M${f(x0)},${f(y0)} Q${f((x0 + x1) / 2)},${f((y0 + y1) / 2 + bend)} ${f(x1)},${f(y1)}`, stroke: INK, "stroke-width": w, fill: "none", "stroke-linecap": "round", opacity: op });
  branches += limb(-40, height * 0.02, width * 0.62, height * 0.1, -30, 22, 0.9);
  branches += limb(width * 0.2, height * 0.05, width * 0.5, height * 0.22, 6, 9, 0.8);
  branches += limb(width * 0.45, height * 0.08, width * 0.86, height * 0.16, -14, 7, 0.75);
  const anchors = [];
  for (let i = 0; i < 40; i++) { const t = r(); anchors.push([-20 + t * width * 0.85, height * (0.03 + t * 0.11) + (r() - 0.5) * 24]); }
  for (const [x, y] of anchors) {
    const len = height * (0.3 + r() * 0.55); const sway = 20 + r() * 70; const op = 0.35 + r() * 0.5;
    // 先向外弯出，再自然垂落
    const c1x = x + sway; const c1y = y + len * 0.15; const c2x = x + sway * 0.6; const c2y = y + len * 0.6; const ex = x + sway * 0.25; const ey = y + len;
    strands += tag("path", { d: `M${f(x)},${f(y)} C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(ex)},${f(ey)}`, stroke: INK, "stroke-width": f(1 + r() * 1.2), fill: "none", opacity: f(op * 100) / 100 });
    for (let k = 2; k < 12; k++) {
      const s = k / 12; if (r() < 0.25) continue;
      const u = 1 - s;
      const lx = u * u * u * x + 3 * u * u * s * c1x + 3 * u * s * s * c2x + s * s * s * ex;
      const ly = u * u * u * y + 3 * u * u * s * c1y + 3 * u * s * s * c2y + s * s * s * ey;
      leaves += leaf(lx, ly, 22 + r() * 14, 5 + r() * 3, (r() > 0.5 ? 60 : 120) + (r() - 0.5) * 30, op * (0.7 + r() * 0.4));
    }
  }
  return tag("g", { filter: "url(#dryBrush)" }, branches + strands) + tag("g", { filter: "url(#blot)" }, leaves);
}

/** 松：曲干、横枝、扇形针叶团 */
function pine({ width, height, seed }) {
  const r = rng(seed); let trunk = ""; let needles = "";
  const bx = width * 0.42;
  const trunkPath = `M${f(bx - 22)},${height} C${f(bx - 50)},${f(height * 0.72)} ${f(bx + 60)},${f(height * 0.56)} ${f(bx + 10)},${f(height * 0.32)} S${f(bx + 20)},${f(height * 0.1)} ${f(bx + 70)},${f(height * 0.05)}`;
  trunk += tag("path", { d: trunkPath, stroke: INK, "stroke-width": 34, fill: "none", "stroke-linecap": "round", opacity: 0.55 });
  trunk += tag("path", { d: trunkPath, stroke: INK, "stroke-width": 14, fill: "none", "stroke-linecap": "round", opacity: 0.6, transform: "translate(-9,0)" });
  // 鳞皮
  for (let i = 0; i < 46; i++) { const y = height * (0.12 + r() * 0.85); const x = bx + (r() - 0.5) * 30 + (y > height * 0.5 ? -10 : 8); trunk += tag("path", { d: `M${f(x)},${f(y)} q8,-5 16,0`, stroke: INK, "stroke-width": 2, fill: "none", opacity: 0.7 }); }
  const arms = [[0.34, -1, 0.4], [0.46, 1, 0.36], [0.6, -1, 0.3], [0.22, 1, 0.3], [0.13, -1, 0.24]];
  const clusters = [];
  for (const [t, dir, len] of arms) {
    const y = height * t; const x = bx + (r() - 0.5) * 20; const ex = x + dir * width * len; const ey = y - 24 - r() * 40;
    trunk += tag("path", { d: `M${f(x)},${f(y)} Q${f((x + ex) / 2)},${f(y + 24)} ${f(ex)},${f(ey)}`, stroke: INK, "stroke-width": 9, fill: "none", "stroke-linecap": "round", opacity: 0.8 });
    clusters.push([ex, ey, 1], [(x + ex) / 2 + dir * 10, y - 4, 0.75]);
  }
  clusters.push([bx + 70, height * 0.05, 1.1]);
  for (const [cx, cy, s0] of clusters) {
    const s = s0 * 1.7;
    // 一团针叶：自中心向上、左右散开的扇形短线，叠一层淡墨
    needles += tag("ellipse", { cx: f(cx), cy: f(cy - 10 * s), rx: f(70 * s), ry: f(22 * s), fill: INK, opacity: 0.12, filter: "url(#inkWash)" });
    for (let k = 0; k < 70; k++) {
      const a = Math.PI * (1.0 + r() * 1.0); const len = (26 + r() * 30) * s;
      const x0 = cx + (r() - 0.5) * 60 * s; const y0 = cy + (r() - 0.5) * 8;
      needles += tag("path", { d: `M${f(x0)},${f(y0)} l${f(Math.cos(a) * len)},${f(Math.sin(a) * len * 0.55)}`, stroke: INK, "stroke-width": 1.7, opacity: f(45 + r() * 45) / 100 });
    }
  }
  return tag("g", { filter: "url(#dryBrush)" }, trunk) + tag("g", { filter: "url(#softBrush)" }, needles);
}

/** 草：田野、薇蕨 */
function grass({ width, height, seed, n = 160 }) {
  const r = rng(seed); let out = "";
  for (let i = 0; i < n; i++) {
    const x = r() * width; const h = 20 + r() * height * 0.7; const lean = (r() - 0.5) * 40;
    out += tag("path", { d: `M${f(x)},${height} q${f(lean * 0.2)},${f(-h * 0.6)} ${f(lean)},${f(-h)}`, stroke: INK, "stroke-width": f(1 + r() * 2), fill: "none", "stroke-linecap": "round", opacity: f(35 + r() * 50) / 100 });
  }
  return tag("g", { filter: "url(#softBrush)" }, out) + tag("rect", { x: 0, y: height - 14, width, height: 14, fill: INK, opacity: 0.25, filter: "url(#inkWash)" });
}

/** 小舟：舟身、篙、蓑笠人 */
function boat(x, y, s = 1) {
  return tag("g", { transform: `translate(${x},${y}) scale(${s})`, filter: "url(#dryBrush)" },
    tag("path", { d: "M-46,0 q46,16 92,-4 q-40,3 -92,4Z", fill: INK, opacity: 0.85 }) +
    tag("path", { d: "M8,-2 l-2,-26", stroke: INK, "stroke-width": 1.6 }) +
    tag("path", { d: "M-10,-4 q4,-12 10,-14 q6,2 8,14", fill: INK, opacity: 0.7 }) +
    tag("path", { d: "M26,-3 L52,-40", stroke: INK, "stroke-width": 1.3, opacity: 0.7 }));
}

/** 桃枝（设色：墨枝 + 胭脂花） */
function blossom({ x, y, seed, scale = 1 }) {
  const r = rng(seed); let br = ""; let flowers = ""; const tips = [];
  function branch(x0, y0, ang, len, w, depth) {
    const x1 = x0 + Math.cos(ang) * len; const y1 = y0 + Math.sin(ang) * len;
    br += tag("path", { d: `M${f(x0)},${f(y0)} Q${f((x0 + x1) / 2 + (r() - 0.5) * 20)},${f((y0 + y1) / 2 + (r() - 0.5) * 20)} ${f(x1)},${f(y1)}`, stroke: "#1e1a16", "stroke-width": f(w), fill: "none", "stroke-linecap": "round" });
    tips.push([x1, y1]);
    if (depth <= 0) return;
    branch(x1, y1, ang - 0.4 - r() * 0.4, len * (0.6 + r() * 0.2), w * 0.65, depth - 1);
    if (r() > 0.3) branch(x1, y1, ang + 0.3 + r() * 0.4, len * (0.5 + r() * 0.2), w * 0.6, depth - 1);
  }
  branch(0, 0, -0.5, 150, 12, 3);
  for (const [tx, ty] of tips) for (let i = 0; i < 4; i++) {
    const cx = tx + (r() - 0.5) * 34; const cy = ty + (r() - 0.5) * 30; const rad = 5 + r() * 6;
    flowers += tag("circle", { cx: f(cx), cy: f(cy), r: f(rad), fill: r() > 0.3 ? "#d4664f" : "#e48f7a", opacity: f(55 + r() * 40) / 100 });
    flowers += tag("circle", { cx: f(cx), cy: f(cy), r: f(rad * 0.35), fill: "#7a1f14", opacity: 0.6 });
  }
  return tag("g", { transform: `translate(${x},${y}) scale(${scale})` }, tag("g", { filter: "url(#dryBrush)" }, br) + tag("g", { filter: "url(#blot)" }, flowers));
}

function svg(width, height, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${FILTERS}${defs}</defs>${body}</svg>`;
}

/** 首页立轴：远山、主峰、近岸三层，中间夹 CSS 云雾 */
const HOME_W = 1600; const HOME_H = 1000;
export const ART = {
  "home-far": () => { const m = mountains([
    { width: HOME_W, base: 640, seed: 3, top: 0.22, wash: true, peaks: [{ x: 140, w: 220, h: 300 }, { x: 470, wl: 160, wr: 280, h: 380 }, { x: 820, w: 280, h: 260 }, { x: 1100, w: 220, h: 200 }, { x: 1420, w: 260, h: 240 }], jag: 8 },
  ], "f", [460, 700]); return svg(HOME_W, HOME_H, m.defs, m.body); },
  "home-peaks": () => { const m = mountains([
    { width: HOME_W, base: 760, seed: 8, top: 0.85, peaks: [{ x: 250, wl: 140, wr: 190, h: 540, s: 1.15 }, { x: 360, w: 96, h: 420, s: 1.3 }, { x: 515, wl: 120, wr: 170, h: 360, s: 1.35 }, { x: 660, w: 100, h: 220 }], jag: 12, cun: 44 },
    { width: HOME_W, base: 830, seed: 15, top: 0.5, opacity: 0.75, peaks: [{ x: 900, wl: 180, wr: 130, h: 260, s: 1.25 }, { x: 1060, w: 130, h: 160 }], jag: 10, cun: 16 },
  ], "p", [600, 860]); return svg(HOME_W, HOME_H, m.defs, m.body); },
  "home-near": () => { const m = mountains([
    { width: HOME_W, base: 1010, seed: 21, top: 0.9, bottom: 0.25, peaks: [{ x: 40, wl: 130, wr: 330, h: 210, s: 1.2 }, { x: 1420, wl: 280, wr: 220, h: 150 }], jag: 14, cun: 18 },
  ], "n"); return svg(HOME_W, HOME_H, m.defs, m.body + water({ y0: 820, y1: 980, width: 1450, x0: 60, n: 46, seed: 4 }) + boat(760, 880, 1.1) + reeds({ x0: 1240, x1: 1600, base: 1000, n: 26, seed: 31, h: 200 })); },

  /** 阅读页画材（按诗意取用） */
  "peaks": () => { const m = mountains([
    { width: 1000, base: 660, seed: 5, top: 0.2, wash: true, peaks: [{ x: 160, w: 200, h: 260 }, { x: 640, w: 260, h: 220 }, { x: 900, w: 160, h: 180 }], jag: 6 },
    { width: 1000, base: 760, seed: 9, top: 0.85, peaks: [{ x: 300, wl: 130, wr: 170, h: 520, s: 1.15 }, { x: 410, w: 90, h: 400, s: 1.3 }, { x: 560, wl: 110, wr: 150, h: 300, s: 1.35 }], jag: 12, cun: 40 },
  ], "k", [560, 800]); return svg(1000, 900, m.defs, m.body); },
  "hills": () => { const m = mountains([
    { width: 1000, base: 560, seed: 13, top: 0.2, wash: true, peaks: [{ x: 200, w: 260, h: 200 }, { x: 720, w: 300, h: 240 }], jag: 6 },
    { width: 1000, base: 700, seed: 17, top: 0.6, peaks: [{ x: 120, wl: 160, wr: 260, h: 230, s: 1.4 }, { x: 640, w: 240, h: 180, s: 1.5 }, { x: 930, w: 150, h: 140 }], jag: 9, cun: 16 },
  ], "h", [520, 760]); return svg(1000, 900, m.defs, m.body); },
  "distant": () => { const m = mountains([
    { width: 1000, base: 520, seed: 23, top: 0.18, wash: true, peaks: [{ x: 180, w: 220, h: 170 }, { x: 560, w: 260, h: 140 }, { x: 880, w: 180, h: 120 }], jag: 5 },
  ], "d", [380, 580]); return svg(1000, 900, m.defs, m.body); },
  "water": () => svg(1000, 420, "", water({ y0: 30, y1: 400, width: 1000, x0: -80, n: 60, seed: 9 })),
  "boat": () => svg(240, 150, "", boat(120, 110, 1.4)),
  "reeds": () => svg(700, 900, "", reeds({ x0: -20, x1: 520, base: 900, n: 52, seed: 12, h: 480 }) + reeds({ x0: 420, x1: 720, base: 900, n: 20, seed: 5, h: 280 })),
  "willow": () => svg(800, 900, "", willow({ width: 800, height: 900, seed: 6 })),
  "bamboo": () => svg(700, 1000, "", bamboo({ width: 700, height: 1000, seed: 14 })),
  "pine": () => svg(700, 900, "", pine({ width: 700, height: 900, seed: 3 })),
  "grass": () => svg(1000, 260, "", grass({ width: 1000, height: 260, seed: 19 })),
  "blossom": () => svg(700, 620, "", blossom({ x: 40, y: 560, seed: 7, scale: 1.25 })),
};

/** 着色画材直接显示，其余当遮罩（只取透明度） */
export const COLORED = new Set(["blossom"]);

if (import.meta.url === `file://${process.argv[1]}`) {
  const sharp = (await import("sharp")).default;
  fs.mkdirSync(outDir, { recursive: true });
  const only = process.argv.slice(2);
  for (const [name, draw] of Object.entries(ART)) {
    if (only.length && !only.includes(name)) continue;
    const source = draw();
    const width = Number(/width="(\d+)"/.exec(source)[1]);
    const scale = name.startsWith("home") ? 1.2 : 1;
    const png = new Resvg(source, { fitTo: { mode: "width", value: Math.round(width * scale) }, background: "rgba(0,0,0,0)" }).render().asPng();
    const file = path.join(outDir, `${name}.webp`);
    await sharp(png).webp({ quality: COLORED.has(name) ? 82 : 72, alphaQuality: 70, effort: 6 }).toFile(file);
    console.log(`${name}.webp  ${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
  }
}
