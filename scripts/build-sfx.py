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
     → RMS 归一到各自目标（设计值 -14 dBFS 档，实际下发值见 TARGET_SHIFT_DB），
       峰值顶到天花板（见 PEAK_CEILING_DB）。

    这一步 2026-09-20 推翻重做过一次，教训值得留着：
      · **峰值受限时，RMS 有数学上界**。flip 是「很轻的床体 + 一记 6ms 爆裂」，
        0.77% 的样本占掉 4.83dB 能量；峰值钉在天花板时它的 RMS 上界只有 -17.3dB，
        离 -14dB 差 3.3dB —— **靠限幅永远到不了**。
        所以先量上界，再决定「要不要为响度付失真」，别对着一个够不到的目标反复调参。
      · 到不了就只能要么**接受偏差**、要么**引入失真**（软削顶）。这里选了后者，
        但**逐素材决定**（SPECS[*].clip）：宽频噪声瞬态被饱和听着像「响了一点」，
        有音高的起音被饱和就变成闷响 —— 不能一条全局规则套所有素材。
      · 我在这中间写过一版 4:1 downward compressor，注释声称它救了 flip。**那是假的** ——
        它的峰值包络是 3ms 慢起音，单样本尖峰只把包络顶起 0.75%，根本进不了阈值。
        删掉它换成显式软削顶后，失真量变成可审计的数字（被削样本占比）。
      · **判据要落在 mp3 解码结果上**，不是编码前 PCM：64kbps 单声道有 0.4~0.7dB
        的固有衰减，拿 PCM 去对目标会为了「数字好看」而过推响度。

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
import re
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
#   hpf      高通转折频率（Hz）；None 不滤。charge 的 102Hz 泥需要 240
#   passes   一阶 HPF 级联次数（2 = 12dB/oct）
#   rms      归一目标（dBFS，**设计值**）。真正下发给流水线的是它 + TARGET_SHIFT_DB
#            —— 那个偏移是留给 mp3 编码过冲的余量，见 PEAK_CEILING_DB 的说明。
#   fade_out 末尾淡出（秒）：截断处 / 自然结尾都用它防「咔」
#   rescue   **是否强制「救泥判据」**。只有 charge 需要（原始素材质心 97Hz、
#            低频占比 0.94，是真的泥）。burst/flip/reveal 本来就是亮音，
#            硬套同一道门槛会**假失败** —— 「只在特定素材上成立的门槛，
#            不能无差别套到所有素材」，这个坑在塔罗项目里已经踩过一次。
#   clip     是否允许用**软削顶**换响度（见 normalize 的说明）。
#            默认 False：削顶改音色，值不值得要逐素材判断。
#            只有 flip 开了 —— 它的峰值系数 28.5dB，纯限幅的响度上界只有 -17.3dB，
#            离 -14dB 差太远，会「听不见」；而被削的是宽频噪声瞬态，饱和听感可接受。
#   trim     播放增益补偿，写进 sfx.js 的 TRIMS（两处必须一致，main() 有对拍检查）。
#            **默认 1.0**：流水线已经把每个音在文件里归到各自 rms 目标，
#            这里再乘一个数就是「二次补偿」，反而把响度对齐破坏掉。
#            ⚠️ charge 曾经是 1.4，注释写「补回高通削掉的电平」—— 但那个电平
#            已经被 normalize() 补过一次了，于是 charge 悄悄比其它三个响 2.9dB。
#            2026-09-20 修正为 1.0。
SPECS = {
    # 参数是扫出来的（180~360Hz × 2~3 级联，见 2026-09-20 会话记录）：
    # 240Hz×2 是「质心 623Hz / 低频占比 0.57」与「别滤成薄片」的平衡点；
    # passes=3 时峰值系数恶化到 ~20dB，同样响度下动态被压得没法听。
    'charge': {'target': 1.0, 'hpf': 240, 'passes': 2, 'rms': -14.0, 'fade_out': 0.08, 'trim': 1.0, 'rescue': True,  'clip': False},
    'burst':  {'target': 1.5, 'hpf': 90,  'passes': 2, 'rms': -13.0, 'fade_out': 0.12, 'trim': 1.0, 'rescue': False, 'clip': False},
    'flip':   {'target': 1.5, 'hpf': 120, 'passes': 2, 'rms': -14.0, 'fade_out': 0.10, 'trim': 1.0, 'rescue': False, 'clip': True},
    # ⚠️ 合同写的是 5 秒，实际生成的是 **4 秒** —— 账户余额只够 4 秒（20 点/秒）。
    #    差的那 1 秒在这条音里是「余韵尾巴」，4 秒的落点依然成立；
    #    等以后有点数可以重生成 5s 覆盖，脚本无需改。
    'reveal': {'target': 4.0, 'hpf': 60,  'passes': 1, 'rms': -14.0, 'fade_out': 0.50, 'trim': 1.0, 'rescue': False, 'clip': False},
}

