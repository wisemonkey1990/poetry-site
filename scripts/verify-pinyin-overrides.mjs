/**
 * 校验多音字校正：对全部诗篇（简体 + 繁体 opencc twp）逐字对比「改动前 / 改动后」显示的拼音。
 *
 * 用法：
 *   node scripts/verify-pinyin-overrides.mjs <apply-rules.json> [--baseline-ref <git ref>]
 *
 *   --baseline-ref  改动前的代码取自该 git 提交（git show <ref>:src/utils/...）；
 *                   省略时使用内置的 legacy 基线（main 上原有的 6 条校正，逻辑与旧 pinyin-overrides.js 相同）。
 *   不带 apply-rules.json 时只做不依赖规则文件的检查（见 verifyWithoutRules）。
 *
 * 断言（失败则退出码 1）：
 *   (a) 简体：改动的 (poemId, lineIndex, charIndex) 集合 == 规则覆盖且旧读音 != correct 的出现处；每处改后读音 == correct
 *   (b) 简体：其余字读音零变化
 *   (c) 繁体：与简体同位置的字同样改变（于->於 另按「於 读 yú，叹词词语读 wū」处理），其余零变化
 *   (d) renderRubyLines（预计算表路径）与 toRubyHTML（运行时路径）对全部诗篇输出一致
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Converter } from "opencc-js/cn2t";
import poems from "../src/data/poems.json" with { type: "json" };
import pinyinTable from "../src/data/pinyin-table.json" with { type: "json" };
import { charPinyin, toRubyHTML } from "../src/utils/pinyin.js";
import { groupPoemText, HAN_CHAR, renderRuby } from "../src/utils/pinyin-ruby.js";
import { BASE_RULES } from "./generate-pinyin-overrides.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const toTraditional = Converter({ from: "cn", to: "twp" });
const getTone = (ch) => pinyinTable[ch] ?? charPinyin(ch);
const RUBY = /ruby-text">(.)<rt>([^<]*)<\/rt>/gsu;

/** 从 ruby HTML 取出每个字符位置（Array.from(line) 下标）的拼音，非汉字为 null */
function tonesFromHtml(line, html) {
  const tones = [...html.matchAll(RUBY)].map((m) => m[2]);
  let k = 0;
  return Array.from(line).map((c) => (HAN_CHAR.test(c) ? tones[k++] : null));
}

/** 内置 legacy 基线：旧 pinyin-overrides.js + 旧 renderRuby 的逻辑 */
function legacyRender(text) {
  const source = String(text);
  const phrases = groupPoemText(source);
  const chars = Array.from(source);
  const overrides = new Map();
  if (phrases.join("") === source) {
    const words = [...BASE_RULES.words, { word: "參差", tones: ["cēn", "cī"] }];
    for (const { word, tones } of words) {
      const target = Array.from(word);
      for (let i = 0; i + target.length <= chars.length; i += 1) {
        if (target.every((ch, k) => chars[i + k] === ch)) target.forEach((_, k) => overrides.set(i + k, tones[k]));
      }
    }
  }
  return Array.from(phrases.join("")).map((c, index) => (HAN_CHAR.test(c) ? overrides.get(index) ?? (c === "覃" ? "tán" : getTone(c)) : null));
}

/** 从 git 提交取旧代码并在临时目录中加载 */
async function gitBaselineRender(ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pinyin-baseline-"));
  for (const f of ["html.js", "pinyin-overrides.js", "pinyin-ruby.js"]) {
    fs.writeFileSync(path.join(dir, f), execFileSync("git", ["show", `${ref}:src/utils/${f}`], { cwd: root, encoding: "utf8" }));
  }
  const mod = await import(pathToFileURL(path.join(dir, "pinyin-ruby.js")).href);
  return (text) => tonesFromHtml(text, mod.renderRuby(text, getTone));
}

/** 全部诗句：简体与繁体（对齐，逐字一一对应） */
function allLines() {
  const out = [];
  for (const p of poems) {
    p.content.forEach((line, li) => {
      const trad = toTraditional(line);
      if (Array.from(trad).length !== Array.from(line).length) throw new Error(`繁体转换改变长度：${p.id} ${line}`);
      out.push({ poemId: p.id, li, simp: line, trad });
    });
  }
  return out;
}

/**
 * 由规则文件独立计算「简体下每个位置应有的读音」（不复用生成脚本/运行时代码）。
 * 规则：词规则（更长优先，等长最左）> 字规则（except 词内除外）；ids 限定诗篇直接按诗篇 id 判断。
 * 返回 Map(key -> {tone, kind}) 以及 exceptKept（命中 all 规则的 except 词、因而保持原读音的位置）
 */
