"""一次性实验台：换提示词/影响力，成批生成 charge·burst 并量指标排名。

为什么要它：直接跑 gen-sfx-elevenlabs.py 每次都会**覆盖** audio-src/sfx/_raw/<name>-raw.mp3，
只能看到最后一次的结果，没法横向比。这个脚本把每个候选存到独立文件名，
量完指标打一张表，最后给每个音报「最接近目标的是哪个」。

指标与判据**从 gen-sfx-elevenlabs.py 里 import**，不复制一份 ——
否则实验用的量法与定阈值时的量法会悄悄漂移，改出来的数就没意义了。

用法：
    python scripts/_exp_sfx_prompts.py --recheck          # 零成本：拿备份的旧素材回测判据可比性
    python scripts/_exp_sfx_prompts.py --only charge      # 跑 charge 的候选矩阵
    python scripts/_exp_sfx_prompts.py                    # 两个音都跑
产物：scripts/out/_exp/<name>--<tag>.mp3（+ 同名 .json 指标）
"""
import argparse
import glob
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# 把 gen-sfx-elevenlabs.py 当模块加载（文件名带连字符，不能直接 import）
_spec = importlib.util.spec_from_file_location(
    'gen_sfx', os.path.join(HERE, 'gen-sfx-elevenlabs.py')
)
G = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(G)

OUT = os.path.join('scripts', 'out', '_exp')


# ★ v4：v3 暴露出一个**指标没覆盖的维度 —— 手势（包络）**。
#
# v3 里 charge 的 en-180/240/320 **频谱三条全绿**，但包络在结尾塌掉：
#   尾段 -22.5 / -11.9 / -9.1 dB。而节拍表里 burst 的 at=1000ms 正好是
#   charge 的结束点 → **蓄势到自己先静了，两拍之间露出空档**。
#   对照：旧 charge（用户只否音色、没否手势）尾段 -2.6dB，全程平稳。
#   → 已把 `env_tail_db` 补进 TARGETS['charge']（下限 -6），并做了反向验证。
#
# 于是这轮的策略变了：**先锁手势、再修频谱** —— 只动频率那一项，别的一次改一个。
#   第 4 条 rise-220 用的是 v2 那份「实测手势正确（尾段 0.0dB）」的措辞，只把 150 换成 220：
#   150Hz 时次低频占 0.285 超标，抬高基频应当同时把 sub 压下去。
#   前三条换成 "steady and even throughout"，直接要求平稳，看哪种措辞更稳。
# ─────────────────────────────────────────────────────────────────────────────

ZH_UNUSED_NOTE = '中文稿已证伪，保留在此仅作对照记录，不再参与生成。'

_TMPL_FLAT = ('A warm steady low drone of about {hz} Hz, like a quiet organ note '
              'held deep inside a stone hall, steady and even throughout.')

_TMPL_RISE = ('A warm steady low drone of about {hz} Hz, like a quiet organ note '
              'held deep inside a stone hall, rising slowly and smoothly.')

EN_BURST_SHORT = ('Soft warm mist spreading and dissolving in still air: a round, velvety '
                  'low-mid swell that fades in gently and drifts away.')


_TMPL_BURST_HZ = ('A soft warm misty swell of about {hz} Hz spreading out and slowly '
                  'dissolving in still air, round and velvety, with a gentle fade-in '
                  'and a long quiet tail.')


def build_candidates():
    return {
        'charge': [],
        # burst 1.5s 的第二轮：上一轮的三条（1.2s 的 en-0.7 是 1254Hz）说明
        # **时长拉长会把质心压暗**（1.5s 的两条只有 218/326Hz、92% 能量在 300Hz 以下）。
        # 这轮按 charge 验证过有效的办法（**把目标频率写进稿子**）把质心往上要，
        # 目标是「契约长度 1.5s」与「有中频质感」兼得 —— 太暗会像闷响，不像雾。
        'burst': [
            ('L15-400', 0.7, _TMPL_BURST_HZ.format(hz=400)),
            ('L15-700', 0.7, _TMPL_BURST_HZ.format(hz=700)),
            ('L15-1000', 0.7, _TMPL_BURST_HZ.format(hz=1000)),
        ],
    }


def parse_metric(name):
    """返回 (排序分, 明细)。排序分 = 归一化后离目标区间中心的距离（越小越好）。"""
    tgt = G.TARGETS.get(name, {})
    return tgt


def score(name, m):
    """离目标区间的相对偏离量。0 = 完全落在区间内。用于排名，不改变 PASS/FAIL。"""
    tgt = G.TARGETS.get(name, {})
    total = 0.0
    for k, (lo, hi) in tgt.items():
        v = m.get(k)
        if v is None:
            continue
        span = (hi - lo) or 1.0
        if v < lo:
            total += (lo - v) / span
        elif v > hi:
            total += (v - hi) / span
    return total


