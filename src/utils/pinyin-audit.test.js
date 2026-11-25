import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { Converter } from "opencc-js/cn2t";
import poems from "../data/poems.json";
import data from "../data/pinyin-overrides.json";
import { toRubyHTML } from "./pinyin.js";
import { renderRuby } from "./pinyin-ruby.js";
import { renderRubyLines } from "./reading.js";
import { findOverrides, findWordOverrides } from "./pinyin-overrides.js";
import { checkWordConflicts, collectSimplified } from "../../scripts/generate-pinyin-overrides.mjs";
import { verify } from "../../scripts/verify-pinyin-overrides.mjs";

const toTraditional = Converter({ from: "cn", to: "twp" });
const HAN = /[㐀-鿿]/;

const findLine = (id, keyword) => {
  const line = poems.find((p) => p.id === id).content.find((l) => l.includes(keyword));
  if (!line) throw new Error(`no line ${id} ${keyword}`);
  return line;
};
/** 取 line 中第 nth 个 char 的显示拼音（走运行时 toRubyHTML） */
function toneOf(line, char, nth = 0) {
  const tones = Array.from(toRubyHTML(line).matchAll(/ruby-text">(.)<rt>([^<]*)<\/rt>/gsu), (m) => [m[1], m[2]]);
  return tones.filter(([c]) => c === char)[nth]?.[1];
}
const toneAtWord = (line, word, offset) => {
  const at = line.indexOf(word);
  const tones = Array.from(toRubyHTML(line).matchAll(/ruby-text">(.)<rt>([^<]*)<\/rt>/gsu), (m) => m[2]);
  const han = Array.from(line.slice(0, at)).filter((c) => HAN.test(c)).length;
  return tones[han + offset];
};

describe("审校后的多音字校正（真实诗句）", () => {
  it("载 -> zài（载驰载驱）", () => {
    const line = findLine(54, "载驰载驱");
    expect(toneOf(line, "载", 0)).toBe("zài");
    expect(toneOf(line, "载", 1)).toBe("zài");
  });

  it("为 wéi，胡为乎等例外保持 wèi", () => {
    expect(toneOf(findLine(42, "匪女之为美"), "为")).toBe("wéi");
    expect(toneOf(findLine(36, "胡为乎中露"), "为")).toBe("wèi");
    expect(toneOf(findLine(144, "胡为乎株林"), "为")).toBe("wèi");
  });

  it("女 = 汝 -> rǔ（谁谓女无家）", () => {
    expect(toneOf(findLine(17, "谁谓女无家"), "女")).toBe("rǔ");
    expect(toneOf(findLine(17, "亦不女从"), "女")).toBe("rǔ");
  });

  it("予 yú，何以予之 yǔ", () => {
    expect(toneOf(findLine(155, "予手拮据"), "予")).toBe("yú");
    expect(toneOf(findLine(53, "何以予之"), "予")).toBe("yǔ");
  });

  it("参 shēn（维参与昴），参差仍 cēn cī", () => {
    expect(toneOf(findLine(21, "维参与昴"), "参")).toBe("shēn");
    expect(toneAtWord(findLine(1, "参差"), "参差", 0)).toBe("cēn");
    expect(toneAtWord(findLine(1, "参差"), "参差", 1)).toBe("cī");
  });

  it("将仲子 qiāng、岂弟 kǎi tì、饮之食之 yìn…sì", () => {
    expect(toneOf(findLine(76, "将仲子"), "将")).toBe("qiāng");
    const qidi = findLine(174, "岂弟君子");
    expect(toneAtWord(qidi, "岂弟", 0)).toBe("kǎi");
    expect(toneAtWord(qidi, "岂弟", 1)).toBe("tì");
    const yin = findLine(230, "饮之食之");
    expect(toneAtWord(yin, "饮之食之", 0)).toBe("yìn");
    expect(toneAtWord(yin, "饮之食之", 2)).toBe("sì");
  });

  it("于穆 wū，其他处的于仍 yú", () => {
    expect(toneAtWord(findLine(266, "于穆清庙"), "于穆", 0)).toBe("wū");
    expect(toneAtWord(findLine(267, "于乎不显"), "于乎", 0)).toBe("wū");
    expect(toneOf(findLine(266, "无射于人斯"), "于", 1)).toBe("yú");
    expect(toneOf(findLine(13, "于以采蘩"), "于")).toBe("yú");
  });

  it("繁体：於 yú，於穆 wū，於差 chāi，其余校正同样生效", () => {
    const t = (id, kw) => toTraditional(findLine(id, kw));
    expect(toneOf(t(266, "无射于人斯"), "於", 1)).toBe("yú");
    expect(toneAtWord(t(266, "于穆清庙"), "於穆", 0)).toBe("wū");
    expect(toneAtWord(t(267, "于乎不显"), "於乎", 0)).toBe("wū");
    const cha = toTraditional(poems.find((p) => p.id === 137).content.find((l) => l.includes("于差")));
    expect(toneAtWord(cha, "於差", 0)).toBe("yú");
    expect(toneAtWord(cha, "於差", 1)).toBe("chāi");
    expect(toneOf(t(54, "载驰载驱"), "載")).toBe("zài");
    expect(toneOf(t(53, "何以予之"), "予")).toBe("yǔ");
    expect(toneOf(t(155, "予手拮据"), "予")).toBe("yú");
    expect(toneOf(t(42, "匪女之为美"), "為")).toBe("wéi");
    expect(toneOf(t(36, "胡为乎中露"), "為")).toBe("wèi");
  });
});

describe("优先级：词规则 > 字规则，更长词优先", () => {
  it("字规则不作用于 except 词内（回退到拼音表读音），词规则优先于字规则", () => {
    const chars = (s) => Array.from(s);
    const x = findOverrides(chars("以我覃耜"));
    expect(x.get(2)).toBe("tǎn"); // 覃耜（词）优先于 覃（字）
    expect(findOverrides(chars("葛之覃兮")).get(2)).toBe("tán");
    // 为：except 词内不校正；其他处 wéi
    expect(findOverrides(chars("胡为乎株林")).has(1)).toBe(false);
    expect(findOverrides(chars("匪女之为美")).get(3)).toBe("wéi");
  });

  it("词规则只改目标字，不波及词内其他字", () => {
    const map = findWordOverrides(Array.from("谁谓女无家"));
    expect([...map.keys()]).toEqual([2]);
  });

  it("词规则被标点隔开时不匹配", () => {
    expect(findOverrides(Array.from("参，差")).size).toBe(0);
    expect(renderRuby("于，穆", () => "x")).not.toContain("wū");
  });

  it("更长的词优先：我心则说（yuè）优于 说于（shuì）", () => {
    const m = findOverrides(Array.from("我心则说于"));
    expect(m.get(3)).toBe("yuè");
  });
});

describe("生成脚本冲突检测", () => {
  it("同一词同一位置读音不同 => 报错", () => {
    const rules = [
      { id: 1, char: "女", correct: "rǔ", rule: { words: ["谁谓女无家"], all: false, except: null, ids: null, pos: null } },
      { id: 2, char: "女", correct: "nǚ", rule: { words: ["谁谓女无家"], all: false, except: null, ids: null, pos: null } },
    ];
    expect(collectSimplified(rules, poems).errors.join()).toContain("读音冲突");
  });

  it("等长词规则在诗文中真实叠合且读音不同 => 报错；未出现则只是提示", () => {
    const words = new Map([["甲乙", new Map([[1, "a"]])], ["乙丙", new Map([[0, "b"]])]]);
    expect(checkWordConflicts(words, ["甲乙丙"]).errors).toHaveLength(1);
    const lax = checkWordConflicts(words, ["无关"]);
    expect(lax.errors).toHaveLength(0);
    expect(lax.resolved).toHaveLength(1);
  });

  it("限定诗篇的规则展开为上下文词：朝夕 zhāo 只在 205/234/301", () => {
    const rules = [{ id: 1, char: "朝", correct: "zhāo", rule: { words: ["朝夕"], all: false, except: null, ids: [205, 234, 301], pos: null } }];
    const { words, errors } = collectSimplified(rules, poems);
    expect(errors).toEqual([]);
    expect(words.has("朝夕")).toBe(false);
    expect(toneOf(findLine(205, "朝夕从事"), "朝")).toBe("zhāo");
    expect(toneOf(findLine(234, "朝夕不暇"), "朝")).toBe("zhāo");
    expect(toneOf(findLine(301, "温恭朝夕"), "朝")).toBe("zhāo");
    expect(toneOf(findLine(194, "莫肯朝夕"), "朝")).not.toBe("zhāo");
  });
});

describe("全量校验：305 首，简体 + 繁体", () => {
  it("预计算路径与运行时路径一致，且改动只落在规则覆盖的位置", async () => {
    const report = await verify({ renderRubyLines });
    expect(report.failures).toEqual([]);
    expect(report.stats.htmlMismatch).toBe(0);
    expect(report.stats.changedSimp).toBeGreaterThan(0);
  });

  it("改动的位置都由数据文件中的某条规则覆盖（独立的朴素匹配）", async () => {
    // 改动后读音必须等于「数据文件中覆盖该位置的规则」给出的读音：对所有诗句逐位置用朴素算法重算
    const words = Object.entries(data.words).map(([w, flat]) => ({ chars: Array.from(w), pairs: flat.reduce((a, v, i) => (i % 2 ? a : [...a, [v, flat[i + 1]]]), []) }));
    const naive = (chars) => {
      const best = [];
      chars.forEach((_, s) => words.forEach(({ chars: w, pairs }) => {
        if (!w.every((c, k) => chars[s + k] === c)) return;
        pairs.forEach(([k, tone]) => { if (!best[s + k] || w.length > best[s + k].len) best[s + k] = { len: w.length, tone }; });
      }));
      return best;
    };
    for (const p of poems) {
      for (const line of [...p.content, ...p.content.map((l) => toTraditional(l))]) {
        const chars = Array.from(line);
        const best = naive(chars);
        const html = toRubyHTML(line);
        const tones = Array.from(html.matchAll(/ruby-text">(.)<rt>([^<]*)<\/rt>/gsu), (m) => m[2]);
        let k = 0;
        chars.forEach((c, i) => {
          if (!HAN.test(c)) return;
          const tone = tones[k++];
          if (best[i]) expect(tone, `${p.id} ${line} ${i}`).toBe(best[i].tone);
        });
      }
    }
  });

  it.skipIf(!process.env.PINYIN_APPLY_RULES)("提供 apply-rules.json 时：改动集合与规则覆盖集合完全一致", async () => {
    const rules = JSON.parse(fs.readFileSync(process.env.PINYIN_APPLY_RULES, "utf8"));
    const report = await verify({ rules, renderRubyLines });
    expect(report.failures).toEqual([]);
    expect(report.stats.changedSimp).toBe(report.stats.expectedSimp);
    expect(report.stats.changedTrad).toBe(report.stats.expectedTrad);
  });
});
