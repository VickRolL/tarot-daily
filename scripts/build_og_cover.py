"""生成分享用的 og:image 封面（1200x630）

发到微信 / 朋友圈 / 微博时如果没有 og:image，抓取端只会显示一行纯文字，
点击率明显低于带图卡片。这里用**合成好的主视觉**（背景 + 水晶球，与首页同一套锚点）
裁一张标准 1200x630 的封面 —— 比直接用 hero-bg 更重要一点：
hero-bg 里是没有球的（球是独立图层）。

文字压在画面**顶部**的星云区：球和双手落在画面下方约 3/4 处，
把标题放底下会正好压住球，放顶部则整好落在深色星空上。

用法：
    cd "C:/Users/29923/WorkBuddy/2026-09-17-19-02-52/tarot-app"
    "C:/Users/29923/.workbuddy/binaries/python/envs/default/Scripts/python.exe" scripts/build_og_cover.py

换主视觉 / 改锚点之后重跑一次；产物在 public/og-cover.png。
"""
import os
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from preview_hero import load_slot, read_skin_consts  # noqa: E402  复用同一套锚点与取景数学

ROOT = pathlib.Path(__file__).resolve().parent.parent
# 用 JPEG 而不是 PNG：这张是照片质感的图，PNG 要 750 KB，JPEG 只要 1/6，
# 而抓取端本来也不要求无损（平台还会再压一次）。
OUT = ROOT / "public" / "og-cover.jpg"

OG_W, OG_H = 1200, 630

TITLE = "今夜一签"
SUB = "塔罗日签 · 每天一张 · 抽一张今天的牌"
BRAND = "TAROT · DAILY"

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\simsun.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
]


def pick_font(size):
    for path in FONT_CANDIDATES:
        p = pathlib.Path(path)
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except OSError:
                continue
    sys.exit("找不到可用的中文字体，试过：%s" % FONT_CANDIDATES)


def draw_spaced(draw, text, font, x, baseline, spacing, fill, align="center"):
    """逐字绘制模拟字距（PIL 没有 letter-spacing 参数）。
    align='center' 时 x 是中线，align='left' 时 x 是左边界。"""
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    start = x - total / 2 if align == "center" else x
    for ch, w in zip(text, widths):
        draw.text((start, baseline), ch, font=font, fill=fill)
        start += w + spacing


def build_scene():
    """在**画布坐标系**里合成 背景 + 水晶球（与首页 .hero-frame 内完全一致）。"""
    cfg = read_skin_consts()
    fw, fh = cfg["frame"]
    fw, fh = int(fw), int(fh)
    bg = load_slot(cfg["skin"], "hero-bg")
    if bg is None:
        sys.exit("找不到 hero-bg 素材，先跑 scripts/build_hero_assets.py")

    scene = Image.new("RGBA", (fw, fh), (8, 5, 15, 255))
    base = bg.resize((fw, fh), Image.LANCZOS)
    scene.paste(base, (0, 0), base)

    orb = load_slot(cfg["skin"], "hero-orb")
    if orb is not None:
        side = int(round(cfg["orb"]["size"] / 100.0 * fh))
        cx = cfg["orb"]["x"] / 100.0 * fw
        cy = cfg["orb"]["y"] / 100.0 * fh
        o = orb.resize((side, side), Image.LANCZOS)
        scene.paste(o, (int(round(cx - side / 2)), int(round(cy - side / 2))), o)
    return scene.convert("RGB")


def main():
    art = build_scene()
    aw, ah = art.size

    # 满宽取景：纵向保住「帽檐 → 双手」这一段，球自然落在下方 3/4 处
    crop_h = int(round(aw / (OG_W / OG_H)))
    crop_h = min(crop_h, ah)
    top = int(round(0.02 * ah))
    top = max(0, min(top, ah - crop_h))
    cover = art.crop((0, top, aw, top + crop_h)).resize((OG_W, OG_H), Image.LANCZOS)

    # 顶部暗角：标题压在星空区，底下留给球和双手
    scrim = Image.new("L", (1, OG_H), 0)
    for y in range(OG_H):
        t = y / (OG_H - 1)
        scrim.putpixel((0, y), int(max(0.0, 1 - t / 0.52) ** 1.15 * 0.88 * 255))
    cover = Image.composite(
        Image.new("RGB", (OG_W, OG_H), (8, 5, 15)), cover, scrim.resize((OG_W, OG_H))
    )

    d = ImageDraw.Draw(cover)
    cx = OG_W // 2
    draw_spaced(d, BRAND, pick_font(20), 48, 46, 5, (150, 134, 200), align="left")
    draw_spaced(d, TITLE, pick_font(76), cx, 138, 20, (245, 240, 255))
    draw_spaced(d, SUB, pick_font(27), cx, 218, 6, (201, 180, 255))

    cover.save(OUT, format="JPEG", quality=88, optimize=True, progressive=True)
    stale = OUT.with_suffix(".png")
    if stale.exists():
        stale.unlink()
    print("合成画布 %dx%d -> 封面 %dx%d" % (aw, ah, OG_W, OG_H))
    print("已写入 public/og-cover.jpg（%.0f KB）" % (OUT.stat().st_size / 1024))


if __name__ == "__main__":
    main()
