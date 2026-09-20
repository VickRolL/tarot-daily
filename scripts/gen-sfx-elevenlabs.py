"""用 ElevenLabs Sound Effects 生成音效（当前用于替换被否决的 charge / burst）。

为什么换通道（2026-09-20）：AiSounds 账户额度用完，用户推荐 ElevenLabs。
ElevenLabs 的 SFX API 有两个对本项目很关键的能力：
  · duration_seconds 支持 **0.5~30 的小数秒**（AiSounds 只吃整数秒）
  · prompt_influence 可调（默认 0.3）—— 我们这类「点名频段」的提示词需要它说了算，
    所以这里默认抬到 0.7

生成后**立刻量指标并对着 TARGETS 报 PASS/FAIL**：这两个音上一版翻车就是因为
「提示词里的声学名词被逐字实现」（说低频嗡鸣 → 13Hz 闷雷；说空气铺开 → 蒸汽嘶声）。
判据前移到生成阶段，避免拿到手才发现又是个闷雷。

用法：
    # key 从环境变量读（推荐），也可以 --api-key 传
    export ELEVENLABS_API_KEY=sk_xxx        # Git Bash
    set ELEVENLABS_API_KEY=sk_xxx           # cmd

    python scripts/gen-sfx-elevenlabs.py --only charge burst
    python scripts/gen-sfx-elevenlabs.py --only charge --variants 2
    python scripts/gen-sfx-elevenlabs.py --only burst --duration 1.2

产物：audio-src/sfx/_raw/<name>-raw.mp3（多变体 → <name>-raw-a.mp3 / -raw-b.mp3）
之后照常跑 `python scripts/build-sfx.py --force` 裁齐 + 配平 + 接进站点。
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

import miniaudio
import numpy as np

# ─────────────────────────────────────────────────────────────────────────────
# 提示词（与 audio-src/README.md 的 ①② 节保持一致；改一处要同步另一处）
# ─────────────────────────────────────────────────────────────────────────────
COMMON = """
不要：音乐、旋律、节奏、鼓点、打击乐、掌声；
      人声、语言、旁白、吟唱；
      有音高的敲击（「咚」「嗒」「咔」这类）。
要：  柔软渐入的起音（不要突然出现）；安静的、有空间混响的质感；阴冷、克制、空灵。
"""

JOBS = {
    # ① 屏息：1 秒。被否原因「像雷云滚滚」——实测 50.6% 能量在 20-60Hz、谱峰 13Hz。
    #    新版要把能量搬到中频的空气摩擦感（目标质心 400~1500Hz）。
    'charge': {
        'duration': 1.0,
        'prompt': """一段 1 秒的极安静空气声：像在幽暗石厅里一次非常轻的吸气，
只有空气轻微流动的沙沙质感，很薄、很近、很柔。

起音必须极其柔软地淡入；全程音量很轻，只有一点点缓慢浮现的变化，
没有任何渐强到饱满的过程，结尾不要重音。

绝对不要：低频轰鸣、隆隆声、闷雷感、次低频（20-60Hz 的震动感）、
嗡嗡的低频垫、引擎怠速声；
不要上升的扫频音、不要咻的冲刺音、不要风啸、不要白噪声嘶声。""" + COMMON,
    },
    # ② 雾散：1.5 秒。被否原因「像电饭煲烧开」——实测 84.5% 能量在 6-12kHz、质心 8718Hz。
    #    新版要搬回中低频的柔和铺开感（目标质心 300~1200Hz），且要有厚度。
    'burst': {
        'duration': 1.2,
        'prompt': """一声柔和的「雾气无声弥散」：像一层薄雾缓缓铺开又慢慢淡去，
质地圆润、绵密、柔软，像很轻的丝绒拂过空气。

