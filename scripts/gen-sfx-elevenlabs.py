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
    # ① 屏息：1 秒。被否原因「像雷云滚滚」——实测 50.6% 能量在 20-60Hz、谱峰 13.3/14.0Hz。
    #    用户选定的新方向：**柔和的低频暖流**（不是「空气声」）——
    #    要保留厚度与力量感，砍掉的只是次低频的「滚」。
    'charge': {
        'duration': 1.0,
        'prompt': """一段 1 秒的柔和低频暖流：一层平滑、温暖、厚实的低音持续声，
频率集中在中低频（大约 100-300Hz），像一层温暖的低音垫在幽暗石厅深处缓缓浮现。

质地必须完全平滑、稳定、连续：从头到尾没有任何波动、起伏、脉动、
忽强忽弱或震荡感；音量只做极轻微的缓慢上升，全程平稳。

严格禁止：20-60Hz 的次低频震动感、隆隆声、闷雷感、滚动感、低沉轰鸣、
引擎怠速声、有节奏的脉冲或重复的波动；
不要上升的扫频音、不要咻的冲刺音、不要风啸、不要白噪声嘶声；
不要气流的沙沙声（这一条要的是「低音」，不是「空气摩擦」）。""" + COMMON,
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
# 验收区间。用户选定的方向（2026-09-20 确认）：
#   charge：「柔和的低频暖流 —— 有厚度地缓缓浮现但绝不轰鸣，保留一点攒劲的力量感，
#            只是把『滚』去掉」→ 20-60Hz 要砍（那是雷），20-300Hz 要留（那是厚度）。
#   burst ：「雾散」原版是 6-12kHz 的蒸汽，要搬回中低频的柔和铺开，且要有底子。
# 阈值是**先量后定**的（scripts/out/metrics2.log），括号里是被否决旧版的实测值，
# 也是反向验证的输入 —— 旧素材必须能把这几条打红。
# ─────────────────────────────────────────────────────────────────────────────
TARGETS = {
    'charge': {
        'sub_lt60': (0.0, 0.15),      # 旧 0.506 ← 闷雷，这条是核心
        'low_lt300': (0.40, 1.0),     # 旧 0.756 ✓够厚；下限防它跳到「没底子的空气声」
        'centroid_Hz': (150, 1500),   # 旧 105Hz 太暗；参照用户满意的 reveal 1701Hz
        'high_gt4000': (0.0, 0.20),   # 旧 0.004 ✓；设上限防它变成高频气流
    },
    'burst': {
        'centroid_Hz': (250, 3000),   # 旧 8600Hz ← 蒸汽
        'high_gt4000': (0.0, 0.25),   # 旧 0.939 ← 同上
        'low_lt300': (0.06, 1.0),     # 旧 0.004 ← 没底子所以「飘、刺、吵」
    },
}

# ⚠️ 注意别被文档 URL 带偏：文档页面叫 /docs/api-reference/text-to-sound-effects/convert，
# 但**实际 REST 端点**是 /v1/sound-generation。写成前者会得到 404 {"detail":"Not Found"}。
# （SDK 里的方法名 still 叫 text_to_sound_effects.convert，这也是混淆的来源。）
API = 'https://api.elevenlabs.io/v1/sound-generation'
MODEL = 'eleven_text_to_sound_v2'
RAW_DIR = os.path.join('audio-src', 'sfx', '_raw')


def read_env_file(path='.env.local'):
    """从 .env.local 读 ELEVENLABS_API_KEY。

    为什么要这个：走 `--api-key sk_xxx` 会把密钥留在 shell 历史里，
    而 export 出来的环境变量在下次会话就没了。放文件里最省事且不进 git
    （.gitignore 有 .env / .env.local / *.key）。
    """
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            if k.strip() == 'ELEVENLABS_API_KEY':
                return v.strip().strip('"').strip("'")
    return None


def generate(api_key, text, duration, influence, model=MODEL, timeout=120, retries=3):
    """调一次 API，返回 (mp3 字节, 计费字符数或 None)。错误信息尽量说清是哪一类。

    带重试：本机实测偶发 `SSL: UNEXPECTED_EOF_WHILE_READING`（生成请求要跑十几秒，
    中途连接被掐断），重试即可 —— 别把它当成 key/参数问题去查。
    401/402/403/422 这类**确定性**错误不重试，直接给出针对性的处理建议。
    """
    import time as _time

    body = json.dumps({
        'text': text,
        'duration_seconds': duration,
        'prompt_influence': influence,
        'model_id': model,
    }).encode('utf-8')

    last_err = None
    for attempt in range(1, max(1, retries) + 1):
        req = urllib.request.Request(
            API + '?output_format=mp3_44100_128',
            data=body,
            headers={
                'xi-api-key': api_key,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg',
                'Connection': 'close',   # 避免复用被中途掐断的 keep-alive 连接
            },
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                # 响应头 character-cost = 这次扣了多少额度；拿不到就返回 None（不影响主流程）
                return r.read(), r.headers.get('character-cost')
        except urllib.error.HTTPError as e:
            detail = ''
            try:
                detail = e.read().decode('utf-8', 'replace')[:400]
            except Exception:
                pass
            hint = {
                401: 'API key 无效 / 权限不足（这个 key 没给 Sound Effects 权限？）',
                402: '额度用完 / 该功能需要更高套餐',
                403: '该 key 没有 Sound Effects 权限',
                404: '端点路径不对（应为 /v1/sound-generation，不是文档页的 '
                     '/v1/text-to-sound-effects/convert）',
                422: '参数不合法（duration 必须 0.5~30，influence 必须 0~1）',
                429: '请求过频，稍等再试',
            }.get(e.code, '')
            if e.code == 404:
                raise SystemExit(f'  ✗ HTTP {e.code} {e.reason}  {hint}\n    {detail}')
            if e.code not in (500, 502, 503, 504):
                raise SystemExit(f'  ✗ HTTP {e.code} {e.reason}  {hint}\n    {detail}')
            last_err = f'HTTP {e.code} {e.reason}'
        except (urllib.error.URLError, OSError) as e:
            last_err = f'{type(e).__name__}: {e}'

        if attempt < retries:
            wait = 2 * attempt
            print(f'  … 第 {attempt} 次失败（{last_err}），{wait}s 后重试')
            _time.sleep(wait)

    raise SystemExit(f'  ✗ 连续 {retries} 次失败，最后一次：{last_err}')


def measure(path):
    """量出声学签名。指标是为这两次故障量身定的，不是通用清单。

    别用「包络 CV」当「滚」的判据 —— **试过，区分度不成立**：
    用户满意的 flip 反而是四个音里 CV 最高的（1.658）。理由很直白：
    CV 量的是「能量随时间变化多少」，而一个短促的摩擦声本来就在变。
    真正的「滚」来自**次低频**（charge 旧版谱峰 13.3/14.0Hz，差 0.7Hz 的拍频），
    所以判据落在频段占比上，而不是起伏上。
    """
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
        # 「闷雷」的直接指标：charge 旧版 50.6%
        'sub_lt60': round(float(spec[(fr >= 20) & (fr < 60)].sum() / tot), 3),
        # 「暖流」的厚度：介于 20-300Hz 的能量。要有下限，否则会从闷雷
        # 跳到另一个极端（变成没底子的空气声）
        'low_lt300': round(float(spec[(fr >= 20) & (fr < 300)].sum() / tot), 3),
        # 「蒸汽嘶声」的直接指标：burst 旧版 93.9%
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

    key = args.api_key or os.environ.get('ELEVENLABS_API_KEY') or read_env_file()
    names = [n for n in JOBS if n in args.only]

    print(f'模型 {MODEL} · prompt_influence {args.influence} · 变体 {args.variants}')
    if not key and not args.dry_run:
        print('\n✗ 没有 API key。三种给法（推荐第一种：不进 shell 历史、下次还能用）：')
        print('    1) 项目根建 .env.local，写一行  ELEVENLABS_API_KEY=sk_xxx')
        print('       （.gitignore 已忽略 .env / .env.local / *.key，不会入库）')
        print('    2) export ELEVENLABS_API_KEY=sk_xxx   （只对当前 shell 有效）')
        print('    3) --api-key sk_xxx                   （会留在 shell 历史里）')
        print('  建 key：https://elevenlabs.io/app/settings/api-keys')
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
            data, cost = generate(key, job['prompt'], dur, args.influence)
            with open(out, 'wb') as f:
                f.write(data)
            cost_txt = f' · 计费 {cost}' if cost else ''
            print(f'  ✓ {out}  {len(data) / 1024:.1f} KB{cost_txt}')

            m = measure(out)
            if not m:
                print('  ✗ 解码为空，文件可能坏了')
                ok_all = False
                continue
            fails = check(name, m)
            flag = 'PASS' if not fails else 'FAIL'
            print(
                f'  {flag}  时长 {m["duration_s"]}s · 质心 {m["centroid_Hz"]}Hz · '
                f'20-60Hz {m["sub_lt60"]:.3f} · 20-300Hz {m["low_lt300"]:.2f} · '
                f'>4kHz {m["high_gt4000"]:.3f}'
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
