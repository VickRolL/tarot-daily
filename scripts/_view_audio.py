# -*- coding: utf-8 -*-
"""把音频画成图，供「用眼睛看结构」（本项目已验证：文字素描会骗人，图不会）。

输出：波形包络（上）+ 对数频率声谱图（下），横向 = 时间。
PNG 落盘到 scripts/out/，随后用 Read 直接看图。
"""
import os
import sys

import numpy as np
import miniaudio
from PIL import Image, ImageDraw, ImageFont


def load(path):
    d = miniaudio.decode_file(path, output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1)
    return np.array(d.samples, dtype=np.float32), d.sample_rate


def stft_db(x, nfft=1024, hop=128):
    w = np.hanning(nfft).astype(np.float64)
    n = 1 + max(0, (len(x) - nfft) // hop)
    out = np.empty((n, nfft // 2 + 1), dtype=np.float64)
    for i in range(n):
        s = x[i * hop:i * hop + nfft].astype(np.float64) * w
        out[i] = np.abs(np.fft.rfft(s))
    return out


def color_heat(v):
    """0..1 → 热力图 RGB（黑→紫→橙→白）。"""
    v = max(0.0, min(1.0, v))
    stops = [(0.0, (8, 6, 20)), (0.25, (60, 30, 110)), (0.5, (150, 40, 120)),
             (0.72, (230, 120, 40)), (0.88, (250, 210, 90)), (1.0, (255, 255, 240))]
    for i in range(len(stops) - 1):
        a, ca = stops[i]
        b, cb = stops[i + 1]
        if a <= v <= b:
            t = (v - a) / (b - a)
            return tuple(int(ca[k] + (cb[k] - ca[k]) * t) for k in range(3))
    return stops[-1][1]


def render(paths, out_png, title=''):
    """paths: [(label, path) | (label, path, (t0, t1)), ...] 上下并排多组。"""
    W = 1500
    row_h = 260          # 每组的波形 + 声谱总高
    pad_l, pad_r, pad_t = 96, 16, 46
    font = ImageFont.load_default()

    rows = len(paths)
    H = pad_t + rows * (row_h + 34) + 16
    img = Image.new('RGB', (W, H), (16, 14, 24))
    dr = ImageDraw.Draw(img)
    dr.text((pad_l, 14), title, fill=(235, 232, 245), font=font)

    plot_w = W - pad_l - pad_r

    for r, item in enumerate(paths):
        label, p = item[0], item[1]
        crop = item[2] if len(item) > 2 else None
        if not os.path.exists(p):
            dr.text((pad_l, pad_t + r * (row_h + 34)), f'{label}: 缺 {p}', fill=(255, 90, 90), font=font)
            continue
        x, sr = load(p)
        full_dur = len(x) / sr
        if crop:
            a = max(0, int(crop[0] * sr))
            b = min(len(x), int(crop[1] * sr))
            x = x[a:b]
        nfft, hop = 1024, 128
        mags = stft_db(x, nfft, hop)
        freqs = np.fft.rfftfreq(nfft, 1.0 / sr)
        dur = len(x) / sr
        y0 = pad_t + r * (row_h + 34)

        # ── 波形包络（2ms 窗 RMS + 峰值）────────────────────────────────
        win = int(sr * 0.002)
        n = len(x) // win
        seg = x[:n * win].reshape(n, win)
        pk = np.abs(seg).max(axis=1)
        amp = pk / (np.abs(x).max() or 1.0)
        wf_h = 92
        mid = y0 + wf_h // 2
        for i in range(plot_w):
            a = int(i * n / plot_w)
            b = max(a + 1, int((i + 1) * n / plot_w))
            v = float(amp[a:b].max())
            hgt = int(v * (wf_h / 2 - 3))
            if hgt <= 0:
                continue
            dr.line([(pad_l + i, mid - hgt), (pad_l + i, mid + hgt)], fill=(120, 220, 255))
        dr.line([(pad_l, mid), (pad_l + plot_w, mid)], fill=(50, 46, 66))
        dr.text((pad_l - 88, y0 + 4), label[:26], fill=(220, 216, 235), font=font)
        dr.text((pad_l - 88, y0 + 20), f'{dur:.3f}s', fill=(150, 146, 175), font=font)

        # 峰值位置标注
        pks = []
        for i in range(1, len(amp) - 1):
            if amp[i] > 0.35 and amp[i] >= amp[i - 1] and amp[i] > amp[i + 1]:
                t = i * win / sr
                if pks and t - pks[-1][0] < 0.02:
                    if amp[i] > pks[-1][1]:
                        pks[-1] = (t, float(amp[i]))
                    continue
                pks.append((t, float(amp[i])))
        for t, v in pks:
            px = pad_l + int(t / dur * plot_w)
            dr.line([(px, y0 + 2), (px, y0 + wf_h)], fill=(255, 90, 90))
        dr.text((pad_l, y0 + wf_h + 2),
                f'峰(>35%) {len(pks)} 个: ' + ','.join(f'{t:.2f}' for t, _ in pks[:14]),
                fill=(255, 140, 140), font=font)

        # ── 声谱图 ────────────────────────────────────────────────────
        sp_y0 = y0 + wf_h + 18
        sp_h = row_h - wf_h - 18
        f0, f1 = 40.0, sr / 2
        db = 20 * np.log10(np.maximum(mags, 1e-9))
        db -= db.max()
        for i in range(plot_w):
            a = int(i * mags.shape[0] / plot_w)
            b = max(a + 1, int((i + 1) * mags.shape[0] / plot_w))
            col = mags[a:b].max(axis=0)
            cdb = 20 * np.log10(np.maximum(col, 1e-9))
            cdb -= cdb.max()
            for j in range(sp_h):
                # 纵轴：对数频率，上=高频
                fr = f0 * (f1 / f0) ** (1.0 - j / sp_h)
                k = int(np.searchsorted(freqs, fr))
                k = min(k, len(cdb) - 1)
                v = (cdb[k] + 60.0) / 60.0
                img.putpixel((pad_l + i, sp_y0 + j), color_heat(v))
        # 频率刻度
        for fr in (100, 300, 1000, 3000, 10000):
            j = int((1.0 - np.log(fr / f0) / np.log(f1 / f0)) * sp_h)
            if 0 <= j < sp_h:
                dr.line([(pad_l - 5, sp_y0 + j), (pad_l, sp_y0 + j)], fill=(90, 86, 110))
                dr.text((pad_l - 46, sp_y0 + j - 6), f'{fr//1000}k' if fr >= 1000 else str(fr),
                        fill=(150, 146, 175), font=font)
        # 时间刻度（每 0.1s）
        k = 0.1
        while k < dur:
            px = pad_l + int(k / dur * plot_w)
            dr.line([(px, sp_y0 + sp_h - 4), (px, sp_y0 + sp_h)], fill=(150, 146, 175))
            k += 0.1

    img.save(out_png)
    print('→', out_png, f'{img.size[0]}x{img.size[1]}')


if __name__ == '__main__':
    base = os.path.join('audio-src', 'sfx', '_raw')
    if len(sys.argv) > 1 and sys.argv[1] == 'zoom':
        render(
            [('flip raw 0~0.35s (放大)', os.path.join(base, 'flip-raw.mp3'), (0.0, 0.35)),
             ('flip 成品 0~0.35s (放大)', os.path.join('src', 'assets', 'audio', 'sfx', 'flip.mp3'), (0.0, 0.35))],
            os.path.join('scripts', 'out', '_flip_zoom.png'),
            'flip 开头放大 0~350ms —— 问：有没有一次可用的「起手」（尖峰 + 快速衰减）？',
        )
    elif len(sys.argv) > 2 and sys.argv[1] == 'flip-cmp':
        # 由调用方给出「标签=路径」列表，用于横向对比
        items = []
        for a in sys.argv[2:]:
            lab, p = a.split('=', 1)
            items.append((lab, p))
        render(items, os.path.join('scripts', 'out', '_flip_cmp.png'),
               'flip 候选对比：波形包络(蓝) + 对数频率声谱。看「是不是一次干脆的动作」')
    else:
        render(
            [('flip 原始素材 (1.0s)', os.path.join(base, 'flip-raw.mp3')),
             ('flip 站点成品 (0.86s)', os.path.join('src', 'assets', 'audio', 'sfx', 'flip.mp3'))],
            os.path.join('scripts', 'out', '_flip_view.png'),
            'flip 现状：波形包络(上,蓝) + 对数频率声谱(下)  —— 用户："冗杂、像翻了两三张牌/翻书"',
        )
