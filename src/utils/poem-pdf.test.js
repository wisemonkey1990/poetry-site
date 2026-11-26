import { describe, expect, it } from "vitest";
import fs from "node:fs";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import { tokenizeLine } from "./pinyin-ruby.js";
import { breakRow, buildPoemPdf, paginate, splitSentences, pdfFileName } from "./poem-pdf.js";
import { buildPoemFont, poemFontChars, readReading } from "../../scripts/pdf-fonts.mjs";
import poems from "../data/poems.json";

const sharedPath = new URL("../assets/fonts/NotoSerifSC-poem-subset.ttf", import.meta.url);
const shared = fs.readFileSync(sharedPath);
const root = new URL("../..", import.meta.url).pathname;
const tone = (ch) => `t${ch}`;

describe("tokenizeLine", () => {
  it("attaches punctuation to the neighbouring hanzi", () => {
    const units = tokenizeLine("“关关”，雎鸠。", tone);
    expect(units.map((u) => u.ch).join("")).toBe("关关雎鸠");
    expect(units[0].before).toBe("“");
    expect(units[1].after).toBe("”，");
    expect(units[3].after).toBe("。");
  });
  it("prefers supplied tones", () => {
    expect(tokenizeLine("关雎", tone, ["guān", "jū"]).map((u) => u.py)).toEqual(["guān", "jū"]);
  });
});

describe("layout", () => {
  const units = tokenizeLine("关关雎鸠，在河之洲。窈窕淑女，君子好逑。", tone);
  const m = { hz: 20, pyWidth: () => 10, gap: 2 };
  it("splits a stanza into sentences", () => {
    expect(splitSentences(units).map((r) => r.length)).toEqual([8, 8]);
  });
  it("breaks overlong rows at a comma", () => {
    const rows = breakRow(units, 200, m);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.flat()).toHaveLength(units.length);
    expect(rows[0].at(-1).after).toMatch(/[，。]/);
  });
  it("paginates long text onto several pages and keeps rows inside the margins", () => {
    const stanzas = Array.from({ length: 40 }, () => units);
    const { pages, fits } = paginate(stanzas, { hz: 22, withPinyin: true, pyWidth: () => () => 12, startY: 600 });
    expect(fits).toBe(false);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap((p) => p.rows).every((r) => r.y > 60)).toBe(true);
  });
});

describe("pdf fonts", () => {
  const fontOf = (bytes) => fontkit.create(new Uint8Array(bytes));
  it("shared subset covers every character used by all poems (simplified, traditional, pinyin)", () => {
    const font = fontOf(shared);
    const missing = new Set();
    for (const poem of poems) {
      for (const ch of poemFontChars(poem, readReading(root, poem.id))) if (!font.hasGlyphForCodePoint(ch.codePointAt(0))) missing.add(ch);
    }
    expect([...missing]).toEqual([]);
  });
  it("per-poem font is small and has the poem's characters", async () => {
    const poem = poems[0];
    const bytes = await buildPoemFont(shared, poem, readReading(root, poem.id));
    expect(bytes.length).toBeLessThan(120 * 1024);
    const font = fontOf(bytes);
    for (const ch of poem.content.join("")) if (!/[，。！？；：、]/.test(ch)) expect(font.hasGlyphForCodePoint(ch.codePointAt(0))).toBe(true);
  });
});

describe("buildPoemPdf", () => {
  it("writes a valid multi-script PDF with and without pinyin", async () => {
    const poem = poems[0];
    const font = new Uint8Array(await buildPoemFont(shared, poem, readReading(root, poem.id)));
    for (const withPinyin of [true, false]) {
      const stanzas = poem.content.map((line) => tokenizeLine(line, tone));
      const titleUnits = tokenizeLine(poem.title, tone);
      const bytes = await buildPoemPdf({ poem, display: { title: poem.title }, stanzas, titleUnits, withPinyin, fonts: [font] });
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1);
      expect(bytes.length).toBeLessThan(150 * 1024);
    }
  });
  it("falls back to the next font when the first lacks a character", async () => {
    const poem = poems[0];
    const tiny = new Uint8Array(await (await import("subset-font")).default(shared, "A", { targetFormat: "truetype" }));
    const stanzas = poem.content.map((line) => tokenizeLine(line, tone));
    const bytes = await buildPoemPdf({ poem, display: { title: poem.title }, stanzas, titleUnits: tokenizeLine(poem.title, tone), withPinyin: false, fonts: [tiny, new Uint8Array(shared)] });
    expect(bytes.length).toBeGreaterThan(500 * 1024);
  });
  it("names files by poem", () => {
    expect(pdfFileName({ id: 1 }, "关雎", true)).toBe("诗经-关雎-001-注音.pdf");
  });
});
