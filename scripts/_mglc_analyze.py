"""量一量芒果灵创生成的四段音频到底是什么形态。

听不见声音时的判据设计（每条都对应一个具体故障）：
  duration       —— score 模式到底产不产短音效？短音效该 < 3s，音乐该 > 60s
  dynamicRange   —— P95(dB) - P5(dB)。持续 drone 应当很窄（< 10dB），
                    有起伏的曲子会宽（> 20dB）—— 判「是不是一首曲子」
  onsetRate      —— 每秒有多少帧的短时能量比前一帧抬升 > 6dB。
                    节拍密集的曲子高，氛围音接近 0 —— 判「背后有没有鼓」
  centroid       —— 频谱质心。氛围/幽暗应当低（< 1200Hz），
                    亮而密的编曲会高 —— 判「是不是偏亮、偏热闹」
  lowRatio       —— 250Hz 以下能量占比 —— 判「有没有低频底子」

所有阈值都是先量后定，不预设结论。
"""
import json
import os

import miniaudio
import numpy as np

FILES = [
    ('ambient-01_1', 'scripts/out/mglc/ambient-01_1.mp3'),
    ('ambient-01_2', 'scripts/out/mglc/ambient-01_2.mp3'),
    ('sfx-test_1', 'scripts/out/mglc/sfx-test_1.mp3'),
    ('sfx-test_2', 'scripts/out/mglc/sfx-test_2.mp3'),
]

ENV_POINTS = 160


def analyze(path):
    dec = miniaudio.decode_file(
        path,
        output_format=miniaudio.SampleFormat.FLOAT32,
        nchannels=1,
    )
    sr = dec.sample_rate
    x = np.array(dec.samples, dtype=np.float32)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if x.size == 0:
        return None

    dur = len(x) / sr

    frame = max(1, int(sr * 0.05))
    n = len(x) // frame
    rms = np.sqrt((x[: n * frame].reshape(n, frame) ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-12)
    drange = float(np.percentile(db, 95) - np.percentile(db, 5))
    peak_db = float(np.percentile(db, 99))

    diff = np.diff(db)
    onsets = int((diff > 6).sum())

    seg = x[len(x) // 2: len(x) // 2 + sr * 10]
    if len(seg) < 1024:
        seg = x
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
    freqs = np.fft.rfftfreq(len(seg), 1 / sr)
    centroid = float((spec * freqs).sum() / (spec.sum() + 1e-12))
    low_ratio = float(spec[freqs < 250].sum() / (spec.sum() + 1e-12))
    mid_ratio = float(spec[(freqs >= 250) & (freqs < 2000)].sum() / (spec.sum() + 1e-12))
    high_ratio = float(spec[freqs >= 4000].sum() / (spec.sum() + 1e-12))

    idx = np.linspace(0, len(x), ENV_POINTS + 1).astype(int)
    env = np.array([
        float(np.sqrt((x[idx[i]:max(idx[i] + 1, idx[i + 1])] ** 2).mean() + 1e-12))
        for i in range(ENV_POINTS)
    ])
    env_db = 20 * np.log10(env + 1e-12)
    env_db = env_db - env_db.max()

    return {
        'duration_s': round(dur, 2),
        'dynamicRange_dB': round(drange, 1),
        'peak_dB': round(peak_db, 1),
        'onsets': onsets,
        'onsetRate_per_s': round(onsets / dur, 3) if dur else 0,
        'centroid_Hz': round(centroid, 1),
        'low_lt250': round(low_ratio, 3),
        'mid_250_2000': round(mid_ratio, 3),
        'high_gt4000': round(high_ratio, 3),
        'envelope_dB': [round(float(v), 1) for v in env_db],
    }


def main():
    out = {}
    for name, path in FILES:
        if not os.path.exists(path):
            print(f'{name:14s} MISSING')
            continue
        m = analyze(path)
        out[name] = m
        if not m:
            print(f'{name:14s} DECODE-FAILED')
            continue
        print(
            f'{name:14s} dur={m["duration_s"]:7.2f}s  '
            f'dyn={m["dynamicRange_dB"]:5.1f}dB  '
            f'onset={m["onsets"]:4d} ({m["onsetRate_per_s"]:5.2f}/s)  '
            f'centroid={m["centroid_Hz"]:7.1f}Hz  '
            f'low={m["low_lt250"]:.2f} mid={m["mid_250_2000"]:.2f} high={m["high_gt4000"]:.3f}'
        )
    with open('scripts/out/_mglc_analysis.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('saved scripts/out/_mglc_analysis.json')


if __name__ == '__main__':
    main()
