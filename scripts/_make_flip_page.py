"""把 flip 的候选做成可试听页 —— **每条都跑完构建链**，听到的就是真上线的那一份。

为什么不能直接播 `_exp/` 里的素材：素材和成品的听感差别可以很大。
这轮的实测就是例子 —— 素材 duty 0.15 的「一记擦碰」，经过 RMS 归一 + 软削顶之后
duty 变成 0.18~0.89 不等；**旧那条被否决的 flip 正是素材看着正常（0.24）、
成品被填成一片（0.89）**。所以试听必须听成品。

数字**从流水线现场的返回值读**，不手抄（手抄的数字一定会随产物过期，且是静默的）。
构建链直接调 `build-sfx.py` 里那几个函数 + 它当前的 SPECS ——
这样「页面上听到的」与「站点里跑的」用的是同一条链、同一套参数。

用法：python scripts/_make_flip_page.py
产物：audio-src/candidates/flip.html + flip--*.mp3
"""
import importlib.util
import os
import shutil
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
EXP = os.path.join('scripts', 'out', '_exp')
DST = os.path.join('audio-src', 'candidates')
BACKUP = os.path.join('scripts', 'out', '_raw-backup-20260921-012259')   # 换素材前的备份

# 另外三个音现役的实测解码 RMS（build-sfx.py 的回读行）—— 四音配平判据的固定基准
OTHER_RMS = {'charge': -17.1, 'burst': -16.1, 'reveal': -17.2}

# 当前构建进站点的那一条（改这里 + 重跑 build-sfx.py 即可换音）
CHOSEN = 's1-60'

# 候选顺序 = 试听顺序。带说明的是「这条是什么」。
CANDS = [
    ('s1-60', '一记擦碰 + 一点纸的颤（当前选用）', 'One flick only, fast and clean'),
    ('s1-50', '同上，但只生成 0.5 秒', '同稿，更短'),
    ('s3-50', '更硬的「啪」，带一点点纸的颤', 'One sharp card flip'),
    ('s3-60', '同上，生成 0.6 秒', '同稿，更长'),
    ('s2-50', '「snap」措辞 —— 指标没过（更像持续擦碰）', 'A snappy card flip'),
]


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


B = load_module(os.path.join('scripts', 'build-sfx.py'), 'bsfx')


def product_of(raw_path, spec):
    """照 build-sfx.py 的链条（不减不增）跑一遍，返回 (成品数组, 报告 dict)。"""
    a = B.load(raw_path)
    if spec['hpf']:
        a = B.highpass(a, spec['hpf'], spec['passes'])
    a = B.trim_silence(a)
    a = B.fit_duration(a, spec['target'], spec['fade_out'])
    rms_target = spec['rms'] + B.TARGET_SHIFT_DB
    norm = B.normalize(a, rms_target, peak_ceiling_db=B._ceiling_of(spec),
                       allow_softclip=spec.get('clip', False))
    y = np.asarray(norm['y'], dtype=np.float32)
    return y, {
        'rms_target': round(rms_target, 1),
        'path': norm['path'],
        'gain': round(norm['gain_db'], 1),
        'soft_db': None if norm['soft_clip_db'] is None else round(norm['soft_clip_db'], 1),
        'soft_frac': round((norm['soft_frac'] or 0.0) * 100, 2),
    }


def measure_mp3(path):
    """量**成品 mp3 解码后**的那一份（页面拿到的就是它）。"""
    rt = B.load(path)
    pinned = int(np.sum(np.abs(rt) >= 0.9999995))
    peak = 20 * np.log10(max(float(np.abs(rt).max()), 1e-12))
    rms = 20 * np.log10(max(float(np.sqrt((B.trim_silence(rt).astype(np.float64) ** 2).mean())), 1e-12))
    g = B._GEN._gesture(np.array(B.trim_silence(rt), dtype=np.float32), B.SR)
    return {
        'dur': round(len(rt) / B.SR, 3),
        'rms': round(rms, 1), 'peak': round(peak, 2), 'pinned': pinned,
        'crest': g['crest_db'], 'duty': g['duty_20'],
        'n_onset': g['n_onset'], 'span': g['onset_span_s'], 'last': g['last_onset_ratio'],
    }


