"""把第 2 版主视觉里「女巫的脸」彻底埋进黑暗里。

## 背景

`HERO_V2_PROMPT.md` §2 原本的处方是「脸几乎完全在帽檐阴影里，**只留下颌/唇极弱轮廓**」。
用户 2026-09-19 看过成图后要求得更严：**连鼻子和嘴巴都不要看见，被黑暗笼罩得彻底**。
手部不动（用户明确说「手的部分先不改了」）。

## 关键事实：这不是「脸太亮」，而是「脸和头发的局部反差还在」

`scripts/_diag_face.py` 量出来的（1536×1024）：

| 取样 | mean | 说明 |
|---|---|---|
| 脸框 x[49,65]% y[19,36]% | **0.0462** | 比周围还暗 |
| 脸周合法暗部（头发/帽檐阴影/衣领） | 0.0695（p50 **0.0311**） | 压暗的目标档位 |

而用「L>0.10」取掩码时，脸框里几乎一个像素都没有 ——
**五官全部落在 0.02–0.10 这段窄区间里**，靠绝对亮度阈值根本抓不到它们。
人能读出鼻子和嘴唇，靠的是这段窄区间里的**局部对比**（鼻梁高光 vs 鼻孔阴影、唇高光 vs 唇缝）。

所以做法不能是「压暗亮块」，必须是**抹平这块区域的局部对比**：
把脸椭圆内的像素替换成「周围合法暗部的插值场」，那个场是平滑的、而且还带着发丝的大尺度走向。

## 做法

1. **引导插值暗场**（不是简单模糊）：
   `field = blur(L · w_dark) / blur(w_dark)`，`w_dark` 只保留「本来就暗」的像素。
   这样脸区中心得到的是**周围发丝/阴影的插值**，而不是肤色被模糊后的灰。
   ⚠️ 直接做高斯模糊会得到「一块灰补丁」，因为在脸中央把肤色和发丝一起平均了。
2. **软椭圆遮罩**：椭圆覆盖整张可见的脸（含鼻唇下颌），羽化带宽 ≈ 4% 画布高。
   遮罩本身要再羽化一次，杜绝像素级硬边。
3. **外圈高亮保护**：椭圆上缘紧邻帽檐下缘那条**磨损亮边**（x55.6–62.8%, y≈21.5%）。
   只在「椭圆外圈（d>0.60）且亮度高（L>0.10）」处衰减压暗强度，
   核心区（d<0.60，覆盖鼻/唇/下颌）**不保护** —— 鼻子上的高光必须一起压掉。
4. **抖动 ±0.9/255**：压到 L≈0.03 之后，1 级量化就是亮度的 4%，不加必出色带。

## 输入输出

输入：`assets/hero-art/bg/_beforeface/hero-v2b.png`
      （首次运行自动从 `bg/hero-v2b.png` 复制一份 —— 即「void 修好、脸还没修」那一版）
输出：`assets/hero-art/bg/hero-v2b.png`
      `assets/_debug/face-fix-{ab,zoom}.png` + `face-fix-report.txt`

幂等：输入固定为 `_beforeface/`，重复运行不会二次压暗。

用法：cd <project> && "$PY" scripts/fix_hero_face.py
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
BG = ROOT / "assets/hero-art/bg"
SRC = BG / "hero-v2b.png"
PRE = BG / "_beforeface"
OUT = ROOT / "assets/_debug"

# —— 脸的椭圆（画布百分比）。来自 _diag_face.py 的实测 + face-zoom-2x.png 逐点目视核对 ——
#    鼻 x57.3–59.9% y25.7–31%；唇 x55.3–61.2% y31–34%；下颌到 y38%
CX, CY = 58.5, 30.0
RX, RY = 7.5, 9.0
D_IN, D_OUT = 0.75, 1.18              # 遮罩场：d≤0.75 全额，d≥1.18 归零
K_MAX = 0.95
# —— 外圈高亮保护（只保护帽檐磨损亮边，核心区照样压）——
D_HI_IN, D_HI_OUT = 0.60, 0.95
HI_LO, HI_HI = 0.10, 0.22             # L≤0.10 不保护；L≥0.22 保护到底
# —— 引导插值暗场 ——
DARK_LO, DARK_HI = 0.040, 0.095       # 判为「合法暗部」的亮度区间
FIELD_BLUR = 0.055                    # 引导模糊半径 = 0.055 × 画布高 ≈ 56px
DITHER = 0.9 / 255

# 验证用：脸核心区（五官所在）与脸周暗部取样
CORE_D = 0.70
RING_BOXES = [(40.0, 47.0, 20.0, 38.0),   # 左：头发
              (67.0, 74.0, 20.0, 38.0),   # 右：头发
              (52.0, 66.0, 40.0, 45.0)]   # 下：颈下暗部


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


def gauss(arr: np.ndarray, sigma: float) -> np.ndarray:
    """对 float32 场做高斯模糊。

    ⚠️ 不能用 PIL 的 `ImageFilter.GaussianBlur` —— 本机 Pillow 对 `mode="F"` 直接抛
    `ValueError: image has wrong mode`（实测）。降到 8bit 也不行：本图上要模糊的场
    L≈0.03，8bit 的 1 级 = 亮度 13%，量化噪声比要保留的结构还大。
    本机也没装 scipy。所以用 **纯 numpy 的 FFT 高斯**（reflect padding 抑制环绕），
    float32 全程不量化，零新依赖。
    """
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


def sl_of(box, W, H):
    x0, x1, y0, y1 = box
    return (slice(int(H * y0 / 100), int(H * y1 / 100)),
            slice(int(W * x0 / 100), int(W * x1 / 100)))


def main() -> int:
    if not PRE.exists():
        PRE.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SRC, PRE / SRC.name)
        print(f"备份「脸未修」版本 → {PRE.relative_to(ROOT)}/{SRC.name}")
    im = Image.open(PRE / SRC.name).convert("RGB")
    W, H = im.size
    a = np.asarray(im).astype(np.float32)
    L = lum_of(a)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    cx, cy = CX / 100 * W, CY / 100 * H
    rx, ry = RX / 100 * W, RY / 100 * H
    d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)

    # ---------- ① 引导插值暗场：field = blur(L·w) / blur(w) ----------
    w_dark = 1 - smoothstep((L - DARK_LO) / (DARK_HI - DARK_LO))
    rad = FIELD_BLUR * H
    den = gauss(w_dark, rad)
    den_s = np.maximum(den, 1e-3)
    field = np.stack([gauss(a[:, :, c] * w_dark, rad) / den_s for c in range(3)], axis=2)
    L_field = lum_of(field)

    # ---------- ② 遮罩 ----------
    w_geo = 1 - smoothstep((d - D_IN) / (D_OUT - D_IN))
    w_hi = 1 - smoothstep((L - HI_LO) / (HI_HI - HI_LO))
    w_prot = smoothstep((d - D_HI_IN) / (D_HI_OUT - D_HI_IN))
    eff_hi = 1 - w_prot * (1 - w_hi)                    # 核心区不保护，外圈才保护
    alpha = K_MAX * w_geo * eff_hi
    alpha = gauss(alpha, max(2.0, H * 0.006))           # 再羽化一次，杜绝像素级硬边
    alpha = np.clip(alpha, 0, 1)

    out = a * (1 - alpha[:, :, None]) + field * alpha[:, :, None]
    rng = np.random.default_rng(20260919)
    noise = rng.uniform(-DITHER, DITHER, size=(H, W, 1)).astype(np.float32) * 255
    out = np.clip(out + noise * (alpha > 0.05)[:, :, None], 0, 255)
    after = Image.fromarray(out.astype(np.uint8))
    L2 = lum_of(np.asarray(after).astype(np.float32))

    # ---------- ③ 验收指标 ----------
    core = d <= CORE_D
    ring = np.zeros_like(core)
    for b in RING_BOXES:
        ring[sl_of(b, W, H)] = True
    ring &= (d > 1.30)

    def hp_energy(field_l: np.ndarray, r_px: float = 8.0) -> float:
        """局部对比能量：高通残差的 RMS。五官可辨识 = 局部对比高。"""
        return float(np.sqrt(((field_l - gauss(field_l, r_px))[core] ** 2).mean()))

    lines = [f"源图(_beforeface): {SRC.name}  {W}x{H}",
             f"椭圆 中心({CX}%,{CY}%) 半轴({RX}%,{RY}%)  遮罩 d≤{D_IN} 全额 → d≥{D_OUT} 归零  羽化≈{H*0.006:.0f}px",
             f"遮挡覆盖：alpha>0.05 占全图 {100*(alpha>0.05).mean():.2f}%"
             f"（核心 d≤{CORE_D} 内 {100*(alpha[core]>0.5).mean():.1f}% 的像素被全额压）",
             ""]
    lines.append("=== 脸核心区（五官所在，d≤0.70）===")
    for name, arr in (("处理前", L), ("处理后", L2)):
        z = arr[core]
        lines.append(f"  {name}  mean={z.mean():.4f} p50={np.percentile(z,50):.4f} "
                     f"p90={np.percentile(z,90):.4f} p99={np.percentile(z,99):.4f} max={z.max():.4f}")
    lines.append(f"  局部对比能量(RMS, 8px 高通)：{hp_energy(L):.5f} → {hp_energy(L2):.5f}"
                 f"  （{100*(1-hp_energy(L2)/max(hp_energy(L),1e-9)):.0f}% 下降）")
    lines.append(f"  核心区内 p99−p50（五官相对脸的对比）：{np.percentile(L[core],99)-np.percentile(L[core],50):.4f}"
                 f" → {np.percentile(L2[core],99)-np.percentile(L2[core],50):.4f}")
    lines.append("")
    lines.append("=== 脸周合法暗部（压暗的目标档位）===")
    lines.append(f"  处理前 mean={L[ring].mean():.4f} p50={np.percentile(L[ring],50):.4f}")
    lines.append(f"  处理后 mean={L2[ring].mean():.4f} p50={np.percentile(L2[ring],50):.4f}（环带在椭圆外，应几乎不动）")
    lines.append(f"  → 脸核心 mean 与暗部的差：{L[core].mean()-L[ring].mean():+.4f} → "
                 f"{L2[core].mean()-L2[ring].mean():+.4f}（目标：归零或略负）")
    lines.append("")
    lines.append("=== 全图（不能因为修脸而动了别处） ===")
    lines.append(f"  mean {L.mean():.4f} → {L2.mean():.4f}")
    lines.append(f"  p90  {np.percentile(L,90):.4f} → {np.percentile(L2,90):.4f}")
    lines.append(f"  p99  {np.percentile(L,99):.4f} → {np.percentile(L2,99):.4f}（高光必须基本不掉）")
    hp_all = float(np.sqrt(((L - gauss(L, 8.0)) ** 2).mean()))
    hp_all2 = float(np.sqrt(((L2 - gauss(L2, 8.0)) ** 2).mean()))
    lines.append(f"  全图局部对比能量 {hp_all:.5f} → {hp_all2:.5f}")
    lines.append("")

    # ---------- ④ 对照图 ----------
    box_px = (int(cx - rx * 1.7), int(cy - ry * 1.7), int(cx + rx * 1.7), int(cy + ry * 1.7))

    def marked(img: Image.Image, label: str) -> Image.Image:
        c = img.copy()
        dr = ImageDraw.Draw(c)
        dr.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=(120, 255, 140), width=3)
        dr.text((10, 10), label, fill=(255, 255, 255), font=font(24))
        return c

    sheet = Image.new("RGB", (W, H * 2 + 10), (26, 26, 30))
    sheet.paste(marked(im, "BEFORE  (鼻子 / 嘴唇可辨)"), (0, 0))
    sheet.paste(marked(after, "AFTER  (埋进暗部)"), (0, H + 10))
    sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS).save(OUT / "face-fix-ab.png")

    # ★ 关键验收图：脸区 1:1 + 极限对比拉伸（在正常显示下看不出来的东西，拉伸后会现形）
    cells = []
    for img, tag in ((im, "BEFORE"), (after, "AFTER")):
        c = img.crop(box_px)
        cells.append((c, f"{tag} 原样"))
        cells.append((ImageOps.autocontrast(c.convert("L"), cutoff=0.5).convert("RGB"), f"{tag} 拉伸"))
    cw, ch = cells[0][0].size
    grid = Image.new("RGB", (cw * 2 + 12, ch * 2 + 12), (26, 26, 30))
    for i, (c, tag) in enumerate(cells):
        gx, gy = (i % 2) * (cw + 12), (i // 2) * (ch + 12)
        cc = c.copy()
        ImageDraw.Draw(cc).text((6, 6), tag, fill=(255, 120, 120), font=font(17))
        grid.paste(cc, (gx, gy))
    grid.save(OUT / "face-fix-zoom.png")
    lines.append(f"wrote {(OUT/'face-fix-zoom.png').relative_to(ROOT)}  ← 关键验收图（右下=修复后极限拉伸）")

    after.save(SRC, optimize=True)
    lines.append(f"wrote {SRC.relative_to(ROOT)} ({SRC.stat().st_size/1024:.0f} KB)")
    lines.append(f"wrote {(OUT/'face-fix-ab.png').relative_to(ROOT)}")

    (OUT / "face-fix-report.txt").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
