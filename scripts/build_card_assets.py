# -*- coding: utf-8 -*-
"""
塔罗卡牌素材处理工具
作者：阿澈

流水线（每批 AI 出图后跑一次）：
1. 去水印 + 抠卡框：白底卡框 -> 透明底，按内容裁到外沿，并量出插画窗口的百分比坐标
2. 导出牌面：按卡框比例居中裁切 + 去底部水印 + 压成 WebP
3. 合成预览：插画 + 卡框 + 代码文字，输出 22 张成品预览图 + 一张总览拼版

输入约定：
    assets/card-art/major-XX/  放该牌的插画（目录里放一张即可，任意文件名）

用法：
    python scripts/build_card_assets.py
"""
import os
import statistics

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "assets", "card-styles", "anime-v2")
ART_DIR = os.path.join(ROOT, "assets", "card-art")
OUT_SKIN = os.path.join(ROOT, "public", "skins", "mist-night")
OUT_PREVIEW = os.path.join(ROOT, "assets", "previews")

FRAME_SRC = os.path.join(
    SRC_DIR,
    "二次元游戏卡牌外框装饰素材_竖构图比例_3_5__结构_最外_2026-09-17T14-28-50.png",
)

# 22 张大阿卡纳：(card_id, 中文名, 英文名, 罗马数字, 配色说明, 底部裁切比例)
# 插画文件由 find_art() 从 assets/card-art/<card_id>/ 里自动找，不用登记文件名。
# 配色按每张牌的牌性单独指定，风格与卡框全牌统一 —— 统一来自技法与卡框，不来自颜色。
ARTS = [
    ("major-00", "愚人", "THE FOOL", "0", "暖金 · 风", 0.05),
    ("major-01", "魔术师", "THE MAGICIAN", "I", "朱红 · 火", 0.05),
    ("major-02", "女祭司", "THE HIGH PRIESTESS", "II", "靛蓝 · 月", 0.05),
    ("major-03", "女皇", "THE EMPRESS", "III", "翠绿 · 土", 0.05),
    ("major-04", "皇帝", "THE EMPEROR", "IV", "赭红 · 铁", 0.05),
    ("major-05", "教皇", "THE HIEROPHANT", "V", "象牙 · 紫", 0.05),
    ("major-06", "恋人", "THE LOVERS", "VI", "玫粉 · 风", 0.05),
    ("major-07", "战车", "THE CHARIOT", "VII", "深紫 · 金", 0.05),
    ("major-08", "力量", "STRENGTH", "VIII", "暖橙 · 火", 0.05),
    ("major-09", "隐士", "THE HERMIT", "IX", "墨蓝 · 灯", 0.05),
    ("major-10", "命运之轮", "WHEEL OF FORTUNE", "X", "青金 · 轮", 0.05),
    ("major-11", "正义", "JUSTICE", "XI", "冷银 · 赤", 0.05),
    ("major-12", "倒吊人", "THE HANGED MAN", "XII", "青绿 · 悬", 0.05),
    ("major-13", "死神", "DEATH", "XIII", "深红 · 暗", 0.05),
    ("major-14", "节制", "TEMPERANCE", "XIV", "淡青 · 和", 0.05),
    ("major-15", "恶魔", "THE DEVIL", "XV", "暗紫红 · 缚", 0.05),
    ("major-16", "塔", "THE TOWER", "XVI", "铅灰 · 雷", 0.05),
    ("major-17", "星星", "THE STAR", "XVII", "青蓝 · 水", 0.05),
    ("major-18", "月亮", "THE MOON", "XVIII", "银蓝 · 雾", 0.05),
    ("major-19", "太阳", "THE SUN", "XIX", "明黄 · 阳", 0.05),
    ("major-20", "审判", "JUDGEMENT", "XX", "天青 · 号", 0.05),
    ("major-21", "世界", "THE WORLD", "XXI", "翠绿 · 紫罗兰", 0.05),
]

CARD_W = 1024                # 成品卡牌基准宽
CARD_H = 1554                # 成品卡牌基准高（按卡框实际比例推导，脚本会覆盖）

# web 用 2 倍图（卡牌实际显示约 300×455 CSS px）。
# 高度**必须**由卡片比例推导 —— 原来写死 1166，换卡框换比例后会被拉伸变形。
WEB_WID = 768
_WEB = {"w": WEB_WID, "h": 1166}


def set_web_size(card_ratio):
    _WEB["h"] = int(round(_WEB["w"] / card_ratio))
    return (_WEB["w"], _WEB["h"])


def web_size():
    return (_WEB["w"], _WEB["h"])