RAW_DIR = os.path.join('audio-src', 'sfx', '_raw')
OUT_DIR = os.path.join('src', 'assets', 'audio', 'sfx')
REPORT = os.path.join('scripts', 'out', '_sfx_build.json')

SR = 44100

# 峰值天花板（dBFS）= **留给 mp3 编码器的余量**（2026-09-20 第二十五轮重新量化）。
#
# 曾经写 -0.3，理由是一句**没量过的假设**：「mp3 解码只有少量 inter-sample 过冲，
# 0.3dB 够了」。实测把这个假设推翻了 —— 编码前峰值 -0.3dBFS 的素材，
# 浏览器解码后有 +1.0dB 的过冲（burst 解码峰值 **+0.7dBFS**、flip +0.3dBFS），
# 也就是**出厂文件是过满刻度的**。过冲量随内容变化（reveal 同一电平却没冲），
# 所以只能按最坏情况留余量，不能按平均。
#
# ⚠️ 这件事在 python 侧**看不见**：miniaudio 的解码输出被钳在 ±1.0
#    （burst 有 6 个样本精确落在 1.000000、s16 路径有 4 个撞到 32767），
#    所以原来那条「解码峰值 > 0dBFS」判据是**死判据**，永远绿。
#    → 改成了「不许出现被钳样本」这个指纹判据（见 build_one 的回读段），
#      真正量到过冲的是浏览器：`scripts/flows/probe-sfx.js` 的 sfxNoClip。
#
# 2.8 = 实测最大过冲（burst +1.2dB、flip +1.7dB，都是编码前的 PCM 峰值 → 解码峰值）
# 留 1.1dB 余量。**余量必须真的留够，不能卡着零点过**：第一版按 -1.8 重建后
# flip 正好落在 0.0dBFS —— python 的解码器报 -0.1、Chrome 报 0.0，同一条音两边
# 差 0.1dB，判据会随机变红。而且 BGM 那条流水线从一开始用的就是 **-3dBFS**
# （build-ambient.py 的 target_peak，注释写「留出编码器的余量，避免削顶」）——
# 音效这边才是那个异类，向 BGM 看齐即可。
#
# 总线增益 MASTER_GAIN=0.34（-9.4dB）依然兜得住（-2.8dBFS 到总线上只剩 -12.2dBFS），
# 所以这只是**交付卫生**问题，不是可听故障 —— 但交付出去的文件不该过满刻度，
# 那是一条独立的标准。
PEAK_CEILING_DB = -2.8

# 因为天花板下移了，四个音的 rms 目标**必须同步下移同样的量**：
# 这样「峰值到天花板的距离」「限幅器压多少」「软削顶削多少」**逐位不变**，
# 四个音的相对对齐关系与各自的动态一点没动，只是整体轻 2.5dB。
# 反过来若只降天花板不动目标，限幅器会多压 2.5dB → 有 headroom 的 charge
# 不受影响、顶着天花板的 burst/flip/reveal 被压低 → **相对对齐被破坏**，
# 正是这个脚本要修的那类故障。
# 证据：整体下移后 flip 的软削顶电平从 -5.5 → -7.0dBFS，正好差 1.5dB，
# 被削样本比例 **1.44% 一模一样** —— 几何逐位保持。
# 绝对电平轻 2.5dB 在听感上不可辨（要辨也是相对 BGM 的关系，而 BGM 在
# 仪式中会被 duck 到 6.3%，音效仍高出 30dB 以上）。
TARGET_SHIFT_DB = -2.5


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


