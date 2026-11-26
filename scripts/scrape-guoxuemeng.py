#!/usr/bin/env python3
"""抓取国学梦《诗经》（https://www.guoxuemeng.com/guoxue/shijing/）正文与注音，生成 data-sources/guoxuemeng-shijing.json。

用法：python3 -I scripts/scrape-guoxuemeng.py [--cache DIR] [--out FILE]
  --cache  已下载网页的缓存目录（默认 /tmp/guoxuemeng-pages；已存在的页面不会重复下载）

页面里每首诗是「一行拼音 + 一行正文」交替的段落，个别页面排版错乱（拼音插进正文、整段重复、缺字），
所以按整首诗把所有拼音音节和所有汉字各自串起来，再逐字对齐。音节数与汉字数不一致的诗会在 notes 里记录并按 FIXES 处理，
不会猜测读音。
"""
import argparse, html, json, os, re, subprocess, sys, time, unicodedata

BASE = "https://www.guoxuemeng.com"
HAN = re.compile(r"[㐀-鿿]")
LATIN = r"A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹḿ"

# 页面本身有缺陷的诗：gid -> 说明。处理见 apply_fixes。
FIXES = {
    "13397": "溱洧：两处「洵訏于且乐」多出「于」，而且没有对应注音；按其余诗本及「洵訏且乐」去掉「于」。",
    "13472": "瓠叶：第三章「君子有酒」缺「君子」两字的注音；这两字的读音取拼音表（jūn zǐ），不是源站数据。",
    "13540": "瞻彼洛矣：页面把三章正文又整段重复了一遍，只取一份。",
    "13473": "緜：页面「捄之陾陾」只写了一个「陾」（注音也只有一个 réng）；补成「陾陾」，两个字都读 réng。",
    "13442": "卷阿：「菶々」的叠字符号「々」展开为「菶菶」。",
}


def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return
    for attempt in range(6):
        r = subprocess.run(["curl", "-sS", "-m", "30", "-o", path, url], capture_output=True)
        if r.returncode == 0 and os.path.getsize(path) > 0:
            time.sleep(1)
            return
        if os.path.exists(path):
            os.remove(path)
        time.sleep(2 * (attempt + 1))
    sys.exit(f"下载失败：{url}")


def strip_notes(s):
    return re.sub(r"[\(（][^\)）]*[\)）]", "", s).strip()


def parse_page(raw):
    a = raw.find('class="lacontent"')
    b = raw.find("关键词", a)
    paras = [html.unescape(re.sub(r"<[^>]+>", "", p)).replace("\xa0", " ").replace("​", "").strip()
             for p in re.findall(r"<p>(.*?)</p>", raw[a:b], re.S)]
    paras = [unicodedata.normalize("NFC", strip_notes(p)) for p in paras if p.strip()]
    paras = [p for p in paras if "·" not in p and p != "-->"]
    syl, zh = [], []
    for p in paras:
        for m in re.finditer(rf"[{LATIN}]+|[^\s{LATIN}]+", p):
            s = m.group(0)
            if re.match(rf"[{LATIN}]", s):
                syl.append(s)
            elif HAN.search(s) or "々" in s:
                zh.append(s)
    text = re.sub(r"(.)々", r"\1\1", "".join(zh))
    for a_, b_ in zip("?!;:", "？！；："):
        text = text.replace(a_, b_)
    return text, syl


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default="/tmp/guoxuemeng-pages")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "data-sources", "guoxuemeng-shijing.json"))
    ap.add_argument("--table", default=os.path.join(os.path.dirname(__file__), "..", "src", "data", "pinyin-table.json"))
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    idx = os.path.join(args.cache, "index.html")
    fetch(f"{BASE}/guoxue/shijing/", idx)
    index = open(idx, encoding="utf-8", errors="replace").read()
    seen, items = set(), []
    for gid, title in re.findall(r'href="https://www\.guoxuemeng\.com/guoxue/(\d+)\.html" target="_blank" title="([^"]+)"', index):
        title = html.unescape(title)
        if gid in seen or not title.startswith("诗经带拼音："):
            continue
        seen.add(gid)
        items.append((gid, title.split("：", 1)[1].split("·")))
    table = json.load(open(args.table, encoding="utf-8"))
    out = []
    for gid, name in items:
        path = os.path.join(args.cache, f"{gid}.html")
        fetch(f"{BASE}/guoxue/{gid}.html", path)
        text, syl = parse_page(open(path, encoding="utf-8", errors="replace").read())
        notes = []
        if gid == "13540":
            h = len(text) // 2
            assert text[:h] == text[h:]
            text = text[:h]
            notes.append(FIXES[gid])
        if gid == "13442":
            notes.append(FIXES[gid])
        han = [c for c in text if HAN.match(c)]
        if gid == "13397":
            text = text.replace("洵訏于且乐", "洵訏且乐")
            han = [c for c in text if HAN.match(c)]
            notes.append(FIXES[gid])
        if gid == "13473":
            assert "捄之陾，" in text
            i = next(k for k in range(len(syl) - 3) if syl[k:k + 4] == ["réng", "duó", "zhī", "hōng"])
            text = text.replace("捄之陾，", "捄之陾陾，")
            syl.insert(i, "réng")
            han = [c for c in text if HAN.match(c)]
            notes.append(FIXES[gid])
        if gid == "13472":
            i = next(k for k in range(len(syl) - 4) if syl[k:k + 5] == ["yǒu", "jiǔ", "zhuó", "yán", "zuò"])
            syl[i:i] = [table["君"], table["子"]]
            notes.append(FIXES[gid])
        if len(han) != len(syl):
            notes.append(f"UNALIGNED: {len(han)} 字 / {len(syl)} 个音节")
        out.append({
            "gid": gid, "url": f"{BASE}/guoxue/{gid}.html",
            "chapter": name[0], "section": name[1] if len(name) == 3 else None, "title": name[-1],
            "text": text, "pinyin": syl, "notes": notes,
        })
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"source": f"{BASE}/guoxue/shijing/", "poems": out}, f, ensure_ascii=False, indent=1)
        f.write("\n")
    bad = [o for o in out if any(n.startswith("UNALIGNED") for n in o["notes"])]
    print(f"{len(out)} poems, {len(bad)} unaligned", [o["title"] for o in bad])


if __name__ == "__main__":
    main()