# --------------------------------------------------------------------------- #
# 卡框形态：要不要保留右下角的悬挂吊牌
# --------------------------------------------------------------------------- #
# 2026-09-18：用户决定先去掉吊牌，把卡牌收成一个干净的矩形，等项目跑通后再考虑装饰性外挂元素。
#
# 原图的吊牌是「挂在卡片本体外面」的：吊绳贴着右边缘下来，吊牌挂在右下角，
# 而吊牌本体有一大块**压在卡片本体内部**（实测最左到卡体的 x≈0.797、最上到 y≈0.78），
# 所以只裁画布是不够的，压在卡体里的那部分必须补掉。
#
# 置 CROP_TO_CARD_BODY = False 可恢复「卡片 + 吊牌」的旧形态，
# 那时 CARD_ASPECT 会变回 986 / 1496。
CROP_TO_CARD_BODY = True
REMOVE_TAG = True

# 吊牌 / 吊绳在「卡片本体」坐标系里占用的矩形（比例），用左下角镜像补掉。
# (x0, y0, x1, y1, 需要羽化的边)
#   - 值是实测的：吊绳从 y≈0.755 起贴着右侧进来（x≈0.98），吊牌本体最左到 x≈0.797、最上到 y≈0.78
#   - 每块都往外留了 20~30px 余量，保证羽化带里只有「干净的原始内容」，不会把吊牌边缘一起晕开
#   - 两块在 y≈0.855 处重叠，接缝处两边都是镜像内容，所以第二块不需要羽化上边
TAG_PATCH_BOXES = (
    (0.875, 0.735, 1.0, 0.87, ("left", "top")),
    (0.780, 0.855, 1.0, 1.0, ("left",)),
)
TAG_PATCH_FEATHER = 6        # 接缝羽化宽度（px，卡片本体基准）

FONT_CANDIDATES_CN = [
    r"C:\Windows\Fonts\STZHONGS.TTF",
    r"C:\Windows\Fonts\simsun.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
]
FONT_CANDIDATES_EN = [
    r"C:\Windows\Fonts\georgia.ttf",
    r"C:\Windows\Fonts\georgiab.ttf",
    r"C:\Windows\Fonts\times.ttf",
]

GOLD = (168, 130, 62)
# 罗马数字压在米白上框带上，用更深的金棕色保证对比度
ROMAN_GOLD = (138, 104, 46)

ART_EXT = (".png", ".jpg", ".jpeg", ".webp")


def pick_font(cands, size):
    for c in cands:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
    return ImageFont.load_default()


def find_art(card_id):
    """从 assets/card-art/<card_id>/ 里找插画，目录里只放一张，不关心文件名。"""
    d = os.path.join(ART_DIR, card_id)
    if not os.path.isdir(d):
        return None
    for f in sorted(os.listdir(d)):
        if f.lower().endswith(ART_EXT):
            return os.path.join(d, f)
    return None


# --------------------------------------------------------------------------- #
# 1) 去水印
# --------------------------------------------------------------------------- #
def strip_light_watermark(img, region, k=9, low=4.0, high=20.0):
    """
    抹掉压在浅色材质上的半透明白色水印。

    原理：开运算（先 MinFilter 腐蚀、后 MaxFilter 膨胀）会移除比底色亮的细笔画，
    同时完整保留大面积色块和比底色暗的线条（吊牌描边、金色卷草）。
    只在「原图明显比开运算结果亮」的地方替换，其余像素原样保留，因此不留痕迹。
    """
    im = img.convert("RGB")
    w, h = im.size
    x0, y0 = int(w * region[0]), int(h * region[1])
    x1, y1 = int(w * region[2]), int(h * region[3])
    box = im.crop((x0, y0, x1, y1))

    opened = box.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
    b, o = box.load(), opened.load()
    bw, bh = box.size
    touched = 0
    for y in range(bh):
        for x in range(bw):
            p, q = b[x, y], o[x, y]
            d = (p[0] + p[1] + p[2] - q[0] - q[1] - q[2]) / 3.0
            if d > low:
                t = min(1.0, (d - low) / (high - low))
                b[x, y] = tuple(int(round(p[i] + (q[i] - p[i]) * t)) for i in range(3))
                touched += 1
    im.paste(box, (x0, y0))
    return im, touched


def repair_by_mirror(img, region=(0.60, 0.885, 1.0, 1.0), feather=24):
    """左右对称的素材（如首页背景）用镜像内容补掉右下角水印。"""
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


