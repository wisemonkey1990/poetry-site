#!/usr/bin/env python3
"""抓取国学梦《诗经》每篇页面里的「解释翻译」（今译）和「注释出处」（注释），生成 data-sources/guoxuemeng-notes.json。

用法：python3 -I scripts/scrape-guoxuemeng-notes.py [--cache DIR] [--out FILE]
  --cache  已下载网页的缓存目录（默认 /tmp/guoxuemeng-pages，与 scrape-guoxuemeng.py 共用；已存在的页面不会重复下载）

篇目和页面地址取自 data-sources/guoxuemeng-shijing.json（scrape-guoxuemeng.py 的结果，已带站内 id）。
今译：取「解释翻译」里第一种译文，遇到「译文二」「××赏析」之类的小标题就停，开头的「译文一」「意译」小标题去掉。
注释：「注释出处」里的每一条，去掉开头的 ⑴⑵ 序号。有 63 篇源站没有注释，记为空数组，导入时保留站内原注释。
"""
import argparse, html, json, os, re, subprocess, sys, time

BASE = "https://www.guoxuemeng.com"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
STOP = re.compile(r"(赏析|鉴赏|译文二|译文2|创作背景|注释|参考资料)")
SKIP = {"译文一", "译文", "意译", "译文：", "译文一："}


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
        time.sleep(3 * (attempt + 1))
    sys.exit(f"下载失败：{url}")


def paragraphs(block):
    out = []
    for p in re.findall(r"<p[^>]*>(.*?)</p>", block, flags=re.S):
        t = html.unescape(re.sub(r"<[^>]+>", "", p)).replace("\xa0", " ").replace("​", "").strip()
        if t:
            out.append(t)
    return out


def sections(raw):
    parts = re.split(r'<div class="thot">([^<]+)</div>', raw)
    return {parts[i]: parts[i + 1] for i in range(1, len(parts) - 1, 2)}


def parse(raw, title):
    sec = sections(raw)
    if "解释翻译" not in sec or "注释出处" not in sec:
        raise ValueError(f"{title}: 页面缺少「解释翻译」或「注释出处」栏目")
    translation = []
    for t in paragraphs(sec["解释翻译"]):
        if len(t) <= 14 and STOP.search(t):
            break
        if t == title:
            break
        if t in SKIP:
            continue
        translation.append(t)
    notes = [re.sub(r"^\s*[⑴-⒇]\s*", "", t) for t in paragraphs(sec["注释出处"])]
    return translation, [n for n in notes if n]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default="/tmp/guoxuemeng-pages")
    ap.add_argument("--out", default=os.path.join(ROOT, "data-sources", "guoxuemeng-notes.json"))
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    source = json.load(open(os.path.join(ROOT, "data-sources", "guoxuemeng-shijing.json"), encoding="utf-8"))
    out = []
    for poem in source["poems"]:
        path = os.path.join(args.cache, f"{poem['gid']}.html")
        fetch(poem["url"], path)
        translation, notes = parse(open(path, encoding="utf-8", errors="replace").read(), poem["title"])
        if not translation:
            sys.exit(f"{poem['title']}: 没有解析到译文")
        out.append({"id": poem["id"], "gid": poem["gid"], "url": poem["url"], "title": poem["title"],
                    "translation": translation, "notes": notes})
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"source": f"{BASE}/guoxue/shijing/", "poems": out}, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"{len(out)} 篇，{sum(1 for p in out if p['notes'])} 篇有注释 -> {args.out}")


if __name__ == "__main__":
    main()
