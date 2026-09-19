"""主视觉拆层素材后处理流水线

处理三张 AI 出图，产出可直接被代码引用的槽位素材：

    assets/hero-art/bg/    主视觉背景（含巫师、双手托举、掌心留空）→ public/skins/<皮肤>/hero-bg.webp
    assets/hero-art/orb/   水晶球                            → public/skins/<皮肤>/hero-orb.webp（透明底）
    assets/hero-art/back/  牌背                              → public/skins/<皮肤>/card-back.webp

每张的输入都按**目录扫描**取图，不依赖不可控的文件名；
目录里没有图就跳过该项并告警，不会中断整条流水线。

三件必须处理的事（都是本项目踩过的坑）：
  1) AI 出图右下角永远带水印 —— 背景用镜像修补（repair_by_mirror）
  2) `background: transparent` 经常返回白底 RGB，没有 alpha —— 球体用泛洪填充抠白底兜底
  3) 体积 —— 统一压成 WebP，球体保留 alpha

用法：
    cd "C:/Users/29923/WorkBuddy/2026-09-17-19-02-52/tarot-app"
    "C:/Users/29923/.workbuddy/binaries/python/envs/default/Scripts/python.exe" scripts/build_hero_assets.py
"""
import os
import re
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_ROOT = os.path.join(ROOT, "assets", "hero-art")
SKIN_JS = os.path.join(ROOT, "src", "config", "skin.js")


def read_skin_js():
    """从 skin.js 现读皮肤名与牌面比例 —— 不在脚本里复制常量，避免两边不同步。

    牌背的比例是跟着**卡牌本体**走的，卡框形态一改（2026-09-18 去掉了右下吊牌），
    这里就必须跟着变，所以不能写死。
    """
    try:
        js = open(SKIN_JS, encoding="utf-8").read()
    except OSError:
        return "mist-night", 986 / 1496
    m = re.search(r"export const SKIN = '([^']+)'", js)
    skin = m.group(1) if m else "mist-night"
    m = re.search(r"CARD_ASPECT = '(\d+) / (\d+)'", js)
    ratio = float(m.group(1)) / float(m.group(2)) if m else 986 / 1496
    return skin, ratio


SKIN, CARD_ASPECT = read_skin_js()
OUT_SKIN = os.path.join(ROOT, "public", "skins", SKIN)

IMG_EXT = (".png", ".jpg", ".jpeg", ".webp")

# 主视觉成品尺寸：桌面整屏 2 倍图已经足够，再大只是徒增体积
HERO_SIZE = (1536, 1024)
# 球体成品尺寸：屏幕上球约 300 CSS px，768 已是 2.5 倍图
ORB_SIZE = 768
# 牌背成品尺寸：牌面本体约 300x430 CSS px，2 倍图
BACK_SIZE = 620


def find_src(name):
    """从 assets/hero-art/<name>/ 里找源图，目录里只放一张，不关心文件名。"""
    d = os.path.join(SRC_ROOT, name)
    if not os.path.isdir(d):
        return None
    for f in sorted(os.listdir(d)):
        if f.lower().endswith(IMG_EXT):
            return os.path.join(d, f)
    return None


def repair_by_mirror(img, region=(0.78, 0.90, 1.0, 1.0), feather=24):
    """
    左右近似对称的素材（首页背景）用镜像内容补掉右下角水印。
    比让 AI 重画干净可控 —— 这一带的星云/雾气本来就左右近似对称。
    """
    im = img.convert("RGBA")
    w, h = im.size
    x0, y0 = int(w * region[0]), int(h * region[1])
    x1, y1 = int(w * region[2]), int(h * region[3])
    bw, bh = x1 - x0, y1 - y0
    src = im.crop((w - x1, y0, w - x1 + bw, y1)).transpose(Image.FLIP_LEFT_RIGHT)

    mask = Image.new("L", (bw, bh), 255)
    md = ImageDraw.Draw(mask)
    for i in range(feather):
        v = int(255 * (i / feather))
        md.line([(i, 0), (i, bh)], fill=v)
        md.line([(0, i), (bw, i)], fill=v)
    mask = mask.filter(ImageFilter.GaussianBlur(feather * 0.35))

    im.paste(src, (x0, y0), mask)
    return im