# --------------------------------------------------------------------------- #
# 2) 抠卡框
# --------------------------------------------------------------------------- #
def extract_frame(src):
    """白底卡框 -> 透明底卡框；再按不透明内容裁边，去掉画布多余留白。"""
    frame = Image.open(src).convert("RGB")
    w, h = frame.size
    r, g, b = frame.split()
    minch = ImageChops.darker(ImageChops.darker(r, g), b)  # 最暗通道，白≈255

    mask = minch.copy()
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if mask.getpixel(seed) > 200:
            ImageDraw.floodfill(mask, seed, 0, thresh=30)   # 吃掉卡框外部白底
    if mask.getpixel((w // 2, h // 2)) > 200:
        ImageDraw.floodfill(mask, (w // 2, h // 2), 0, thresh=30)  # 吃掉中央开口

    alpha = mask.point(lambda v: 255 if v > 0 else 0)
    out = frame.convert("RGBA")
    out.putalpha(alpha)

    # 裁到内容外沿（保留右下角吊牌探出的部分）
    out = out.crop(out.getbbox())
    return out


# --------------------------------------------------------------------------- #
# 1.2) 裁到「卡片本体」+ 抹掉右下角的吊牌
# --------------------------------------------------------------------------- #
def card_body_rect(frame):
    """稳健量出「卡片本体」矩形（不含吊牌）。

    只取画布中段的行/列（避开右下角吊牌那一角），逐行/逐列找最外的不透明像素，
    再取中位数 —— 比 `getbbox()` 稳，因为 bbox 会被吊牌撑大。
    """
    w, h = frame.size
    px = frame.split()[3].load()
    rows = range(int(h * 0.15), int(h * 0.85))
    cols = range(int(w * 0.15), int(w * 0.85))
    first_x = [min(x for x in range(w) if px[x, y] > 128) for y in rows]
    last_x = [max(x for x in range(w) if px[x, y] > 128) for y in rows]
    first_y = [min(y for y in range(h) if px[x, y] > 128) for x in cols]
    last_y = [max(y for y in range(h) if px[x, y] > 128) for x in cols]
    L = int(statistics.median(first_x))
    R = int(statistics.median(last_x))
    T = int(statistics.median(first_y))
    B = int(statistics.median(last_y))
    return (L, T, R + 1, B + 1)


def remove_hanging_tag(frame, verbose=None):
    """抹掉右下角的吊牌与吊绳：拿左下角的镜像来补。

    为什么镜像能用：这个卡框除「左侧宝石」和「右下吊牌」之外是**左右镜像对称**的 ——
    插画窗口在卡片本体里正好居中（实测左窗边 101 ↔ 右窗边 858，关于卡体中心 479.5 精确对称），
    金色卷草、深青内带、外沿斜切角也都是镜像关系。所以补上去的轮廓天然吻合。

    唯一的误差是纸纹与金线位置会差 1~3px（手绘感素材本来就不是像素级对称），
    因此在朝内的两条边上做羽化过渡。按实际显示尺寸（卡片约 300px 宽、侧边带约 30px）
    这点误差肉眼看不出来。
    """
    w, h = frame.size
    src = frame.transpose(Image.FLIP_LEFT_RIGHT)
    out = frame.copy()
    f = TAG_PATCH_FEATHER

    for x0f, y0f, x1f, y1f, edges in TAG_PATCH_BOXES:
        x0 = int(round(x0f * w))
        y0 = int(round(y0f * h))
        x1 = int(round(x1f * w))
        y1 = int(round(y1f * h))
        pw, ph = x1 - x0, y1 - y0
        if pw <= 0 or ph <= 0:
            continue

        # 镜像取样：src 已经是整幅水平翻转，
        # 而「目的块 [x0,x1) 的镜像」在 src 里的位置正好也是 [x0,x1)（不要多翻一次）。
        sx0 = x0
        piece = src.crop((sx0, y0, sx0 + pw, y1))

        mask = Image.new("L", (pw, ph), 255)
        md = ImageDraw.Draw(mask)
        if "left" in edges:
            for i in range(f):
                md.line([(i, 0), (i, ph)], fill=int(255 * i / f))
        if "top" in edges:
            for i in range(f):
                md.line([(0, i), (pw, i)], fill=int(255 * i / f))
        mask = mask.filter(ImageFilter.GaussianBlur(f * 0.4))

        out.paste(piece, (x0, y0), mask)
        if verbose is not None:
            verbose.append((x0, y0, x1, y1))

    return out


def tag_residue(frame):
    """自查：抹掉吊牌之后，右下角还剩多少「与镜像不一致」的结构。

    把卡体和它的水平镜像都糊 5px（滤掉纸纹噪声），在右半区逐行统计强差异像素。
    残留很小就说明吊牌和吊绳确实被补干净了。返回 (总差异像素数, 最大单行值)。
    """
    rgb = frame.convert("RGB")
    mir = rgb.transpose(Image.FLIP_LEFT_RIGHT)
    d = ImageChops.difference(
        rgb.filter(ImageFilter.GaussianBlur(5)),
        mir.filter(ImageFilter.GaussianBlur(5)),
    ).convert("L")
    w, h = d.size
    px = d.load()
    per_row = [
        sum(1 for x in range(w // 2, w) if px[x, y] > 30)
        for y in range(h)
    ]
    return sum(per_row), (max(per_row) if per_row else 0)


# --------------------------------------------------------------------------- #
# 1.5) 填掉卡框外圈的死区 —— 这一条是「22 张牌全都有黑边」的根治
# --------------------------------------------------------------------------- #
# 踩过的坑（2026-09-18 定位）：
#   原图里卡片本体四周有一圈白底留白，吊牌挂在右下角、悬在这圈留白里。
#   抠图后这圈留白变成透明，而 `crop(getbbox())` 的 bbox 由「卡片 + 吊牌」共同决定，
#   所以留白没被裁掉，成了卡框素材的「透明死区」：
#       上 0px / 左 5px / 右 14px / 下 ~36px（768 宽基准下）
#   插画又按 CARD_BODY_CLIP 裁掉了这部分，于是「卡框不画 + 插画不画」= 漏出卡片底色。
#   实机渲染实测漏出宽度：上 1px / 左 2px / 右 6px / 下 12px（卡宽 254px 时）。
#   合成预览更糟：RGBA 转 RGB 时透明像素直接变纯黑 —— 这就是成品总览图上的「黑边」。
#
# 解法：把「与画布四边连通的透明区」填成纸色，让卡框成为不透光的实心矩形。
#   中央开口是封闭的透明区，泛洪到不了，因此不受影响；
#   吊牌本身是不透明的，填色只落在它周围的留白上。
def sample_outer_paper(frame, near=6, far=44):
    """量卡框外缘往内 near~far px 的纸色，按四条边分别取样（纸色四周略有差异）。"""
    w, h = frame.size
    px = frame.load()
    lines = {
        "left": [(x, h // 2) for x in range(w)],
        "right": [(x, h // 2) for x in range(w - 1, -1, -1)],
        "top": [(w // 2, y) for y in range(h)],
        "bottom": [(w // 2, y) for y in range(h - 1, -1, -1)],
    }
    out = {}
    for side, seq in lines.items():
        start = 0
        for i, (x, y) in enumerate(seq):
            if px[x, y][3] > 240:
                start = i
                break
        cols = [
            px[x, y][:3]
            for x, y in seq[start + near: start + far]
            if px[x, y][3] > 240
        ]
        if cols:
            out[side] = tuple(int(statistics.median([c[k] for c in cols])) for k in range(3))
    return out


def fill_outer_margin(frame, thresh=8):
    """把与画布四边连通的透明死区填成纸色 —— 卡框从此是实心矩形，只留中央开口透明。

    注意不能只「把透明像素换成纸色」：卡体四角是 45° 斜切角，斜边上有半透明的抗锯齿像素，
    只换纯透明像素的话，会沿着斜边留下一道半透明的虚边（合成预览里尤其明显）。
    所以做法是**先在底下垫一层满幅纸色，再把死区的 alpha 直接拉满**，
    这样斜切的抗锯齿像素会和纸色平滑融合，斜边反而保留成一道自然的倒角高光。

    只做一次泛洪 + 两次整层合成（纯 C 级），不要在 compose 里对每张牌重算。
    返回 (填好的卡框, 纸色 RGB)；没有死区时原样返回。
    """
    w, h = frame.size
    papers = sample_outer_paper(frame)
    vals = list(papers.values())
    if not vals:
        return frame, None
    # 四条边的纸色差异很小（实测 209,188,158 / 232,222,202 一档），统一取一个色
    # 既够用，也让 CSS 侧只需要一个 CARD_PAPER 变量，两边颜色天然一致。
    paper = tuple(int(statistics.median([c[k] for c in vals])) for k in range(3))

    m = frame.split()[3].point(lambda v: 255 if v <= thresh else 0)
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if m.getpixel(seed) > 0:
            ImageDraw.floodfill(m, seed, 128, thresh=12)
    outer = m.point(lambda v: 255 if v == 128 else 0)

    if outer.getbbox() is None:
        return frame, paper

    # 往外扩 2px，把死区边缘的抗锯齿像素也纳入「拉满 alpha」的范围
    outer = outer.filter(ImageFilter.MaxFilter(5))

    paper_layer = Image.new("RGBA", (w, h), paper + (255,))
    out = Image.alpha_composite(paper_layer, frame)
    out.putalpha(Image.composite(Image.new("L", (w, h), 255), frame.split()[3], outer))
    return out, paper


def measure(frame):
    """量出插画窗口（中央透明区）在卡框中的百分比坐标。"""
    w, h = frame.size
    a = frame.split()[3]
    row = [a.getpixel((x, h // 2)) for x in range(w)]
    col = [a.getpixel((w // 2, y)) for y in range(h)]

    def widest_gap(vals):
        runs, start = [], None
        for i, v in enumerate(vals):
            if v <= 128 and start is None:
                start = i
            elif v > 128 and start is not None:
                runs.append((start, i - 1))
                start = None
        if start is not None:
            runs.append((start, len(vals) - 1))
        return max(runs, key=lambda r: r[1] - r[0]) if runs else (0, 0)

    ox0, ox1 = widest_gap(row)
    oy0, oy1 = widest_gap(col)

    # 卡片本体外沿（不含吊牌）：中轴剖面上最外的不透明像素
    card_x = [x for x, v in enumerate(row) if v > 128]
    card_y = [y for y, v in enumerate(col) if v > 128]

    return {
        "size": (w, h),
        # 插画窗口：左 / 上 / 右 / 下 四条框带的宽度占比
        "inset": (ox0 / w, oy0 / h, 1 - ox1 / w, 1 - oy1 / h),
        # 卡片本体（不含吊牌）在卡框图中的占比
        "card_box": (
            card_x[0] / w, card_y[0] / h,
            card_x[-1] / w, card_y[-1] / h,
        ),
    }


# --------------------------------------------------------------------------- #
# 3) 导出牌面
# --------------------------------------------------------------------------- #
def fit_card(art_path, card_ratio, bottom_trim=0.05):
    """把插画裁成卡框比例，再裁掉四条边残留的浅色边带。

    bottom_trim 用于切掉 AI 出图固定在底边的水印。

    ⚠️ 裁边必须在**缩放之前**做：如果把裁边放在缩放之后，成品尺寸会被裁小
    （实测 768x1123 → 733x1096），插画和卡框就不再同尺寸同比例了 ——
    而卡框必须严格保持卡牌比例，这个契约不能破。
    代价是 LANCZOS 重采样会在图的边界处重新造出 1~5px 的「亮而平」细线
    （实测只有 major-06 / major-13 中招，且落在本来就很亮的画面上），
    这一圈**最终会被卡框的不透明边框盖住**（左右各盖 10.5%），肉眼不可见，
    因此验收脚本对 ≤6px 的残边判定为「可接受」。
    """
    art = Image.open(art_path).convert("RGB")
    aw, ah = art.size
    keep_h = int(ah * (1 - bottom_trim))
    new_w = int(round(keep_h * card_ratio))
    if new_w <= aw:
        left = (aw - new_w) // 2
        art = art.crop((left, 0, left + new_w, keep_h))
    else:
        new_h = int(round(aw / card_ratio))
        art = art.crop((0, 0, aw, new_h))
    return trim_edge_residue(art)


# AI 出图的画布最外缘常留一条平坦的浅色/白边（原图白边没裁干净）。
# 实测（导出 768x1166 基准）22 张里 17 张顶部中招，最深的到 22px，浅的是 0px。
# 虽然这一圈现在被卡框盖住看不见，但换一个开口更大的卡框就会立刻露出来，
# 而且素材本身带着一条白边，看着就是「半成品」，所以在导出前统一切掉。
EDGE_TRIM_MAX = 0.035   # 单轮、单边最多裁多少（防止一轮误判把画面裁伤）
EDGE_TRIM_TOTAL = 0.06  # 单边累计最多裁多少（多轮收敛的总预算，兜住误判）
EDGE_TRIM_PAD = 3       # 判定出的残线之外再多裁几像素兜底
EDGE_TRIM_PASSES = 6    # 一轮裁完可能又露出下一小条，最多收敛几轮

# 判定阈值：一条「残线」是【横跨整条边都亮】且【亮得很平】（没有画面细节）。
# 只看亮度会把「画得亮的天空」误判成残线，所以必须同时要求标准差很小。
EDGE_RESIDUE_GLOW = 38  # 比内部参考亮多少才算残线
EDGE_RESIDUE_FLAT = 15  # 跨轴标准差低于多少才算「平」


def _edge_stats(art, perp_step=3):
    """返回每条边（每行 / 每列）亮度的 (中位, 标准差)。

    ⚠️ 扫描轴上**必须逐像素**取样。踩过的坑：原来扫描轴也隔 3px 取点，
    结果最外的 1~2 列永远采不到（768 宽的图只采到 x=765），
    残线既判不出来也裁不掉，验收时会一直报「仍有残边」。
    垂直方向隔点取样 —— 画面细节对「平不平」的判断影响很小，把开销压回来。
    灰度用 PIL 的 convert("L") 现成转换，比逐像素 Python 运算快得多。
    """
    g = art.convert("L")
    w, h = g.size
    flat = list(g.getdata())                      # C 级取一遍，之后用切片抽样
    rows = [flat[y * w:(y + 1) * w:perp_step] for y in range(h)]
    cols = [flat[x::w][::perp_step] for x in range(w)]

    def stat(vals):
        return statistics.median(vals), (statistics.pstdev(vals) if len(vals) > 1 else 0.0)

    return [stat(v) for v in rows], [stat(v) for v in cols]


def _residue_depth(stats_seq, count, max_n):
    """从边缘往里数：连续多少条是「平坦的亮带」。返回**像素**深度。"""
    ref = statistics.median([stats_seq[i][0] for i in range(int(count * 0.12), int(count * 0.20))])
    depth = 0
    for i in range(min(max_n, count)):
        m, sd = stats_seq[i]
        if m > ref + EDGE_RESIDUE_GLOW and sd < EDGE_RESIDUE_FLAT:
            depth = i + 1
        else:
            break
    return depth


def trim_edge_residue(art, verbose=None):
    """切掉四条边最外圈残留的浅色边带，四条边各自独立判定。

    为什么要多轮：残边外侧常有一条「没那么亮」的过渡带把检测挡住，
    裁掉最亮的一轮之后，过渡带成了新的最外圈，就又露出来了。
    实测有牌裁一轮后还剩 3px，跑到第二轮才干净；换了卡牌比例（重新裁切）之后
    又会有新的牌中招，所以这里循环收敛，总预算由 EDGE_TRIM_TOTAL 兜住。
    """
    cur = art
    acc = [0, 0, 0, 0]                  # 上 / 右 / 下 / 左 累计裁掉的像素
    W0, H0 = art.size
    bud_y = int(H0 * EDGE_TRIM_TOTAL)   # 单边累计预算（按原图算，不随轮次缩水）
    bud_x = int(W0 * EDGE_TRIM_TOTAL)

    for _ in range(EDGE_TRIM_PASSES):
        w0, h0 = cur.size
        rows, cols = _edge_stats(cur)
        max_row = int(h0 * EDGE_TRIM_MAX)
        max_col = int(w0 * EDGE_TRIM_MAX)

        top = _residue_depth(rows, h0, max_row)
        bottom = _residue_depth(list(reversed(rows)), h0, max_row)
        left = _residue_depth(cols, w0, max_col)
        right = _residue_depth(list(reversed(cols)), w0, max_col)

        if not (top or bottom or left or right):
            break

        cut_t = min(top + EDGE_TRIM_PAD, max(0, bud_y - acc[0]))
        cut_r = min(right + EDGE_TRIM_PAD, max(0, bud_x - acc[1]))
        cut_b = min(bottom + EDGE_TRIM_PAD, max(0, bud_y - acc[2]))
        cut_l = min(left + EDGE_TRIM_PAD, max(0, bud_x - acc[3]))
        if not (cut_t or cut_r or cut_b or cut_l):
            break                            # 预算用尽

        acc[0] += cut_t
        acc[1] += cut_r
        acc[2] += cut_b
        acc[3] += cut_l
        w, h = cur.size
        cur = cur.crop((cut_l, cut_t, w - cut_r, h - cut_b))

    if verbose is not None:
        verbose.append(tuple(acc))
    return cur


def export_card_art(art_path, card_id, card_ratio, bottom_trim=0.05):
    # 先在原尺度裁干净、再缩到 web 尺寸 —— 顺序不能颠倒，见 fit_card 的说明
    art = fit_card(art_path, card_ratio, bottom_trim).resize(web_size(), Image.LANCZOS)
    out_dir = os.path.join(OUT_SKIN, "cards")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"{card_id}.webp")
    art.save(out, format="WEBP", quality=90, method=6)
    print("  牌面素材 -> %s (%.0f KB)" % (out, os.path.getsize(out) / 1024))
    stale = os.path.join(out_dir, f"{card_id}.png")
    if os.path.exists(stale):
        os.remove(stale)


def export_frame(frame):
    f = frame.resize(web_size(), Image.LANCZOS)
    os.makedirs(OUT_SKIN, exist_ok=True)
    out = os.path.join(OUT_SKIN, "frame.webp")
    f.save(out, format="WEBP", quality=92, method=6)
    print("  卡框素材 -> %s (%.0f KB)" % (out, os.path.getsize(out) / 1024))
    for stale in ("frame.png", "frame.jpg"):
        sp = os.path.join(OUT_SKIN, stale)
        if os.path.exists(sp):
            os.remove(sp)


# --------------------------------------------------------------------------- #
# 4) 合成预览
# --------------------------------------------------------------------------- #
def compose(art_path, frame, meta, card_ratio, inset, card_box, out_path, bottom_trim=0.05):
    # 先在原尺度裁边、再缩到成品尺寸（顺序见 fit_card 的说明），
    # 保证预览与导出的 webp 用的是同一条处理链路。
    art_full = fit_card(art_path, card_ratio, bottom_trim).resize((CARD_W, CARD_H), Image.LANCZOS)
    art_full = art_full.convert("RGBA")

    # 卡片本体之外（右下角吊牌那一带）在卡框里是透明的，插画不能从那里漏出来
    bx0 = int(CARD_W * card_box[0])
    by0 = int(CARD_H * card_box[1])
    bx1 = int(CARD_W * card_box[2])
    by1 = int(CARD_H * card_box[3])
    art = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 0))
    art.paste(art_full.crop((bx0, by0, bx1, by1)), (bx0, by0))

    fr = frame.resize((CARD_W, CARD_H), Image.LANCZOS)
    card = Image.alpha_composite(art, fr)
    d = ImageDraw.Draw(card)

    ins_l, ins_t, ins_r, ins_b = inset
    top_h = int(CARD_H * ins_t)                        # 上框带（净空足够放罗马数字）
    win_l, win_r = int(CARD_W * ins_l), int(CARD_W * (1 - ins_r))
    win_b = int(CARD_H * (1 - ins_b))                  # 插画窗口底边

    d.text((CARD_W // 2, int(top_h * 0.52)), meta[3],
           font=pick_font(FONT_CANDIDATES_EN, max(18, int(top_h * 0.44))), fill=ROMAN_GOLD, anchor="mm")

    # 下框带被双层金线占满（净空仅 13px / 25px），放不下牌名。
    # 所以牌名落在插画窗口内下缘，底下垫一层由透明渐深的暗色，保证任何画面上都读得清。
    # 实测：浅色插画（恋人 / 力量 / 太阳）上底衬太弱，牌名对比不足，
    # 因此底衬加高加深（0.15 高度、峰值 240 不透明度、1.15 次幂快速起坡），文字再加同色描边兜底。
    scrim_h = int(CARD_H * 0.15)
    ramp = Image.new("L", (1, scrim_h))
    for i in range(scrim_h):
        ramp.putpixel((0, i), int(240 * ((i / (scrim_h - 1)) ** 1.15)))
    scrim = ramp.resize((win_r - win_l, scrim_h))
    card.paste(Image.new("RGB", scrim.size, (8, 5, 16)), (win_l, win_b - scrim_h), scrim)

    d.text((CARD_W // 2, win_b - int(scrim_h * 0.56)), meta[1],
           font=pick_font(FONT_CANDIDATES_CN, int(CARD_H * 0.037)), fill=(252, 248, 238),
           anchor="mm", stroke_width=3, stroke_fill=(14, 9, 24))
    d.text((CARD_W // 2, win_b - int(scrim_h * 0.22)), meta[2],
           font=pick_font(FONT_CANDIDATES_EN, int(CARD_H * 0.021)), fill=(238, 214, 158),
           anchor="mm", stroke_width=2, stroke_fill=(14, 9, 24))

    card.convert("RGB").save(out_path, quality=95)


def export_hero():
    """首页主视觉：镜像修水印 + 转 WebP 压体积。"""
    src = os.path.join(OUT_SKIN, "hero-bg.png")
    if not os.path.exists(src):
        return
    raw = Image.open(src).convert("RGB")
    fixed = repair_by_mirror(raw, region=(0.78, 0.90, 1.0, 1.0))
    out = os.path.join(OUT_SKIN, "hero-bg.webp")
    fixed.save(out, format="WEBP", quality=88, method=6)
    print("  主视觉 -> %s (%.0f KB)" % (out, os.path.getsize(out) / 1024))
    os.remove(src)


# --------------------------------------------------------------------------- #
def main():
    global CARD_H
    os.makedirs(OUT_PREVIEW, exist_ok=True)
    os.makedirs(OUT_SKIN, exist_ok=True)

    print("1) 去水印 + 抠卡框")
    raw = Image.open(FRAME_SRC).convert("RGB")
    # 水印只压在右下角吊牌下缘（卡片底边 y≈1390，水印 y≈1478-1536）。
    # 修补区域从 y=0.95h 起，完全避开卡框主体的金色卷草，避免误伤。
    cleaned, n = strip_light_watermark(
        raw, region=(0.79, 0.95, 1.0, 1.0), k=7, low=5.0, high=20.0
    )
    print("   抹除水印像素: %d" % n)
    tmp = os.path.join(SRC_DIR, "_frame-clean.png")
    cleaned.save(tmp)

    frame = extract_frame(tmp)
    print("   抠出卡框 %dx%d（按内容裁边，含右下角吊牌）" % frame.size)

    # 1.2) 裁到「卡片本体」再抹掉压在本体上的吊牌 + 吊绳
    if CROP_TO_CARD_BODY:
        rect = card_body_rect(frame)
        frame = frame.crop(rect)
        print("   裁到卡片本体 rect=%s -> %dx%d" % (rect, *frame.size))
    if REMOVE_TAG:
        patch = []
        frame = remove_hanging_tag(frame, patch)
        print("   抹掉吊牌/吊绳，镜像补图 %d 块: %s" % (len(patch), patch))
        if os.environ.get("TAG_CHECK", "1") != "0":
            tot, worst = tag_residue(frame)
            print("   镜像残差自查: 总差异 %d px / 最大单行 %d px（越小越好）" % (tot, worst))

    info = measure(frame)
    w, h = info["size"]
    CARD_H = int(round(CARD_W * h / w))
    card_ratio = CARD_W / CARD_H
    set_web_size(card_ratio)

    print("   卡框尺寸 %dx%d" % (w, h))
    print("   成品卡牌基准 %dx%d  比例 %.4f" % (CARD_W, CARD_H, card_ratio))
    print("   web 导出 %dx%d（高度由比例推导，不再写死）" % web_size())
    ins = info["inset"]
    print("   插画窗口 inset: left %.4f  top %.4f  right %.4f  bottom %.4f" % ins)
    cb = info["card_box"]
    print("   卡片本体占比: left %.4f top %.4f right %.4f bottom %.4f" % cb)
    # 卡框外圈死区已被填成纸色 → 卡框成为实心矩形，插画不再需要按卡片本体裁剪，
    # 因此 CARD_BODY_CLIP 全为 0（clip-path 变成空操作，保留它只是为了兼容旧配置）。
    cb_clip = (0.0, 0.0, 1.0, 1.0)
    print("   ---- 可直接粘进 src/config/skin.js ----")
    print("   CARD_ASPECT = '%d / %d'" % (w, h))
    print("   FRAME_INSET = { left: '%.2f%%', top: '%.2f%%', right: '%.2f%%', bottom: '%.2f%%' }"
          % (ins[0] * 100, ins[1] * 100, ins[2] * 100, ins[3] * 100))
    print("   CARD_BODY_CLIP = { top: '%.2f%%', right: '%.2f%%', bottom: '%.2f%%', left: '%.2f%%' }"
          % (cb_clip[1] * 100, (1 - cb_clip[2]) * 100, (1 - cb_clip[3]) * 100, cb_clip[0] * 100))

    # 卡框外圈死区填成纸色：只做一次，导出与 22 张成品预览共用同一个卡框
    frame_solid, solid = fill_outer_margin(frame)
    if solid:
        print("  卡框纸色 -> CARD_PAPER = '#%02x%02x%02x'  (请同步到 skin.js)" % solid)
    export_frame(frame_solid)

    print("2) 导出牌面（按卡框比例裁切 + 去边缘残线 + WebP）")
    missing = []
    for cid, cn, en, num, note, trim in ARTS:
        p = find_art(cid)
        if not p:
            missing.append(cid)
            print("  !! 缺插画: %s" % cid)
            continue
        export_card_art(p, cid, card_ratio, trim)
    if missing:
        print("   缺失插画 %d 张: %s" % (len(missing), ", ".join(missing)))

    print("3) 合成成品预览")
    for cid, cn, en, num, note, trim in ARTS:
        p = find_art(cid)
        if not p:
            continue
        compose(p, frame_solid, (cid, cn, en, num, note), card_ratio, ins, cb_clip,
                os.path.join(OUT_PREVIEW, "preview-%s.png" % cid), trim)
        print("  合成 -> preview-%s.png | %s %s" % (cid, cn, note))

    print("4) 首页主视觉压缩")
    export_hero()
    print("完成。")


if __name__ == "__main__":
    main()
