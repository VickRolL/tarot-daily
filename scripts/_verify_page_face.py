"""在**真实页面截图**里验证脸是否已经不可辨（素材级验证不够，页面还叠了暗角与缩放）。

几何来自页面自报（scripts/flows/probe-face-rect.js）：
  宽屏 1564×708：faceBox x[798,1042] y[115,310]；球 y 从 337 起 → 脸不被球挡
  手机  504×844：faceBox x[265,463] y[174,332]；球 y 从 354 起 → 同上
外界各留一点余量，用来看椭圆边界与周围头发接得自不自然。

输出 assets/_debug/page-face-zoom.png（原样 / 极限拉伸 两行）
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/_debug"

CASES = [
    ("宽屏 1564x708", "assets/previews/v2c-face-wide.png", (798 - 70, 115 - 80, 1042 + 70, 310 + 40)),
    ("手机 504x844", "assets/previews/v2c-face-phone.png", (265 - 70, 174 - 80, 463 + 70, 332 + 40)),
]
SCALE = 3


def font(sz=17):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/consola.ttf", sz)
    except Exception:
        return ImageFont.load_default()


def main() -> int:
    cells = []
    for name, rel, box in CASES:
        im = Image.open(ROOT / rel).convert("RGB")
        c = im.crop(box)
        c = c.resize((c.width * SCALE, c.height * SCALE), Image.LANCZOS)
        stretch = ImageOps.autocontrast(c.convert("L"), cutoff=0.2).convert("RGB")
        cells.append((f"{name} 原样 {c.width}x{c.height}", c))
        cells.append((f"{name} 极限拉伸", stretch))

    pad = 12
    cw = max(c.width for _, c in cells)
    ch = max(c.height for _, c in cells)
    grid = Image.new("RGB", (cw * 2 + pad * 3, ch * 2 + pad * 3), (24, 24, 28))
    for i, (tag, c) in enumerate(cells):
        gx, gy = pad + (i % 2) * (cw + pad), pad + (i // 2) * (ch + pad)
        cc = c.copy()
        ImageDraw.Draw(cc).text((8, 8), tag, fill=(255, 120, 120), font=font(20))
        grid.paste(cc, (gx, gy))
    dst = OUT / "page-face-zoom.png"
    grid.save(dst)
    print(f"wrote {dst.relative_to(ROOT)}  ({grid.width}x{grid.height})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
