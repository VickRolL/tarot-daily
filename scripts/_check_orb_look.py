"""3D 球观感体检（2026-09-19）
---------------------------------------------------------------------------
本机 Git Bash 的 `cd` 不可靠，所以路径一律写死绝对路径，且脚本落地成文件跑，
避免命令行转义。

判据（这是本次要回答的问题）：
  · 球心亮度 / 背景亮度 的比值 —— 球是主 CTA，该比背景亮，但高太多就变「发光的星球」
  · 球心饱和度 —— 过饱和的蓝会读成行星，而不是「暗玻璃球里透出的冷光」
  · 球心到边缘的亮度落差 —— 落差不足就是「贴了图的球面」而不是球
"""

from PIL import Image
import sys

ROOT = r"C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app"
_name = sys.argv[1] if len(sys.argv) > 1 else "orb3d"
SHOT = ROOT + r"\scripts\out\%s.png" % _name
ZOOM = ROOT + r"\scripts\out\_%s-zoom.png" % _name

# 探针量到的 .orb 屏幕矩形（CSS px）
L, T, W = 571.6, 367.3, 438.7


def mean_rgb(img):
    px = list(img.getdata())
    n = len(px)
    r = sum(p[0] for p in px) / n
    g = sum(p[1] for p in px) / n
    b = sum(p[2] for p in px) / n
    sat = (max(r, g, b) - min(r, g, b)) / max(1e-6, max(r, g, b))
    return r, g, b, (r + g + b) / 3, sat


im = Image.open(SHOT).convert("RGB")
print("shot size:", im.size)

# 放大图：看清「手是不是真的压在球前面」以及边缘衔接
pad = 40
c = im.crop((int(L - pad), int(T - pad), int(L + W + pad), int(T + W + pad)))
c = c.resize((c.width * 2, c.height * 2), Image.LANCZOS)
c.save(ZOOM)
print("zoom saved:", ZOOM, c.size)


def ring(frac_in, frac_out):
    """取以球心为心、半径落在 [frac_in, frac_out] * R 的环带"""
    cx, cy, R = L + W / 2, T + W / 2, W / 2
    box = (int(cx - R * frac_out), int(cy - R * frac_out),
           int(cx + R * frac_out), int(cy + R * frac_out))
    sub = im.crop(box)
    sw = sub.width
    px = sub.load()
    acc = [0, 0, 0]
    n = 0
    ri, ro = frac_in * frac_out and frac_in, frac_out
    for y in range(sw):
        for x in range(sw):
            dx = (x - sw / 2) / (sw / 2)
            dy = (y - sw / 2) / (sw / 2)
            d = (dx * dx + dy * dy) ** 0.5
            if frac_in <= d <= frac_out:
                p = px[x, y]
                acc[0] += p[0]; acc[1] += p[1]; acc[2] += p[2]
                n += 1
    if n == 0:
        return None
    return [a / n for a in acc]


r, g, b, lc, sat = mean_rgb(im.crop((
    int(L + W * 0.35), int(T + W * 0.35), int(L + W * 0.65), int(T + W * 0.65))))
print("ball center  RGB = %.1f %.1f %.1f  L=%.1f  sat=%.2f" % (r, g, b, lc, sat))

r2, g2, b2, lb, _ = mean_rgb(im.crop((100, 200, 300, 400)))
print("background   RGB = %.1f %.1f %.1f  L=%.1f" % (r2, g2, b2, lb))
print("ball/背景 亮度比 = %.2f" % (lc / max(1e-6, lb)))

for a, bb in ((0.0, 0.22), (0.30, 0.50), (0.62, 0.80), (0.86, 0.97)):
    m = ring(a, bb)
    if m:
        print("ring %.2f-%.2f  RGB = %.1f %.1f %.1f  L=%.1f" % (a, bb, m[0], m[1], m[2], sum(m) / 3))

tex = Image.open(ROOT + r"\public\skins\mist-night\orb-nebula.webp").convert("RGB")
print("texture size:", tex.size)
pt = list(tex.getdata())
nt = len(pt)
rt = sum(p[0] for p in pt) / nt
gt = sum(p[1] for p in pt) / nt
bt = sum(p[2] for p in pt) / nt
lt = sorted((0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) for p in pt)
print("texture mean RGB = %.1f %.1f %.1f L=%.1f  p50=%.1f p95=%.1f p99=%.1f"
      % (rt, gt, bt, (rt + gt + bt) / 3, lt[nt // 2], lt[int(nt * 0.95)], lt[int(nt * 0.99)]))
