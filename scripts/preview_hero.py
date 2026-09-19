"""主视觉合成预览（不需要浏览器）

项目一直没有无头浏览器，锚点只能靠目测改，改完也不知道对不对。
这个脚本把 src/index.css 里 .hero-frame / .orb 的定位数学在 Python 里复现一遍，
用成品素材合成出「某个视口尺寸下屏幕真正看到的样子」，用于核对：

  - 主视觉底板的位置与缩放是否和 CSS 一致
  - 水晶球有没有落在新的掌心窝里、大小是否合适
  - 牌面落点（ANCHORS.stage）是不是在画面中间偏上

锚点全部从 src/config/skin.js 现读（不复制常量，避免两边不同步），
改完 skin.js 直接重跑本脚本就能看到结果。

用法：
    cd "C:/Users/29923/WorkBuddy/2026-09-17-19-02-52/tarot-app"
    "C:/Users/29923/.workbuddy/binaries/python/envs/default/Scripts/python.exe" scripts/preview_hero.py
    ... scripts/preview_hero.py 1440x900 2560x1080     # 指定视口，可给多个
"""
import os
import re
import sys

from PIL import Image, ImageDraw

try:
    from PIL import ImageFont
except ImportError:
    ImageFont = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIN_JS = os.path.join(ROOT, "src", "config", "skin.js")
OUT_DIR = os.path.join(ROOT, "assets", "previews")


def read_skin_consts():
    """从 skin.js 里读出布局常量（保持单一事实来源，不在脚本里复制一遍）。"""
    js = open(SKIN_JS, encoding="utf-8").read()

    def grab(pattern, what):
        m = re.search(pattern, js, re.S)
        if not m:
            sys.exit("无法从 src/config/skin.js 解析出%s，脚本需要同步更新" % what)
        return m

    skin = grab(r"export const SKIN = '([^']+)'", "SKIN").group(1)
    frame = grab(r"HERO_FRAME = \{\s*width:\s*([\d.]+),\s*height:\s*([\d.]+)", "HERO_FRAME")
    layout = grab(r"HERO_LAYOUT = \{(.*?)\}", "HERO_LAYOUT").group(1)
    anchors = grab(r"ANCHORS = \{(.*?)\n\}", "ANCHORS").group(1)
    # 牌面比例也现读 —— 以前写死 986/1496，卡框形态一改（比如去掉吊牌）预览就画错了
    ca = grab(r"CARD_ASPECT = '(\d+) / (\d+)'", "CARD_ASPECT")

    def num(text, key):
        m = re.search(r"%s:\s*(-?[\d.]+)" % key, text)
        if not m:
            sys.exit("skin.js 里找不到 %s" % key)
        return float(m.group(1))

    orb = re.search(r"orb:\s*\{([^}]*)\}", anchors).group(1)
    stage = re.search(r"stage:\s*\{([^}]*)\}", anchors).group(1)

    return {
        "skin": skin,
        "frame": (float(frame.group(1)), float(frame.group(2))),
        "card_aspect": float(ca.group(1)) / float(ca.group(2)),
        "bleed": num(layout, "bleed"),
        "position_y": num(layout, "positionY"),
        "orb": {"x": num(orb, "x"), "y": num(orb, "y"), "size": num(orb, "size")},
        "stage": {"x": num(stage, "x"), "y": num(stage, "y")},
    }


def load_slot(skin, name):
    for ext in (".webp", ".png"):
        p = os.path.join(ROOT, "public", "skins", skin, name + ext)
        if os.path.exists(p):
            return Image.open(p).convert("RGBA")
    return None


def plate_rect(vw, vh, cfg):
    """复现 .hero-frame 的尺寸与位置（对应 CSS 的 width: max(...) + translate(-50%,-posY%)）。

    注意：skin.js 里的 HERO_LAYOUT.bleed 是**单边**外扩比例，而 CSS 变量 --hero-bleed
    存的是总量（bleed*2，因为左右/上下各外扩一次）。这里必须乘 2，
    否则底板会被算小一圈（实测 1600x900 下应是 1664x1109.3，不是 1632x1088）。
    """
    fw, fh = cfg["frame"]
    ratio = fw / fh
    bleed = cfg["bleed"] * 2
    width = max(vw + bleed * vw / 100.0, (vh + bleed * vh / 100.0) * ratio)
    height = width / ratio
    return (-(width - vw) / 2.0, -(height - vh) * cfg["position_y"] / 100.0, width, height)


