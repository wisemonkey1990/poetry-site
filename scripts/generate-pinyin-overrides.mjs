/**
 * 生成多音字校正数据 src/data/pinyin-overrides.json
 *
 * 用法：
 *   npm run pinyin:overrides -- <apply-rules.json>
 *   node scripts/generate-pinyin-overrides.mjs <apply-rules.json> [--out <file>]
 *
 * 输入 apply-rules.json 是经审校接受的规则列表，每项
 *   { char, correct, rule: { words, all, except, ids, pos } }：
 *   - rule.words：这些词在句中出现时，词内的 char（rule.pos 非空时仅词内第 pos 位）读 correct
 *   - rule.all：char 的全部出现处读 correct，但位于 rule.except 词内的出现处保持拼音表原读音
 *   - rule.ids：仅对这些诗篇生效（运行时不知道诗篇 id，本脚本把它展开为在其他诗篇中不会出现的上下文词）
 * 另外合并 BASE_RULES（main 上已有的 6 条校正）和繁体专属规则（於）。
 *
 * 繁体：每条词规则/字规则都会同时生成繁体写法（opencc cn -> twp；同时取诗文逐字对齐后的实际写法），
 * 因为详情页的繁体拼音也走同一个 renderRuby。
 *
 * 运行时优先级（见 src/utils/pinyin-overrides.js）：
 *   词规则优先于字规则；多个词规则同时命中同一位置时，更长的词优先；
 *   字规则不作用于其 except 词内的出现处（回退到拼音表读音）；都不命中则用拼音表读音。
 * 本脚本会检测并报告规则冲突：同一位置、等长词规则、不同读音 => 失败（退出码 1）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Converter } from "opencc-js/cn2t";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HAN = /[㐀-鿿]/;
const toTraditional = Converter({ from: "cn", to: "twp" });

/** main 上已有的校正（保持不变）。tones 中 "" 表示该位置不校正 */
export const BASE_RULES = {
  words: [
    { word: "参差", tones: ["cēn", "cī"] },
    { word: "差池", tones: ["cī", "chí"] },
    { word: "于差", tones: ["yú", "chāi"] },
    { word: "既差", tones: ["jì", "chāi"] },
    { word: "覃耜", tones: ["tǎn", "sì"] }, // 与《大田》注释「覃耜（tǎn sì）」一致
  ],
  chars: [{ char: "覃", tone: "tán", except: [] }],
};

function parseArgs(argv) {
  const args = { input: null, out: path.join(root, "src/data/pinyin-overrides.json") };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") args.out = path.resolve(argv[++i]);
    else if (!args.input) args.input = path.resolve(argv[i]);
  }
  return args;
}

/** 整合简体规则：words: Map<word, Map<idx, tone>>，chars: Map<char, {tone, except:Set}> */
export function collectSimplified(rules, poems) {
  const words = new Map();
  const chars = new Map();
  const errors = [];
  const origin = new Map(); // `${word}|${idx}` -> 来源，便于报错

  const addWord = (word, idx, tone, from) => {
    const m = words.get(word) ?? new Map();
    words.set(word, m);
    const key = `${word}|${idx}`;
    if (m.has(idx) && m.get(idx) !== tone) errors.push(`同一词同一位置读音冲突：${word}[${idx}] ${m.get(idx)} (${origin.get(key)}) vs ${tone} (${from})`);
    else { m.set(idx, tone); origin.set(key, from); }
  };

  for (const w of BASE_RULES.words) w.tones.forEach((t, k) => t && addWord(w.word, k, t, "base"));
  for (const c of BASE_RULES.chars) chars.set(c.char, { tone: c.tone, except: new Set(c.except) });

  for (const item of rules) {
    const { char, correct, rule } = item;
    const from = `#${item.id} ${char}${correct}`;
    if (rule.all) {
      if (rule.ids) { errors.push(`${from}: all + ids 不支持`); continue; }
      const prev = chars.get(char);
      if (prev) { errors.push(`${from}: 字规则重复（已有 ${prev.tone}）`); continue; }
      chars.set(char, { tone: correct, except: new Set(rule.except ?? []) });
      for (const w of rule.except ?? []) if (!Array.from(w).includes(char)) errors.push(`${from}: except 词 ${w} 不含 ${char}`);
      continue;
    }
    for (const word of rule.words ?? []) {
      const arr = Array.from(word);
      const idxs = arr.map((c, k) => (c === char && (rule.pos == null || rule.pos === k) ? k : -1)).filter((k) => k >= 0);
      if (!idxs.length) { errors.push(`${from}: 词 ${word} 在 pos=${rule.pos} 处不含 ${char}`); continue; }
      const targets = rule.ids ? expandByIds(word, idxs, rule.ids, poems, from, errors) : [{ word, idxs }];
      for (const t of targets) for (const k of t.idxs) addWord(t.word, k, correct, from);
    }
  }
  return { words, chars, errors };
}

