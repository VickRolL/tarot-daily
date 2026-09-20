#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BGM 素材处理：AI 生成的「长氛围曲」→ 可无缝循环的短循环 → 体积可控的 mp3
==========================================================================

为什么需要这一步
----------------
AI 音乐服务（芒果灵创 Mureka / AiSounds 等）只出**整首曲子**，两三分钟、
三到四 MB。直接拿它当网页 BGM 有三个问题：

  ① **体积**：3.3 MB 比站里任何一张卡牌图都大（图 ~300 KB）。BGM 是「背景」，
     不该比主角重。
  ② **接缝**：一首曲子首尾电平不同、调性不同，`<audio loop>` 回去会「咔」一下。
     更糟的是**首尾内容不连续**：不是电平问题，是音乐本身断掉了。
  ③ **长度**：一首 3 分半的曲子对网页太长 —— 用户根本待不到它放完。

本脚本用「**等功率交叉淡化**」一次解决②③：
    取 `L + X` 秒的素材，输出 `L` 秒，把**尾部 X 秒淡出的同时叠上头 X 秒淡入**。
    数学上保证 `out[L-1] → out[0]` 与 `out[X-1] → out[X]` 两处都连续 ——
    接缝不是「听不出来」，是**根本不存在**（输出本身就是一个闭合的环）。

    ⚠️ 所以**不能**在循环的两端加淡入淡出。那会让每一圈都在音量上「喘一口气」，
       比接缝还明显。淡化只发生在环的**内部**（那个 X 秒的交叠区）。

并顺手解决①：单声道 + VBR 编码。这里有个反直觉的点 ——
**单声道不会丢掉空间感**。站内的环境音要送进 engine.js 那条程序生成的
**立体声**混响，左右声道由 IR 去相关产生，宽度来自混响而不是源。
所以源用单声道：省一半体积，空间感一点不损失，还避免低码率立体声的
「水声」（joint stereo 在 40kbps 下会有明显的相位摆动）。

选窗策略
--------
不是随便截一段。脚本在候选起点上扫一遍，用**接缝残差**打分：
对每个候选起点算「尾部 X 秒」与「头部 X 秒」的差异（同长度逐样本比），
差异越小，交叉淡化后残留的痕迹越小。取最小的那个起点。
`--start` 可人工指定，用于覆盖。

用法
----
    # 只看指标，不写文件（先判断这段素材值不值得用）
    python scripts/build-ambient.py scripts/out/mglc/ambient-01_1.mp3 --probe

    # 产出循环片段
    python scripts/build-ambient.py 输入.mp3 -o src/assets/audio/ambient.mp3 \\
        --loop 60 --xfade 3.5 --kbps 48

    # 两个变体各出一份，对比体积与接缝质量
    python scripts/build-ambient.py a.mp3 b.mp3 --probe
