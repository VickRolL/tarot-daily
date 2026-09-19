"""验收第 2 版主视觉：把「球位圆」直接叠到图上，并给出暗区形状与亮度分布。

产出（assets/_debug/）：
  v2b-overlay.png    新图 + 10% 网格 + 球位圆(径=画布高 40%) + 空区目标圆(径 52%)
  v2b-darkness.png   四联：不同阈值下的「暗区」掩膜（看空区形状与大小）
  v2b-wide-band.png  宽扁屏(1564×708)真正看得见的那条带（y 10.4%–75.7%）
  v2b-phone-band.png 手机(390×844)真正看得见的那条带（x 35%–65%）
  v2b-report.txt     亮度分布 / 空区径向半径 / 球位圆内的亮像素占比（≈手的遮挡）

用法：cd <project> && "$PY" scripts/_verify_hero_v2b.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "_debug"
BG = ROOT / "assets/hero-art/bg"

# 坐标系：一律用「画布百分比」，球心来自 src/config/skin.js 的 ANCHORS.orb
ORB = dict(x=50.0, y=61.5, size=40.0)        # size = 直径占画布高 %
VOID_TARGET = 52.0                            # 目标空区直径（占画布高 %）
REFS = {
    "ref": Path(r"C:\Users\29923\.workbuddy\clipboard-images\clipboard-2026-09-19T13-17-25-147Z-5098f5c9.jpg"),
    "v2a": BG / "_v2/以参考图为准_完全保持它的画风_暗夜厚涂油画质感_冷紫暗色调_2026-09-19T12-36-04.png",
}


def find_new() -> Path:
    cands = sorted(BG.glob("*.png"))
    if not cands:
        raise SystemExit("bg/ 里没有图")
    return cands[-1]  # 时间戳在文件名末尾，最后一张 = 最新


def font(sz: int = 18):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/consola.ttf", sz)
    except Exception:
        return ImageFont.load_default()


def lum_of(im: Image.Image) -> np.ndarray:
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    return (0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]) / 255.0


def stats(name: str, lum: np.ndarray) -> str:
    return (f"{name:<10} mean={lum.mean():.4f} p50={np.percentile(lum,50):.4f} "
            f"p95={np.percentile(lum,95):.4f} p99={np.percentile(lum,99):.4f} "
            f"高光面积(V>0.35)={(lum>0.35).mean()*100:.2f}%")


def radial(lum: np.ndarray, cx_pct: float, cy_pct: float, thresh: float, n: int = 72) -> dict:
    """从球心向外扫，录「沿该方向第一次离开暗区」的半径（占画布高 %）。"""
    h, w = lum.shape
    cx, cy = cx_pct / 100 * w, cy_pct / 100 * h
    rs = []
    for k in range(n):
        th = 2 * np.pi * k / n
        r = 0.0
        while r < 0.5 * h:
            x = int(round(cx + r * np.cos(th)))
            y = int(round(cy + r * np.sin(th)))
            if not (0 <= x < w and 0 <= y < h):
                break
            if lum[y, x] > thresh:
                break
            r += 1.0
        rs.append(r / h * 100)
    rs = np.array(rs)
    return {"min": rs.min(), "p25": np.percentile(rs, 25), "median": np.median(rs),
            "p75": np.percentile(rs, 75), "max": rs.max()}


def main() -> int:
    new = find_new()
    im = Image.open(new).convert("RGB")
    W, H = im.size
    lum = lum_of(im)
    lines = [f"新图: {new.name}", f"尺寸: {W}x{H}", ""]

    # ---- 亮度分布对照 ----
    lines.append("=== 亮度分布（三张图对照，检验「拉开分布」有没有做到）===")
    lines.append(stats("v2 新", lum))
    for k, p in REFS.items():
        if p.exists():
            lines.append(stats(k, lum_of(Image.open(p).convert("RGB"))))
    lines.append("")

    # ---- 球位圆内的亮度分布（≈手/袍的遮挡代理）----
    yy, xx = np.mgrid[0:H, 0:W]
    r_px = ORB["size"] / 100 * H / 2
    cx, cy = ORB["x"] / 100 * W, ORB["y"] / 100 * H
    in_orb = ((xx - cx) ** 2 + (yy - cy) ** 2) <= r_px ** 2
    o = lum[in_orb]
    lines.append("=== 球位圆（径=画布高 40%，心=(50%,61.5%)）===")
    lines.append(f"圆内像素 {int(in_orb.sum())}  ·  mean={o.mean():.4f} p50={np.percentile(o,50):.4f} "
                 f"p90={np.percentile(o,90):.4f} p99={np.percentile(o,99):.4f}")
    for t in (0.06, 0.08, 0.10, 0.13, 0.16):
        lines.append(f"  圆内亮度 > {t:.2f} 的像素占比 = {(o > t).mean()*100:5.2f}%   "
                     f"（≈被手/发/袍挡住的面积）")
    lines.append("")

    # ---- 空区：不同阈值下的径向半径 ----
    lines.append("=== 空区径向扫描（自球心向外，单位=画布高%；阈值越高=只算越黑的像素）===")
    for t in (0.04, 0.05, 0.06, 0.07, 0.08, 0.10, 0.12):
        r = radial(lum, ORB["x"], ORB["y"], t)
        lines.append(f"  T={t:.2f}  min={r['min']:.1f}% p25={r['p25']:.1f}% 中位={r['median']:.1f}% "
                     f"p75={r['p75']:.1f}% max={r['max']:.1f}%  → 等效直径≈{r['median']*2:.1f}%")
    lines.append("")
    lines.append(f"需要：等效直径 ≥ {VOID_TARGET}%（=球径 {ORB['size']}% 的 1.3 倍）才有 ±6% 余量")
    lines.append("")

    # ---- 覆盖图 ----
    ov = im.copy()
    d = ImageDraw.Draw(ov)
    f18, f24 = font(18), font(26)
    for i in range(1, 10):
        x, y = round(W * i / 10), round(H * i / 10)
        col = (255, 80, 80) if i % 2 == 0 else (255, 190, 60)
        d.line([(x, 0), (x, H)], fill=col, width=2 if i % 2 == 0 else 1)
        d.line([(0, y), (W, y)], fill=col, width=2 if i % 2 == 0 else 1)
        d.text((x + 3, 6), f"x{i*10}", fill=col, font=f18)
        d.text((6, y + 3), f"y{i*10}", fill=col, font=f18)
    v_r = VOID_TARGET / 100 * H / 2
    d.ellipse([cx - v_r, cy - v_r, cx + v_r, cy + v_r], outline=(0, 220, 255), width=3)
    d.text((cx + v_r * 0.1, cy - v_r - 30), f"空区目标 d={VOID_TARGET:.0f}%h", fill=(0, 220, 255), font=f18)
    d.ellipse([cx - r_px, cy - r_px, cx + r_px, cy + r_px], outline=(80, 255, 120), width=4)
    d.text((cx + r_px * 0.1, cy + r_px + 6), f"球 d={ORB['size']:.0f}%h", fill=(80, 255, 120), font=f24)
    d.line([(0, H * 0.757), (W, H * 0.757)], fill=(255, 255, 255), width=3)
    d.text((6, H * 0.757 - 28), "宽屏可见下缘 y75.7%", fill=(255, 255, 255), font=f18)
    d.line([(W * 0.35, 0), (W * 0.35, H)], fill=(255, 255, 255), width=3)
    d.line([(W * 0.65, 0), (W * 0.65, H)], fill=(255, 255, 255), width=3)
    d.text((W * 0.35 + 4, H - 30), "手机可见带 x35–65%", fill=(255, 255, 255), font=f18)
    ov.save(OUT / "v2b-overlay.png")
    lines.append(f"wrote {OUT/'v2b-overlay.png'}")

    # ---- 暗区掩膜四联 ----
    tiles = []
    for t in (0.05, 0.07, 0.09, 0.12):
        m = (lum <= t)
        rgb = np.zeros((H, W, 3), np.uint8)
        rgb[m] = (40, 230, 255)      # 暗区
        rgb[~m] = (12, 12, 16)       # 非暗区
        t_im = Image.fromarray(rgb)
        td = ImageDraw.Draw(t_im)
        td.ellipse([cx - r_px, cy - r_px, cx + r_px, cy + r_px], outline=(120, 255, 140), width=3)
        td.text((10, 8), f"lum<={t:.2f}  ({(lum<=t).mean()*100:.1f}% of img)", fill=(255, 255, 255), font=f18)
        tiles.append(t_im)
    sheet = Image.new("RGB", (W * 2 + 12, H * 2 + 12), (30, 30, 34))
    for i, t_im in enumerate(tiles):
        sheet.paste(t_im, ((i % 2) * (W + 12), (i // 2) * (H + 12)))
    sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS).save(OUT / "v2b-darkness.png")

    # ---- 两种视口真正看得见的带 ----
    im.crop((0, int(H * 0.104), W, int(H * 0.757))).save(OUT / "v2b-wide-band.png")
    im.crop((int(W * 0.35), 0, int(W * 0.65), H)).save(OUT / "v2b-phone-band.png")
    lines.append(f"wrote {OUT/'v2b-darkness.png'} / v2b-wide-band.png / v2b-phone-band.png")

    (OUT / "v2b-report.txt").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
