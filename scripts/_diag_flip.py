# -*- coding: utf-8 -*-
"""诊断 flip（翻牌）为什么「像翻了两三张牌」。

用户原话：「翻牌那里的音效效果是符合的，但是冗杂了点，听起来像在翻书，
而翻牌要利落一点，你这个听起来像翻了两张牌需要修改一下」。

「冗杂 / 像翻了两三张」在声学上最可能的对应物是**包络里出现了多个能量峰**
（= 多次瞬态 / 多次擦碰），而不是一次干净的动作。所以这里量三件事：

  1. **包络细粒度**：用 10ms 窗跑一遍，看有几个「峰」（局部极大且够突出）
  2. **瞬态间隔**：峰与峰之间隔多久 —— 间隔像人手翻页的节奏（>80ms）就会
     被听成「翻了好几下」；<30ms 的一串通常会被听成一次动作的粗糙纹理
  3. **能量拖尾**：动作结束后能量多久才落下去（利落 = 快落）

只为定位问题，不改任何东西。用完可删。
"""
import os
import sys
import json

import numpy as np
import miniaudio

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))


def load(path):
    d = miniaudio.decode_file(path, output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1)
    return np.array(d.samples, dtype=np.float32), d.sample_rate


def envelope_db(x, sr, win_ms=10.0, hop_ms=5.0):
    """短窗 RMS 包络，返回 (时间轴秒, dB 相对全局峰值)。"""
    win = max(1, int(sr * win_ms / 1000.0))
    hop = max(1, int(sr * hop_ms / 1000.0))
    n = 1 + max(0, (len(x) - win) // hop)
    db = np.empty(n, dtype=np.float64)
    for i in range(n):
        s = x[i * hop:i * hop + win]
        r = float(np.sqrt((s.astype(np.float64) ** 2).mean()))
        db[i] = 20.0 * np.log10(r if r > 1e-9 else 1e-9)
    db -= db.max()
    t = (np.arange(n) * hop + win / 2.0) / sr
    return t, db


def find_peaks(db, t, prominence_db=6.0):
    """找包络的突出局部极大。prominence_db 是「要比两侧谷高出多少」才算一个动作。

    6dB 是保守值：一次干脆的动作，其内部细纹起伏一般 <6dB；翻两页之间的
    「手离开又落下」通常 >8dB 的凹陷。这个阈值稍后会做敏感性检查。
    """
    peaks = []
    n = len(db)
    for i in range(1, n - 1):
        if db[i] < db[i - 1] or db[i] <= db[i + 1]:
            continue
        # 向左找谷
        j = i
        while j > 0 and db[j] > db[i] - prominence_db:
            j -= 1
            if db[j] > db[i]:
                break
        left_val = db[j]
        j2 = i
        while j2 < n - 1 and db[j2] > db[i] - prominence_db:
            j2 += 1
            if db[j2] > db[i]:
                break
        right_val = db[j2]
        prom = db[i] - max(left_val, right_val)
        if prom >= prominence_db:
            peaks.append((float(t[i]), float(db[i]), float(prom)))
    # 合并靠得过近（<25ms）的峰，只留最高的 —— 避免把同一次动作的毛刺数成两个
    merged = []
    for p in peaks:
        if merged and p[0] - merged[-1][0] < 0.025:
            if p[1] > merged[-1][1]:
                merged[-1] = p
        else:
            merged.append(p)
    return merged


def tail_decay(t, db):
    """从全局峰值起，能量回落到 -30dB 需要多久（秒）。"""
    i0 = int(np.argmax(db))
    for i in range(i0, len(db)):
        if db[i] <= -30.0:
            return float(t[i] - t[i0])
    return None


def report(path, label):
    if not os.path.exists(path):
        print(f'{label}: 文件不存在 {path}')
        return None
    x, sr = load(path)
    t, db = envelope_db(x, sr)
    peaks = find_peaks(db, t, 6.0)
    dur = len(x) / sr
    r = {
        'label': label,
        'path': path,
        'dur_s': round(dur, 3),
        'peak_db': round(float(20 * np.log10(np.abs(x).max() or 1e-9)), 2),
        'rms_db': round(float(20 * np.log10(np.sqrt((x.astype(np.float64) ** 2).mean()) or 1e-9)), 2),
        'n_peaks': len(peaks),
        'peaks': [(round(p[0], 3), round(p[1], 1), round(p[2], 1)) for p in peaks],
        'tail30_s': tail_decay(t, db),
    }
    # 峰间隔
    if len(peaks) >= 2:
        gaps = [round(peaks[i + 1][0] - peaks[i][0], 3) for i in range(len(peaks) - 1)]
        r['gaps_s'] = gaps
    print(f'\n=== {label} ===')
    print(f'  时长 {r["dur_s"]}s · 峰值 {r["peak_db"]}dBFS · RMS {r["rms_db"]}dB')
    print(f'  突出的包络峰: {r["n_peaks"]} 个')
    for pt, pv, pr in r['peaks']:
        print(f'      t={pt:>6.3f}s  高度 {pv:>6.1f}dB  突出度 {pr:>5.1f}dB')
    if 'gaps_s' in r:
        print(f'  峰间隔: {r["gaps_s"]}s')
    print(f'  从峰值回落 30dB 用时: {r["tail30_s"]}s')
    # 包络素描（每 30ms 一格，用字符画一眼看形状）
    step = max(1, int(0.03 / (t[1] - t[0])) if len(t) > 1 else 1)
    sketch = ''
    for i in range(0, len(db), step):
        v = db[i]
        if v > -3:
            ch = '#'
        elif v > -8:
            ch = '='
        elif v > -15:
            ch = '-'
        elif v > -25:
            ch = '.'
        else:
            ch = ' '
        sketch += ch
    print(f'  包络素描(每格≈30ms): |{sketch}|')
    return r


def main():
    out = {}
    base = os.path.join('audio-src', 'sfx', '_raw')
    prod = os.path.join('src', 'assets', 'audio', 'sfx')
    bak = sorted([p for p in __import__('glob').glob('scripts/out/_raw-backup-*')])
    bak = bak[-1] if bak else None

    out['flip_raw'] = report(os.path.join(base, 'flip-raw.mp3'), 'flip 原始素材(audio-src/sfx/_raw)')
    out['flip_prod'] = report(os.path.join(prod, 'flip.mp3'), 'flip 站点成品(src/assets/audio/sfx)')
    if bak:
        out['flip_bak'] = report(os.path.join(bak, 'flip-raw.mp3'), 'flip 最初版(备份=用户认可音色那版)')

    # 独立性检查：把翻转阈值调到 3 / 9 / 12dB，看结论是否稳定
    print('\n=== 阈值敏感性（原始素材）===')
    x, sr = load(os.path.join(base, 'flip-raw.mp3'))
    t, db = envelope_db(x, sr)
    for p in (3.0, 6.0, 9.0, 12.0):
        pk = find_peaks(db, t, p)
        print(f'  突出度阈值 {p:>4.1f}dB → {len(pk)} 个峰  {[round(q[0], 3) for q in pk]}')

    os.makedirs(os.path.join('scripts', 'out'), exist_ok=True)
    with open(os.path.join('scripts', 'out', '_flip_diag.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print('\n→ scripts/out/_flip_diag.json')


if __name__ == '__main__':
    main()
