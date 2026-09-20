# -*- coding: utf-8 -*-
"""把 flip 候选素材逐个跑一遍构建链，量**成品**的手势指标。

为什么不能只看素材：上一轮就是这么翻车的 —— 素材 crest 28.8dB / duty 0.24 看着很正常，
经过「RMS 归一 + 软削顶」之后变成 crest 13.7 / duty 0.89，听感从「一次擦碰」
变成「一片沙沙」。所以选素材必须看**成品**。

同时对比几种管线策略，看哪种能在保住响度平衡的前提下不把瞬态压平：
  A 现管线（rms -14 / 软削顶允许）
  B 现管线但不许削顶（只限幅）
  C 只做峰值归一（rms 目标不管）
  D rms 目标降低 3dB（少拉一点）

纯离线试算，不写 audio-src/、不动 src/。产物落 scripts/out/_try/。
"""
import glob
import importlib.util
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


B = load_module(os.path.join('scripts', 'build-sfx.py'), 'bsfx')
G = load_module(os.path.join('scripts', 'gen-sfx-elevenlabs.py'), 'gen')

SR = B.SR
EXPDIR = os.path.join('scripts', 'out', '_exp')
OUTDIR = os.path.join('scripts', 'out', '_try')


def write_mp3(a, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    B.encode_mp3(a.astype(np.float32), 128, path)


def product(name, raw_path, variant):
    """按某个策略跑一遍，返回 (成品数组, 说明)。"""
    spec = dict(B.SPECS[name])
    a = B.load(raw_path)
    a = B.highpass(a, spec['hpf'], spec['passes'])
    a = B.trim_silence(a)
    a = B.fit_duration(a, spec['target'], spec['fade_out'])
    rms_target = spec['rms'] + B.TARGET_SHIFT_DB

    if variant == 'A':          # 现管线
        n = B.normalize(a, rms_target, allow_softclip=spec.get('clip', False))
        return n['y'], f'rms {rms_target}dB / {n["path"]} / gain {n["gain_db"]:.1f}dB'
    if variant == 'B':          # 不许削顶
        n = B.normalize(a, rms_target, allow_softclip=False)
        return n['y'], f'rms {rms_target}dB / {n["path"]} / gain {n["gain_db"]:.1f}dB'
    if variant == 'C':          # 峰值归一
        pk = float(np.abs(a).max()) or 1e-9
        g = (10 ** (B.PEAK_CEILING_DB / 20)) / pk
        return a * g, f'峰值归一到 {B.PEAK_CEILING_DB}dBFS / gain {20*np.log10(g):.1f}dB'
    if variant == 'D':          # rms 目标降 3dB
        n = B.normalize(a, rms_target - 3.0, allow_softclip=spec.get('clip', False))
        return n['y'], f'rms {rms_target - 3.0}dB / {n["path"]} / gain {n["gain_db"]:.1f}dB'
    raise SystemExit('未知策略 ' + variant)


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    cands = sorted(glob.glob(os.path.join(EXPDIR, 'flip--*.mp3')))
    if not cands:
        print('✗ 没有候选，先跑 _exp_sfx_prompts.py --only flip')
        return 2

    keys = ['duration_s', 'crest_db', 'duty_20', 'n_onset', 'onset_span_s',
            'last_onset_ratio', 'centroid_Hz', 'high_gt4000']

    def row(label, path, extra=''):
        m = G.measure(path)
        f = G.check('flip', m)
        s = f'{label:34s}' + ''.join(f'{str(m.get(k)):>13s}' for k in keys)
        s += f'{"  PASS" if not f else "  FAIL " + ";".join(x.split("=")[0] for x in f)}'
        if extra:
            s += f'   [{extra}]'
        print(s)
        return m, f

    print('\n===== 先量素材本身 =====')
    hdr = f'{"素材/成品":34s}' + ''.join(f'{k:>13s}' for k in keys)
    print(hdr)
    print('-' * len(hdr))
    for p in cands:
        row(os.path.basename(p)[:-4], p)
    row('★ 现有(被否)素材', os.path.join('audio-src', 'sfx', '_raw', 'flip-raw.mp3'))

    for variant in ('A', 'B', 'C', 'D'):
        print(f'\n===== 策略 {variant} 下的成品 =====')
        print(hdr)
        print('-' * len(hdr))
        for p in cands:
            y, note = product('flip', p, variant)
            out = os.path.join(OUTDIR, f'{os.path.basename(p)[:-4]}--{variant}.mp3')
            write_mp3(y, out)
            row(os.path.basename(p)[:-4] + f' →{variant}', out, note)
        y, note = product('flip', os.path.join('audio-src', 'sfx', '_raw', 'flip-raw.mp3'), variant)
        out = os.path.join(OUTDIR, f'OLD--{variant}.mp3')
        write_mp3(y, out)
        row(f'★ 现有(被否) →{variant}', out, note)

    print('\n产物：' + OUTDIR)
    return 0


if __name__ == '__main__':
    sys.exit(main())