"""

import argparse
import json
import os
import subprocess
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


# ---------------------------------------------------------------- 解码

def load(path, sr=44100, channels=1):
    """解码任意音频（mp3/wav/flac/ogg…）为 float32 数组，形状 (帧数, 声道数)。

    miniaudio 自己会做重采样与声道转换（下混），所以这里不需要再写 DSP。
    """
    d = miniaudio.decode_file(
        path,
        output_format=miniaudio.SampleFormat.FLOAT32,
        nchannels=channels,
        sample_rate=sr,
    )
    a = np.frombuffer(d.samples, dtype=np.float32)
    a = a.reshape(-1, d.nchannels).copy()
    return a, d.sample_rate, d.nchannels


def db(x):
    """线性幅度 → dBFS（带下限保护，静音时返回 -200 而不是 -inf）"""
    return float(20 * np.log10(max(float(x), 1e-10)))


# ---------------------------------------------------------------- 分析

def frame_rms(a, sr, hop_ms=50):
    """短时 RMS 包络（单声道求和后算）"""
    mono = a.mean(axis=1) if a.ndim > 1 else a
    hop = max(1, int(sr * hop_ms / 1000))
    n = len(mono) // hop
    if n < 2:
        return np.array([float(np.sqrt(np.mean(mono ** 2) + 1e-20))]), hop
    f = mono[: n * hop].reshape(n, hop)
    return np.sqrt((f ** 2).mean(axis=1) + 1e-20), hop


def spectral_centroid(a, sr, frames=24, nfft=8192):
    """频谱质心（Hz）：粗略的「亮/暗」指标。越低越暗。

    这是「幽暗」这个形容词唯一能客观化的地方 —— 没有它，
    「A 比 B 暗」只能靠感觉说。
    """
    mono = a.mean(axis=1) if a.ndim > 1 else a
    if len(mono) < nfft:
        return float('nan')
    idx = np.linspace(0, len(mono) - nfft - 1, frames).astype(int)
    win = np.hanning(nfft)
    freqs = np.fft.rfftfreq(nfft, 1 / sr)
    acc, wsum = 0.0, 0.0
    for i in idx:
        seg = mono[i : i + nfft] * win
        mag = np.abs(np.fft.rfft(seg))
        s = mag.sum()
        if s > 1e-9:
            acc += float((freqs * mag).sum() / s) * s
            wsum += s
    return acc / wsum if wsum > 0 else float('nan')


def jump_rate(a, sr, hop_ms=50):
    """能量跳变率（次/秒）：包络上超过中位数 1.6 倍的「上行事件」的密度。

    环境音要的是「一层垫」，不是「一首曲子」。这个数能区分二者：
    0.6~0.9 说明背后有音符/事件在走（是曲子），越低越接近纯氛围层。
    """
    env, hop = frame_rms(a, sr, hop_ms)
    if len(env) < 4:
        return 0.0
    med = float(np.median(env))
    up = (env[1:] > env[:-1] * 1.6) & (env[1:] > med * 1.6)
    secs = len(env) * hop / sr
    return float(up.sum() / secs) if secs > 0 else 0.0


def dynamic_range_db(a, sr, hop_ms=100):
    """动态范围 = 第 95 百分位 - 第 10 百分位的包络电平（dB）"""
    env, _ = frame_rms(a, sr, hop_ms)
    if len(env) < 8:
        return 0.0
    hi = float(np.percentile(env, 95))
    lo = float(np.percentile(env, 10))
    return db(hi) - db(lo)


# ---------------------------------------------------------------- 选窗与成环

def seam_cost(a, sr, start, ln, xfade):
    """候选起点的接缝残差：尾部 X 秒与头部 X 秒的逐样本平均绝对差。

    越小说明「尾」和「头」越像 → 交叉淡化越听不出来。
    用**相关**而不是纯差值更能反映「叠起来会不会抵消/打架」：
    这里取归一化差的均值，避免电平小的段落天然占优。
    """
    x = int(sr * xfade)
    h = a[start : start + x]
    t = a[start + int(sr * ln) : start + int(sr * ln) + x]
    n = min(len(h), len(t))
    if n < x // 2:
        return float('inf')
    h, t = h[:n], t[:n]
    scale = max(float(np.sqrt(np.mean(h ** 2))), float(np.sqrt(np.mean(t ** 2))), 1e-6)
    return float(np.mean(np.abs(h - t)) / scale)


def pick_start(a, sr, ln, xfade, skip_head=8.0, skip_tail=10.0, step_s=1.0):
    """在可用区间里扫一遍，取接缝残差最小的起点。返回 (起点秒, 残差, 扫描次数)"""
    total = len(a) / sr
    lo = skip_head
    hi = total - ln - xfade - skip_tail
    if hi <= lo:
        return None, float('inf'), 0
    best, best_cost, n = lo, float('inf'), 0
    s = lo
    while s <= hi:
        c = seam_cost(a, sr, int(s * sr), ln, xfade)
        n += 1
        if c < best_cost:
            best, best_cost = s, c
        s += step_s
    return best, best_cost, n


def make_loop(a, sr, start_s, ln, xfade):
    """等功率交叉淡化成环。

        out[i]      = buf[i]*sin(t·π/2) + buf[L+i]*cos(t·π/2)   , i < X
        out[i]      = buf[i]                                     , X ≤ i < L

    连续性：out[0] = buf[L]（fadeIn=0），而循环回去时 out[L-1] = buf[L-1]，
    所以 out[L-1] → out[0] 就是 buf[L-1] → buf[L] —— 源素材里本来就连续。
    另一端同理：out[X-1] = buf[X-1]，与 out[X] = buf[X] 相接。
    """
    x = int(sr * xfade)
    L = int(sr * ln)
    s = int(start_s * sr)
    buf = a[s : s + L + x]
    if len(buf) < L + x:
        raise SystemExit(
            f'素材不够长：需要 {start_s + ln + xfade:.1f}s，实际全长 {len(a)/sr:.1f}s'
        )
    out = buf[:L].copy()
    t = np.linspace(0.0, 1.0, x, dtype=np.float32)
    fi = np.sin(t * np.pi / 2).astype(np.float32)   # 淡入（等功率）
    fo = np.cos(t * np.pi / 2).astype(np.float32)   # 淡出（等功率）
    if out.ndim > 1:
        fi = fi[:, None]
        fo = fo[:, None]
    out[:x] = buf[:x] * fi + buf[L : L + x] * fo
    return out


def verify_loop(out, sr):
    """验证「环上真的没有接缝」。

    做法：把输出接三遍，在接缝附近取一小段，算逐样本最大跳变；
    与全曲 99.9 百分位的跳变比。**判据是「接缝处不比别处更陡」**，
    而不是「跳变很小」—— 素材本身可能是亮音色，逐样本跳变天然就大。
    """
    flat = out.reshape(-1) if out.ndim == 1 else out.mean(axis=1)
    three = np.tile(flat, 3)
    d = np.abs(np.diff(three))
    L = len(flat)
    win = int(sr * 0.030)  # 接缝前后各 30ms
    seams = []
    for k in (1, 2):
        at = k * L
        seg = d[max(0, at - win) : at + win]
        seams.append(float(seg.max()) if len(seg) else 0.0)
    base = float(np.percentile(d, 99.9))
    worst = max(seams)
    return {
        'seam_max_delta': worst,
        'baseline_p999_delta': base,
        'seam_ratio': (worst / base) if base > 0 else float('inf'),
    }


# ---------------------------------------------------------------- 编码

def encode_mp3(samples, sr, kbps, out_path):
    """单声道 ABR mp3。

    ⚠️ `set_vbr()` 收的是**模式常量**，不是布尔值 —— 传 `1` 会抛
       `RuntimeError: Invalid mode`。可用：VBR_OFF=0 / VBR_RH=2 / VBR_ABR=3 / VBR_MTRH=4。

    这里选 `VBR_ABR`（平均码率）而不是 `VBR_MTRH`（最高质量）或 `set_vbr_quality`：
    前者的体积**可以预测**（BGM 有体积预算，得能事前算），后两者只能事后称重。
    """
    e = lameenc.Encoder()
    e.set_vbr(lameenc.VBR_ABR)
    e.set_vbr_mean_bitrate_kbps(int(kbps))
    e.set_quality(2)
    e.set_in_sample_rate(int(sr))
    e.set_channels(1 if samples.ndim == 1 else samples.shape[1])
    mono = samples.reshape(-1) if samples.ndim == 1 else samples.mean(axis=1)
    pcm = np.clip(mono, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype('<i2')
    data = e.encode(pcm.tobytes()) + bytes(e.flush())
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, 'wb') as f:
        f.write(data)
    return len(data)


# ---------------------------------------------------------------- 主流程

def probe(path, sr=44100):
    a, real_sr, ch = load(path, sr=sr, channels=1)
    env, _ = frame_rms(a, sr)
    return {
        'file': os.path.basename(path),
        'bytes': os.path.getsize(path),
        'sample_rate': real_sr,
        'duration_s': round(len(a) / sr, 1),
        'peak_dB': round(db(np.abs(a).max()), 1),
        'rms_dB': round(db(np.sqrt(np.mean(a ** 2))), 1),
        'centroid_Hz': round(spectral_centroid(a, sr), 0),
        'dyn_range_dB': round(dynamic_range_db(a, sr), 1),
        'jumps_per_s': round(jump_rate(a, sr), 2),
    }


def build(src, out, ln, xfade, kbps, sr, start=None, skip_head=8.0, skip_tail=10.0):
    a, _, _ = load(src, sr=sr, channels=1)
    total = len(a) / sr
    if total < ln + xfade + 4:
        raise SystemExit(f'{src}: 全长 {total:.1f}s，放不下 {ln}s 循环 + {xfade}s 交叠')

    if start is None:
        start, cost, n = pick_start(a, sr, ln, xfade, skip_head, skip_tail)
        if start is None:
            raise SystemExit(f'{src}: 找不到可用起点（head/tail 保护太严？）')
        picked = f'自动（扫描 {n} 个候选，残差最小）'
    else:
        cost = seam_cost(a, sr, int(start * sr), ln, xfade)
        picked = '人工指定'

    loop = make_loop(a, sr, start, ln, xfade)

    peak = float(np.abs(loop).max())
    target_peak = 10 ** (-3.0 / 20)   # -3 dBFS：留出编码器的余量，避免削顶
    gain = target_peak / peak if peak > 0 else 1.0
    loop = loop * gain

    size = encode_mp3(loop, sr, kbps, out)
    v = verify_loop(loop, sr)

    return {
        'src': os.path.basename(src),
        'out': out,
        'out_bytes': size,
        'out_kb': round(size / 1024, 1),
        'out_peak_dB': round(db(np.abs(loop).max()), 1),
        'out_rms_dB': round(db(np.sqrt(np.mean(loop ** 2))), 1),
        'loop_s': ln,
        'xfade_s': xfade,
        'start_s': round(start, 1),
        'start_how': picked,
        'seam_cost': round(cost, 4),
        'applied_gain_dB': round(db(gain), 1),
        'seam_max_delta': round(v['seam_max_delta'], 5),
        'baseline_p999': round(v['baseline_p999_delta'], 5),
        'seam_ratio': round(v['seam_ratio'], 3),
        'PASS_no_seam': v['seam_ratio'] <= 1.25,
    }


def main():
    p = argparse.ArgumentParser(description='AI 长氛围曲 → 无缝循环 mp3')
    p.add_argument('inputs', nargs='+', help='输入音频（可多个）')
    p.add_argument('-o', '--out', help='输出路径（仅单个输入时可用）')
    p.add_argument('--loop', type=float, default=60.0, help='循环长度（秒，默认 60）')
    p.add_argument('--xfade', type=float, default=3.5, help='交叉淡化长度（秒，默认 3.5）')
    p.add_argument('--kbps', type=int, default=48, help='VBR 平均码率（默认 48）')
    p.add_argument('--sr', type=int, default=44100, help='输出采样率（默认 44100）')
    p.add_argument('--start', type=float, help='人工指定起点（秒）')
    p.add_argument('--skip-head', type=float, default=8.0, help='开头保护（秒，避开淡入）')
    p.add_argument('--skip-tail', type=float, default=10.0, help='结尾保护（秒，避开淡出）')
    p.add_argument('--probe', action='store_true', help='只打印指标，不产出文件')
    p.add_argument('--json', help='把结果写到这个 json')
    args = p.parse_args()

    if args.probe:
        rows = [probe(f, args.sr) for f in args.inputs]
        print('=== 素材形态（判断「是氛围层还是曲子」）===')
        print(f'{"文件":24s} {"时长":>7s} {"质心":>7s} {"动态":>7s} {"跳变":>6s} {"峰值":>7s}')
        for r in rows:
            print(
                f'{r["file"]:24s} {r["duration_s"]:>6.1f}s {r["centroid_Hz"]:>6.0f}Hz '
                f'{r["dyn_range_dB"]:>6.1f}dB {r["jumps_per_s"]:>5.2f}/s {r["peak_dB"]:>6.1f}dB'
            )
        # 顺势给出选窗预览，省得再跑一次
        print()
        print('=== 选窗预览（按接缝残差最小）===')
        for f in args.inputs:
            a, _, _ = load(f, sr=args.sr, channels=1)
            s, c, n = pick_start(a, args.sr, args.loop, args.xfade, args.skip_head, args.skip_tail)
            if s is None:
                print(f'  {os.path.basename(f):24s} 无可用起点')
            else:
                print(
                    f'  {os.path.basename(f):24s} 起点 {s:6.1f}s  '
                    f'残差 {c:.4f}  （扫了 {n} 个候选）'
                )
        if args.json:
            with open(args.json, 'w', encoding='utf-8') as fp:
                json.dump(rows, fp, ensure_ascii=False, indent=2)
        return 0

    if len(args.inputs) > 1 and args.out:
        sys.exit('多个输入时不能用 -o（会互相覆盖）。逐个跑，或省略 -o 自动命名。')

    results = []
    for f in args.inputs:
        if args.out:
            out = args.out
        else:
            base = os.path.splitext(os.path.basename(f))[0]
            out = os.path.join('src/assets/audio', f'{base}-loop.mp3')
        r = build(f, out, args.loop, args.xfade, args.kbps, args.sr,
                  args.start, args.skip_head, args.skip_tail)
        results.append(r)
        print(f'→ {r["out"]}')
        print(f'   {r["loop_s"]:.0f}s 循环（起点 {r["start_s"]}s，{r["start_how"]}，'
              f'交叠 {r["xfade_s"]}s）')
        print(f'   体积 {r["out_kb"]} KB   增益 {r["applied_gain_dB"]:+.1f} dB')
        print(f'   接缝比 {r["seam_ratio"]}（接缝处最大跳变 / 全曲 99.9 百分位）'
              f'  → {"PASS" if r["PASS_no_seam"] else "FAIL 有可闻接缝"}')

    ok = all(r['PASS_no_seam'] for r in results)
    print()
    print(f'ALL_PASS {str(ok).lower()}')
    if args.json:
        with open(args.json, 'w', encoding='utf-8') as fp:
            json.dump(results, fp, ensure_ascii=False, indent=2)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
