"""拆开两个「被否掉」的音，看清它们的声学签名。

用户听感 → 要找的客观特征：
  charge「雷云滚滚」 → 低频墙 + 有没有拍频/AM 调制（「滚」的感觉来自包络起伏）
  burst 「电饭煲烧开」→ 是不是一段纯高频白噪（蒸汽 = 宽带噪声 + 起音瞬态）

目的：新提示词里「不要什么」要写成**具体的声学事件**，不是形容词。
"""
import sys

import miniaudio
import numpy as np


def load(path):
    dec = miniaudio.decode_file(
        path, output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1
    )
    return np.array(dec.samples, dtype=np.float32), dec.sample_rate


def report(path):
    x, sr = load(path)
    print(f'\n===== {path}  ({len(x)/sr:.2f}s @ {sr}Hz)')
    if x.size == 0:
        print('  EMPTY')
        return
    x = x - x.mean()

    # ── 包络调制：把 20~200Hz 之外的能量滤掉，只看低频墙的起伏 ──
    # 「滚滚」= 低频能量在缓慢起伏（0.5~8Hz 的 AM）。平稳的垫不会有这个。
    seg = x[: int(sr * 1.0)]
    env = np.abs(seg)
    k = max(1, int(sr * 0.005))
    env = np.convolve(env, np.ones(k) / k, mode='same')
    if len(env) > 16:
        e = env - env.mean()
        f = np.fft.rfft(e * np.hanning(len(e)))
        fr = np.fft.rfftfreq(len(e), 1 / sr)
        band = (fr >= 0.5) & (fr <= 12)
        if band.any():
            i = np.argmax(np.abs(f[band]))
            print(
                f'  包络调制峰 {fr[band][i]:.2f}Hz  '
                f'调制深度 {np.abs(f[band][i]) / (np.abs(f).sum() + 1e-9):.3f}'
            )
        # 低频墙的起伏量：包络的 std/mean
        print(f'  包络起伏(CV) {env.std()/ (env.mean()+1e-9):.3f}  (平稳垫≈0.1, 「滚滚」偏大)')

    # ── 低频段峰值分布：拍频＝两个很近的峰 ──
    n = min(len(x), sr * 2)
    spec = np.abs(np.fft.rfft(x[:n] * np.hanning(n)))
    fr = np.fft.rfftfreq(n, 1 / sr)
    lo = fr < 300
    s, f_ = spec[lo], fr[lo]
    order = np.argsort(s)[::-1][:5]
    print('  <300Hz 前 5 个谱峰:  ' + '  '.join(f'{f_[i]:.1f}Hz' for i in sorted(order)))
    tot = spec.sum() + 1e-12
    for a, b in [(20, 60), (60, 120), (120, 250), (250, 800), (800, 2500),
                 (2500, 6000), (6000, 12000), (12000, 20000)]:
        m = (fr >= a) & (fr < b)
        print(f'    {a:>5}-{b:<5}Hz  {spec[m].sum()/tot*100:5.1f}%')
    # 波峰因数
    print(f'  波峰因数 {20*np.log10(np.abs(x).max()/(np.sqrt((x**2).mean())+1e-9)):.1f}dB')


if __name__ == '__main__':
    for p in sys.argv[1:]:
        report(p)