def label(draw, x, y, text):
    draw.text((x, y), text, fill=(0, 255, 140))


def compose(vw, vh, cfg, bg, orb, stage_card=None):
    px, py, pw, ph = plate_rect(vw, vh, cfg)

    # 底板：把主视觉按底板尺寸铺满，再按视口裁切
    base = bg.resize((int(round(pw)), int(round(ph))), Image.LANCZOS)
    scene = Image.new("RGBA", (vw, vh), (8, 5, 15, 255))
    scene.paste(base, (int(round(px)), int(round(py))), base)

    # 水晶球：正方形边长 = size% × 画布高，中心在 (x%, y%)，与 CSS 的 cqh / 百分比一致
    if orb is not None:
        side = cfg["orb"]["size"] / 100.0 * ph
        cx = px + cfg["orb"]["x"] / 100.0 * pw
        cy = py + cfg["orb"]["y"] / 100.0 * ph
        o = orb.resize((int(round(side)), int(round(side))), Image.LANCZOS)
        scene.paste(o, (int(round(cx - side / 2)), int(round(cy - side / 2))), o)

    # 牌面落点参考框（真实牌面高度是 min(48vh, 430px)，比例取自 skin.js）
    if stage_card:
        card_h = min(vh * 0.48, 430)
        card_w = card_h * stage_card
        sx = cfg["stage"]["x"] / 100.0 * vw
        sy = cfg["stage"]["y"] / 100.0 * vh
        draw = ImageDraw.Draw(scene)
        draw.rectangle(
            [sx - card_w / 2, sy - card_h / 2, sx + card_w / 2, sy + card_h / 2],
            outline=(255, 90, 90, 255),
            width=2,
        )

    return scene.convert("RGB")


def main(argv):
    cfg = read_skin_consts()
    os.makedirs(OUT_DIR, exist_ok=True)
    bg = load_slot(cfg["skin"], "hero-bg")
    if bg is None:
        sys.exit("找不到 hero-bg 素材，先跑 scripts/build_hero_assets.py")
    orb = load_slot(cfg["skin"], "hero-orb")
    print("皮肤 %s | 锚点 orb=(%g%%, %g%%) size=%g%%  主视觉 %sx%s" % (
        cfg["skin"], cfg["orb"]["x"], cfg["orb"]["y"], cfg["orb"]["size"], *cfg["frame"]))
    if orb is None:
        print("!! 没有 hero-orb 素材，预览里画不出球")

    sizes = []
    for a in argv:
        m = re.match(r"^(\d+)x(\d+)$", a)
        if m:
            sizes.append((int(m.group(1)), int(m.group(2))))
    if not sizes:
        sizes = [(1600, 900), (1440, 1000), (390, 844)]

    for vw, vh in sizes:
        img = compose(vw, vh, cfg, bg, orb, stage_card=cfg["card_aspect"])
        out = os.path.join(OUT_DIR, "hero-preview-%dx%d.png" % (vw, vh))
        img.save(out)
        px, py, pw, ph = plate_rect(vw, vh, cfg)
        print("视口 %dx%d -> %s" % (vw, vh, os.path.relpath(out, ROOT)))
        print("   底板 %.0fx%.0f  左上角 (%.0f, %.0f)  球直径 %.0fpx  球心 (%.1f%%, %.1f%%)"
              % (pw, ph, px, py, cfg["orb"]["size"] / 100.0 * ph,
                 (px + cfg["orb"]["x"] / 100.0 * pw) / vw * 100,
                 (py + cfg["orb"]["y"] / 100.0 * ph) / vh * 100))

    print("完成。红框是牌面落点，只看构图对不对，不看美术。")


if __name__ == "__main__":
    main(sys.argv[1:])