def limit_peaks(a, ceiling_db=-1.5, look_ms=20.0, release_ms=120.0):
    """峰值限幅器：**只压尖峰，不动整体响度**。

    为什么必须有限幅这一步（2026-09-20 实测踩到）：
      归一那一步如果写成「RMS 增益与峰值增益取更严的那个」，遇到**峰值系数大**的
      素材就会整体降增益 —— flip 的床体只有 -25~-34dB，却有一个 -11dB 的孤立瞬态
      （峰值系数 28.5dB），于是它被压到 **RMS -30.6dB**，比 charge 低 16dB，
      在页面上几乎听不见。而 README 里明写着「有的音听不见、有的音吓人」是要避免的。

    做法：峰值跟随包络（瞬时起、指数落）→ 增益 g = min(1, ceil/env) →
    **对 g 做前视滑动最小值**（不是滑动平均！）→ 乘上去。

    ⚠️ 前视必须用「最小值」而不是「平均」—— 这一条是第二轮才修对的：
      平均会把尖峰处的削减量抹平，于是**尖峰照样越界**；我最初的兜底是
      「还剩越界就整体线性收一下」，结果整体被收了 9dB，
      flip 的 RMS 变成 -28.4dB（离目标 14dB）——
      等于绕一圈又把「整体降增益」请了回来。滑动最小值天然满足
      `gain ≤ ceil/|x|`，只在尖峰邻域压，别处一律 1.0。
    """
    ceil = 10 ** (ceiling_db / 20)
    aa = np.abs(a)
    rel = float(np.exp(-1.0 / max(1.0, SR * release_ms / 1000.0)))
    env = np.empty_like(aa)
    prev = 0.0
    for i in range(len(aa)):
        v = aa[i]
        prev = v if v > prev * rel else prev * rel
        env[i] = prev
    gain = np.minimum(1.0, ceil / np.maximum(env, 1e-9))

    # 前视滑动最小值：窗口内取最严的削减量，保证峰值一定不越界
    w = max(1, int(SR * look_ms / 1000))
    n = len(gain)
    if w > 1:
        gmin = gain.copy()
        for k in range(1, min(w, n)):
            gmin[: n - k] = np.minimum(gmin[: n - k], gain[k:])
        gain = gmin
    return a * gain


def soft_clip(a, c_db):
    """tanh 软削顶：把超过 c 电平的部分圆滑地压下去（拐点是圆的，不是折的）。

    为什么需要它 —— 2026-09-20 实测算出来的「响度上界」：
      flip 是「很轻的床体 + 一记短促爆裂」，峰值系数 28.5dB。
      0.77% 的样本（约 6ms）就占了 4.83dB 的能量。
      **峰值钉在 -1.5dBFS 时，RMS 有数学上界**（逐样本硬削顶就取到上界）：
      flip 的上界只有 -17.33dB，离 -14dB 目标差 3.3dB —— 靠限幅**永远到不了**。
      要到 -14dB，唯一的路是「在更低电平处削顶、再整体提增益」，
      而那就必然引入失真。既然失真不可避免，就选**圆滑**的那种：
      tanh 在宽频噪声瞬态上听感接近「饱和」，硬削顶则是「数码碎裂」。

    ★ 教训（写下来免得下轮又绕）：先量上界，再决定要不要为响度付失真。
      我上一版在这里写了个 4:1 的 downward compressor，注释声称它救了 flip ——
      **那是假的**：它的峰值包络是 3ms 慢起音，单样本尖峰只把包络顶起 0.75%，
      根本进不了阈值，12 组参数扫下来结果一模一样（-16.7~-16.9dB 纹丝不动）。
      真实起作用的是「限幅 + 提增益」的迭代，而那个迭代等价于在 -2.2dBFS
      附近做软削顶。所以现在把这件事**写成明码**：显式削顶、显式报失真量。
    """
    c = 10 ** (c_db / 20)
    return c * np.tanh(a / c)


def _rms(a):
    return float(np.sqrt(np.mean(a ** 2)))


