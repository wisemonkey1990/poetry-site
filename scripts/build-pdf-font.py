#!/usr/bin/env python3
"""生成 PDF 用的字体子集：src/assets/fonts/NotoSerifSC-poem-subset.ttf

思源宋体（Noto Serif SC, SIL OFL 1.1）按「全部诗篇的简体 + 繁体正文、篇名、章节、拼音字母」裁剪，
并把复合字形展开成简单字形（pdf-lib 使用的 fontkit 在二次裁剪复合字形时会丢字）。

用法（需要 pip install fonttools）：
  python3 scripts/build-pdf-font.py /path/to/NotoSerifSC-Regular.ttf
新增诗篇或改字后重新运行即可；npm test 会校验字体覆盖了全部文字。
"""
import glob, json, os, sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
src = sys.argv[1]
out = os.path.join(root, "src/assets/fonts/NotoSerifSC-poem-subset.ttf")

chars = set(map(chr, range(32, 127)))
for poem in json.load(open(os.path.join(root, "src/data/poems.json"), encoding="utf-8")):
    for text in [poem["title"], poem["chapter"], poem["section"], *poem["content"]]:
        chars |= set(text)
for path in glob.glob(os.path.join(root, "src/data/reading/*.json")):
    data = json.load(open(path, encoding="utf-8"))
    for text in [data["title"], *data["lines"], *data["py"], data.get("tp", "")]:
        chars |= set(text)
# 版式文字：印章、页脚、章节繁体、缺字占位
chars |= set("诗经三百序篇·《》「」『』□ 國風邶鄘衛王鄭齊魏唐秦陳檜曹豳小雅大周魯商頌詩經序篇")

opts = subset.Options()
opts.layout_features = []
opts.hinting = False
opts.drop_tables += ["GPOS", "GSUB", "GDEF", "BASE", "STAT", "vhea", "vmtx", "gasp"]
font = subset.load_font(src, opts)
sub = subset.Subsetter(opts)
sub.populate(text="".join(sorted(chars)))
sub.subset(font)

glyf = font["glyf"]
gs = font.getGlyphSet()
for name in font.getGlyphOrder():
    if glyf[name].isComposite():
        pen = TTGlyphPen(gs)
        gs[name].draw(pen)
        glyf[name] = pen.glyph()
font.save(out)
print(f"{out}: {os.path.getsize(out)} bytes, {len(chars)} chars")
