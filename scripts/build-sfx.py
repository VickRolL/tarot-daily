#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SFX 素材处理：AI 生成的原始音效 → 时长对齐、去泥、音量归一的成品 mp3
==========================================================================

为什么需要这一步（2026-09-20 第二十五轮）
----------------------------------------
aisounds.cn（ElevenLabs 引擎）产出的素材有三个通病，逐个有对策：

  ① **时长不可控**：时长只能选整数秒，1s 实际出 1.5s，且首尾带服务端的
     淡入淡出尾巴。→ 修剪静音（-55dB 阈值）后按 contract 目标时长截断，
     截断处给足淡出，避免「咔」。

  ② **发闷（低频泥）**：charge-raw 实测低频占比 0.97、频谱质心只有 102Hz ——
     模型把「蓄力」理解成了「低频嗡鸣」。这一版没法再花点数重生成
     （余额 140 点必须留给 burst/flip/reveal），所以用**高通滤波**救：
     一阶 HPF 级联两遍（12dB/oct），把 200Hz 以下压下去。
     判据用**质心**：滤波后质心必须显著上移，否则视为「救失败」仍报 FAIL。

  ③ **响度不一**：四段素材 RMS 各不相同，直接播会一段炸一段听不见。
     → RMS 归一到各自目标（-14 dBFS 附近），峰值顶到 -1.5 dBFS 封顶。

为什么每段一个 `--only` 而不是一次全跑：素材是分批到货的（限流），
到一段处理一段；已处理的跳过不覆盖，重复跑安全。

用法
----
    # 全部（_raw 里有什么处理什么）
    python scripts/build-sfx.py

    # 只处理某一个
    python scripts/build-sfx.py --only charge

    # 覆盖已存在的成品（改了参数后重跑）
    python scripts/build-sfx.py --only charge --force
