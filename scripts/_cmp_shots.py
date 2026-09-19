"""对比三张同视口截图（1564×708）的亮度分布，分离「图变暗」与「暗角压暗」两种成因。

用法：cd <project> && "$PY" scripts/_cmp_shots.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SHOTS = {
    "旧 v2（31% 球 + 旧暗角）": ROOT / "assets/_debug/v2-idle-wide.png",
    "新 v2b（40% 球 + 新暗角）": ROOT / "assets/previews/v2b-idle-wide.png",
    "新 v2b（隐球·隐暗角）": ROOT / "assets/_debug/v2b-plate-only-wide.png",
}


def lum(p: Path) -> np.ndarray:
    a = np.asarray(Image.open(p).convert("RGB")).astype(np.float32)
    return (0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]) / 255.0


def main() -> int:
    rows = []
    for name, p in SHOTS.items():
        if not p.exists():
            rows.append((name, None))
            continue
        L = lum(p)
        h = L.shape[0]
        rows.append((name, L, h))

    print(f"{'截图':<26} {'全图mean':>9} {'p50':>7} {'p90':>7} {'p99':>7} "
          f"{'上带0-22%':>9} {'中带22-64%':>10} {'下带64-100%':>11}")
    base = None
    for item in rows:
        name = item[0]
        if len(item) == 2:
            print(f"{name:<26}  (缺文件)")
            continue
        L, h = item[1], item[2]
        y1, y2 = int(h * 0.22), int(h * 0.64)
        vals = [L.mean(), np.percentile(L, 50), np.percentile(L, 90), np.percentile(L, 99),
                L[:y1].mean(), L[y1:y2].mean(), L[y2:].mean()]
        print(f"{name:<26} " + " ".join(f"{v:9.4f}" for v in vals[:4]) + "  "
              + " ".join(f"{v:10.4f}" for v in vals[4:]))
        if "隐球" in name:
            base = L
    if base is not None:
        newp = SHOTS["新 v2b（40% 球 + 新暗角）"]
        if newp.exists():
            Ln = lum(newp)
            print(f"\n暗角把新底板整体压掉了：中带 {base[int(base.shape[0]*0.22):int(base.shape[0]*0.64)].mean():.4f} "
                  f"→ {Ln[int(Ln.shape[0]*0.22):int(Ln.shape[0]*0.64)].mean():.4f}"
                  f"（×{Ln[int(Ln.shape[0]*0.22):int(Ln.shape[0]*0.64)].mean()/max(base[int(base.shape[0]*0.22):int(base.shape[0]*0.64)].mean(),1e-6):.2f}）")
            print(f"               上带 {base[:int(base.shape[0]*0.22)].mean():.4f} → {Ln[:int(Ln.shape[0]*0.22)].mean():.4f}"
                  f"（×{Ln[:int(Ln.shape[0]*0.22)].mean()/max(base[:int(base.shape[0]*0.22)].mean(),1e-6):.2f}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
