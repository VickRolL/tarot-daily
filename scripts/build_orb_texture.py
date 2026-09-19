"""生成 3D 水晶球的「球内星云」贴图（等距圆柱投影 / equirectangular）。

## 为什么在构建期生成，而不是在着色器里实时算

球的屏幕上直径约 434 CSS px，DPR 2 就是 868² ≈ 75 万像素。实时 fbm 每像素要跑
3–4 次 fbm（每次 4 octave × 每次 noise 若干次 hash）≈ 上百次 hash/像素/帧
→ 7500 万次以上，移动端必掉帧。
把噪声搬进构建期（Python + numpy），运行时着色器只做 **1 次纹理采样 + 几个点积**，
代价趋近于零，而且改纹理不用碰着色器代码。

## 关键：水平方向必须无缝

运球会把贴图绕球一圈，所以 u 方向的左右边缘必须接得上。
做法是**全部用循环卷积**（`fft2 → 乘核 → ifft2`，不加 padding），
而不是常规的 reflect padding —— 后者会在左右边缘造出一条可见的缝。

垂直方向（v）是两极，会极度拉伸变形，所以**极区直接压暗**（`sin(πv)^0.85`），
让变形落在纯黑里。

## 配色

用户第七轮拍板：「紫为底、冷蓝只给球」→ 球体走**冷蓝**主调，
只在低密度区掺极少量紫罗兰与全站冷紫呼应。

输入：无（全程序化，seed 固定可复现）
输出：public/skins/<皮肤>/orb-nebula.webp（默认 1024×512）
     assets/_debug/orb-texture-preview.png

用法：cd <project> && "$PY" scripts/build_orb_texture.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SKIN_JS = ROOT / "src/config/skin.js"
OUT = ROOT / "assets/_debug"

W, H = 1024, 512
SEED = 20260919

# —— 星云密度 → 颜色 的分段映射（冷蓝主调）——
STOPS_T = [0.00, 0.26, 0.44, 0.60, 0.76, 0.89, 1.00]
STOPS_C = [(4, 5, 20), (12, 16, 54), (30, 48, 140), (58, 92, 220),
           (120, 165, 255), (198, 222, 255), (245, 250, 255)]
VIOLET = np.array([104, 70, 196], np.float32)   # 极少量的紫罗兰点缀

N_STARS = 900


def font(sz=16):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/consola.ttf", sz)
    except Exception:
        return ImageFont.load_default()


def gauss_cyclic(arr: np.ndarray, sigma: float) -> np.ndarray:
    """**循环**高斯（不加 padding）—— 左右边缘因此天然无缝，可以直接绕球一圈。"""
    if sigma <= 0:
        return arr.astype(np.float32)
    Hh, Ww = arr.shape
    fy = np.fft.fftfreq(Hh).astype(np.float32)[:, None]
    fx = np.fft.fftfreq(Ww).astype(np.float32)[None, :]
    G = np.exp(-2.0 * (np.pi ** 2) * (sigma ** 2) * (fy ** 2 + fx ** 2)).astype(np.float32)
    return np.fft.ifft2(np.fft.fft2(arr.astype(np.float32)) * G).real.astype(np.float32)


def fbm(shape, octaves, rng, base_sigma, gain=0.55):
    out = np.zeros(shape, np.float32)
    tot, amp = 0.0, 1.0
    for o in range(octaves):
        n = rng.random(shape).astype(np.float32)
        n = gauss_cyclic(n, base_sigma / (2 ** o))
        n = (n - n.mean()) / (n.std() + 1e-6)
        out += amp * n
        tot += amp
        amp *= gain
    return out / tot


def norm01(a: np.ndarray) -> np.ndarray:
    lo, hi = np.percentile(a, 1), np.percentile(a, 99)
    return np.clip((a - lo) / max(hi - lo, 1e-6), 0, 1)


def smoothstep(t: np.ndarray) -> np.ndarray:
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def warp(field: np.ndarray, dx: np.ndarray, dy: np.ndarray) -> np.ndarray:
    """按 (dx, dy) 位移场重采样 field（u 方向环绕，v 方向夹取）。"""
    Hh, Ww = field.shape
    yy, xx = np.mgrid[0:Hh, 0:Ww].astype(np.float32)
    x = (xx + dx) % Ww
    y = np.clip(yy + dy, 0, Hh - 1)
    x0 = np.floor(x).astype(np.int32)
    y0 = np.floor(y).astype(np.int32)
    fx = x - x0
    fy = y - y0
    x1 = (x0 + 1) % Ww
    y1 = np.clip(y0 + 1, 0, Hh - 1)
    return (field[y0, x0] * (1 - fx) * (1 - fy) + field[y0, x1] * fx * (1 - fy)
            + field[y1, x0] * (1 - fx) * fy + field[y1, x1] * fx * fy)


def colorize(t: np.ndarray) -> np.ndarray:
    """按 t（0..1）在 STOPS 上做逐通道线性插值。"""
    out = np.zeros(t.shape + (3,), np.float32)
    for c in range(3):
        out[:, :, c] = np.interp(t, STOPS_T, [s[c] for s in STOPS_C])
    return out


def read_skin():
    try:
        js = SKIN_JS.read_text(encoding="utf-8")
    except OSError:
        return "mist-night"
    m = re.search(r"export const SKIN = '([^']+)'", js)
    return m.group(1) if m else "mist-night"


def main() -> int:
    rng = np.random.default_rng(SEED)
    lines = [f"orb-nebula  {W}x{H}  seed={SEED}", ""]

    # ---- 密度场：fbm + domain warping（warp 才有「卷曲的丝」，纯 fbm 只是团块）----
    base = fbm((H, W), 6, rng, 70)
    wx = fbm((H, W), 3, rng, 110) * 130
    wy = fbm((H, W), 3, rng, 110) * 60
    warped = warp(base, wx, wy)
    detail = fbm((H, W), 5, rng, 16)
    dens = norm01(0.66 * norm01(warped) + 0.34 * norm01(detail))

    # ---- 极区压暗：equirect 在极点会极度拉伸，把变形埋进黑里 ----
    vv = (np.arange(H, dtype=np.float32) + 0.5) / H
    polar = np.sin(np.pi * vv) ** 0.85
    dens *= polar[:, None]

    # ---- 上色 ----
    col = colorize(dens ** 0.92)
    mixv = smoothstep((dens - 0.30) / 0.20) * (1 - smoothstep((dens - 0.52) / 0.22)) * 0.32
    col = col * (1 - mixv[:, :, None]) + VIOLET * mixv[:, :, None]

    # ---- 星点：极区与最亮的星云核附近少放，避免糊成一片 ----
    star_layer = np.zeros((H, W), np.float32)
    sx = rng.integers(0, W, N_STARS)
    sy = (rng.beta(2.2, 2.2, N_STARS) * (H - 1)).astype(np.int32)      # 中间多、两极少
    sb = (rng.random(N_STARS) ** 2.2) * 255.0                          # 少量很亮
    for i in range(N_STARS):
        star_layer[sy[i], sx[i]] = max(star_layer[sy[i], sx[i]], sb[i])
    star_glow = gauss_cyclic(star_layer, 0.75)
    star_core = gauss_cyclic(star_layer, 0.30)
    stars = np.clip(star_glow * 0.55 + star_core * 1.35, 0, 255)
    lines.append(f"星点 {N_STARS} 颗 · 峰值亮度 {stars.max():.1f} · 覆盖 "
                 f"{100*(stars>12).mean():.2f}%")
    col = col + stars[:, :, None] * np.array([0.80, 0.90, 1.0], np.float32)

    # ---- 细节量化：贴图要喂 8bit ----
    img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), mode="RGB")

    # ---- 水平无缝自检：左边缘与右边缘的差（应当与小位移差同量级）----
    a = np.asarray(img).astype(np.float32)
    seam = float(np.abs(a[:, 0] - a[:, -1]).mean())
    inner = float(np.abs(a[:, 0] - a[:, 1]).mean())
    lines.append(f"水平接缝自检：左-右边缘平均差 {seam:.2f} / 相邻列平均差 {inner:.2f}"
                 f"  → {'无缝 OK' if seam < inner * 3 + 2 else '⚠️ 有缝'}")
    lines.append(f"亮度 mean={a.mean():.1f} p50={np.percentile(a,50):.1f} p99={np.percentile(a,99):.1f}")
    lines.append("")

    skin = read_skin()
    dst = ROOT / "public" / "skins" / skin / "orb-nebula.webp"
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, format="WEBP", quality=92, method=6)
    lines.append(f"wrote {dst.relative_to(ROOT)} ({dst.stat().st_size/1024:.0f} KB)")

    # 预览：贴图 + 一张「贴到球上大致长什么样」的经纬拉伸示意
    prev = img.resize((W // 2, H // 2), Image.LANCZOS).convert("RGB")
    d = ImageDraw.Draw(prev)
    d.text((8, 8), "orb-nebula (equirect, 水平无缝)", fill=(255, 255, 255), font=font(18))
    d.ellipse([W // 4 - 8, H // 4 - 8, W // 4 + 120, H // 4 + 120], outline=(120, 255, 140), width=2)
    prev.save(OUT / "orb-texture-preview.png")
    lines.append(f"wrote {(OUT/'orb-texture-preview.png').relative_to(ROOT)}")

    (OUT / "orb-texture-report.txt").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