function expectedClaims(rules, line, poemId, overlaps) {
  const chars = Array.from(line);
  const claims = new Map(); // idx -> {len, start, tone}
  const exceptKept = new Set();
  const consider = (idx, len, start, tone) => {
    const cur = claims.get(idx);
    if (cur && cur.tone !== tone) overlaps.push(`${poemId} ${line} [${idx}] ${cur.tone}(len${cur.len}) vs ${tone}(len${len})`);
    if (!cur || len > cur.len || (len === cur.len && start < cur.start)) claims.set(idx, { len, start, tone });
  };
  const wordRule = (word, char, pos, tone) => {
    const w = Array.from(word);
    for (let s = 0; s + w.length <= chars.length; s += 1) {
      if (!w.every((c, k) => chars[s + k] === c)) continue;
      w.forEach((c, k) => { if (c === char && (pos == null || pos === k)) consider(s + k, w.length, s, tone); });
    }
  };
  const allRule = (char, tone, except) => {
    chars.forEach((c, i) => {
      if (c !== char) return;
      const inExcept = except.some((w) => {
        const W = Array.from(w);
        for (let s = i - W.length + 1; s <= i; s += 1) if (s >= 0 && W.every((x, k) => chars[s + k] === x)) return true;
        return false;
      });
      if (inExcept) exceptKept.add(i);
      else consider(i, 0, i, tone);
    });
  };
  for (const w of BASE_RULES.words) w.tones.forEach((t, k) => t && wordRule(w.word, Array.from(w.word)[k], k, t));
  for (const c of BASE_RULES.chars) allRule(c.char, c.tone, c.except);
  for (const { char, correct, rule } of rules) {
    if (rule.ids && !rule.ids.includes(poemId)) continue;
    if (rule.all) allRule(char, correct, rule.except ?? []);
    else for (const word of rule.words) wordRule(word, char, rule.pos, correct);
  }
  return { claims, exceptKept };
}

function diffSets(a, b) {
  return { onlyA: [...a].filter((k) => !b.has(k)), onlyB: [...b].filter((k) => !a.has(k)) };
}

/** 预计算路径（reading.js 的 renderRubyLines）的等价实现：拼音表取字。node 下无法加载 reading.js（import.meta.glob），测试里会传入真实实现 */
async function defaultRenderRubyLines(lines) {
  return lines.map((line) => renderRuby(String(line), getTone));
}

