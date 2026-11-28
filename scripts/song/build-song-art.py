"""宋画诗经图：按 paintings.json 从原图裁出每首诗的画与高宗手书，存成 WebP。

用法：python3 scripts/song/build-song-art.py <原图目录> [诗篇号 ...]
输出：public/images/song/<id>.webp（画，长边约 1600）、<id>-s.webp（手机，约 760）、<id>-text.webp（手书）
同时写 src/data/song-paintings.json 给页面用（只含标注与尺寸，不含原图）。
"""
import json, sys, os
from PIL import Image, ImageOps
Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = json.load(open(os.path.join(ROOT, 'scripts/song/paintings.json'), encoding='utf-8'))
src_dir = sys.argv[1]
only = set(sys.argv[2:])
out_dir = os.path.join(ROOT, 'public/images/song'); os.makedirs(out_dir, exist_ok=True)
data_path = os.path.join(ROOT, 'src/data/song-paintings.json')
existing = json.load(open(data_path, encoding='utf-8')) if os.path.exists(data_path) else {}
data = existing.get('poems', {})
cache = {}

def crop(im, box):
    w, h = im.size
    return im.crop((round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h)))

def fit(im, long_side):
    w, h = im.size
    s = min(1, long_side / max(w, h))
    return im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS) if s < 1 else im

def save(im, name, q):
    path = os.path.join(out_dir, name)
    im.save(path, 'WEBP', quality=q, method=6)
    return os.path.getsize(path)

for pid, item in spec['poems'].items():
    if only and pid not in only: continue
    f = os.path.join(src_dir, item['file'])
    if not os.path.exists(f): print('缺原图', pid, f); continue
    if f not in cache: cache = {f: Image.open(f).convert('RGB')}
    im = cache[f]
    art = crop(im, item['art'])
    a = fit(art, 1600); s = fit(art, 760)
    size = save(a, f'{pid}.webp', 74) + save(s, f'{pid}-s.webp', 70)
    if max(art.size) > 1700: size += save(fit(art, 3200), f'{pid}-l.webp', 74)
    entry = {'src': item['src'], 'w': a.size[0], 'h': a.size[1], 'large': max(art.size) > 1700}
    if item.get('text'):
        t = fit(crop(im, item['text']), 1400)
        size += save(t, f'{pid}-text.webp', 72)
        entry.update({'tw': t.size[0], 'th': t.size[1]})
    data[pid] = entry
    print(pid, a.size, f'{size // 1024} KB')

sources = {k: {kk: v[kk] for kk in ('title', 'artist', 'calligrapher', 'museum', 'license', 'page') if kk in v} for k, v in spec['sources'].items()}
poems = {k: data[k] for k in sorted(data, key=int) if k in spec['poems']}
with open(data_path, 'w', encoding='utf-8') as fh:
    json.dump({'sources': sources, 'poems': poems, 'hangings': existing.get('hangings', {})}, fh, ensure_ascii=False, indent=1)
    fh.write('\n')

# 立轴配画（其余诗篇用）
hang_dir = os.path.join(ROOT, 'public/images/hanging'); os.makedirs(hang_dir, exist_ok=True)
hangings = {}
for key, item in spec.get('hangings', {}).items():
    if only and key not in only: continue
    f = os.path.join(src_dir, item['file'])
    if not os.path.exists(f): print('缺原图', key, f); continue
    im = crop(Image.open(f).convert('RGB'), item['crop'])
    for suffix, long_side, q in (('', 1500, 72), ('-s', 760, 68)):
        out = fit(im, long_side); out.save(os.path.join(hang_dir, f'{key}{suffix}.webp'), 'WEBP', quality=q, method=6)
    big = fit(im, 1500)
    hangings[key] = {k: item[k] for k in ('dynasty', 'artist', 'title', 'met')} | {'w': big.size[0], 'h': big.size[1]}
    print(key, big.size, os.path.getsize(os.path.join(hang_dir, f'{key}.webp')) // 1024, 'KB')
if hangings:
    cur = json.load(open(data_path, encoding='utf-8'))
    cur['hangings'] = {**cur.get('hangings', {}), **hangings}
    with open(data_path, 'w', encoding='utf-8') as fh:
        json.dump(cur, fh, ensure_ascii=False, indent=1); fh.write('\n')

# 首页开卷：北宋屈鼎《夏山图》
if spec.get('hero') and (not only or 'hero' in only):
    item = spec['hero']
    im = crop(Image.open(os.path.join(src_dir, item['file'])).convert('RGB'), item['crop'])
    for suffix, width, q in (('', 2560, 68), ('-m', 1400, 66)):
        out = im.resize((width, round(width * im.size[1] / im.size[0])), Image.LANCZOS)
        path = os.path.join(ROOT, f'public/images/song/hero{suffix}.webp'); out.save(path, 'WEBP', quality=q, method=6)
        print('hero', suffix, out.size, os.path.getsize(path) // 1024, 'KB')
