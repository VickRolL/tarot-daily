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
    # ② 雾散：**1.5 秒（契约值）**。被否原因「像电饭煲烧开」——实测 84.5% 能量在 6-12kHz、质心 8718Hz。
    #    新版要搬回中低频的柔和铺开感（目标质心 300~1200Hz），且要有厚度。
    #    ⚠️ 2026-09-21 把这里从 1.2 改回 **1.5**：README 的契约表和 build-sfx.py 的
    #       SPECS.target 都写 1.5，只有这里写 1.2 —— 三处不一致。旧 burst 之所以
    #       只有 1.0s，是 **AiSounds 只支持整数秒** 的通道限制，不是契约。
    #       ElevenLabs 支持小数秒，就该照契约来（节拍余量：burst@1000ms → flip@3700ms，
    #       可用 2.7s，1.5s 安全）。
    'burst': {
        'duration': 1.5,
        'prompt': """一声柔和的「雾气无声弥散」：像一层薄雾缓缓铺开又慢慢淡去，
质地圆润、绵密、柔软，像很轻的丝绒拂过空气。

起音是柔软的淡入，绝不是「噗」或「嘶」的瞬击；
完全没有任何喷射感、气流嘶嘶声、蒸汽声、白噪声、高频噪声（6kHz 以上要极少）；
没有低频轰响、爆炸、冲击感。
安静、空灵、圆润、有大厅混响。""" + COMMON,
    },
    # ③ 翻牌。用户第二轮意见（2026-09-21）：
    #   「效果是符合的，但是冗杂了点，听起来像在翻书，而翻牌要利落一点，
    #     你这个听起来像翻了两三张牌」。
    #   → **音色/方向不用动，要改的是「手势」**：现在这条是 1.0s 的连续沙沙，
    #     实测 3 次起手（0.07 / 0.12 / **0.633**）、起手跨度 0.563s、高频(>4kHz)响 665ms
    #     —— 最后一次起手落在整段 63% 的位置，听感就是「翻了一下，过半天又翻一下」。
    #   → 新方向：**一次、短、快落**。所以时长从 1.5 契约改为 **0.5s**
    #     （契约 1.5s 是「不许超」的上限，不是「必须撑满」；翻牌是一次事件，
    #      不该像床垫一样铺满 1.5 秒。翻牌动画 flipAt→flipDone 有 1200ms，
    #      下一拍 reveal 在 flipAt+1480ms，0.5s 留足余量）。
    #   ★ 直连必须写英文（见下 TARGETS 顶部的实测结论）；短稿、只做正面描述。
    'flip': {
        'duration': 0.5,
        'prompt': """A single crisp playing card flick: one quick, sharp snap of a card flipped
over, bright and decisive, with a short papery flutter that ends at once.
One flick only, fast and clean, over in a moment.""",
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
        # ★ 2026-09-21 补：**手势**也要卡。踩过的坑 ——
        #   en-180/240/320 三条频谱全绿，但包络在结尾塌到 -22.5/-11.9/-9.1dB，
        #   而节拍表里 burst 正好在 charge **结束那一刻**接上（at=1000ms）
        #   → 蓄势蓄到一半自己先静了，两拍之间出现空档。
        #   参照物是**旧 charge 的手势**（用户只否了音色、没否手势）：尾段 -2.6dB。
        #   阈值取 -6：给参照物留 3.4dB 余量，同时把上面三条（≥9.1）判红。
        'env_tail_db': (-6.0, 0.5),
    },
    'burst': {
        'centroid_Hz': (250, 3000),   # 旧 8600Hz ← 蒸汽
        'high_gt4000': (0.0, 0.25),   # 旧 0.939 ← 同上
        'low_lt300': (0.06, 1.0),     # 旧 0.004 ← 没底子所以「飘、刺、吵」
    },
    # ③ flip：用户只否「手势」，没否音色（「效果是符合的」）—— 所以这里
    #    **不设频谱硬约束**，只留两条宽松的护栏防止方向性跑偏（变成闷响 / 纯嘶声），
    #    重点全部压在手势上。
    #    反向验证的输入是**现有那条被否的素材**（音频文件没动过，直接拿来当反例）：
    #      现有 raw: onset_span 0.563s / last_onset_ratio 0.633 / n_onset 3
    #                duty 0.241 / crest 28.8dB / 质心 3746Hz
    #      → 必须能把 onset_span（0.563 > 0.20）与 last_onset_ratio 判红。
    'flip': {
        # 「像翻了两三张牌」的直接量度：第一次起手到最后一次起手跨了多久。
        # 一次动作 = 几十毫秒。上限取 0.20s：给「啪 + 一点点纸的颤」留足空间，
        # 但把现有素材的 0.563s 判红。
        'onset_span_s': (0.0, 0.20),
        # 且动作必须挤在开头：最后一次起手不得晚于整段的 45%。
        'last_onset_ratio': (0.0, 0.45),
        # 能量不许铺满（持续沙沙 ≈ 1.0；一次动作远低于此）。
        'duty_20': (0.0, 0.55),
        # 瞬态感：峰值 − RMS。被压平的素材/成品会掉到 14dB 以下。
        'crest_db': (16.0, 60.0),
        # 护栏：保留「纸/卡」的宽频质感，但别变成闷响或纯嘶声。
        'centroid_Hz': (600.0, 9500.0),
        'high_gt4000': (0.02, 0.90),
    },
}