/** 把「仅限某些诗篇」的词规则展开为不会在其他诗篇出现的上下文词 */
function expandByIds(word, idxs, ids, poems, from, errors) {
  const allowed = new Set(ids);
  const others = poems.filter((p) => !allowed.has(p.id)).flatMap((p) => p.content);
  const out = new Map();
  const hasSubstring = (s) => others.some((l) => l.includes(s));
  if (!hasSubstring(word)) return [{ word, idxs }];
  for (const p of poems) {
    if (!allowed.has(p.id)) continue;
    for (const line of p.content) {
      const chars = Array.from(line);
      for (let s = 0; s + Array.from(word).length <= chars.length; s += 1) {
        if (chars.slice(s, s + Array.from(word).length).join("") !== word) continue;
        const e = s + Array.from(word).length;
        let a = s;
        while (a > 0 && HAN.test(chars[a - 1])) a -= 1;
        let b = e;
        while (b < chars.length && HAN.test(chars[b])) b += 1;
        let found = null;
        for (let r = 1; r <= Math.max(s - a, b - e) && !found; r += 1) {
          const lo = Math.max(a, s - r);
          const hi = Math.min(b, e + r);
          const ctx = chars.slice(lo, hi).join("");
          if (!hasSubstring(ctx)) found = { word: ctx, idxs: idxs.map((k) => k + (s - lo)) };
        }
        if (!found) errors.push(`${from}: 无法为 ${word} 找到唯一上下文（${line}）`);
        else out.set(found.word, found);
      }
    }
  }
  return [...out.values()];
}

/** 生成繁体变体：词 -> 繁体写法集合（opencc 直接转换 + 诗文对齐写法） */
function buildTraditionalizer(poems) {
  const pairs = []; // [简体行字符数组, 繁体行字符数组]
  for (const p of poems) {
    for (const line of p.content) {
      const s = Array.from(line);
      const t = Array.from(toTraditional(line));
      if (s.length !== t.length) throw new Error(`繁体转换改变了长度：${p.id} ${line}`);
      pairs.push([s, t]);
    }
  }
  const variants = (word) => {
    const w = Array.from(word);
    const set = new Set();
    const direct = toTraditional(word);
    if (Array.from(direct).length !== w.length) throw new Error(`词 ${word} 的繁体 ${direct} 长度改变，无法按位置校正`);
    set.add(direct);
    for (const [s, t] of pairs) {
      for (let i = 0; i + w.length <= s.length; i += 1) {
        let ok = true;
        for (let k = 0; k < w.length && ok; k += 1) ok = s[i + k] === w[k];
        if (ok) set.add(t.slice(i, i + w.length).join(""));
      }
    }
    return [...set];
  };
  return { variants };
}

/** 检查词规则之间的冲突；返回 { errors, resolved } */
export function checkWordConflicts(words, corpusLines = []) {
  const entries = [...words].map(([word, m]) => ({ word, chars: Array.from(word), m }));
  const errors = [];
  const resolved = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const A = entries[i];
      const B = entries[j];
      // B 相对 A 的起始偏移 d：-(B.len-1) .. A.len-1
      for (let d = -(B.chars.length - 1); d < A.chars.length; d += 1) {
        let overlapOk = true;
        for (let k = Math.max(0, d); k < Math.min(A.chars.length, d + B.chars.length) && overlapOk; k += 1) overlapOk = A.chars[k] === B.chars[k - d];
        if (!overlapOk) continue;
        for (const [ia, ta] of A.m) {
          const ib = ia - d;
          if (ib < 0 || ib >= B.chars.length || !B.m.has(ib)) continue;
          const tb = B.m.get(ib);
          if (ta === tb) continue;
          const msg = `${A.word}[${ia}]=${ta} 与 ${B.word}[${ib}]=${tb}（偏移 ${d}）`;
          if (A.chars.length !== B.chars.length) {
            resolved.push(`${msg} => 取${A.chars.length > B.chars.length ? A.word : B.word}（更长）`);
            continue;
          }
          // 等长：运行时取最左侧的匹配。若两词的叠合写法真的出现在诗文中则视为真冲突
          const union = d >= 0 ? A.word + B.chars.slice(A.chars.length - d).join("") : B.chars.slice(0, -d).join("") + A.word;
          const real = corpusLines.some((l) => l.includes(union));
          if (real) errors.push(`等长词规则冲突（叠合写法 ${union} 出现在诗文中）：${msg}`);
          else resolved.push(`${msg} => 等长，未在诗文中同时出现（叠合写法 ${union}），运行时取最左匹配`);
        }
      }
    }
  }
  return { errors, resolved };
}

