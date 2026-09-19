"""量出第 2 版主视觉里「女巫的脸」的确切位置与亮度分布（一次性诊断脚本）。

目的：用户要求「连鼻子和嘴巴都不要看见，被黑暗笼罩得彻底」。
要压得准，先得知道三件事：
  ① 脸（皮肤）在哪、占多大、亮度多少
  ② 脸部周围「合法的暗部」（头发 / 帽檐阴影 / 衣领）有多暗 —— 这是压暗的目标值
  ③ 脸区里本来就有多少暗像素（头发）—— 这些不能被误伤成平滑块

输出（assets/_debug/）：
  face-diag.png      三联图：原图带标记 / 皮肤掩码 / 脸区 2 倍放大
  face-diag-report.txt
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BG = ROOT / "assets/hero-art/bg"
OUT = ROOT / "assets/_debug"

SRC = BG / "hero-v2b.png"
# 脸的搜索框（画布百分比，比脸大一圈：含两侧头发与下颌）
ROI = (40.0, 74.0, 12.0, 46.0)
# 脸**本身**的估计框（看原图目测，待量化确认）
FACE = (49.0, 65.0, 19.0, 36.0)
# 脸部周围「合法暗部」的取样环（外侧一圈，全部是头发/帽檐阴影/衣领）
RING = [(40.0, 74.0, 12.0, 17.0),    # 上：帽檐阴影
        (40.0, 47.0, 17.0, 40.0),    # 左：头发
        (67.0, 74.0, 17.0, 40.0),    # 右：头发
        (40.0, 74.0, 40.0, 46.0)]    # 下：衣领/颈下


def font(sz=18):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/consola.ttf", sz)
    except Exception:
        return ImageFont.load_default()


def lum_of(a: np.ndarray) -> np.ndarray:
    return (0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]) / 255.0


def sl_of(box, W, H):
    x0, x1, y0, y1 = box
    return (slice(int(H * y0 / 100), int(H * y1 / 100)),
            slice(int(W * x0 / 100), int(W * x1 / 100)))


def main() -> int:
    im = Image.open(SRC).convert("RGB")
    W, H = im.size
    a = np.asarray(im).astype(np.float32)
    L = lum_of(a)
    lines = [f"源图: {SRC.name}  {W}x{H}", ""]

    # ---------- ① ROI 亮度分布 ----------
    lines.append(f"=== ① ROI{ROI} 的亮度分位 ===")
    z = L[sl_of(ROI, W, H)]
    qs = [1, 5, 10, 25, 50, 75, 90, 95, 99, 100]
    lines.append("  " + "  ".join(f"p{q}={np.percentile(z, q):.4f}" for q in qs))
    lines.append(f"  mean={z.mean():.4f}  std={z.std():.4f}")
    lines.append("")

    # ---------- ② 脸部周围合法暗部 = 压暗的目标值 ----------
    lines.append("=== ② 脸周围的合法暗部（压暗目标）===")
    ring_vals = []
    for i, r in enumerate(RING):
        rv = L[sl_of(r, W, H)]
        ring_vals.append(rv)
        lines.append(f"  环{i} {r}  mean={rv.mean():.4f} p50={np.percentile(rv,50):.4f} "
                     f"p90={np.percentile(rv,90):.4f}")
    allring = np.concatenate([v.ravel() for v in ring_vals])
    lines.append(f"  合计      mean={allring.mean():.4f} p50={np.percentile(allring,50):.4f} "
                 f"p75={np.percentile(allring,75):.4f} p90={np.percentile(allring,90):.4f}")
    lines.append("")

    # ---------- ③ 皮肤掩码：阈值扫描 ----------
    lines.append("=== ③ 皮肤掩码阈值扫描（整个 ROI 内）===")
    roi_sl = sl_of(ROI, W, H)
    for t in (0.05, 0.08, 0.10, 0.12, 0.15, 0.20, 0.28):
        m = L > t
        pct = 100 * m[roi_sl].mean()
        ys, xs = np.nonzero(m[roi_sl])
        if len(xs):
            bx0 = (ROI[0] + xs.min() / W * 100)
            bx1 = (ROI[0] + xs.max() / W * 100)
            by0 = (ROI[2] + ys.min() / H * 100)
            by1 = (ROI[2] + ys.max() / H * 100)
            bbox = f"bbox x[{bx0:.1f}%,{bx1:.1f}%] y[{by0:.1f}%,{by1:.1f}%] px={len(xs)}"
        else:
            bbox = "(空)"
        lines.append(f"  L>{t:.2f} → 占 ROI {pct:5.1f}%   {bbox}")
    lines.append("")

    # ---------- ④ 脸框内的亮部 = 五官所在 ----------
    lines.append(f"=== ④ 脸框{FACE} 内 ===")
    fz = L[sl_of(FACE, W, H)]
    lines.append(f"  mean={fz.mean():.4f} p50={np.percentile(fz,50):.4f} "
                 f"p90={np.percentile(fz,90):.4f} p99={np.percentile(fz,99):.4f} max={fz.max():.4f}")
    lines.append(f"  比周围暗部亮出 {(fz.mean() - allring.mean()):.4f}（这是一个「看得见的脸」的量级）")
    lines.append("")

    # ---------- 可视化 ----------
    # 皮肤掩码覆盖层
    mask = (L > 0.10).astype(np.uint8) * 255
    mask_img = Image.fromarray(mask, mode="L").convert("RGB")
    md = ImageDraw.Draw(mask_img)
    md.rectangle([*[int(v * (W if i % 2 == 0 else H) / 100) for i, v in enumerate((FACE[0], FACE[2], FACE[1], FACE[3]))]],
                 outline=(0, 255, 120), width=3)

    def marks(img: Image.Image, label: str) -> Image.Image:
        c = img.copy()
        d = ImageDraw.Draw(c)
        for box, col in ((ROI, (255, 210, 0)), (FACE, (0, 255, 120))):
            d.rectangle([int(box[0] * W / 100), int(box[2] * H / 100),
                         int(box[1] * W / 100), int(box[3] * H / 100)], outline=col, width=3)
        for r in RING:
            d.rectangle([int(r[0] * W / 100), int(r[2] * H / 100),
                         int(r[1] * W / 100), int(r[3] * H / 100)], outline=(90, 170, 255), width=2)
        d.text((10, 10), label, fill=(255, 255, 255), font=font(24))
        return c

    crop = im.crop((int(ROI[0] * W / 100), int(ROI[2] * H / 100),
                    int(ROI[1] * W / 100), int(ROI[3] * H / 100)))
    crop = crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS)
    crop.thumbnail((W, H * 2))

    sheet = Image.new("RGB", (W, H * 2 + 10), (26, 26, 30))
    sheet.paste(marks(im, "原图 + ROI(黄) / FACE(绿) / 暗部环(蓝)"), (0, 0))
    sheet.paste(mask_img, (0, H + 10))
    sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS).save(OUT / "face-diag.png")
    crop.save(OUT / "face-zoom-2x.png")
    lines.append(f"wrote {(OUT/'face-diag.png').relative_to(ROOT)}")
    lines.append(f"wrote {(OUT/'face-zoom-2x.png').relative_to(ROOT)}  （脸区 2 倍放大，1:1 看五官）")

    (OUT / "face-diag-report.txt").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
