# -*- coding: utf-8 -*-
"""消融：逐级跑构建链，看「连续沙沙」到底是**素材**带来的，还是**流水线**制造的。

为什么要这么做（本项目踩过的坑）：从一张波形图反推「哪一层干的」会出错，
必须**逐级加步骤、各量一次**，看指标在哪一步跳变。这里的关键指标：

  duty_20  能量高于「峰值 -20dB」的时间占比 —— **一次动作 ≈ 低，持续噪声 ≈ 1.0**
  crest    峰值 - RMS（dB）。瞬态感：越高越「点」，越低越「糊成一片」
  n_onset  谱通量起始点数

纯诊断，不改任何文件、不调 API。
"""
import importlib.util
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


B = load_module(os.path.join('scripts', 'build-sfx.py'), 'bsfx')
G = load_module(os.path.join('scripts', 'gen-sfx-elevenlabs.py'), 'gen')


def metrics(a, sr=B.SR, label=''):
    if len(a) == 0:
        return {'label': label, 'dur_s': 0}
    rms = float(np.sqrt((a.astype(np.float64) ** 2).mean()))
    pk = float(np.abs(a).max())
    rms_db = 20 * np.log10(max(rms, 1e-12))
    pk_db = 20 * np.log10(max(pk, 1e-12))

    # duty：逐帧能量（10ms 窗 / 5ms 跳）
    win = max(1, int(sr * 0.010))
    hop = max(1, int(sr * 0.005))
    n = 1 + max(0, (len(a) - win) // hop)
    e = np.empty(n)
    for i in range(n):
        s = a[i * hop:i * hop + win].astype(np.float64)
        e[i] = (s ** 2).mean()
    e_db = 10 * np.log10(np.maximum(e, 1e-20))
    e_db -= e_db.max()
    duty = float((e_db > -20.0).mean())

    # 谱通量起始点
    nfft, hop2 = 1024, 256
    m = 1 + max(0, (len(a) - nfft) // hop2)
    if m > 4:
        w = np.hanning(nfft)
        mags = np.empty((m, nfft // 2 + 1))
        for i in range(m):
            mags[i] = np.abs(np.fft.rfft(a[i * hop2:i * hop2 + nfft] * w))
        nm = mags / (mags.max() or 1.0)
        flux = np.maximum(np.diff(nm, axis=0), 0).sum(axis=1)
        thr = flux.mean() + 2.0 * flux.std()
        idx = [i for i in range(len(flux)) if flux[i] > thr]
        onsets = []
        for i in idx:
            t = (i + 1) * hop2 / sr
            if onsets and t - onsets[-1] < 0.05:
                continue
            onsets.append(round(float(t), 3))
        # 最后一个起始点占总长的比例 —— 「动作是不是都在开头」
        last_ratio = round(onsets[-1] / (len(a) / sr), 3) if onsets else 0.0
    else:
        onsets, last_ratio = [], 0.0

    sp = G.measure and None
    return {
        'label': label,
        'dur_s': round(len(a) / sr, 3),
        'rms_db': round(rms_db, 1),
        'peak_db': round(pk_db, 1),
        'crest_db': round(pk_db - rms_db, 1),
        'duty_20': round(duty, 3),
        'n_onset': len(onsets),
        'onsets': onsets[:8],
        'last_onset_ratio': last_ratio,
    }


def show(rows):
    keys = ['dur_s', 'rms_db', 'peak_db', 'crest_db', 'duty_20', 'n_onset', 'last_onset_ratio']
    hdr = f'{"阶段":38s}' + ''.join(f'{k:>17s}' for k in keys)
    print(hdr)
    print('-' * len(hdr))
    for r in rows:
        print(f'{r["label"]:38s}' + ''.join(f'{str(r.get(k, "-")):>17s}' for k in keys))
        if r.get('onsets'):
            print(f'{"":38s} 起始点 {r["onsets"]}')


def main():
    raw = B.load(os.path.join('audio-src', 'sfx', '_raw', 'flip-raw.mp3'))
    spec = B.SPECS['flip']
    print(f'flip SPEC: {spec}')
    print(f'SR={B.SR}  PEAK_CEILING_DB={B.PEAK_CEILING_DB}  TARGET_SHIFT_DB={B.TARGET_SHIFT_DB}')
    print()

    rows = []
    rows.append(metrics(raw, label='S0 原始素材 (raw)'))

    a = B.highpass(raw, spec['hpf'], spec['passes'])
    rows.append(metrics(a, label=f'S1 + 高通 {spec["hpf"]}Hz x{spec["passes"]}'))

    a = B.trim_silence(a)
    rows.append(metrics(a, label='S2 + 去静音(≥-55dB)'))

    a = B.fit_duration(a, spec['target'], spec['fade_out'])
    rows.append(metrics(a, label=f'S3 + 对齐时长到 {spec["target"]}s'))

    rms_target = spec['rms'] + B.TARGET_SHIFT_DB
    norm = B.normalize(a, rms_target, allow_softclip=spec.get('clip', False))
    rows.append(metrics(norm['y'], label=f'S4 + RMS 归一到 {rms_target:.1f}dB ({norm["path"]})'))

    print('  normalize 明细: gain=%s dB, 削顶 %s dB, 被削样本 %s%%, pre_peak %s dB'
          % (round(norm['gain_db'], 1), norm['soft_clip_db'],
             round(norm['soft_frac'] * 100, 2), round(norm['pre_peak_db'], 1)))
    print()
    show(rows)

    print()
    print('=== 若把「只增不减」的增益换成纯增益（不做限幅）会怎样 ===')
    g = (10 ** (rms_target / 20)) / max(float(np.sqrt((raw.astype(np.float64) ** 2).mean())), 1e-9)
    rows2 = [metrics(np.clip(raw * g, -1.0, 1.0), label=f'raw × {20*np.log10(g):.1f}dB (纯增益, 硬裁到 ±1)')]
    show(rows2)
    print('  ↑ crest 明显更高 = 瞬态还在；duty 明显更低 = 不是「一片沙沙」')


if __name__ == '__main__':
    main()