/** 串联：简体规则 + 繁体变体 + 繁体专属 -> 最终数据 */
export function buildData(rules, poems) {
  const simp = collectSimplified(rules, poems);
  const errors = [...simp.errors];
  const { variants } = buildTraditionalizer(poems);
  const table = JSON.parse(fs.readFileSync(path.join(root, "src/data/pinyin-table.json"), "utf8"));

  const words = new Map();
  const addWord = (word, m) => {
    const cur = words.get(word) ?? new Map();
    for (const [k, t] of m) {
      if (cur.has(k) && cur.get(k) !== t) errors.push(`词 ${word}[${k}] 读音冲突：${cur.get(k)} vs ${t}`);
      cur.set(k, t);
    }
    words.set(word, cur);
  };
  for (const [w, m] of simp.words) {
    addWord(w, m);
    for (const v of variants(w)) addWord(v, m);
  }

  // 字规则：简体 + 繁体变体
  const chars = new Map();
  const addChar = (c, tone, except, from) => {
    const prev = chars.get(c);
    if (prev && prev.tone !== tone) { errors.push(`字 ${c} 读音冲突：${prev.tone} vs ${tone}（${from}）`); return; }
    const x = prev?.except ?? new Set();
    for (const e of except) x.add(e);
    chars.set(c, { tone, except: x });
  };
  const tradFromSimp = new Map(); // 繁体字 -> 简体字集合（来自诗文对齐），用于检测共享繁体字的副作用
  for (const p of poems) {
    for (const line of p.content) {
      const s = Array.from(line);
      const t = Array.from(toTraditional(line));
      s.forEach((c, i) => { if (HAN.test(c)) (tradFromSimp.get(t[i]) ?? tradFromSimp.set(t[i], new Set()).get(t[i])).add(c); });
    }
  }
  const shared = [];
  for (const [c, { tone, except }] of simp.chars) {
    // except 词同样要有繁体写法（字本身繁简同形时也一样，如 予）
    const exceptAll = new Set([...except].flatMap((w) => [w, ...variants(w)]));
    addChar(c, tone, exceptAll, "simplified");
    const tradChars = new Set(variants(c));
    for (const tc of tradChars) {
      if (tc === c) continue;
      addChar(tc, tone, exceptAll, `traditional of ${c}`);
    }
    for (const tc of tradChars) {
      const srcs = tradFromSimp.get(tc);
      if (srcs) for (const o of srcs) if (o !== c && !simp.chars.has(o)) shared.push(`繁体 ${tc}（${c} 的繁体）在诗文中也来自 ${o}，字规则会波及：${c}->${tone}`);
    }
    // 繁体拼音表读音与简体不同的字：except 词要保持「简体下的读音」，否则繁体会错位
    for (const tc of tradChars) {
      const simpDefault = table[c];
      const tradDefault = table[tc];
      if (!except.size || tc === c || simpDefault === tradDefault) continue;
      for (const ew of except) {
        for (const tw of variants(ew)) {
          const eIdx = Array.from(ew).map((x, k) => (x === c ? k : -1)).filter((k) => k >= 0);
          for (const k of eIdx) if (Array.from(tw)[k] === tc) addWord(tw, new Map([[k, simpDefault]]));
        }
      }
    }
  }

  // 繁体专属：於（于 的繁体）读 yú；读 wū 的叹词/词语已由「于xx」词规则的繁体写法覆盖，词规则优先
  addChar("於", "yú", new Set(), "traditional-only 於");

  const corpusLines = poems.flatMap((p) => p.content.flatMap((l) => [l, toTraditional(l)]));
  const conflict = checkWordConflicts(words, corpusLines);
  errors.push(...conflict.errors);

  const data = { words: {}, chars: {} };
  for (const w of [...words.keys()].sort()) data.words[w] = [...words.get(w)].sort((a, b) => a[0] - b[0]).flat();
  for (const c of [...chars.keys()].sort()) {
    const { tone, except } = chars.get(c);
    data.chars[c] = except.size ? [tone, [...except].sort()] : [tone];
  }
  return { data, errors, resolved: conflict.resolved, shared, simp };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error("用法：npm run pinyin:overrides -- <apply-rules.json> [--out <file>]");
    process.exit(2);
  }
  const rules = JSON.parse(fs.readFileSync(args.input, "utf8"));
  const poems = JSON.parse(fs.readFileSync(path.join(root, "src/data/poems.json"), "utf8"));
  const { data, errors, resolved, shared, simp } = buildData(rules, poems);
  console.log(`简体：词条 ${simp.words.size}，字规则 ${simp.chars.size}；输出：词条 ${Object.keys(data.words).length}，字规则 ${Object.keys(data.chars).length}`);
  if (resolved.length) console.log(`词规则重叠（按「更长词优先」解决，共 ${resolved.length} 处）：\n  ${resolved.join("\n  ")}`);
  if (shared.length) console.log(`繁体共享字提示（${shared.length}）：\n  ${shared.join("\n  ")}`);
  if (errors.length) {
    console.error(`规则冲突/错误（${errors.length}）：\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  fs.writeFileSync(args.out, `${JSON.stringify(data)}\n`);
  console.log(`已写入 ${path.relative(root, args.out)}（${fs.statSync(args.out).size} 字节）`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