def _limit_then_compensate(x, rms_target_db, ceiling_db, rounds=2):
    """只限幅 + 复测补偿（不引入削顶失真）。

    补偿循环是「提增益 → 再限幅」的迭代：quiet 段会被提到原始值之上、
    响段被天花板压回 —— 最终收敛到「峰值 = 天花板」。这是**零显式失真**路径。
    """
    y = limit_peaks(x, ceiling_db)
    for _ in range(rounds):
        cur = db(_rms(y))
        if abs(cur - rms_target_db) < 0.5:
            break
        y = limit_peaks(y * (10 ** ((rms_target_db - cur) / 20)), ceiling_db)
    return y


def _fit_soft_clip(x, rms_target_db, ceiling_db, iters=14):
    """二分找「刚好够到目标响度」的最大 c（c 越大 = 削得越轻 = 失真越小）。

    RMS 随 c 单调下降（削得越狠越响），所以可以直接二分。
    返回 (处理后的样本, 实际用的 c dBFS, 被削样本占比)。
    """
    ceil_lin = 10 ** (ceiling_db / 20)
    lo, hi = ceiling_db - 30.0, ceiling_db  # c 越小削得越狠、RMS 越高
    best = None
    for _ in range(iters):
        mid = (lo + hi) / 2.0
        z = soft_clip(x, mid)
        pk = float(np.abs(z).max())
        if pk > 0:
            z = z * (ceil_lin / pk)  # 提到峰值刚好压天花板
        d = db(_rms(z))
        if best is None or abs(d - rms_target_db) < abs(best[1] - rms_target_db):
            best = (mid, d, z.copy())
        # ★ RMS 随 c **单调递减**（削得越狠越响）。所以：
        #   d > target → c 给大了 → 往上界挪（lo = mid）
        #   d < target → c 给小了 → 往下界挪（hi = mid）
        # 上一版这两支写反了，结果二分收敛到「削得最狠」那一端，响度冲过头、
        # 比纯限幅还差，于是被回退 —— 症状是「软削顶明明该生效却一直没生效」。
        if d > rms_target_db:
            lo = mid
        else:
            hi = mid
    c_used, _, z = best
    soft_frac = float(np.mean(np.abs(x) > 10 ** (c_used / 20)))
    return z, c_used, soft_frac


