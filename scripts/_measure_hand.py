"""量「手」在画布上的实际高度范围 —— 决定它在宽屏可见带（下缘 y≈75.7%）里能不能被看见。

用法：cd <project> && "$PY" scripts/_measure_hand.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BG = ROOT / "assets/hero-art/bg"


def lum(a: np.ndarray) -> np.ndarray:
    return (0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]) / 255.0


def main() -> int:
    p = BG / "hero-v2b.png"
    a = np.asarray(Image.open(p).convert("RGB")).astype(np.float32)
    H, W = a.shape[:2]
    L = lum(a)
    # 手所在的大致区域（从叠加图上读出来的）：x 28–70%, y 58–96%
    x0, x1 = int(W * 0.28), int(W * 0.70)
    y0, y1 = int(H * 0.58), int(H * 0.96)
    sub = L[y0:y1, x0:x1]
    print(f"源图 {p.name} {W}x{H}")
    print(f"扫描区 x28–70% y58–96%  亮度 mean={sub.mean():.4f} p95={np.percentile(sub,95):.4f} "
          f"p99={np.percentile(sub,99):.4f}")
    print()
    print(f"{'阈值':>6} {'像素数':>8} {'占扫描区':>9} {'最高点 y%':>10} {'中位 y%':>9} {'x 范围%':>14}")
    for t in (0.12, 0.14, 0.16, 0.18, 0.20):
        m = sub > t
        n = int(m.sum())
        if n < 50:
            print(f"{t:>6.2f} {n:>8}  （太少，忽略）")
            continue
        ys, xs = np.where(m)
        y_pct = (ys + y0) / H * 100
        x_pct = (xs + x0) / W * 100
        print(f"{t:>6.2f} {n:>8} {n / sub.size * 100:>8.2f}% {y_pct.min():>10.1f} "
              f"{np.median(y_pct):>9.1f}  {x_pct.min():>6.1f}–{x_pct.max():<6.1f}")
    print()
    print("宽屏可见带下缘（1564×708 实测）= 画布 y 75.7%；1920×950 约 y 80%；1366×768 约 y 87%")
    print("判据：手里的高光最高点若 ≤ 该值，桌面上就能看见它")
    return 0


if __name__ == "__main__":
    sys.exit(main())
