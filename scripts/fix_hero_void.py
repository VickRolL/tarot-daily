"""把第 2 版主视觉里「被模型偷偷画出来的球」从球位空区里去掉。

## 背景（见 HERO_V2_PROMPT.md 第 2 节 / 第 8 节）

规格要求球位空区里「只允许稀薄的暗雾，不许画球体 / 球状光晕 / 朝中央的辉光」。
实测第 2 版出图**违反了这一条，而且违反得很实在**：空区里画了一颗没打光的球 ——
1:1 放大后有清楚的球面、有上缘反光，核心 L≈0.104，而周围雾只有 0.065。
3D 球装上去之后，这颗「假球」的轮廓会从 3D 球的边缘露出来，读起来就是画上去的一坨。

## 做法：在空区内「重建一层平滑暗雾」，而不是简单压暗

前两次尝试都失败了，记在这里免得再走：

| 尝试 | 结果 | 为什么不行 |
|---|---|---|
| ① 按亮度线性压暗到环境光 | 空区变成一片**斑驳脏纹** | 压暗只缩小了绝对反差，8bit 量化台阶的相对占比反而变大 |
| ② 再叠一层 46px 高斯柔化 | 仍然是斑驳 | 斑驳的尺度远大于模糊半径，而且它本来就来自量化台阶，柔化只会把它抹糊不会消掉 |
| ③ 按亮度**比值**缩放 RGB 做替换 | 空区爆出一片**亮点噪斑** | L=0.005 的暗像素遇到 base=0.06 会得到 12 倍缩放，乘完在 255 处削顶 |

所以改成：以**全图大半径模糊场**为底（继承雾气的大尺度走向），把它重新映射到一段
很暗的窄区间，再用同一个软遮罩与原因素混合。结果是空区变成一层**无纹理、无边界、
只有大尺度渐变**的暗雾，同时因为遮罩是软的，看不到任何硬边。

另外加一道 **±1/255 的抖动**：暗部（L≈0.06）里 1 级量化就是亮度的 6%，
不加抖动必然出现色带 —— 这是 ① ② 两次「斑驳」的最后一块拼图。

手必须保住：判据用 **R/B 比值**，不是 R−B。
（坑：这张图整幅都是冷紫，手指区 R−B=−5.3 而空区核心 R−B=−6.3，毫无分离度，
用 R−B 当判据等于没判，会把手指压掉一半 —— 而「手在宽屏上要看得见」正是本轮核心目标。
R/B 才有分离度：手 0.883 / 空区核心 0.808 / 左雾 0.765 / 右袍 0.688。）

## 输入输出

输入：assets/hero-art/bg/_raw/ 里的出图原样（首次运行会把 bg/ 根目录那张挪进去）
输出：assets/hero-art/bg/hero-v2b.png（后处理成品源图）
     assets/_debug/glow-fix-ab.png + glow-fix-report.txt

用法：cd <project> && "$PY" scripts/fix_hero_void.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BG = ROOT / "assets/hero-art/bg"
RAW_DIR = BG / "_raw"
OUT = ROOT / "assets" / "_debug"

# —— 几何（与 src/config/skin.js 的 ANCHORS.orb 同源）——
CX_PCT, CY_PCT = 50.0, 61.5           # 球心（画布百分比）
R_FLAT = 0.16                         # 半径 ≤0.16H：全额替换
R_ZERO = 0.36                         # 半径 ≥0.36H：完全不动
# —— 混合强度 ——
K_MAX = 0.94
# —— 重建的暗雾区间（归一化后映射到这一段亮度）——
LO_FOG, HI_FOG = 0.030, 0.070
BLUR_A = 0.22                         # 底场模糊半径 = 0.22 × 画布高
P10, P90 = 10, 90                     # 归一化用的分位
# —— 保护 ——
HI_FULL = 0.22                        # 亮度 ≥ 此值完全不碰（指甲、帽檐边光）
HI_START = 0.15
RB_HAND, RB_FOG = 0.870, 0.800        # R/B ≥0.87 = 手；≤0.80 = 雾（在平滑场上算）
MASK_BLUR = 0.020                     # 判据用的模糊半径 = 0.02 × 画布高
DITHER = 0.9 / 255                    # 抖动幅度（消暗部色带）

ZONES = {
    "空区核心": (46, 54, 55, 68),
    "空区上缘(球位顶)": (44, 56, 42, 48),
    "空区外·左雾": (6, 16, 45, 65),
    "空区外·右袍": (78, 92, 70, 88),
    "手指区": (38, 58, 74, 84),
    "指尖区": (40, 56, 70, 76),
}


def font(sz=18):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/consola.ttf", sz)
    except Exception:
        return ImageFont.load_default()


def lum_of(a: np.ndarray) -> np.ndarray:
    return (0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]) / 255.0


def smoothstep(t: np.ndarray) -> np.ndarray:
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    raws = sorted(p for p in RAW_DIR.iterdir()
                  if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"))
    if not raws:
        loose = sorted(p for p in BG.iterdir()
                       if p.is_file() and p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"))
        if not loose:
            raise SystemExit("找不到出图原图：bg/_raw/ 为空，bg/ 根目录也没有图")
        loose[0].replace(RAW_DIR / loose[0].name)
        raws = sorted(RAW_DIR.iterdir())
        print(f"原图移入 _raw/: {raws[0].name}")
    keep = raws[0]

    im = Image.open(keep).convert("RGB")
    W, H = im.size
    a = np.asarray(im).astype(np.float32)
    L = lum_of(a)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = CX_PCT / 100 * W, CY_PCT / 100 * H
    r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / H
    R_, B_ = a[:, :, 0], a[:, :, 2]
    # ⚠️ 第四个坑：rb 一开始是**逐像素**算的。暗部 R、B 只有个位数，
    # 8bit 量化噪声让比值在 0.75↔0.90 之间随机跳 → w_hand 变成空间随机的遮罩 →
    # 结果是「原图」与「底场」按像素交替混合，空区爆出一片**椒盐亮点**。
    # 判据必须在**平滑场**上算：先对 RGB 做一次中半径模糊再取比值。
    mb = max(3, int(MASK_BLUR * H))
    a_s = np.asarray(im.filter(ImageFilter.GaussianBlur(mb))).astype(np.float32)
    rb = a_s[:, :, 0] / np.maximum(a_s[:, :, 2], 1.0)

    lines = [f"源图(_raw): {keep.name}  {W}x{H}", ""]

    def zone_line(arr_l: np.ndarray, name: str) -> str:
        x0, x1, y0, y1 = ZONES[name]
        sl = (slice(int(H * y0 / 100), int(H * y1 / 100)), slice(int(W * x0 / 100), int(W * x1 / 100)))
        return f"  {name:<18} L={arr_l[sl].mean():.4f}"

    lines.append("=== 取样区（处理前）===")
    for n in ZONES:
        lines.append(zone_line(L, n))
    lines.append("")

    # ---- 底场：全图大半径模糊 → 归一化 → 映射到暗雾区间 ----
    # ⚠️ 第三个坑：一开始是「按亮度比值缩放 RGB」（out = a * L_new/L）。
    # 空区里 L 只有 0.005 的暗像素遇到 base=0.06 会得到 12 倍的缩放系数，
    # 乘完在 255 处削顶 —— 空区爆出一片**亮点噪斑**，比原来的圆盘还难看。
    # 所以改成**在 RGB 空间做混合**：底场自己也带颜色（就是模糊后的雾气颜色），
    # 只把它的「亮度」重映射到暗雾区间，绝不逐像素算比值。
    rad = int(BLUR_A * H)
    blur_rgb = np.asarray(im.filter(ImageFilter.GaussianBlur(rad))).astype(np.float32)
    L_blur = lum_of(blur_rgb)
    lo, hi = np.percentile(L_blur, P10), np.percentile(L_blur, P90)
    norm = np.clip((L_blur - lo) / max(hi - lo, 1e-6), 0, 1)
    base_l = LO_FOG + (HI_FOG - LO_FOG) * norm                    # 目标「亮度场」
    # 用底场自身的颜色承担亮度变化，缩放系数被夹在温和区间内
    k = np.clip(base_l / np.maximum(L_blur, 1e-4), 0.30, 2.00)
    base_rgb = np.clip(blur_rgb * k[:, :, None], 0, 255)

    # ---- 软遮罩 ----
    w_radial = 1 - smoothstep((r - R_FLAT) / (R_ZERO - R_FLAT))
    w_hi = np.clip((HI_FULL - L) / (HI_FULL - HI_START), 0, 1)
    w_hand = 1 - smoothstep((rb - RB_FOG) / (RB_HAND - RB_FOG))
    alpha = K_MAX * w_radial * w_hi * w_hand
    # 遮罩再轻微羽化一次，去掉任何残留的像素级硬边
    alpha = np.asarray(Image.fromarray(np.clip(alpha * 255, 0, 255).astype(np.uint8), mode="L")
                       .filter(ImageFilter.GaussianBlur(mb * 0.5))).astype(np.float32) / 255.0

    out = a * (1 - alpha[:, :, None]) + base_rgb * alpha[:, :, None]

    # ---- 抖动：暗部 1 级量化 = 亮度的 6%，不加必出色带 ----
    rng = np.random.default_rng(20260919)
    noise = rng.uniform(-DITHER, DITHER, size=(H, W, 1)).astype(np.float32) * 255
    out = np.clip(out + noise * (alpha > 0.05)[:, :, None], 0, 255)
    after = Image.fromarray(out.astype(np.uint8))
    L2 = lum_of(np.asarray(after).astype(np.float32))

    lines.append(f"底场：模糊半径 {rad}px({BLUR_A:.2f}H) · 归一化 p{P10}–p{P90} = {lo:.4f}–{hi:.4f} "
                 f"→ 映射到 {LO_FOG}–{HI_FOG}")
    lines.append(f"遮罩：径向 1@r≤{R_FLAT}H → 0@{R_ZERO}H · 高亮 L≥{HI_FULL} 不碰 · "
                 f"手 R/B≥{RB_HAND} 不碰 · 替换覆盖 {100*(alpha>0.05).mean():.2f}% 像素")
    lines.append(f"抖动 ±{DITHER*255:.2f}/255")
    lines.append("")
    lines.append("=== 取样区（处理后）===")
    for n in ZONES:
        lines.append(zone_line(L2, n))
    lines.append("")

    r_px = 0.40 / 2 * H
    in_orb = ((xx - cx) ** 2 + (yy - cy) ** 2) <= r_px ** 2
    lines.append(f"全图  mean {L.mean():.4f} → {L2.mean():.4f} · p99 {np.percentile(L,99):.4f} → "
                 f"{np.percentile(L2,99):.4f}（高光必须基本不掉）")
    lines.append(f"球位圆(d=40%h) L均值 {L[in_orb].mean():.4f} → {L2[in_orb].mean():.4f}"
                 f" · 圆内标准差 {L[in_orb].std():.4f} → {L2[in_orb].std():.4f}（纹理必须显著变小）")
    lines.append(f"全图 p50 = {np.percentile(L2,50):.4f}")
    lines.append("")

    def with_marks(img: Image.Image, label: str) -> Image.Image:
        c = img.copy()
        d = ImageDraw.Draw(c)
        rr = 0.40 / 2 * H
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=(120, 255, 140), width=4)
        d.text((10, 10), label, fill=(255, 255, 255), font=font(26))
        return c

    sheet = Image.new("RGB", (W, H * 2 + 10), (30, 30, 34))
    sheet.paste(with_marks(im, "BEFORE  (空区里被画了一颗球)"), (0, 0))
    sheet.paste(with_marks(after, "AFTER  (空区重建为暗雾 · 手保留)"), (0, H + 10))
    sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS).save(OUT / "glow-fix-ab.png")
    after.save(BG / "hero-v2b.png", optimize=True)
    lines.append(f"wrote {(BG/'hero-v2b.png').relative_to(ROOT)} ({(BG/'hero-v2b.png').stat().st_size/1024:.0f} KB)")
    lines.append(f"wrote {(OUT/'glow-fix-ab.png').relative_to(ROOT)}")

    (OUT / "glow-fix-report.txt").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