"""

import argparse
import json
import os
import sys

import numpy as np

try:
    import miniaudio
except ImportError:
    sys.exit('缺少 miniaudio：python -m pip install miniaudio')

try:
    import lameenc
except ImportError:
    sys.exit('缺少 lameenc：python -m pip install lameenc')

# ---------------------------------------------------------------- 合同
# 与 audio-src/README.md 的四音合同保持一致。
#   target   成品目标时长（秒）：比 site 里实际用的略长或相等，超了截断
#   hpf      高通转折频率（Hz）；None 不滤。charge 的 102Hz 泥需要 180
#   passes   一阶 HPF 级联次数（2 = 12dB/oct）
#   rms      归一目标（dBFS）
#   fade_out 末尾淡出（秒）：截断处 / 自然结尾都用它防「咔」
#   trim     播放增益补偿（写进 sfx.js 的 TRIM，报告里带出去人工核对）
SPECS = {
    # 参数是扫出来的（180~360Hz × 2~3 级联，见 2026-09-20 会话记录）：
    # 240Hz×2 是「质心 623Hz / 低频占比 0.57」与「别滤成薄片」的平衡点；
    # passes=3 时峰值系数恶化到 ~20dB，同样响度下动态被压得没法听。
    'charge': {'target': 1.0, 'hpf': 240, 'passes': 2, 'rms': -14.0, 'fade_out': 0.08, 'trim': 1.4},
    'burst':  {'target': 1.5, 'hpf': 90,  'passes': 2, 'rms': -13.0, 'fade_out': 0.12, 'trim': 1.0},
    'flip':   {'target': 1.5, 'hpf': 120, 'passes': 2, 'rms': -14.0, 'fade_out': 0.10, 'trim': 1.0},
    'reveal': {'target': 5.0, 'hpf': 60,  'passes': 1, 'rms': -14.0, 'fade_out': 0.50, 'trim': 1.0},
}

RAW_DIR = os.path.join('audio-src', 'sfx', '_raw')
OUT_DIR = os.path.join('src', 'assets', 'audio', 'sfx')
REPORT = os.path.join('scripts', 'out', '_sfx_build.json')

SR = 44100


def db(x):
    return float(20 * np.log10(max(float(x), 1e-10)))


def load(path):
    d = miniaudio.decode_file(
        path,
        output_format=miniaudio.SampleFormat.FLOAT32,
        nchannels=1,
        sample_rate=SR,
    )
    return np.frombuffer(d.samples, dtype=np.float32).copy()


def highpass(a, fc, passes):
    """一阶 HPF 级联。y[n] = α·(y[n-1] + x[n] - x[n-1])，逐样本 IIR。

    numpy 下用循环太慢，改写成「累积差分」的向量化等价形式不可行（IIR 有反馈），
    但 SFX 都只有几秒钟（≤22 万样本），纯 Python 循环 <1s，可以接受。
    """
    rc = 1.0 / (2.0 * np.pi * fc)
    dt = 1.0 / SR
    alpha = rc / (rc + dt)
    y = a
    for _ in range(passes):
        out = np.empty_like(y)
        prev_y = 0.0
        prev_x = 0.0
        for i in range(len(y)):
            out[i] = alpha * (prev_y + y[i] - prev_x)
            prev_y = out[i]
            prev_x = y[i]
        y = out
    return y


def trim_silence(a, th_db=-55.0, pad_s=0.02):
    """首尾静音修剪。阈值相对**峰值**而不是绝对值——归一前电平不可知。"""
    peak = float(np.abs(a).max())
    th = peak * (10 ** (th_db / 20))
    idx = np.nonzero(np.abs(a) > th)[0]
    if len(idx) == 0:
        return a
    pad = int(SR * pad_s)
    lo = max(0, int(idx[0]) - pad)
    hi = min(len(a), int(idx[-1]) + 1 + pad)
    return a[lo:hi].copy()


def fit_duration(a, target, fade_out):
    """超过目标时长就截断，截断处 + 自然结尾都给淡出。"""
    n = int(SR * target)
    if len(a) > n:
        a = a[:n].copy()
    fo = int(SR * fade_out)
    if fo > 0 and fo < len(a):
        a[-fo:] *= np.linspace(1.0, 0.0, fo, dtype=np.float32)
    fi = int(SR * 0.005)
    if fi < len(a):
        a[:fi] *= np.linspace(0.0, 1.0, fi, dtype=np.float32)
    return a


def normalize(a, rms_target_db, peak_ceiling_db=-1.5):
    """RMS 归一 + 峰值封顶。两个约束取更严的那个。"""
    rms = float(np.sqrt(np.mean(a ** 2)))
    peak = float(np.abs(a).max())
    g_rms = (10 ** (rms_target_db / 20)) / max(rms, 1e-9)
    g_peak = (10 ** (peak_ceiling_db / 20)) / max(peak, 1e-9)
    g = min(g_rms, g_peak)
    return a * g, db(g)


def spectral_metrics(a, nfft=4096):
    """频谱质心 + 低频（<200Hz）能量占比 —— 「泥」的两个客观判据。"""
    if len(a) < nfft:
        nfft = 1 << (len(a).bit_length() - 1)
    seg = a[: nfft] * np.hanning(nfft)
    mag = np.abs(np.fft.rfft(seg))
    freqs = np.fft.rfftfreq(nfft, 1 / SR)
    total = float(mag.sum())
    if total < 1e-9:
        return float('nan'), float('nan')
    centroid = float((freqs * mag).sum() / total)
    low_ratio = float(mag[freqs < 200].sum() / total)
    return centroid, low_ratio


def encode_mp3(samples, kbps, out_path):
    e = lameenc.Encoder()
    e.set_vbr(lameenc.VBR_ABR)
    e.set_vbr_mean_bitrate_kbps(int(kbps))
    e.set_quality(2)
    e.set_in_sample_rate(SR)
    e.set_channels(1)
    pcm = np.clip(samples, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype('<i2')
    data = e.encode(pcm.tobytes()) + bytes(e.flush())
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, 'wb') as f:
        f.write(data)
    return len(data)


def build_one(name, spec, kbps):
    raw = os.path.join(RAW_DIR, f'{name}-raw.mp3')
    out = os.path.join(OUT_DIR, f'{name}.mp3')
    if not os.path.exists(raw):
        return None

    a = load(raw)
    raw_dur = len(a) / SR
    raw_centroid, raw_low = spectral_metrics(a)

    if spec['hpf']:
        a = highpass(a, spec['hpf'], spec['passes'])
    a = trim_silence(a)
    a = fit_duration(a, spec['target'], spec['fade_out'])
    a, gain_db = normalize(a, spec['rms'])

    size = encode_mp3(a, kbps, out)
    out_centroid, out_low = spectral_metrics(a)
    out_dur = len(a) / SR

    # 「救泥」判据：滤波后质心必须上移 ≥ 1.5 倍，且低频占比明显回落。
    rescued = spec['hpf'] is None or (out_centroid > raw_centroid * 1.5 and out_low < 0.6)

    return {
        'name': name,
        'src': raw,
        'out': out,
        'out_bytes': size,
        'out_kb': round(size / 1024, 1),
        'raw_dur': round(raw_dur, 2),
        'out_dur': round(out_dur, 2),
        'target_dur': spec['target'],
        'hpf': spec['hpf'],
        'applied_gain_db': round(gain_db, 1),
        'out_peak_db': round(db(float(np.abs(a).max())), 1),
        'out_rms_db': round(db(float(np.sqrt(np.mean(a ** 2)))), 1),
        'raw_centroid_hz': round(raw_centroid, 0),
        'out_centroid_hz': round(out_centroid, 0),
        'raw_low_ratio': round(raw_low, 2),
        'out_low_ratio': round(out_low, 2),
        'trim': spec['trim'],
        'PASS_rescued': bool(rescued),
    }


def main():
    p = argparse.ArgumentParser(description='AI 原始音效 → 成品 mp3')
    p.add_argument('--only', help='只处理这一个（charge/burst/flip/reveal）')
    p.add_argument('--force', action='store_true', help='覆盖已存在的成品')
    p.add_argument('--kbps', type=int, default=64, help='ABR 码率（默认 64，SFX 要比 BGM 干净）')
    args = p.parse_args()

    os.makedirs('scripts/out', exist_ok=True)
    old = []
    if os.path.exists(REPORT):
        with open(REPORT, 'r', encoding='utf-8') as f:
            old = json.load(f)
    by_name = {r['name']: r for r in old}

    results = list(old)
    for name, spec in SPECS.items():
        if args.only and name != args.only:
            continue
        out = os.path.join(OUT_DIR, f'{name}.mp3')
        if os.path.exists(out) and not args.force:
            print(f'= {name}: 成品已存在，跳过（--force 覆盖）')
            continue
        r = build_one(name, spec, args.kbps)
        if r is None:
            print(f'- {name}: 无原始素材（{RAW_DIR}/{name}-raw.mp3），等生成后重跑')
            continue
        by_name[name] = r
        print(f"→ {r['out']}")
        print(
            f"   {r['raw_dur']}s → {r['out_dur']}s（目标 {r['target_dur']}s）  "
            f"体积 {r['out_kb']}KB  增益 {r['applied_gain_db']:+.1f}dB"
        )
        print(
            f"   质心 {r['raw_centroid_hz']:.0f}Hz → {r['out_centroid_hz']:.0f}Hz  "
            f"低频占比 {r['raw_low_ratio']} → {r['out_low_ratio']}"
        )
        print(f"   救泥判据：{'PASS' if r['PASS_rescued'] else 'FAIL 仍发闷，考虑重生成'}")

    results = [by_name[n] for n in SPECS if n in by_name]
    with open(REPORT, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    have_raw = [n for n in SPECS if os.path.exists(os.path.join(RAW_DIR, f'{n}-raw.mp3'))]
    done = [n for n in have_raw if os.path.exists(os.path.join(OUT_DIR, f'{n}.mp3'))]
    print(f"\n素材 {len(have_raw)}/4 到货，成品 {len(done)}/4 就位：{done or '[]'}")
    rescue_fail = [r['name'] for r in results if not r['PASS_rescued']]
    ok = len(rescue_fail) == 0
    print(f"ALL_PASS {str(ok).lower()}")
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
