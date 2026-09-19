"""从主视觉里抠出「手」的前景层 —— 让 3D 球出现在手的**后面**。

## 为什么需要这一层

用户第七轮拍板：「手在球前，遮挡 ≤15%（甲 · 手在球前）」。
手已经画进 `hero-v2b.png` 里，而 3D 球的 canvas 是叠在背景之上的
→ 球会把手盖住，读起来从「手托着球」变成「球压在手尖上」。
所以要把手单独抠出来，放在 canvas **之上**。

## 判据：这一段用「亮度」，不用 R/B

球位下缘（y≈62–82%）那一带除了手以外**全是暗雾** —— 没有别的亮物。
所以在这个受限区域内，`L > 阈值` 就足以分离手，比 R/B 比值更稳
（R/B 会在指甲的冷色高光上失效，而指甲正是手部最需要保住的细节）。

区域限制（三重，防误抓）：
  ① `y ≥ 56%`  —— 手在球位下方；上方是脸/帽檐，不属于这一层
  ② `x ∈ [28%, 72%]` —— 手横向只落在 36–64%，外面留余量
  ③ `r ≤ 1.25 × 球半径` —— 只在球周围一圈内有意义

边界处是**硬限制**，但不可见：因为切片的像素与背景**逐像素相同**，
且掩码在边界处已经衰减到 0。

## 输入输出

输入：`assets/hero-art/bg/hero-v2b.png`（已修 void + 已修脸）
输出：`public/skins/mist-night/hero-hand.webp`（RGBA，同画布 1536×1024，便于用同一套百分比定位）
     `assets/_debug/hand-{mask,layer}.png`

用法：cd <project> && "$PY" scripts/build_hero_hand.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BG = ROOT / "assets/hero-art/bg"
SRC = BG / "hero-v2b.png"
SKIN_JS = ROOT / "src/config/skin.js"
OUT = ROOT / "assets/_debug"

# 与 ANCHORS.orb 同源
CX_PCT, CY_PCT, ORB_SIZE_PCT = 50.0, 61.5, 40.0

HAND_L_LO, HAND_L_HI = 0.075, 0.115   # 手（亮）的亮度区间
LIMIT_Y = 56.0                        # 区域限制①
LIMIT_X = (28.0, 72.0)                # 区域限制②
LIMIT_R = 1.25                        # 区域限制③（× 球半径）
DILATE = 7                            # 膨胀半径（px）
FEATHER = 10                          # 羽化半径（px）


def font(sz=17):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/consola.ttf", sz)
    except Exception:
        return ImageFont.load_default()


def lum_of(a: np.ndarray) -> np.ndarray:
    return (0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]) / 255.0


def smoothstep(t: np.ndarray) -> np.ndarray:
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def gauss(arr: np.ndarray, sigma: float) -> np.ndarray:
    """纯 numpy FFT 高斯（Pillow 的 GaussianBlur 不吃 mode="F"，本机也没 scipy）。"""
    if sigma <= 0:
        return arr.astype(np.float32)
    H, W = arr.shape
    a = arr.astype(np.float32)
    p = int(min(H // 4, W // 4, max(2, round(sigma * 3))))
    pad = np.pad(a, ((p, p), (p, p)), mode="reflect")
    PH, PW = pad.shape
    fy = np.fft.fftfreq(PH).astype(np.float32)[:, None]
    fx = np.fft.rfftfreq(PW).astype(np.float32)[None, :]
    G = np.exp(-2.0 * (np.pi ** 2) * (sigma ** 2) * (fy ** 2 + fx ** 2)).astype(np.float32)
    out = np.fft.irfft2(np.fft.rfft2(pad) * G, s=(PH, PW))
    return out[p:p + H, p:p + W].astype(np.float32)


def read_skin():
    try:
        js = SKIN_JS.read_text(encoding="utf-8")
    except OSError:
        return "mist-night"
    m = re.search(r"export const SKIN = '([^']+)'", js)
    return m.group(1) if m else "mist-night"


def main() -> int:
    skin = read_skin()
    dst = ROOT / "public" / "skins" / skin / "hero-hand.webp"
    dst.parent.mkdir(parents=True, exist_ok=True)

    im = Image.open(SRC).convert("RGB")
    W, H = im.size
    a = np.asarray(im).astype(np.float32)
    L = lum_of(a)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = CX_PCT / 100 * W, CY_PCT / 100 * H
    r_orb = ORB_SIZE_PCT / 100 * H / 2

    lines = [f"源图: {SRC.name}  {W}x{H}", f"球心 ({CX_PCT}%,{CY_PCT}%)  球半径 {r_orb:.1f}px", ""]

    # ---- 手部掩码 ----
    w_hand = smoothstep((L - HAND_L_LO) / (HAND_L_HI - HAND_L_LO))

    inside = (yy >= LIMIT_Y / 100 * H)
    inside &= (xx >= LIMIT_X[0] / 100 * W) & (xx <= LIMIT_X[1] / 100 * W)
    inside &= (np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) <= LIMIT_R * r_orb)
    w_hand = w_hand * inside

    raw_pct = 100 * (w_hand > 0.5).mean()
    m8 = Image.fromarray(np.clip(w_hand * 255, 0, 255).astype(np.uint8), mode="L")
    if DILATE > 0:
        m8 = m8.filter(ImageFilter.MaxFilter(DILATE * 2 + 1))
    alpha = gauss(np.asarray(m8).astype(np.float32) / 255.0, FEATHER)
    alpha = np.clip(alpha, 0, 1)

    ys, xs = np.nonzero(alpha > 0.05)
    if len(xs):
        bbox = (f"x[{xs.min()/W*100:.1f}%,{xs.max()/W*100:.1f}%] "
                f"y[{ys.min()/H*100:.1f}%,{ys.max()/H*100:.1f}%]")
    else:
        bbox = "(空)"

    lines.append("=== 手部掩码 ===")
    lines.append(f"  阈值 L>{HAND_L_LO}（区间 {HAND_L_LO}–{HAND_L_HI}）")
    lines.append(f"  二值化后占全图 {raw_pct:.2f}%")
    lines.append(f"  膨胀 {DILATE}px + 羽化 {FEATHER}px 后 alpha>0.05 占全图 {100*(alpha>0.05).mean():.2f}%  {bbox}")

    # 球位圆内被手挡住的面积（用户定的上限是 15%）
    in_orb = ((xx - cx) ** 2 + (yy - cy) ** 2) <= r_orb ** 2
    occ = float(alpha[in_orb].mean())
    lines.append(f"  ★ 球位圆内被该层遮挡：{100*occ:.1f}%（用户定过的上限 15%）")
    lines.append(f"  球位圆内 alpha 的均值 {alpha[in_orb].mean():.3f} / 中位 {np.median(alpha[in_orb]):.3f}")
    lines.append("")

    # ---- 输出 RGBA ----
    rgba = np.dstack([a, alpha * 255]).astype(np.uint8)
    out = Image.fromarray(rgba, mode="RGBA")
    out.save(dst, format="WEBP", quality=88, method=6)
    lines.append(f"wrote {dst.relative_to(ROOT)} ({dst.stat().st_size/1024:.0f} KB, RGBA {W}x{H})")

    # ---- 验收图 ----
    # 棋盘格：一眼看出哪里透明、哪里不透明
    chk = Image.new("RGB", (W, H), (60, 60, 66))
    d = ImageDraw.Draw(chk)
    for gy in range(0, H, 32):
        for gx in range(0, W, 32):
            if (gx // 32 + gy // 32) % 2:
                d.rectangle([gx, gy, gx + 31, gy + 31], fill=(92, 92, 100))
    chk.paste(out, (0, 0), out)
    dc = ImageDraw.Draw(chk)
    dc.ellipse([cx - r_orb, cy - r_orb, cx + r_orb, cy + r_orb], outline=(120, 255, 140), width=3)
    dc.text((10, 10), "手部前景层（棋盘=透明）球位圆=绿", fill=(255, 255, 255), font=font(24))
    chk.resize((W // 2, H // 2), Image.LANCZOS).save(OUT / "hand-layer.png")

    mm = Image.fromarray(np.clip(alpha * 255, 0, 255).astype(np.uint8), mode="L").convert("RGB")
    ImageDraw.Draw(mm).ellipse([cx - r_orb, cy - r_orb, cx + r_orb, cy + r_orb], outline=(120, 255, 140), width=3)
    mm.resize((W // 2, H // 2), Image.LANCZOS).save(OUT / "hand-mask.png")
    lines.append(f"wrote {(OUT/'hand-layer.png').relative_to(ROOT)}")
    lines.append(f"wrote {(OUT/'hand-mask.png').relative_to(ROOT)}")

    (OUT / "hand-report.txt").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
