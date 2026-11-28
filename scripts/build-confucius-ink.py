"""孔子像转成两张遮罩：线稿（墨色）和剪影（纸色衬底），首页按晨昼暮夜给它们上色。

用法：python3 scripts/build-confucius-ink.py
输入 public/images/confucius-salute-transparent-948.webp，输出 public/images/ink/confucius{,-fill}.webp
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public/images/confucius-salute-transparent-948.webp"
OUT = ROOT / "public/images/ink"
WIDTH = 600

im = Image.open(SOURCE).convert("RGBA")
a = np.asarray(im).astype(float)
alpha = a[..., 3:4] / 255
luma = (a[..., :3] * alpha + 255 * (1 - alpha)).mean(axis=2)

# 线稿：越暗越不透明
line = np.clip((236 - luma) / 150, 0, 1) ** 0.85

# 剪影：线条加粗后从四边灌水，灌不到的就是人物
w, h = im.size
thick = Image.fromarray(((luma < 215) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(13))
canvas = Image.new("L", (w + 2, h + 2), 0)
canvas.paste(thick, (1, 1))
ImageDraw.floodfill(canvas, (0, 0), 128)
inside = np.asarray(canvas)[1:-1, 1:-1] != 128
fill = Image.fromarray((inside * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(7)).filter(ImageFilter.GaussianBlur(2))

size = (WIDTH, round(WIDTH * h / w))
zero = Image.new("L", size, 0)
for name, mask, quality in (("confucius", Image.fromarray((line * 255).astype(np.uint8)), 80), ("confucius-fill", fill, 60)):
    channel = mask.resize(size, Image.LANCZOS)
    Image.merge("RGBA", [zero, zero, zero, channel]).save(OUT / f"{name}.webp", quality=quality, method=6)
    print(name, (OUT / f"{name}.webp").stat().st_size // 1024, "KB")