def fmt(v):
    return f'{v:.3f}' if isinstance(v, float) and abs(v) < 10 else str(v)


def row(label, v, warn=False):
    cls = 'v bad' if warn else 'v'
    return f'<tr><td>{label}</td><td class="{cls}">{fmt(v)}</td></tr>'


def main():
    os.makedirs(DST, exist_ok=True)
    spec = B.SPECS['flip']

    cards = []

    # ── 被否决的旧版（用当时的规格跑，才是它真正的样子）──────────────
    old_raw = os.path.join(BACKUP, 'flip-raw.mp3')
    if os.path.exists(old_raw):
        old_spec = dict(spec)
        old_spec.update({'target': 1.5, 'rms': -14.0, 'ceiling': B.PEAK_CEILING_DB})
        y, rep = product_of(old_raw, old_spec)
        out = os.path.join(DST, 'flip--OLD.mp3')
        B.encode_mp3(y, 64, out)
        m = measure_mp3(out)
        src = B._GEN.measure(old_raw)
        cards.append(('old', '旧版（你听出「像在翻书 / 翻了两三张牌」的那个）',
                      '被否决', src, m, rep, '素材 1.0s、整段都是沙沙；成品把空隙全填上（铺满度 0.89）'))

    for tag, desc, prompt_note in CANDS:
        raw = os.path.join(EXP, f'flip--{tag}.mp3')
        if not os.path.exists(raw):
            print(f'  ⚠ 缺 {raw}，跳过')
            continue
        y, rep = product_of(raw, spec)
        out = os.path.join(DST, f'flip--{tag}.mp3')
        B.encode_mp3(y, 64, out)
        m = measure_mp3(out)
        src = B._GEN.measure(raw)
        ok = (m['pinned'] == 0 and m['duty'] <= 0.55 and m['span'] <= 0.20
              and m['last'] <= 0.45 and m['crest'] >= 16)
        cards.append(('on' if tag == CHOSEN else 'cand', f'{tag} · {desc}', prompt_note,
                      src, m, rep, '', tag == CHOSEN))

    # ── 页面 ──────────────────────────────────────────────────────────
    L = []
    L.append('''<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>③ 翻牌 —— 候选试听（听的是成品）</title>
<style>
 :root{color-scheme:dark}
 body{margin:0;padding:34px 24px 70px;background:radial-gradient(circle at 50% 0%,#1b1730 0%,#0b0912 62%);
      color:#e8e4f4;font:15px/1.65 "Noto Serif SC","Songti SC",serif}
 h1{font-size:21px;font-weight:700;letter-spacing:.12em;margin:0 0 8px}
 .sub{color:#8f88a8;font-size:13px;margin-bottom:8px;max-width:900px}
 .sub b{color:#cfc7e6}
 .warn{margin:14px 0 26px;padding:12px 16px;border:1px solid #6b5a2f;border-radius:10px;
       background:rgba(107,90,47,.14);color:#d9c98f;font-size:13px;max-width:900px}
 .cand{border:1px solid #2b2544;border-radius:12px;padding:15px 17px;margin-bottom:12px;
       background:linear-gradient(180deg,rgba(43,37,68,.42),rgba(20,17,33,.42))}
 .cand.on{border-color:#6a5ab8;background:linear-gradient(180deg,rgba(74,63,122,.42),rgba(20,17,33,.5))}
 .cand.old{border-color:#5a2f2f;background:linear-gradient(180deg,rgba(74,40,40,.3),rgba(20,17,33,.4))}
 .hd{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:9px}
 .tag{font-size:15.5px;letter-spacing:.04em}
 .pill{font-size:11.5px;padding:2px 9px;border-radius:20px;border:1px solid #3d3563;color:#a89fd0}
 .pill.ok{border-color:#3f6b4d;color:#8fd3a4;background:rgba(63,107,77,.16)}
 .pill.no{border-color:#6b3f3f;color:#d39a9a;background:rgba(107,63,63,.16)}
 .pill.now{border-color:#6a5ab8;color:#cfc0ff;background:rgba(106,90,184,.2)}
 audio{width:100%;height:34px;margin:3px 0 10px}
 .cols{display:flex;gap:44px;flex-wrap:wrap}
 .col h4{margin:0 0 4px;font-size:12px;letter-spacing:.14em;color:#6f6889;font-weight:400}
 table{border-collapse:collapse;font-size:12.5px}
 td{padding:2px 14px 2px 0;color:#8f88a8;white-space:nowrap}
 td.v{color:#cfc7e6;font-variant-numeric:tabular-nums}
 td.v.bad{color:#e29a9a}
 .p{color:#6f6889;font-size:12px;margin-top:10px;font-style:italic}
 .note{margin-top:34px;padding:16px 19px;border:1px solid #4a3f7a;border-radius:12px;
       background:linear-gradient(180deg,rgba(74,63,122,.26),rgba(20,17,33,.4));
       color:#a89fd0;font-size:13px;max-width:900px}
 .note b{color:#cfc7e6}
 code{background:rgba(106,90,184,.18);padding:1px 6px;border-radius:5px;font-size:.92em}
</style></head><body>
<h1>③ 翻牌 —— 候选试听</h1>
<div class="sub">
  你的意见：<b>「效果是符合的，但冗杂了点，听起来像在翻书；翻牌要利落一点，你这个听起来像翻了两三张牌。」</b><br>
  量下来，「像翻了两三张牌」对应的是：旧素材有 <b>3 次起手</b>，第一次到最后一次跨了 <b>0.563s</b>，
  最后一次起手落在整段 <b>63%</b> 的位置；而且流水线把它的空隙填满了（铺满度 <b>0.24 → 0.89</b>）。<br>
  所以这轮改的是<b>手势</b>（音色方向不动）：一次起手、动作挤在开头、能量不许铺满。
</div>
<div class="warn">
  <b>这里每条都跑完了构建链</b>，你听到的就等于上线后的那一份 —— 不是原始素材。
  （旧方案翻车的原因之一正是「素材看着正常、成品被压平」，所以只听素材会判断错。）
</div>
''')

    for cls, title, prompt_note, src, m, rep, extra, *rest in cards:
        is_chosen = bool(rest and rest[0])
        # 四音响度极差：另外三个的实测解码 RMS（build-sfx.py 的回读行）是固定值，
        # 加上本条算出极差。判据 ≤3dB（probe-sfx 的 sfxLoudness）。
        spread = round(max(list(OTHER_RMS.values()) + [m['rms']])
                       - min(list(OTHER_RMS.values()) + [m['rms']]), 1)
        m['spread'] = spread
        fails = []
        if m['pinned']:
            fails.append(f"{m['pinned']} 个样本过满刻度")
        if m['duty'] > 0.55:
            fails.append(f"铺满度 {m['duty']} > 0.55")
        if m['span'] > 0.20:
            fails.append(f"起手跨度 {m['span']}s > 0.20s")
        if m['last'] > 0.45:
            fails.append(f"末次起手位置 {m['last']} > 0.45")
        if m['crest'] < 12:
            fails.append(f"峰值系数 {m['crest']}dB < 12dB")
        if spread > 3.0:
            fails.append(f"四音响度极差 {spread}dB > 3dB")
        ok = not fails
        pills = ''
        if cls == 'old':
            pills += '<span class="pill no">已否决</span>'
        else:
            pills += f'<span class="pill {"ok" if ok else "no"}">{"指标合格" if ok else str(len(fails)) + " 项超标"}</span>'
        if is_chosen:
            pills += '<span class="pill now">当前站点在用</span>'
        pills += f'<span class="pill">{prompt_note}</span>'
        src_tbl = ''.join([
            row('素材时长 (s)', src['duration_s']),
            row('素材 起手次数', src['n_onset']),
            row('素材 起手跨度 (s)', src['onset_span_s'], src['onset_span_s'] > 0.20),
            row('素材 末次起手位置', src['last_onset_ratio'], src['last_onset_ratio'] > 0.45),
            row('素材 峰值系数 (dB)', src['crest_db']),
            row('素材 铺满度', src['duty_20'], src['duty_20'] > 0.55),
            row('素材 质心 (Hz)', src['centroid_Hz']),
        ])
        out_tbl = ''.join([
            row('成品时长 (s)', m['dur']),
            row('成品 解码 RMS (dB)', m['rms']),
            row('成品 解码峰值 (dBFS)', m['peak'], m['pinned'] > 0),
            row('成品 峰值系数 (dB)', m['crest'], m['crest'] < 16),
            row('成品 铺满度', m['duty'], m['duty'] > 0.55),
            row('成品 起手跨度 (s)', m['span'], m['span'] > 0.20),
            row('成品 末次起手位置', m['last'], m['last'] > 0.45),
            row('过满刻度样本数', m['pinned'], m['pinned'] > 0),
            row('削顶比例 (%)', rep['soft_frac'], rep['soft_frac'] > 3.0),
            row('四音响度极差 (dB)', m['spread'], m['spread'] > 3.0),
            row('构建增益 (dB)', rep['gain']),
        ])
        L.append(f'''<div class="cand {cls}">
  <div class="hd"><span class="tag">{title}</span>{pills}</div>
  <audio controls preload="metadata" src="flip--{('OLD' if cls == 'old' else title.split(' · ')[0])}.mp3"></audio>
  <div class="cols">
    <div class="col"><h4>素材（生成出来的原始音）</h4><table>{src_tbl}</table></div>
    <div class="col"><h4>成品（构建后真正上线的）</h4><table>{out_tbl}</table></div>
  </div>
  {f'<div class="p">{extra}</div>' if extra else ''}
  {f'<div class="p">超标：{"；".join(fails)}</div>' if fails else ''}
</div>''')

    L.append('''<div class="note">
  <b>怎么读这些数</b><br>
  · <b>起手跨度</b>＝第一次起手到最后一次起手隔了多久。一次动作只该跨几十毫秒；
    旧素材 0.563s ＝「翻了一下，过半天又翻一下」—— 这是「像翻了两三张牌」的直接量度。<br>
  · <b>末次起手位置</b>＝最后一次起手落在整段的百分之几。要利落，动作必须全挤在开头。<br>
  · <b>铺满度</b>＝能量高于「峰值 −20dB」的时间占比。一次动作远低于 1；一片沙沙接近 1。
    旧成品 0.89 ＝「从头到尾都在响」＝像翻书。<br>
  · <b>峰值系数</b>＝峰值 − RMS。越高越「点」，越低越「糊成一片」。<br><br>
  <b>这轮顺带查出来的两件事</b>：<br>
  ① 用逐级消融（<code>scripts/_ablate_flip.py</code>）确认：那条「像翻书」的沙沙<b>大半是构建链造的</b>，
     不是素材本身的锅 —— 前三级（高通 / 去静音 / 对齐时长）纹丝不动，问题全出在
     「RMS 归一 + 软削顶」那一步：素材 RMS 只有 -33.5dB，为了凑响度要拉 +16.9dB，
     拉不上去就削顶，于是瞬态被压平 15dB、空隙被填满。<br>
  ② 因此光换素材不够，还加了一条<b>成品判据</b>「一次动作型的素材不许被填平」
     （已反向验证：旧素材 0.24→0.89 判红，新素材 0.15→0.18 判绿）。<br><br>
  <b>需要你做的</b>：听一遍，告诉我「就用哪个」。若觉得<b>还可以更干更短</b>、
  或者<b>尾巴再长一点更有余韵</b>，说方向，我按方向再铺一批（每条约 5~6 点额度）。
</div></body></html>''')

    out = os.path.join(DST, 'flip.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L))
    print(f'✓ {out}')
    for cls, title, note, src, m, rep, extra, *rest in cards:
        print(f"   {title[:34]:36s} 成品 {m['dur']}s / crest {m['crest']} / duty {m['duty']} "
              f"/ 峰值 {m['peak']} / 铺满 {'!!' if m['duty'] > 0.55 else 'ok'}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
