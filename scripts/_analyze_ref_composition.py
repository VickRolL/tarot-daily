"""临时分析脚本：把「用户给的参考图」与「v1 母版」「v2 已出图」放在同一坐标系下量。

产出（都落 assets/_debug/）：
  ref-grid.png     参考图 + 10% 网格 + 标签
  v1-grid.png      v1 母版 + 10% 网格 + 标签
  v2-grid.png      v2 已出图 + 10% 网格 + 标签
  composition-report.txt  三张图的分区亮度、最亮连通域（球/光）位置与尺寸

用法：cd <project> && "$PY" scripts/_analyze_ref_composition.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "_debug"
OUT.mkdir(parents=True, exist_ok=True)

REF = Path(r"C:\Users\29923\.workbuddy\clipboard-images\clipboard-2026-09-19T13-17-25-147Z-5098f5c9.jpg")
V1 = ROOT / "assets/hero-art/bg/_v1/参考这张塔罗主视觉_保持完全相同的构图_画风_色调_笔触与光_2026-09-17T17-21-14.png"
V2 = ROOT / "assets/hero-art/bg/以参考图为准_完全保持它的画风_暗夜厚涂油画质感_冷紫暗色调_2026-09-19T12-36-04.png"

SOURCES = [("ref", REF), ("v1", V1), ("v2", V2)]


def load_rgb(p: Path, width: int = 1080) -> Image.Image:
    im = Image.open(p).convert("RGB")
    if im.width != width:
        h = round(im.height * width / im.width)
        im = im.resize((width, h), Image.LANCZOS)
    return im


def draw_grid(im: Image.Image, label: str) -> Image.Image:
    im = im.copy()
    d = ImageDraw.Draw(im)
    w, h = im.size
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 18)
    except Exception:
        font = ImageFont.load_default()
    for i in range(1, 10):
        x = round(w * i / 10)
        y = round(h * i / 10)
        major = i % 2 == 0
        col = (255, 80, 80) if major else (255, 190, 60)
        d.line([(x, 0), (x, h)], fill=col, width=2 if major else 1)
        d.line([(0, y), (w, y)], fill=col, width=2 if major else 1)
        d.text((x + 3, 6), f"x{i*10}", fill=col, font=font)
        d.text((6, y + 3), f"y{i*10}", fill=col, font=font)
    d.rectangle([0, 0, w - 1, h - 1], outline=(0, 255, 160), width=3)
    d.text((10, h - 34), label, fill=(0, 255, 160), font=font)
    return im


def block_means(arr: np.ndarray, n: int = 5) -> np.ndarray:
    h, w = arr.shape
    ys = np.linspace(0, h, n + 1).astype(int)
    xs = np.linspace(0, w, n + 1).astype(int)
    out = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            out[i, j] = arr[ys[i]:ys[i + 1], xs[j]:xs[j + 1]].mean()
    return out


def brightest_blob(arr: np.ndarray, thr_pct: float = 99.0) -> dict:
    """在亮度图上取 top 分位阈值，找最大连通域（4 邻域，用 scipy 若可用）。"""
    thr = np.percentile(arr, thr_pct)
    mask = arr >= thr
    try:
        from scipy import ndimage  # type: ignore

        lab, n = ndimage.label(mask)
        if n == 0:
            return {}
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        k = int(np.argmax(sizes)) + 1
        ys, xs = np.where(lab == k)
        return {
            "cx": float(xs.mean() / arr.shape[1]),
            "cy": float(ys.mean() / arr.shape[0]),
            "w": float((xs.max() - xs.min() + 1) / arr.shape[1]),
            "h": float((ys.max() - ys.min() + 1) / arr.shape[0]),
            "px": int(sizes[k - 1]),
        }
    except Exception:
        ys, xs = np.where(mask)
        return {
            "cx": float(xs.mean() / arr.shape[1]),
            "cy": float(ys.mean() / arr.shape[0]),
            "w": float((xs.max() - xs.min() + 1) / arr.shape[1]),
            "h": float((ys.max() - ys.min() + 1) / arr.shape[0]),
            "px": int(mask.sum()),
        }


def main() -> int:
    lines: list[str] = []
    for name, path in SOURCES:
        if not path.exists():
            lines.append(f"!! 缺文件 {name}: {path}")
            continue
        im = load_rgb(path)
        draw_grid(im, f"{name}  ({path.name[:34]})").save(OUT / f"{name}-grid.png")

        a = np.asarray(im).astype(np.float32)
        lum = (0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]) / 255.0
        hsv_v = a.max(axis=2) / 255.0
        sat = (a.max(axis=2) - a.min(axis=2)) / np.maximum(a.max(axis=2), 1e-6)

        lines.append(f"\n===== {name}  ({im.width}x{im.height}) =====")
        lines.append(f"全局亮度 mean={lum.mean():.4f} p50={np.percentile(lum,50):.4f} "
                     f"p95={np.percentile(lum,95):.4f} p99={np.percentile(lum,99):.4f}")
        lines.append(f"饱和 illum 比例(V>0.35) = {(hsv_v>0.35).mean()*100:.2f}%")
        lines.append("5x5 分区平均亮度（行=y 上→下, 列=x 左→右）:")
        bm = block_means(lum, 5)
        for i in range(5):
            lines.append("  " + "  ".join(f"{bm[i,j]:.4f}" for j in range(5)))
        lines.append("5x5 分区平均饱和度:")
        bs = block_means(sat, 5)
        for i in range(5):
            lines.append("  " + "  ".join(f"{bs[i,j]:.3f}" for j in range(5)))

        for pct in (99.0, 97.0):
            b = brightest_blob(lum, pct)
            if b:
                lines.append(
                    f"亮度 top{100-pct:.0f}% 最大连通域: 中心=({b['cx']*100:.1f}%, {b['cy']*100:.1f}%) "
                    f"尺寸={b['w']*100:.1f}%W x {b['h']*100:.1f}%H  面积占比={b['px']/(im.width*im.height)*100:.2f}%"
                )
        # 横向 / 纵向亮度剖面（分 20 段）
        colp = lum.mean(axis=0)
        rowp = lum.mean(axis=1)
        lines.append("横向剖面(x 每 5%): " + " ".join(
            f"{colp[int(im.width*t)]:.3f}" for t in np.linspace(0.025, 0.975, 20)))
        lines.append("纵向剖面(y 每 5%): " + " ".join(
            f"{rowp[int(im.height*t)]:.3f}" for t in np.linspace(0.025, 0.975, 20)))

    txt = OUT / "composition-report.txt"
    txt.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    print(f"\nwrote {txt}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
