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


# 源站明显的笔误：按站长要求改回原来的写法（不采纳）。(篇名, 章, 源站写法, 原写法, {改回的字: 读音})
# 读音默认沿用源站对应位置的注音；字数相同时逐字替换，调换顺序的两个字注音一起调换。
ORIGINAL_WORDING = [
    ("韩奕", "大雅", "乐韩土", "乐孔土", {"孔": "kǒng"}),
    ("韩奕", "大雅", "齿舄", "赤舄", {"赤": "chì"}),
    ("韩奕", "大雅", "镪镪", "锵锵", {}),
    ("韩奕", "大雅", "实籍", "实藉", {}),
    ("载芟", "周颂", "不洽百礼", "以洽百礼", {"以": "yǐ"}),
    ("殷武", "商颂", "松伯", "松柏", {}),
    ("车攻", "小雅", "田牡", "四牡", {"四": "sì"}),
    ("采芑", "小雅", "呈此", "于此", {}),
    ("荡", "大雅", "既衍", "既愆", {}),
    ("杕杜", "小雅", "斯逝", "期逝", {"期": "qī"}),
    ("閟宫", "鲁颂", "是尝", "是常", {}),
    ("皇矣", "大雅", "同尔弟兄", "同尔兄弟", {}),
    ("皇矣", "大雅", "訽尔", "询尔", {}),
    ("楚茨", "小雅", "钟鼓送尸", "鼓钟送尸", {}),
    ("楚茨", "小雅", "孔戁矣", "孔熯矣", {"熯": "hàn"}),
    ("桑柔", "大雅", "灭资", "蔑资", {}),
    ("思文", "周颂", "菲尔", "匪尔", {}),
    ("云汉", "大雅", "圭壁既", "圭璧既", {}),
    ("行苇", "大雅", "既钧", "既均", {}),
    ("大田", "小雅", "祈祈", "祁祁", {}),
    ("何人斯", "小雅", "絺搅", "祇搅", {}),
    ("执竞", "周颂", "磬莞将将", "磬筦将将", {}),
    ("既醉", "大雅", "室家之壶", "室家之壸", {"壸": "kǔn"}),
    ("四月", "小雅", "徂署", "徂暑", {}),
    ("生民", "大雅", "不拆不副", "不坼不副", {}),
]


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
    # 源站有 12 处把 g 写成 U+0261「ɡ」（拉丁文单层 g），不归一化会被当成非字母丢掉，音节就缺声母 g（告 ào、归 uī）
    paras = [html.unescape(re.sub(r"<[^>]+>", "", p)).replace("\xa0", " ").replace("​", "").replace("\u0261", "g").strip()
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
        for title, chapter, wrong, right, readings in ORIGINAL_WORDING:
            if (title, chapter) != (name[-1], name[0]):
                continue
            assert len(wrong) == len(right) and text.count(wrong) >= 1, (title, wrong)
            for m in re.finditer(re.escape(wrong), text):
                k = len([c for c in text[:m.start()] if HAN.match(c)])
                chars_w = [c for c in wrong if HAN.match(c)]
                chars_r = [c for c in right if HAN.match(c)]
                if sorted(chars_w) == sorted(chars_r) and chars_w != chars_r:  # 调换顺序
                    olds = syl[k:k + len(chars_w)]
                    syl[k:k + len(chars_w)] = [olds[chars_w.index(c)] for c in chars_r]
                else:
                    for j, (a_, b_) in enumerate(zip(chars_w, chars_r)):
                        if a_ != b_ and b_ in readings:
                            syl[k + j] = readings[b_]
            text = text.replace(wrong, right)
            notes.append(f"{title}：源站「{wrong}」疑为笔误，保留原写法「{right}」。")
        han = [c for c in text if HAN.match(c)]
        # 连读变调先还原为本调：不 bú -> bù，一 yí/yì -> yī（生成阶段再统一标变调）
        for k, c in enumerate(han):
            if c == "不" and syl[k] == "bú":
                syl[k] = "bù"
            elif c == "一" and syl[k] in ("yí", "yì"):
                syl[k] = "yī"
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
