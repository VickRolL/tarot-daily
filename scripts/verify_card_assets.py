# -*- coding: utf-8 -*-
"""
牌面素材验收（一跑就知道黑边有没有根治）
----------------------------------------
检查两件事：
1. frame.webp 是不是「不透光实心矩形」—— 只看**真透明**（alpha <= 8）。
   抗锯齿像素 alpha 常在 100~250，那不是洞，会让统计误报，所以不能拿 alpha>250 当标准。
   判定：四边外沿不允许出现 alpha <= 8 的像素；再看全图真透明占比是否只剩中央开口。
2. cards/*.webp 四条边有没有残留的浅色边带 —— 原图白边没裁干净留下的「半成品感」。
   判定方式和 build_card_assets.py 一致：横跨整条边都亮 + 亮得很平。

用法：
    python scripts/verify_card_assets.py
"""
import os
import statistics
import sys

from PIL import Image, ImageChops, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIN = os.path.join(ROOT, "public", "skins", "mist-night")

GLOW = 38      # 比内部参考亮多少才算残线
FLAT = 15      # 跨轴标准差低于多少才算「平」
STEP = 3
HOLE = 8       # alpha <= 8 视为真透明

# 牌面残边的容许量（px @ 768 宽）。
# 为什么允许非零：真正的残边是 9~36px 的长条（原图白边没裁干净），
# 而 LANCZOS 把裁好的图缩到 web 尺寸时，会在图的边界处重新造出 1~5px 的
# 「亮而平」细线（实测只有 major-06 / major-13 中招，且落在本来就很亮的画面上）。
# 这一圈最终会被卡框的不透明边框盖住（左右各 10.5%、上 7.5%、下 8.2%），
# 渲染出来完全看不见，所以判定为可接受。
EDGE_TOL = 6


def lum(t):
    return (t[0] * 299 + t[1] * 587 + t[2] * 114) / 1000.0


def check_frame(path):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    a = im.split()[3]
    edges = {
        "top":    [a.getpixel((x, 0)) for x in range(w)],
        "bottom": [a.getpixel((x, h - 1)) for x in range(w)],
        "left":   [a.getpixel((0, y)) for y in range(h)],
        "right":  [a.getpixel((w - 1, y)) for y in range(h)],
    }
    print("frame.webp %dx%d  比例 %.4f" % (w, h, w / h))
    ok = True
    for side, vals in edges.items():
        holes = sum(1 for v in vals if v <= HOLE)
        soft = sum(1 for v in vals if HOLE < v < 255)
        if holes:
            ok = False
        print("  %s%-6s 真透明 %d px | 半透明(抗锯齿/有损压缩) %d px"
              % ("!! " if holes else "OK ", side, holes, soft))

    hist = a.histogram()
    hole_total = sum(hist[:HOLE + 1])
    win = (1 - 0.1052 - 0.1062) * (1 - 0.0748 - 0.0820)   # 插画窗口占卡体的比例（参考值）
    print("  全图真透明 %.1f%%（应≈插画窗口 %.1f%%；边框带内不应有）"
          % (hole_total / (w * h) * 100, win * 100))
    return ok


def check_tag_removed(path):
    """右下角吊牌是否真的补干净了。

    做法：把卡框和它的水平镜像都糊 5px（滤掉纸纹噪声），在右半区逐行统计强差异像素。
    卡框除「左侧宝石」和「右下吊牌」外是左右镜像对称的，所以残留应该只剩一点点。
    只要单行残留不超过卡体宽的 15%，就认为吊牌/吊绳已经补干净。
    """
    im = Image.open(path).convert("RGB")
    w, h = im.size
    mir = im.transpose(Image.FLIP_LEFT_RIGHT)
    d = ImageChops.difference(
        im.filter(ImageFilter.GaussianBlur(5)),
        mir.filter(ImageFilter.GaussianBlur(5)),
    ).convert("L")
    px = d.load()
    per_row = [sum(1 for x in range(w // 2, w) if px[x, y] > 30) for y in range(h)]
    total = sum(per_row)
    worst = max(per_row) if per_row else 0
    limit = int(w * 0.15)
    ok = worst <= limit
    print("  镜像残差：合计 %d px（%.1f/行）| 最大单行 %d px（阈值 %d）"
          % (total, total / h, worst, limit))
    if not ok:
        print("     !! 右下角疑似还有吊牌/吊绳残留，检查 build_card_assets.py 的 TAG_PATCH_BOXES")
    return ok


def edge_depth(art, axis, reverse, max_depth_px):
    """沿一条边往里数「平坦的亮带」连续多少像素。

    必须和 build_card_assets.py 用同一套判据，否则会出现
    「流水线说裁干净了、验收说还有残边」这种自相矛盾的结果。
    扫描轴逐像素、垂直方向隔点 —— 隔点会漏掉最外的 1~2 条残线。
    """
    g = art.convert("L")
    w, h = g.size
    flat = list(g.getdata())
    if axis == "y":
        seq = [flat[y * w:(y + 1) * w:STEP] for y in range(h)]
        count = h
    else:
        seq = [flat[x::w][::STEP] for x in range(w)]
        count = w

    def stat(vals):
        return statistics.median(vals), (statistics.pstdev(vals) if len(vals) > 1 else 0.0)

    stats = [stat(v) for v in seq]
    if reverse:
        stats.reverse()

    ref = statistics.median([stats[i][0] for i in range(int(count * 0.12), int(count * 0.20))])
    depth = 0
    for i in range(min(max_depth_px, count)):
        m, sd = stats[i]
        if m > ref + GLOW and sd < FLAT:
            depth = i + 1
        else:
            break
    return depth


def main():
    print("=" * 62)
    print("1) 卡框实心性 + 吊牌是否已抹掉")
    print("=" * 62)
    frame_path = os.path.join(SKIN, "frame.webp")
    ok_frame = check_frame(frame_path)
    ok_tag = check_tag_removed(frame_path)

    print()
    print("=" * 62)
    print("2) 牌面残边（0 = 干净）")
    print("=" * 62)
    card_dir = os.path.join(SKIN, "cards")
    ids = sorted(f[:-5] for f in os.listdir(card_dir) if f.endswith(".webp"))
    size = Image.open(os.path.join(card_dir, "%s.webp" % ids[0])).size
    print("  牌             上    右    下    左   (px @ %dx%d，容许 ≤ %d)" % (*size, EDGE_TOL))
    bad = []
    for cid in ids:
        art = Image.open(os.path.join(card_dir, "%s.webp" % cid)).convert("RGB")
        w, h = art.size
        mx_y, mx_x = int(h * 0.035), int(w * 0.035)
        t = edge_depth(art, "y", False, mx_y)
        b = edge_depth(art, "y", True, mx_y)
        l = edge_depth(art, "x", False, mx_x)
        r = edge_depth(art, "x", True, mx_x)
        line = "  %-12s %5d %5d %5d %5d" % (cid, t, r, b, l)
        if max(t, b, l, r) > EDGE_TOL:
            bad.append(cid)
            line += "   << 残边过深"
        print(line)

    print()
    print("=" * 62)
    if ok_frame and ok_tag and not bad:
        print("通过：卡框实心无洞、吊牌已抹净，%d 张牌面残边均在容许量内（≤ %dpx）。"
              % (len(ids), EDGE_TOL))
        return 0
    print("未通过：卡框实心=%s / 吊牌已抹净=%s；%d 张残边过深：%s"
          % (ok_frame, ok_tag, len(bad), ", ".join(bad) if bad else "-"))
    return 1


if __name__ == "__main__":
    sys.exit(main())