# ⚠️ 注意别被文档 URL 带偏：文档页面叫 /docs/api-reference/text-to-sound-effects/convert，
# 但**实际 REST 端点**是 /v1/sound-generation。写成前者会得到 404 {"detail":"Not Found"}。
# （SDK 里的方法名 still 叫 text_to_sound_effects.convert，这也是混淆的来源。）
API = 'https://api.elevenlabs.io/v1/sound-generation'
MODEL = 'eleven_text_to_sound_v2'
# `text` 的硬上限，实测报 text_too_long（英文 803 字符被 400 拒）。
# 客户端先拦一道，免得烧一次请求才发现。
MAX_TEXT = 450
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

    if len(text) > MAX_TEXT:
        raise SystemExit(
            f'  ✗ 提示词 {len(text)} 字符，超过上限 {MAX_TEXT}（API 会回 text_too_long）。\n'
            '     ⚠️ 对策不是「删到刚好」——实测**长负面清单 + 高 influence 反而更糟**：\n'
            '     被点名的声学名词（嘶声/风啸/轰鸣）本身会被渲染成内容。\n'
            '     正解是**短稿、只做正面描述**。'
        )

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
        # 手势：末段 1/8 的能量（相对峰值，dB）。量的是**结尾有没有塌掉**。
        # 频谱全绿但结尾静音 = 下一拍之前出现空档（charge 实测踩过，见 TARGETS 注释）。
        # ⚠️ burst **不要**给这条设下限 —— 雾散本来就该「铺开又消散」，尾段低是设计。
        'env_tail_db': round(_tail_db(x), 1),
        **_gesture(x, sr),
    }


def _gesture(x, sr, win_ms=10.0, hop_ms=5.0, merge_s=0.05):
    """手势指标：这个音是「一次干脆的动作」还是「一片持续的活动」。

    ★ 2026-09-21 新增。起因是用户对 flip 的评价：
      「效果是符合的，但是冗杂了点，听起来像在翻书……像翻了两三张牌」。
      「利落」这个听感对应四个可量的东西：

        n_onset          —— 有几次起手（谱通量的突出上升）
        onset_span_s     —— **第一次起手到最后一次起手跨了多久**。这是「冗杂」的核心量度：
                            一次动作只该跨几十毫秒；跨半秒就是「翻了两三张牌」
        duty_20          —— 能量高于「峰值 -20dB」的时间占比。持续噪声 ≈ 1.0，一次动作 ≪ 1
        crest_db         —— 峰值 − RMS。瞬态感的直接量度，低了就是被压平了

    ⚠️ 别只看素材：这三条在**构建链的「RMS 归一 + 软削顶」那一步会被整体破坏**
      （实测 crest 28.5→13.7dB、duty 0.29→0.89，见 `scripts/_ablate_flip.py` 的逐级消融）。
      所以素材和成品**两边都要卡**。
    """
    if x.size == 0:
        return {}
    dur = len(x) / sr

    # ── duty_20：逐帧能量（10ms 窗 / 5ms 跳）─────────────────────────────
    win = max(1, int(sr * win_ms / 1000.0))
    hop = max(1, int(sr * hop_ms / 1000.0))
    n = 1 + max(0, (len(x) - win) // hop)
    if n < 2:
        return {}
    e = np.empty(n)
    for i in range(n):
        s = x[i * hop:i * hop + win].astype(np.float64)
        e[i] = (s ** 2).mean()
    e_db = 10 * np.log10(np.maximum(e, 1e-20))
    e_db -= e_db.max()

    # ── 瞬态感 ───────────────────────────────────────────────────────────
    rms = float(np.sqrt((x.astype(np.float64) ** 2).mean()))
    pk = float(np.abs(x).max())
    crest = 20 * np.log10(max(pk, 1e-12)) - 20 * np.log10(max(rms, 1e-12))

    # ── 起手：谱通量 ─────────────────────────────────────────────────────
    nfft, hop2 = 1024, 256            # 5.8ms 一跳
    m = 1 + max(0, (len(x) - nfft) // hop2)
    onsets = []
    if m > 4:
        w = np.hanning(nfft)
        mags = np.empty((m, nfft // 2 + 1))
        for i in range(m):
            mags[i] = np.abs(np.fft.rfft(x[i * hop2:i * hop2 + nfft] * w))
        nm = mags / (mags.max() or 1.0)
        flux = np.maximum(np.diff(nm, axis=0), 0).sum(axis=1)
        thr = flux.mean() + 2.0 * flux.std()
        for i in range(len(flux)):
            if flux[i] <= thr:
                continue
            t = (i + 1) * hop2 / sr
            if onsets and t - onsets[-1] < merge_s:
                continue
            onsets.append(float(t))

    return {
        'crest_db': round(crest, 1),
        'duty_20': round(float((e_db > -20.0).mean()), 3),
        'n_onset': len(onsets),
        # 起手跨度：一次动作该是几十毫秒
        'onset_span_s': round(onsets[-1] - onsets[0], 3) if len(onsets) >= 2 else 0.0,
        # 最后一次起手落在整段的哪个位置 —— 「动作是不是都挤在开头」
        'last_onset_ratio': round(onsets[-1] / dur, 3) if onsets else 0.0,
    }


def _tail_db(x, parts=8):
    """末段 1/8 的能量，相对整段峰值，单位 dB。"""
    seg = np.array_split(np.abs(x), parts)
    rms = [float(np.sqrt((s ** 2).mean())) for s in seg]
    top = max(rms) or 1e-9
    return 20 * np.log10((rms[-1] or 1e-9) / top)


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
                f'>4kHz {m["high_gt4000"]:.3f} · 尾段 {m["env_tail_db"]}dB'
            )
            print(
                f'        手势：起手 {m.get("n_onset")} 次 · 跨度 {m.get("onset_span_s")}s · '
                f'末次位置 {m.get("last_onset_ratio")} · 铺满 {m.get("duty_20")} · '
                f'crest {m.get("crest_db")}dB'
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