起音是柔软的淡入，绝不是「噗」或「嘶」的瞬击；
完全没有任何喷射感、气流嘶嘶声、蒸汽声、白噪声、高频噪声（6kHz 以上要极少）；
没有低频轰响、爆炸、冲击感。
安静、空灵、圆润、有大厅混响。""" + COMMON,
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# 验收区间：只要「不极端」就算过（第一批是给用户听方向的，不做过度约束）。
# 上一版实测值写在注释里做对照。判据双向可判：区间外就红。
# ─────────────────────────────────────────────────────────────────────────────
TARGETS = {
    'charge': {
        'centroid_Hz': (350, 2500),   # 上一版 102Hz ← 闷雷；不能又落回去
        'low_lt250': (0.0, 0.30),     # 上一版 0.97
        'high_gt4000': (0.0, 0.25),   # 上一版 0.004（低没问题，但别变成蒸汽）
    },
    'burst': {
        'centroid_Hz': (250, 3000),   # 上一版 8718Hz ← 蒸汽；这条是关键
        'high_gt4000': (0.0, 0.25),   # 上一版 0.962
        'low_lt250': (0.08, 1.0),     # 上一版 0.01（没底子 → 飘、刺）
    },
}

API = 'https://api.elevenlabs.io/v1/text-to-sound-effects/convert'
MODEL = 'eleven_text_to_sound_v2'
RAW_DIR = os.path.join('audio-src', 'sfx', '_raw')


def generate(api_key, text, duration, influence, model=MODEL, timeout=120):
    """调一次 API，返回 mp3 字节。错误信息尽量说清是哪一类。"""
    body = json.dumps({
        'text': text,
        'duration_seconds': duration,
        'prompt_influence': influence,
        'model_id': model,
    }).encode('utf-8')
    req = urllib.request.Request(
        API + '?output_format=mp3_44100_128',
        data=body,
        headers={
            'xi-api-key': api_key,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        detail = ''
        try:
            detail = e.read().decode('utf-8', 'replace')[:400]
        except Exception:
            pass
        hint = {
            401: 'API key 无效或没带上（检查 ELEVENLABS_API_KEY）',
            402: '额度用完 / 该功能需要更高套餐',
            403: '该 key 没有 Sound Effects 权限',
            422: '参数不合法（duration 必须 0.5~30，influence 必须 0~1）',
            429: '请求过频，稍等再试',
        }.get(e.code, '')
        raise SystemExit(f'  ✗ HTTP {e.code} {e.reason}  {hint}\n    {detail}')
    except urllib.error.URLError as e:
        raise SystemExit(f'  ✗ 网络不可达：{e.reason}')


def measure(path):
    """量出声学签名。指标含义与 audio-asset-qa/analyze_audio.py 一致。"""
    dec = miniaudio.decode_file(
        path, output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1
    )
    sr = dec.sample_rate
    x = np.array(dec.samples, dtype=np.float32)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if x.size == 0:
        return None
    x = x - x.mean()
    dur = len(x) / sr
    seg = x[len(x) // 2: len(x) // 2 + int(sr * 10)]
    if len(seg) < 1024:
        seg = x
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
    fr = np.fft.rfftfreq(len(seg), 1 / sr)
    tot = spec.sum() + 1e-12
    return {
        'duration_s': round(dur, 2),
        'centroid_Hz': round(float((spec * fr).sum() / tot), 1),
        'low_lt250': round(float(spec[fr < 250].sum() / tot), 3),
        'high_gt4000': round(float(spec[fr >= 4000].sum() / tot), 3),
    }


def check(name, m):
    fails = []
    for key, (lo, hi) in TARGETS.get(name, {}).items():
        v = m.get(key)
        if v is None:
            continue
        if not (lo <= v <= hi):
            fails.append(f'{key}={v} 不在 [{lo}, {hi}]')
    return fails


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='+', choices=list(JOBS), default=list(JOBS),
                    help='要生成哪几个（默认全部：charge burst）')
    ap.add_argument('--variants', type=int, default=1, help='每个音生成几个变体（默认 1）')
    ap.add_argument('--duration', type=float, help='覆盖时长（秒，0.5~30）')
    ap.add_argument('--influence', type=float, default=0.7,
                    help='prompt_influence（默认 0.7；调低会让模型自由发挥）')
    ap.add_argument('--api-key', help='不传则读环境变量 ELEVENLABS_API_KEY')
    ap.add_argument('--dry-run', action='store_true', help='只打印提示词，不调 API')
    args = ap.parse_args()

    key = args.api_key or os.environ.get('ELEVENLABS_API_KEY')
    names = [n for n in JOBS if n in args.only]

    print(f'模型 {MODEL} · prompt_influence {args.influence} · 变体 {args.variants}')
    if not key and not args.dry_run:
        print('\n✗ 没有 API key。两种给法：')
        print('    export ELEVENLABS_API_KEY=sk_xxx   （Git Bash）')
        print('    python scripts/gen-sfx-elevenlabs.py --api-key sk_xxx')
        print('  免费层（$0/月，10k credits）就含 Sound Effects；')
        print('  但商用授权要 Starter($6/月) 起 —— 商用前请确认。')
        return 2

    if not os.path.isdir(RAW_DIR):
        os.makedirs(RAW_DIR, exist_ok=True)

    ok_all = True
    for name in names:
        job = JOBS[name]
        dur = args.duration or job['duration']
        if not (0.5 <= dur <= 30):
            print(f'✗ {name} 时长 {dur}s 越界（必须 0.5~30）')
            return 2
        print(f'\n===== {name}  {dur}s')
        if args.dry_run:
            print(job['prompt'])
            continue

        for i in range(max(1, args.variants)):
            suffix = '' if args.variants == 1 else '-' + chr(ord('a') + i)
            out = os.path.join(RAW_DIR, f'{name}-raw{suffix}.mp3')
            print(f'  → 生成中…（{i + 1}/{args.variants}）')
            data = generate(key, job['prompt'], dur, args.influence)
            with open(out, 'wb') as f:
                f.write(data)
            print(f'  ✓ {out}  {len(data) / 1024:.1f} KB')

            m = measure(out)
            if not m:
                print('  ✗ 解码为空，文件可能坏了')
                ok_all = False
                continue
            fails = check(name, m)
            flag = 'PASS' if not fails else 'FAIL'
            print(
                f'  {flag}  时长 {m["duration_s"]}s · 质心 {m["centroid_Hz"]}Hz · '
                f'<250Hz {m["low_lt250"]:.2f} · >4kHz {m["high_gt4000"]:.2f}'
            )
            if fails:
                ok_all = False
                for f_ in fails:
                    print(f'       ⚠️ {f_}')
                print('       → 仍偏离目标，考虑调高 --influence 或改提示词措辞后重跑')

    if not args.dry_run:
        print(f'\nALL_PASS {str(ok_all).lower()}')
        if ok_all:
            print('下一步：python scripts/build-sfx.py --force   （裁齐 + 配平 + 接进站点）')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
