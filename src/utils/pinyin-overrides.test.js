import { describe, expect, it } from "vitest";
import poems from "../data/poems.json";
import { renderRuby } from "./pinyin-ruby.js";
import { renderRubyLines } from "./reading.js";

// 用故意写错的底层拼音，确认校正确实来自覆盖表
const wrong = () => "xxx";
const tonesOf = (html) => Array.from(html.matchAll(/<rt>([^<]*)<\/rt>/g), (m) => m[1]);
const line = (id, keyword) => poems.find((p) => p.id === id).content.find((l) => l.includes(keyword));

describe("多音字校正", () => {
  it("关雎「参差」读 cēn cī", () => {
    expect(tonesOf(renderRuby("参差荇菜，左右流之。", wrong)).slice(0, 2)).toEqual(["cēn", "cī"]);
    expect(tonesOf(renderRuby("參差荇菜", wrong)).slice(0, 2)).toEqual(["cēn", "cī"]);
  });

  it("葛覃「覃」读 tán，覃耜读 tǎn sì", () => {
    expect(tonesOf(renderRuby("葛之覃兮", wrong))).toEqual(["xxx", "xxx", "tán", "xxx"]);
    expect(tonesOf(renderRuby("以我覃耜，俶载南亩。", wrong)).slice(2, 4)).toEqual(["tǎn", "sì"]);
  });

  it("差池、于差、既差按词校正，且不影响其他字", () => {
    expect(tonesOf(renderRuby("差池其羽", wrong)).slice(0, 2)).toEqual(["cī", "chí"]);
    expect(tonesOf(renderRuby("穀旦于差，南方之原。", wrong)).slice(2, 4)).toEqual(["yú", "chāi"]);
    expect(tonesOf(renderRuby("既差我马", wrong)).slice(0, 2)).toEqual(["jì", "chāi"]);
    expect(tonesOf(renderRuby("其差", wrong))).toEqual(["xxx", "xxx"]);
  });

  it("词语被标点隔开时不会误匹配", () => {
    expect(tonesOf(renderRuby("参，差", wrong))).toEqual(["xxx", "xxx"]);
  });

  it("预计算拼音表路径与实际诗文结果一致", async () => {
    const guan = await renderRubyLines([line(1, "参差")]);
    expect(tonesOf(guan[0]).slice(0, 2)).toEqual(["cēn", "cī"]);
    const ge = await renderRubyLines([line(2, "覃")]);
    expect(tonesOf(ge[0])[2]).toBe("tán");
  });
});
