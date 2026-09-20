# -*- coding: utf-8 -*-
"""flip 的三维扫描：候选素材 × 峰值天花板 × 响度目标，找同时满足三条的落点。

为什么会有这个冲突（2026-09-21 实测）：
  s1-50 素材 crest 26.2dB（一记尖峰 + 静默）→ 要凑 RMS -16.5 得砍掉约 6dB 动态
  → 软削顶削掉 3.3% 样本 → 波形被压密 → **mp3 样本间过冲冲破满刻度**
  （python 侧看到 3 个被钳样本；钳位意味着这里量不出过冲有多大，
    真幅度只有浏览器探针能量）。
  把响度目标降下来能救过冲，但会撞上另一条判据「四音 RMS 极差 ≤3dB」。

所以这里同时扫「素材」这一维 —— **稀疏度是素材本身的属性**，
换一条不那么稀疏的候选（duty 高、crest 低）可能根本不需要那么重的削顶。

三条硬要求（按优先级）：
  1. 无钳位样本（python 侧只能验这一条，见上）
  2. 解码峰值 ≤ -1.0dBFS（给浏览器解码器留余量它和 miniaudio 不是同一条路径）
  3. 四音解码 RMS 极差 ≤ 3.0dB（对照值来自现役的 charge/burst/reveal）
加分项：crest 越高越好（瞬态保留得多）、duty 越低越好（没被填平）。
"""
import glob
import importlib.util
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


B = load_module(os.path.join('scripts', 'build-sfx.py'), 'bsfx')
OUTDIR = os.path.join('scripts', 'out', '_tune')

# 现役三音的实测解码 RMS（上一轮 _build-r27.log 的回读行）——分摊判据的对照基准
OTHER_RMS = {'charge': -17.1, 'burst': -16.1, 'reveal': -17.2}
SPREAD_LIMIT = 3.0
PEAK_MARGIN = -1.0


def prep(raw_path, spec):
    a = B.load(raw_path)
    if spec['hpf']:
        a = B.highpass(a, spec['hpf'], spec['passes'])
    a = B.trim_silence(a)
    a = B.fit_duration(a, spec['target'], spec['fade_out'])
    return a


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    spec = B.SPECS['flip']
    base = spec['rms'] + B.TARGET_SHIFT_DB          # 现状设计目标 -16.5

    cands = sorted(glob.glob(os.path.join('scripts', 'out', '_exp', 'flip--*.mp3')))
    cands = [c for c in cands if 's2-' not in os.path.basename(c)]   # s2 已被判据淘汰
    if not cands:
        print('✗ 没有候选，先跑 _exp_sfx_prompts.py --only flip')
        return 2

    rows = []
    for c in cands:
        name = os.path.basename(c)[:-4].replace('flip--', '')
        a0 = prep(c, spec)
        for ceiling in (-2.8, -4.0):
            for delta in (0.0, -1.0, -2.0, -3.0):
                tg = base + delta
                norm = B.normalize(a0, tg, peak_ceiling_db=ceiling,
                                   allow_softclip=spec.get('clip', False))
                y = np.asarray(norm['y'], dtype=np.float32)
                out = os.path.join(OUTDIR, f'{name}--c{ceiling}_d{delta}.mp3')
                B.encode_mp3(y, 64, out)
                rt = B.load(out)
                pinned = int(np.sum(np.abs(rt) >= 0.9999995))
                rt_peak = 20 * np.log10(max(float(np.abs(rt).max()), 1e-12))
                rms_clean = 20 * np.log10(max(float(np.sqrt((B.trim_silence(rt).astype(np.float64) ** 2).mean())), 1e-12))
                g = B._GEN._gesture(y, B.SR)
                spread = max(list(OTHER_RMS.values()) + [rms_clean]) - min(list(OTHER_RMS.values()) + [rms_clean])
                rows.append({
                    'cand': name, 'ceiling': ceiling, 'delta': delta,
                    'target': round(tg, 1), 'rms': round(rms_clean, 1),
                    'peak': round(rt_peak, 2), 'pinned': pinned,
                    'crest': g['crest_db'], 'duty': g['duty_20'],
                    'frac': round((norm['soft_frac'] or 0.0) * 100, 2),
                    'gain': round(norm['gain_db'], 1),
                    'spread': round(spread, 1),
                    'dur': round(len(a0) / B.SR, 3),
                })

    hdr = (f'{"候选":>7s}{"ceil":>7s}{"delta":>7s}{"目标":>7s}{"解码RMS":>9s}{"解码峰":>8s}'
           f'{"钳位":>6s}{"crest":>7s}{"duty":>7s}{"削顶%":>7s}{"极差":>7s}  结论')
    print(hdr)
    print('-' * len(hdr))
    for r in rows:
        why = []
        if r['pinned']:
            why.append('钳位')
        if r['peak'] > PEAK_MARGIN:
            why.append(f"峰{r['peak']}>余量")
        if r['spread'] > SPREAD_LIMIT:
            why.append('极差超')
        verdict = '✓ 三条全过' if not why else '✗ ' + '+'.join(why)
        print(f"{r['cand']:>7s}{r['ceiling']:>7.1f}{r['delta']:>7.1f}{r['target']:>7.1f}"
              f"{r['rms']:>9.1f}{r['peak']:>8.2f}{r['pinned']:>6d}{r['crest']:>7.1f}"
              f"{r['duty']:>7.3f}{r['frac']:>7.2f}{r['spread']:>7.1f}  {verdict}")

    good = [r for r in rows if not r['pinned'] and r['peak'] <= PEAK_MARGIN and r['spread'] <= SPREAD_LIMIT]
    print()
    print(f'三条全过的组合：{len(good)}/{len(rows)}')
    for r in sorted(good, key=lambda r: (-r['crest'], r['duty']))[:6]:
        print(f"   {r['cand']} ceil {r['ceiling']} delta {r['delta']} → "
              f"RMS {r['rms']}dB · 峰 {r['peak']}dB · crest {r['crest']}dB · duty {r['duty']} "
              f"· 削顶 {r['frac']}% · 极差 {r['spread']}dB")
    if not good:
        print('   （无）→ 需要放宽其中一条，见输出里的失败原因分布')
    print('\n产物目录：' + OUTDIR)
    return 0


if __name__ == '__main__':
    sys.exit(main())