/** 主校验。返回报告对象；report.ok 表示全部通过 */
export async function verify({ rules, baselineRef = null, renderRubyLines = defaultRenderRubyLines } = {}) {
  const baseline = baselineRef ? await gitBaselineRender(baselineRef) : legacyRender;
  const lines = allLines();
  const report = { ok: true, failures: [], stats: {}, notes: [] };
  const fail = (msg) => { report.ok = false; if (report.failures.length < 60) report.failures.push(msg); };

  // 改动后：预计算路径（renderRubyLines）；同时校验 (d)
  let htmlMismatch = 0;
  const after = { simp: [], trad: [] };
  const before = { simp: [], trad: [] };
  for (const p of poems) {
    const simpLines = p.content;
    const tradLines = simpLines.map((l) => toTraditional(l));
    const [aS, aT] = [await renderRubyLines(simpLines), await renderRubyLines(tradLines)];
    simpLines.forEach((l, i) => {
      if (aS[i] !== toRubyHTML(l)) { htmlMismatch += 1; fail(`(d) 简体 HTML 不一致 poem ${p.id} line ${i}`); }
      if (aT[i] !== toRubyHTML(tradLines[i])) { htmlMismatch += 1; fail(`(d) 繁体 HTML 不一致 poem ${p.id} line ${i}`); }
    });
    after.simp.push(...simpLines.map((l, i) => tonesFromHtml(l, aS[i])));
    after.trad.push(...tradLines.map((l, i) => tonesFromHtml(l, aT[i])));
  }
  for (const { simp, trad } of lines) { before.simp.push(baseline(simp)); before.trad.push(baseline(trad)); }
  report.stats.lines = lines.length;
  report.stats.htmlMismatch = htmlMismatch;

  const changed = { simp: new Set(), trad: new Set() };
  const keyOf = (n, idx) => `${lines[n].poemId}|${lines[n].li}|${idx}`;
  for (const mode of ["simp", "trad"]) {
    lines.forEach((_, n) => before[mode][n].forEach((t, idx) => { if (t !== after[mode][n][idx]) changed[mode].add(keyOf(n, idx)); }));
  }
  report.stats.changedSimp = changed.simp.size;
  report.stats.changedTrad = changed.trad.size;

  if (!rules) {
    // 无规则文件：只确认没有改到非汉字位置、繁简对齐
    return report;
  }

  // 期望集合
  const expected = { simp: new Set(), trad: new Set() };
  const covered = { simp: 0, trad: 0 };
  const perChar = {};
  let yuTrad = 0;
  const overlaps = [];
  lines.forEach((ln, n) => {
    const { claims, exceptKept } = expectedClaims(rules, ln.simp, ln.poemId, overlaps);
    const sChars = Array.from(ln.simp);
    const tChars = Array.from(ln.trad);
    sChars.forEach((c, idx) => {
      if (!HAN_CHAR.test(c)) return;
      const claim = claims.get(idx);
      // 简体
      let want = before.simp[n][idx];
      if (claim) { want = claim.tone; covered.simp += 1; }
      const k = keyOf(n, idx);
      if (after.simp[n][idx] !== want) fail(`(a/b) 简体 ${k} ${ln.simp} 「${c}」读音 ${after.simp[n][idx]}，应为 ${want}（旧 ${before.simp[n][idx]}）`);
      if (want !== before.simp[n][idx]) { expected.simp.add(k); perChar[c] = (perChar[c] ?? 0) + 1; }
      // 繁体：被规则覆盖的取规则读音；于->於 且未被词规则（于穆等 wū）覆盖的取 yú；
      // except 词内保持「简体下的原读音」；其余保持繁体旧读音
      let wantT = before.trad[n][idx];
      if (claim) { wantT = claim.tone; covered.trad += 1; }
      else if (c === "于" && tChars[idx] === "於") { wantT = "yú"; yuTrad += 1; }
      else if (exceptKept.has(idx)) wantT = before.simp[n][idx];
      if (after.trad[n][idx] !== wantT) fail(`(c) 繁体 ${k} ${ln.trad} 「${tChars[idx]}」读音 ${after.trad[n][idx]}，应为 ${wantT}（旧 ${before.trad[n][idx]}）`);
      if (wantT !== before.trad[n][idx]) expected.trad.add(k);
    });
  });
  for (const mode of ["simp", "trad"]) {
    const { onlyA, onlyB } = diffSets(changed[mode], expected[mode]);
    if (onlyA.length) fail(`(${mode === "simp" ? "b" : "c"}) ${mode} 意外改动 ${onlyA.length} 处：${onlyA.slice(0, 8).join(", ")}`);
    if (onlyB.length) fail(`(${mode === "simp" ? "a" : "c"}) ${mode} 应改未改 ${onlyB.length} 处：${onlyB.slice(0, 8).join(", ")}`);
    report.stats[`expected${mode === "simp" ? "Simp" : "Trad"}`] = expected[mode].size;
  }
  report.overlaps = overlaps;
  report.stats.overlappingClaimsDifferentTone = overlaps.length;
  report.stats.coveredOccurrencesSimp = covered.simp;
  report.stats.traditionalYuNoClaim = yuTrad;
  report.stats.changedPerCharSimp = perChar;

  // 参考信息：改动后繁简读音不一致的位置（含 main 上原有的差异）
  let diverge = 0;
  const divergeSample = [];
  lines.forEach((ln, n) => after.simp[n].forEach((t, idx) => {
    if (t !== after.trad[n][idx]) {
      diverge += 1;
      if (divergeSample.length < 200) divergeSample.push(`${keyOf(n, idx)} ${Array.from(ln.simp)[idx]}/${Array.from(ln.trad)[idx]} ${t}/${after.trad[n][idx]}`);
    }
  }));
  report.stats.afterDivergeSimpTrad = diverge;
  report.divergeSample = divergeSample;
  return report;
}

async function main() {
  const argv = process.argv.slice(2);
  let rulesPath = null;
  let baselineRef = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--baseline-ref") baselineRef = argv[++i];
    else rulesPath = path.resolve(argv[i]);
  }
  const rules = rulesPath ? JSON.parse(fs.readFileSync(rulesPath, "utf8")) : null;
  const report = await verify({ rules, baselineRef });
  console.log(JSON.stringify(report.stats, null, 1));
  if (report.overlaps?.length) console.log(`overlaps (resolved by priority):\n${report.overlaps.join("\n")}`);
  if (report.divergeSample?.length && process.env.SHOW_DIVERGE) console.log(report.divergeSample.join("\n"));
  if (!report.ok) {
    console.error(`FAILED (${report.failures.length}+)\n${report.failures.join("\n")}`);
    process.exit(1);
  }
  console.log("OK");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
