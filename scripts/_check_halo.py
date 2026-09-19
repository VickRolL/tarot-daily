"""球体外围「紫色气泡」归因：三层对照的径向亮度剖面
---------------------------------------------------------------------------
要回答的问题：球外面那圈紫色，是 `.orb__glow`（外光晕）画的，还是
`.orb__charge`（充能环）画的？各贡献多少？

方法（关键在**对照**，不是单张图上看）：
  同一拍、同一视口，跑三次截图，每次**只隐藏一层**：
    A 全开      → orb3d-charge.png
    B 隐藏 .orb__charge → chg-nocharge.png
    C 隐藏 .orb__glow   → chg-noglow.png
  然后按半径取环带平均亮度，用 A−B 得到充能环的贡献、A−C 得到光晕的贡献。

⚠️ 为什么不能用「单张图的径向剖面 + 肉眼找断崖」：
   径向平均**区分不了「环」和「盘」**（同样一条曲线可以来自细环，也可以来自实心盘），
   而这两层的形状恰好一个是环、一个是盘。我第一版就是这么误判的 ——
   把 `.orb__charge` 的环读成了 `.orb__glow` 的盘，还照着错的结论改了 CSS，越改越糟。
   归因必须靠**消融**（ablate one layer at a time），不能靠形状反推。

⚠️ 这一层还有 `orbBreath` / `orbRing` 这类无限循环动画，两次截图会落在动画的不同相位上。
   所以判据只看「同一半径上 A 与 B/C 的**差**」（同一次实验里相位一致），
   不要拿 idle 图和 charge 图直接比绝对值。

用法：
  P="C:/Users/29923/.workbuddy/binaries/python/envs/default/Scripts/python.exe"
  "$P" scripts/_check_halo.py         # 默认读上面那三张
  "$P" scripts/_check_halo.py A.png B.png C.png
"""

import math
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "scripts/out"

# 探针实测的 .orb 屏幕矩形（CSS px）；视口或断点变了要同步改
ORB_L, ORB_T, ORB_W = 571.6, 367.3, 438.7

R_MIN, R_MAX, R_STEP = 0.98, 1.90, 0.01
ANGLES = 720


def profile(path: Path):
    im = Image.open(path).convert("RGB")
    px = im.load()
    cx, cy, R = ORB_L + ORB_W / 2, ORB_T + ORB_W / 2, ORB_W / 2
    out = []
    n = int(round((R_MAX - R_MIN) / R_STEP)) + 1
    for i in range(n):
        r = R_MIN + i * R_STEP
        acc, cnt = 0.0, 0
        for k in range(ANGLES):
            a = k * math.pi / ANGLES
            x = int(cx + math.cos(a) * R * r)
            y = int(cy + math.sin(a) * R * r)
            if 0 <= x < im.width and 0 <= y < im.height:
                p = px[x, y]
                acc += (p[0] + p[1] + p[2]) / 3
                cnt += 1
        out.append(acc / max(cnt, 1))
    return out


def main() -> int:
    names = sys.argv[1:] or ["orb3d-charge.png", "chg-nocharge.png", "chg-noglow.png"]
    if len(names) == 1:
        names = ["orb3d-charge.png", "chg-nocharge.png", "chg-noglow.png"]
    paths = [OUT / n for n in names]
    for p in paths:
        if not p.exists():
            print("找不到", p)
            return 1

    full = profile(paths[0])
    no_charge = profile(paths[1])
    no_glow = profile(paths[2])

    print("对照：%s / %s / %s" % tuple(n for n in names))
    print()
    print("  r/R    全开   无充能环   无光晕    充能环贡献   光晕贡献")
    for i in range(len(full)):
        r = R_MIN + i * R_STEP
        # 只打关键区间，中间段太密
        if not (r <= 1.32 or abs(r * 100 - round(r * 100)) < 1e-6 and int(round(r * 100)) % 10 == 0):
            continue
        dc = full[i] - no_charge[i]
        dg = full[i] - no_glow[i]
        print("%6.2f %7.1f %9.1f %9.1f %12.1f %11.1f" % (r, full[i], no_charge[i], no_glow[i], dc, dg))

    print()
    # 分区归因
    def band(lo, hi, arr_a, arr_b):
        vals = [arr_a[i] - arr_b[i]
                for i in range(len(arr_a))
                if lo <= R_MIN + i * R_STEP <= hi]
        return sum(vals) / max(len(vals), 1)

    print("归因（区间平均贡献）：")
    for lo, hi, label in [(1.05, 1.32, "贴球那一圈"), (1.32, 1.70, "外圈"), (1.70, 1.90, "更外")]:
        print("  %-10s r %.2f–%.2f   充能环 %+6.1f   光晕 %+6.1f"
              % (label, lo, hi, band(lo, hi, full, no_charge), band(lo, hi, full, no_glow)))

    print()
    print("怎么读：哪个数大，那一圈的亮度就主要来自哪一层。")
    print("如果「贴球那一圈」的光晕贡献明显大于充能环，说明光晕被配得太实 ——")
    print("那时该降 `.orb__glow` 的**强度**（alpha / brightness），而不是收它的包围半径：")
    print("半径是靠渐变里透明停点撑出来的，停得越早、中间档 alpha 就得给得越高，")
    print("结果反而把那圈压得更实（这个错犯过一次，见 index.css 的注释）。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
