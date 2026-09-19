"""静帧判据：两次独立运行的截图是否逐像素一致
---------------------------------------------------------------------------
为什么这个判据能证明「渲染循环没在跑」：
球有自转（SPIN = 0.035 rad/s）。两次运行是**两个独立的 Chrome 进程**，
墙钟时刻不可能对齐，只要 rAF 循环在跑，贴图方位就差出 0.05–0.1 rad ——
在球面上是十几个像素的可见位移。所以「逐像素一致」⇒ 没有自转 ⇒ 没有循环。

同时要防止另一种假阳性：**两次都是空的**（黑屏）也会「一致」。
所以这里同时报球心区的亮度，并要求它落在合理区间（不是全黑、也不是全白）。
"""

import sys

from PIL import Image, ImageChops

ROOT = r"C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app"
L, T, W = 571.6, 367.3, 438.7


def stats(img):
    inner = img.crop((int(L + W * 0.30), int(T + W * 0.30),
                      int(L + W * 0.70), int(T + W * 0.70)))
    px = list(inner.getdata())
    n = len(px)
    r = sum(p[0] for p in px) / n
    g = sum(p[1] for p in px) / n
    b = sum(p[2] for p in px) / n
    lo = min(sum(p) / 3 for p in px)
    hi = max(sum(p) / 3 for p in px)
    return (r + g + b) / 3, lo, hi


a = Image.open(ROOT + r"\scripts\out\%s.png" % sys.argv[1]).convert("RGB")
b = Image.open(ROOT + r"\scripts\out\%s.png" % sys.argv[2]).convert("RGB")
print("尺寸", a.size, b.size)
assert a.size == b.size, "两张图尺寸不同，无法比对"

la, loa, hia = stats(a)
lb, lob, hib = stats(b)
print("A 球心区  L=%.2f  (min %.1f / max %.1f)" % (la, loa, hia))
print("B 球心区  L=%.2f  (min %.1f / max %.1f)" % (lb, lob, hib))

diff = ImageChops.difference(a, b)
bbox = diff.getbbox()
hist = diff.convert("L").histogram()
total = sum(hist)
nonzero = total - hist[0]
worst = max(i for i, c in enumerate(hist) if c > 0)

print("-" * 60)
print("差异包围盒 :", bbox)
print("非零差异像素: %d / %d  (%.4f%%)" % (nonzero, total, 100.0 * nonzero / total))
print("最大单通道差:", worst)

static_ok = nonzero == 0
visible_ok = 12.0 < la < 200.0 and 12.0 < lb < 200.0
print("-" * 60)
print("① 逐像素一致（渲染循环未启动）:", "PASS" if static_ok else "FAIL")
print("② 两帧都画出了东西（不是黑屏）:", "PASS" if visible_ok else "FAIL")
print("总判据:", "PASS" if (static_ok and visible_ok) else "FAIL")