def normalize(a, rms_target_db, peak_ceiling_db=PEAK_CEILING_DB, allow_softclip=False,
              trigger_db=1.0):
    """RMS 归一 → 优先纯限幅；差得太多（>trigger_db）且该素材允许时，才软削顶。

    返回 dict：
      y / gain_db / pre_peak_db / path('limit'|'softclip') / soft_clip_db / soft_frac

    **为什么先纯限幅**：限幅不改音色，能到就到。够不到（峰值系数大到
    上界都不够用，见 soft_clip 的说明）才削顶，并且把削了多少报出来 ——
    失真量必须是**可审计的数字**，不能藏在代码里。

    `allow_softclip` 是**逐素材**的开关，默认关：
      削顶会改音色，值不值得是**按素材**判断的，不是一条全局规则 ——
      宽频噪声瞬态（flip 的纸牌摩擦）被饱和听感接近「响了一点」，
      而**有音高**的起音（reveal 的颂钵）被饱和会变成「嗡」的一声闷响，
      那就把音色弄坏了。所以 reveal 宁可靠抬天花板、也不削顶。
    """
    rms = _rms(a)
    g = (10 ** (rms_target_db / 20)) / max(rms, 1e-9)
    x = a * g
    pre_peak = float(np.abs(x).max())

    y = _limit_then_compensate(x, rms_target_db, peak_ceiling_db)
    dev = abs(db(_rms(y)) - rms_target_db)
    path, c_used, frac = 'limit', None, 0.0

    if allow_softclip and dev > trigger_db:
        z, c_used, frac = _fit_soft_clip(x, rms_target_db, peak_ceiling_db)
        if abs(db(_rms(z)) - rms_target_db) < dev:
            y, path = z, 'softclip'

    return {
        'y': y,
        'gain_db': db(g),
        'pre_peak_db': pre_peak,
        'path': path,
        'soft_clip_db': c_used,
        'soft_frac': frac,
    }


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
    # 见 TARGET_SHIFT_DB 的说明：目标是「设计值 + 编码余量偏移」，只在这一处算
    rms_target = spec['rms'] + TARGET_SHIFT_DB
    norm = normalize(a, rms_target, allow_softclip=spec.get('clip', False))
    a = norm['y']
    # 峰值系数（限幅前）= 归一后的峰值 - 目标 RMS。>18dB 说明有孤立尖峰，
    # 这一步的数字是「限幅器/削顶器到底有没有在干活」的唯一证据。
    crest_db = norm['pre_peak_db'] - rms_target

    size = encode_mp3(a, kbps, out)
    out_centroid, out_low = spectral_metrics(a)
    out_dur = len(a) / SR

    # ── 回读校验：解码刚写出的 mp3，量**真正出厂**的那一份 ──────────────
    # 为什么必须回读：上面所有指标算的都是编码前 PCM。mp3 是有损的，
    # 解码后峰值可能过冲（inter-sample peak）、时长会带编码器补的静音帧。
    # 「页面拿到的是 mp3，不是 PCM」—— 判据必须落在 mp3 上，否则是自欺。
    #
    # ⚠️ 量的时候**必须先剪掉编码器补的静音**：LAME 会在首尾塞约 2000 个
    #    静音样本（解码时长 1.045s vs PCM 1.0s），不剪的话那 4% 静音会把
    #    RMS 稀释掉约 0.2dB，再叠上编码本身的 0.3~0.4dB 衰减，会**误报**
    #    「响度差 0.7dB」。同一个 trim_silence 阈值，两边的口径才对得上。
    rt_raw = load(out)
    rt = trim_silence(rt_raw)
    rt_rms = db(_rms(rt))
    rt_peak = db(float(np.abs(rt_raw).max())) if len(rt_raw) else -999.0
    rt_dur = len(rt_raw) / SR

    # ⚠️ **被钳样本数**：miniaudio 的解码输出被钳在 ±1.0，所以 `rt_peak` **永远
    #    不可能 > 0**（第二十五轮实测：burst 有 6 个样本精确落在 1.000000、
    #    s16 路径有 4 个撞到 32767）。也就是说「解码峰值 > 0dBFS」这条判据
    #    在 python 侧是**死的**，写多少年都不会红 —— 而浏览器（不钳位）
    #    同时报出 +0.7dBFS 的真实过冲。
    #    → 改用**指纹判据**：连续音频里出现成片「精确的满刻度」不可能是巧合，
    #      它是「编码前峰值已经顶到天花板、过冲被截断」的签名。这条会红。
    #      真正量得出过冲幅度的仍是浏览器探针（probe-sfx 的 sfxNoClip）。
    #      复现这份证据的诊断脚本：`scripts/_probe_mp3peak.py`
    #      （打印「精确落在 ±1.0 的样本数」，那是钳位的指纹）。
    pinned = int(np.sum(np.abs(rt_raw) >= 0.9999995))

    # 「救泥」判据按素材分组（见 SPECS.rescue 的说明）：
    #   rescue=True  原始是泥 → 必须**真的被救上来**（质心 ≥1.5 倍 且 低频占比 <0.6）
    #   rescue=False 原始本来就亮 → 只要求滤波别把它弄暗（质心不低于 0.9 倍）
    if spec['hpf'] is None:
        rescued = True
    elif spec['rescue']:
        rescued = out_centroid > raw_centroid * 1.5 and out_low < 0.6
    else:
        rescued = out_centroid >= raw_centroid * 0.9

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
        'applied_gain_db': round(norm['gain_db'], 1),
        'pre_limit_peak_db': round(norm['pre_peak_db'], 1),
        'out_crest_db': round(crest_db, 1),
        'path': norm['path'],
        'soft_clip_db': None if norm['soft_clip_db'] is None else round(norm['soft_clip_db'], 1),
        'soft_frac': round(norm['soft_frac'], 4),
        'out_peak_db': round(db(float(np.abs(a).max())), 1),
        'out_rms_db': round(db(float(np.sqrt(np.mean(a ** 2)))), 1),
        'rms_target_db': round(rms_target, 1),
        'rt_dur': round(rt_dur, 3),
        'rt_peak_db': round(rt_peak, 1),
        'rt_pinned': pinned,
        'rt_rms_db': round(rt_rms, 1),
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
        print(
            f"   峰值系数 {r['out_crest_db']:.1f}dB（限幅前峰值 {r['pre_limit_peak_db']:.1f}dBFS）  "
            f"→ RMS {r['out_rms_db']:.1f}dB / 峰值 {r['out_peak_db']:.1f}dB  "
            f"偏离目标 {abs(r['out_rms_db'] - r.get('rms_target_db', spec['rms'])):.1f}dB"
        )
        if r['path'] == 'softclip':
            print(
                f"   路径：软削顶 @ {r['soft_clip_db']:.1f}dBFS（被削样本 {r['soft_frac']*100:.2f}%）"
                f" —— 峰值系数过大，纯限幅到不了目标，失真量已量化"
            )
        else:
            print('   路径：纯限幅（零削顶失真）')
        print(f"   救泥判据：{'PASS' if r['PASS_rescued'] else 'FAIL 仍发闷，考虑重生成'}")

    results = [by_name[n] for n in SPECS if n in by_name]
    with open(REPORT, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    have_raw = [n for n in SPECS if os.path.exists(os.path.join(RAW_DIR, f'{n}-raw.mp3'))]
    done = [n for n in have_raw if os.path.exists(os.path.join(OUT_DIR, f'{n}.mp3'))]
    print(f"\n素材 {len(have_raw)}/4 到货，成品 {len(done)}/4 就位：{done or '[]'}")
    rescue_fail = [r['name'] for r in results if not r['PASS_rescued']]

    # ── 响度齐不齐 ────────────────────────────────────────────────────
    # 四个音来自四次独立生成，**响度必须齐**，否则「有的音听不见、有的音吓人」。
    # 判据按各自的目标算偏差，而不是四个绝对值互比（burst 的目标本来就高 1dB）。
    #
    # ★ 判据落在**解码后的 mp3** 上，不是编码前 PCM（2026-09-20 修正）：
    #   实测 64kbps 单声道编码对素材有 0.4~0.7dB 的稳定衰减，这是有损格式的
    #   固有代价、消不掉。若拿 PCM 去对目标，要么把门槛放宽到失去意义，
    #   要么就得为了「让 PCM 好看」而过推响度 —— 而页面拿到的是 mp3。
    #   所以：**判出厂的那一份**，门槛用耳朵能分辨的 1.0dB。
    def loud_db(r):
        return r.get('rt_rms_db', r['out_rms_db'])

    def target_db(r):
        # 有效目标 = 设计值 + 编码余量偏移。写成函数而不是就地展开，
        # 是为了让「基线偏移」只有 TARGET_SHIFT_DB 一个来源。
        return r.get('rms_target_db', SPECS[r['name']]['rms'] + TARGET_SHIFT_DB)

    devs = [(r['name'], round(abs(loud_db(r) - target_db(r)), 1)) for r in results]
    loud_fail = [n for n, d in devs if d > 1.0]
    print('响度偏离目标（解码后）：' + '  '.join(f'{n} {d}dB' for n, d in devs))
    if loud_fail:
        print(f'   ⚠️ 这些音没归到位（>1dB）：{loud_fail}')

    ok = not rescue_fail and not loud_fail

    # ── 时长够不够（只告警，不算失败）──────────────────────────────────
    # fit_duration 只**截断**、不**拉伸** —— 素材比合同短时它无能为力：
    # 拉伸会把音色弄坏（而且这条音的「起音形状」是设计的一部分）。
    # 所以这里只提示，让人知道「这条比合同短，是生成结果的锅，不是处理的锅」。
    short = [(r['name'], r['out_dur'], r['target_dur'])
             for r in results if r['out_dur'] < r['target_dur'] - 0.05]
    if short:
        print('时长不足（素材本身比合同短，处理不改长度）：'
              + '  '.join(f'{n} {d}s<{t}s' for n, d, t in short))

    # ── 回读验收：mp3 解码后必须仍满足「不越界、时长不变、编码别乱来」──
    # 判据落在 mp3 上（页面实际拿到的就是它）。三条都双向可判：
    #   ① 解码结果里**出现被钳在满刻度的样本** → 编码前峰值顶到了天花板 → 失败
    #      （不是写「rt_peak > 0dBFS」—— 那条在 python 侧是死判据，见 build_one 的说明）
    #   ② 解码 RMS 与编码前差 > 1.0dB → 编码把响度改了（正常 0.4~0.7dB）→ 失败
    #   ③ 解码时长比 PCM 短 / 长出 0.1s 以上 → 编码器丢了或补了料 → 失败
    rt_fail = []
    for r in results:
        if 'rt_pinned' not in r:
            continue  # 旧报告，本轮没重跑的项
        if r['rt_pinned']:
            rt_fail.append(
                f"{r['name']} mp3 解码有 {r['rt_pinned']} 个样本被钳在满刻度"
                f"（编码前峰值顶到了天花板 {PEAK_CEILING_DB}dBFS，过冲被截断）"
            )
        shift = abs(r['rt_rms_db'] - r['out_rms_db'])
        if shift > 1.0:
            rt_fail.append(
                f"{r['name']} 编码把响度改了 {shift:.1f}dB（解码 {r['rt_rms_db']} vs "
                f"PCM {r['out_rms_db']}，正常 0.4~0.7dB）"
            )
        if r['rt_dur'] < r['out_dur'] - 0.01 or r['rt_dur'] > r['out_dur'] + 0.1:
            rt_fail.append(
                f"{r['name']} mp3 解码时长 {r['rt_dur']}s vs PCM {r['out_dur']}s"
                f"（预期只多不少，且多出的是编码器 padding ≈0.045s）"
            )
    print('回读校验：' + ('  '.join(
        f"{r['name']} {r['rt_rms_db']}dB/{r['rt_peak_db']}dB/{r['rt_dur']}s"
        for r in results if 'rt_peak_db' in r) or '（无）'))
    if rt_fail:
        ok = False
        print(f'   ⚠️ 回读不合格：{rt_fail}')

    # ── 跨文件一致性：sfx.js 的 TRIMS 必须和 SPECS 一致 ────────────────
    # 为什么值得一道检查：成品 mp3 和播放增益分居两地（这里 / sfx.js），
    # 谁改了另一边不知道 → 页面上的响度就悄悄偏了，而且**构建、探针都不会报**。
    # 这里改成读 sfx.js 的 TRIMS 字面量和 SPECS 对拍，一处不一致就红。
    drift = check_sfx_trim_drift()
    if drift:
        ok = False
        print(f'   ⚠️ sfx.js 的 TRIMS 与 SPECS 不一致：{drift}')

    print(f"ALL_PASS {str(ok).lower()}")
    return 0 if ok else 1


SFX_JS = os.path.join('src', 'audio', 'sfx.js')


def check_sfx_trim_drift():
    """读 sfx.js 里的 `const TRIMS = {...}`，和 SPECS 的 trim 对拍。

    返回不一致的说明列表（空列表 = 一致）。文件不存在则跳过（不算失败）。
    """
    if not os.path.exists(SFX_JS):
        return []
    with open(SFX_JS, 'r', encoding='utf-8') as f:
        src = f.read()
    m = re.search(r'const\s+TRIMS\s*=\s*\{([^}]*)\}', src)
    if not m:
        return [f'{SFX_JS} 里找不到 `const TRIMS = {{...}}` 字面量']
    js = {}
    for k, v in re.findall(r'(\w+)\s*:\s*([0-9.]+)', m.group(1)):
        js[k] = float(v)
    out = []
    for name, spec in SPECS.items():
        if name not in js:
            out.append(f'{name} 在 sfx.js 缺失')
        elif abs(js[name] - spec['trim']) > 1e-6:
            out.append(f"{name} sfx.js={js[name]} vs SPECS={spec['trim']}")
    for extra in js:
        if extra not in SPECS:
            out.append(f'{extra} 是 sfx.js 多出来的键')
    return out


if __name__ == '__main__':
    sys.exit(main())
