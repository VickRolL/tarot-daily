"""1:1 放大对比空区（缩到一半看会误判噪点）。

用法：cd <project> && "$PY" scripts/_zoom_void.py [x0 x1 y0 y1]
默认裁剪 x 28–72% / y 36–90%。
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BG = ROOT / "assets/hero-art/bg"
OUT = ROOT / "assets" / "_debug"


def main() -> int:
    raw = sorted((BG / "_raw").glob("*.png"))[0]
    dst = BG / "hero-v2b.png"
    x0, x1, y0, y1 = (float(v) for v in sys.argv[1:5]) if len(sys.argv) >= 5 else (28, 72, 36, 90)

    ims = []
    for p, label in ((raw, "RAW (出图原样)"), (dst, "FIXED (压制+柔化)")):
        im = Image.open(p).convert("RGB")
        W, H = im.size
        box = (int(W * x0 / 100), int(H * y0 / 100), int(W * x1 / 100), int(H * y1 / 100))
        c = im.crop(box)
        d = ImageDraw.Draw(c)
        try:
            f = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 22)
        except Exception:
            f = ImageFont.load_default()
        d.text((8, 8), label, fill=(255, 255, 255), font=f)
        ims.append(c)

    w, h = ims[0].size
    sheet = Image.new("RGB", (w, h * 2 + 8), (30, 30, 34))
    sheet.paste(ims[0], (0, 0))
    sheet.paste(ims[1], (0, h + 8))
    out = OUT / "void-zoom.png"
    sheet.save(out)
    print(f"{sheet.size} -> {out.relative_to(ROOT)}  (裁剪 x{x0}-{x1}% y{y0}-{y1}%, 1:1)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