def key_out_white(img, thresh=28, shrink=1, feather=1.1):
    """
    把白底抠成透明底。

    做法：用「最暗通道」当灰阶场（白 ≈ 255，球体的紫色边缘要暗得多），
    从四角泛洪填充吃掉背景，阈值卡在近白区，所以会停在球体轮廓上。
    再腐蚀 1px 去掉轮廓外的残白、轻微羽化让边不出锯齿。

    这是 `background: transparent` 参数返回白底 RGB 时的兜底手段。
    """
    rgb = img.convert("RGB")
    w, h = rgb.size
    r, g, b = rgb.split()
    field = ImageChops.darker(ImageChops.darker(r, g), b)

    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if field.getpixel(seed) >= 255 - thresh:
            ImageDraw.floodfill(field, seed, 0, thresh=thresh)

    alpha = field.point(lambda v: 255 if v > 0 else 0)
    if shrink:
        alpha = alpha.filter(ImageFilter.MinFilter(3))
    if feather:
        alpha = alpha.filter(ImageFilter.GaussianBlur(feather))

    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def crop_square(img, margin=0.01):
    """按不透明内容裁到外沿，再补成正方形 —— 这样「素材尺寸」就等于「球的直径」。"""
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    side = int(round(max(w, h) * (1 + margin * 2)))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2), img)
    return canvas


def save_webp(img, path, quality=90):
    img.save(path, format="WEBP", quality=quality, method=6)
    print("  -> %s (%.0f KB, %s)" % (os.path.relpath(path, ROOT), os.path.getsize(path) / 1024, img.mode))
    for stale in (path[:-5] + ".png", path[:-5] + ".jpg"):
        if os.path.exists(stale):
            os.remove(stale)
            print("     清掉旧格式 %s" % os.path.relpath(stale, ROOT))


def build_hero_bg():
    src = find_src("bg")
    if not src:
        print("[跳过] 主视觉背景：assets/hero-art/bg/ 里没有图")
        return
    print("[主视觉背景] %s" % os.path.basename(src))
    raw = Image.open(src).convert("RGB")
    # 水印固定在右下角，用左下角镜像内容补上
    fixed = repair_by_mirror(raw, region=(0.78, 0.90, 1.0, 1.0))
    if fixed.size != HERO_SIZE:
        fixed = fixed.resize(HERO_SIZE, Image.LANCZOS)
    save_webp(fixed.convert("RGB"), os.path.join(OUT_SKIN, "hero-bg.webp"), quality=88)


def build_hero_orb():
    src = find_src("orb")
    if not src:
        print("[跳过] 水晶球：assets/hero-art/orb/ 里没有图")
        return
    print("[水晶球] %s" % os.path.basename(src))
    raw = Image.open(src)
    if raw.mode not in ("RGBA", "LA") or raw.convert("RGBA").getextrema()[3][0] == 255:
        print("   素材没有 alpha 通道（transparent 参数返回了白底 RGB），启用抠白底兜底")
        orb = key_out_white(raw)
    else:
        orb = raw.convert("RGBA")
    orb = crop_square(orb)
    orb = orb.resize((ORB_SIZE, ORB_SIZE), Image.LANCZOS)
    a = orb.split()[3]
    opaque = sum(1 for v in a.tobytes() if v > 8)
    print("   不透明像素占比 %.1f%%" % (100 * opaque / (ORB_SIZE * ORB_SIZE)))
    save_webp(orb, os.path.join(OUT_SKIN, "hero-orb.webp"), quality=90)


def build_card_back():
    src = find_src("back")
    if not src:
        print("[跳过] 牌背：assets/hero-art/back/ 里没有图")
        return
    print("[牌背] %s" % os.path.basename(src))
    raw = Image.open(src).convert("RGB")
    # 牌背本体要盖住「卡片本体」那一块，比例走卡体比例而不是整个卡牌框。
    # 2026-09-18 起卡牌本身就是卡体（吊牌已去掉），所以直接取 CARD_ASPECT。
    ratio = CARD_ASPECT
    print("   牌背目标比例 %.4f（现读 skin.js 的 CARD_ASPECT）" % ratio)
    # 整体缩放到目标比例，**不做裁剪**：AI 出图是 2:3，卡体是 0.684，
    # 按比例裁会把底部那圈金边切掉。2.5% 的非等比缩放肉眼完全看不出来，
    # 换来的是整幅图案（四角卷草 + 外圈金线）完整保留。
    back = repair_by_mirror(raw, region=(0.72, 0.90, 1.0, 1.0), feather=20).convert("RGB")
    back = back.resize((BACK_SIZE, int(round(BACK_SIZE / ratio))), Image.LANCZOS)
    save_webp(back, os.path.join(OUT_SKIN, "card-back.webp"), quality=88)


def main():
    os.makedirs(OUT_SKIN, exist_ok=True)
    build_hero_bg()
    build_hero_orb()
    build_card_back()
    print("完成。主视觉锚点若需微调，改 src/config/skin.js 的 ANCHORS.orb")


if __name__ == "__main__":
    sys.exit(main())
