"""指针视差判据：高光质心是否随指针水平移动（2026-09-19）
---------------------------------------------------------------------------
只看「最亮像素质心的 x 位移」。为什么不看整图差异：自转（SPIN）与内部呼吸
（uTime）本身就让两帧不同，整图差异没法归因。高光是画面里唯一的极亮点，
它的位移只可能来自光方向（LIGHT_SHIFT）—— 归因是干净的。

量级参考：LIGHT_SHIFT = 0.22，指针从 0.06 走到 0.94（归一化 -0.88 → +0.88），
球半径 219 px。光方向的 x 分量从 -0.46-0.19 走到 -0.46+0.19，
高光该横移十几到几十像素；自转在 2s 窗口内只转 0.07 rad（≈15 px 的贴图位移，
且不影响高光位置，因为高光由法线/视线/光方向决定，与 mesh.rotation 无关 ——
严格说 mesh 转了法线也跟着转，所以自转会带一点位移，但两帧的 uTime 几乎相同，
自转相位也几乎相同，取向一致）。
"""

import sys

from PIL import Image

ROOT = r"C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app"
# 探针量到的 .orb 屏幕矩形（CSS px），两次一致
L, T, W = 571.6, 367.3, 438.7


def brightest_centroid(img, top_frac=0.0015):
    """取球内最亮的一小撮像素（含最亮点），算它们的加权质心"""
    px = img.load()
    samples = []
    for y in range(img.height):
        for x in range(img.width):
            dx = x - img.width / 2
            dy = y - img.height / 2
            if dx * dx + dy * dy > (img.width / 2) ** 2:
                continue
            r, g, b = px[x, y]
            samples.append((0.2126 * r + 0.7152 * g + 0.0722 * b, x, y))
    samples.sort(reverse=True)
    k = max(20, int(len(samples) * top_frac))
    top = samples[:k]
    sw = sum(s[0] for s in top) or 1.0
    cx = sum(s[0] * s[1] for s in top) / sw
    cy = sum(s[0] * s[2] for s in top) / sw
    return top[0][0], cx, cy, k


out = []
for name in sys.argv[1:]:
    im = Image.open(ROOT + r"\scripts\out\%s.png" % name).convert("RGB")
    box = (int(L), int(T), int(L + W), int(T + W))
    sub = im.crop(box)
    peak, cx, cy, k = brightest_centroid(sub)
    out.append((name, peak, cx, cy, k))
    print("%-12s 峰值 L=%6.1f  高光质心 (%.1f, %.1f)  取 %d px  (球直径 %.0f)"
          % (name, peak, cx, cy, k, W))

if len(out) >= 2:
    a, b = out[0], out[-1]
    dx = b[2] - a[2]
    dy = b[3] - a[3]
    print("-" * 68)
    print("高光质心位移  Δx = %+.1f px   Δy = %+.1f px" % (dx, dy))
    print("判据：指针从左扫到右，高光应向右移（Δx > 0）且 |Δx| > 5 px")
    print("结果：", "PASS" if dx > 5 else "FAIL")
