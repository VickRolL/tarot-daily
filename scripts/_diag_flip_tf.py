# -*- coding: utf-8 -*-
"""flip 的时频诊断：这些包络峰到底是「一次动作的纹理」还是「多次分开的动作」。

判据思路（用消融、不用单图反推）：
  · 「一次动作」= 所有能量峰都长在**同一条宽带起始**之后，中间没有回到静音；
  · 「多次动作」= 能量回落到接近静音（-40dB 以下）后又**重新起始**。

所以量两件东西：
  A. 谱通量 (spectral flux) 的起始点 —— 每次「擦碰」都会推一次通量
  B. 每个起始点之前的**静音间隙** —— 只要有 >60ms 的深谷，就说明是两次动作
  C. 顺手量一下「哗啦」感：高频宽带的持续时间（翻书 vs 一张牌）
"""
import os
import sys
import json

import numpy as np
import miniaudio


def load(path):
    d = miniaudio.decode_file(path, output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1)
    return np.array(d.samples, dtype=np.float32), d.sample_rate


def stft(x, sr, nfft=1024, hop=128):
    w = np.hanning(nfft).astype(np.float64)
    n = 1 + max(0, (len(x) - nfft) // hop)
    mags = np.empty((n, nfft // 2 + 1), dtype=np.float64)
    for i in range(n):
        s = x[i * hop:i * hop + nfft].astype(np.float64) * w
        mags[i] = np.abs(np.fft.rfft(s))
    freqs = np.fft.rfftfreq(nfft, 1.0 / sr)
    times = (np.arange(n) * hop + nfft / 2.0) / sr
    return times, freqs, mags


def frame_db(mags):
    e = (mags ** 2).sum(axis=1)
    db = 10.0 * np.log10(np.maximum(e, 1e-20))
    return db - db.max()


def main():
    path = os.path.join('audio-src', 'sfx', '_raw', 'flip-raw.mp3')
    x, sr = load(path)
    times, freqs, mags = stft(x, sr, nfft=1024, hop=128)
    db = frame_db(mags)
    dt = times[1] - times[0]
    print(f'文件 {path}  时长 {len(x)/sr:.3f}s  sr={sr}  帧长 {dt*1000:.1f}ms  共 {len(times)} 帧')

    # ── A. 逐帧能量曲线（1ms 级），看有没有回到静音 ──────────────────────
    print('\n[A] 逐帧能量（每格 ≈ {:.0f}ms；# >-3dB, = >-8, - >-15, . >-25, _ >-40, 空 <-40）'.format(dt * 1000))
    step = max(1, int(0.02 / dt))
    line = ''
    for i in range(0, len(db), step):
        v = db[i]
        line += '#' if v > -3 else '=' if v > -8 else '-' if v > -15 else '.' if v > -25 else '_' if v > -40 else ' '
    print('  |' + line + '|')

    # 深谷统计：低于 -40dB 的连续区段（= 真的静音，动作之间才会出现）
    silent = db < -40.0
    runs = []
    i = 0
    while i < len(silent):
        if silent[i]:
            j = i
            while j < len(silent) and silent[j]:
                j += 1
            runs.append((times[i], times[j - 1], (j - i) * dt))
            i = j
        else:
            i += 1
    print(f'\n[B] 静音段（<-40dB）：{len(runs)} 段')
    for a, b, d in runs:
        print(f'      {a:.3f}s ~ {b:.3f}s  长 {d*1000:.0f}ms' + ('   ← 够长，会被听成「两次动作」' if d > 0.06 else ''))

    # ── C. 谱通量起始点 ────────────────────────────────────────────────
    norm = mags / (np.abs(mags).max() or 1.0)
    flux = np.maximum(np.diff(norm, axis=0), 0.0).sum(axis=1)
    thr = flux.mean() + 2.0 * flux.std()
    onsets = [times[i + 1] for i in range(len(flux)) if flux[i] > thr]
    merged = []
    for o in onsets:
        if merged and o - merged[-1] < 0.04:
            continue
        merged.append(o)
    print(f'\n[C] 谱通量起始点（阈值 mean+2σ）：{len(merged)} 个')
    print('     ', [round(o, 3) for o in merged])
    if len(merged) >= 2:
        gaps = [round(merged[i + 1] - merged[i], 3) for i in range(len(merged) - 1)]
        print('      间隔:', gaps)

    # ── D. 高频「哗啦」持续时间 ────────────────────────────────────────
    hi = mags[:, freqs >= 3000].sum(axis=1) / (mags.sum(axis=1) + 1e-20)
    hi_db = db
    # 高频能量高于其自身峰值 -20dB 的帧，视为「哗啦」在响
    hi_e = mags[:, freqs >= 3000].sum(axis=1) ** 2
    hi_e_db = 10 * np.log10(np.maximum(hi_e, 1e-20))
    hi_e_db -= hi_e_db.max()
    loud = hi_e_db > -20.0
    total = loud.sum() * dt
    print(f'\n[D] 高频(>3kHz)能量在 -20dB 内的持续时长：{total*1000:.0f}ms'
          f'（这一段就是「翻书/哗啦」的质感来源）')
    print(f'    高频能量占比（全片平均）：{float(hi.mean()):.3f}')

    # ── E. 峰值前后的时间结构 ─────────────────────────────────────────
    i_pk = int(np.argmax(db))
    print(f'\n[E] 全局能量峰在 {times[i_pk]:.3f}s；其前 200ms 内的最低点：', end='')
    lo = i_pk - int(0.2 / dt)
    lo = max(0, lo)
    print(f'{db[lo:i_pk+1].min():.1f}dB（若无深谷，说明峰前能量是连续的）')

    with open(os.path.join('scripts', 'out', '_flip_tf.json'), 'w', encoding='utf-8') as f:
        json.dump({
            'silent_runs': [[round(a, 3), round(b, 3), round(d, 3)] for a, b, d in runs],
            'onsets': [round(o, 3) for o in merged],
            'hi_dur_s': round(float(total), 3),
            'hi_ratio': round(float(hi.mean()), 4),
        }, f, ensure_ascii=False, indent=2)
    print('\n→ scripts/out/_flip_tf.json')


if __name__ == '__main__':
    main()