def do_recheck():
    """零成本：确认判据的量法与当初定阈值时同源可比。

    如果这一关不过，后面所有「离目标多远」的比较都是空的。
    gen-sfx-elevenlabs.py 的 TARGETS 注释里写死了旧版实测值
    （charge sub_lt60=0.506 / 质心 105Hz，burst >4kHz=0.939 / 质心 8600Hz）。
    """
    baks = sorted(glob.glob(os.path.join('scripts', 'out', '_raw-backup-*')))
    if not baks:
        print('✗ 找不到备份目录 scripts/out/_raw-backup-*')
        return 2
    bak = baks[-1]
    print(f'回测目录：{bak}')
    print('目标：旧 charge 应≈ 质心105Hz / 20-60Hz 0.506；旧 burst 应≈ 质心8600Hz / >4kHz 0.939')
    print()
    ok = True
    expect = {
        'charge': {'centroid_Hz': 105, 'sub_lt60': 0.506},
        'burst': {'centroid_Hz': 8600, 'high_gt4000': 0.939},
    }
    for name in ['charge', 'burst', 'flip', 'reveal']:
        p = os.path.join(bak, f'{name}-raw.mp3')
        if not os.path.exists(p):
            continue
        m = G.measure(p)
        fails = G.check(name, m)
        verdict = 'PASS' if not fails else 'FAIL'
        print(f'  {name:7s} 质心 {m["centroid_Hz"]:>8}Hz · 20-60Hz {m["sub_lt60"]:.3f} · '
              f'20-300Hz {m["low_lt300"]:.2f} · >4kHz {m["high_gt4000"]:.3f} · {verdict}')
        for k, want in expect.get(name, {}).items():
            got = m[k]
            rel = abs(got - want) / (abs(want) or 1)
            flag = '✓' if rel < 0.25 else '✗ 与注释值差太多 → 量法或备份不对'
            if rel >= 0.25:
                ok = False
            print(f'          {flag} {k}: 回测 {got} vs 注释 {want}')
    print()
    print(f'可比性 RECHECK_OK {str(ok).lower()}')
    return 0 if ok else 1


def run(names):
    key = os.environ.get('ELEVENLABS_API_KEY') or G.read_env_file()
    if not key:
        print('✗ 没有 key（.env.local 里应有 ELEVENLABS_API_KEY）')
        return 2
    os.makedirs(OUT, exist_ok=True)
    cands = build_candidates()

    best = {}
    for name in names:
        if not cands.get(name):
            print(f'\n================ {name}  本轮无候选，跳过')
            continue
        dur = G.JOBS[name]['duration']
        print(f'\n================ {name}  {dur}s  目标 {G.TARGETS[name]}')
        rows = []
        for tag, infl, prompt in cands[name]:
            out = os.path.join(OUT, f'{name}--{tag}.mp3')
            print(f'  → {tag} (influence {infl}) …')
            data, cost = G.generate(key, prompt, dur, infl)
            with open(out, 'wb') as f:
                f.write(data)
            m = G.measure(out)
            if not m:
                print('    ✗ 解码为空')
                continue
            m['tag'] = tag
            m['influence'] = infl
            m['cost'] = cost
            m['fails'] = G.check(name, m)
            m['score'] = round(score(name, m), 4)
            with open(out.replace('.mp3', '.json'), 'w', encoding='utf-8') as f:
                json.dump(m, f, ensure_ascii=False, indent=2)
            rows.append(m)
            flag = 'PASS' if not m['fails'] else 'FAIL'
            print(f'    {flag} 质心 {m["centroid_Hz"]:>8}Hz · 20-60Hz {m["sub_lt60"]:.3f} · '
                  f'20-300Hz {m["low_lt300"]:.2f} · >4kHz {m["high_gt4000"]:.3f} · '
                  f'尾段 {m.get("env_tail_db")}dB · '
                  f'偏离分 {m["score"]} · 计费 {cost}')
            for f_ in m['fails']:
                print(f'       ⚠️ {f_}')

        rows.sort(key=lambda r: (len(r['fails']), r['score']))
        if rows:
            best[name] = rows[0]
            print(f'  ★ {name} 最优 = {rows[0]["tag"]}（失败 {len(rows[0]["fails"])} 条，偏离分 {rows[0]["score"]}）')
            print(f'    文件 {os.path.join(OUT, name + "--" + rows[0]["tag"] + ".mp3")}')

    print('\n---- 汇总 ----')
    for name, r in best.items():
        n_fail = len(r['fails'])
        print(f'{name}: {r["tag"]}  {"PASS ✓" if not n_fail else str(n_fail) + " 条未过"}  偏离分 {r["score"]}')
    allpass = all(not r['fails'] for r in best.values()) and len(best) == len(names)
    print(f'ALL_PASS {str(allpass).lower()}')
    return 0 if allpass else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='+', choices=['charge', 'burst'], default=['charge', 'burst'])
    ap.add_argument('--recheck', action='store_true', help='零成本：回测旧素材，验证判据可比性')
    args = ap.parse_args()
    if args.recheck:
        return do_recheck()
    return run(args.only)


if __name__ == '__main__':
    sys.exit(main())
