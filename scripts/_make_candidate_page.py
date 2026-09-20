"""把 _exp 实验产物整理成一份可试听的候选对比页。

为什么要有它：指标只能证明「不吵、不闷」，**证明不了「像不像这一场占卜该有的声音」**。
最终必须由耳朵拍板。而候选分散在 scripts/out/_exp/（那是 gitignore 的临时目录），
所以这里把 mp3 复制到 audio-src/candidates/ 并生成一张表。

数字**从 .json 指标文件读**、不手抄 —— 手抄一次就会错一个数，而错的那个数正好是决策依据。

用法：python scripts/_make_candidate_page.py
产物：audio-src/candidates/{index.html, *.mp3}
"""
import glob
import json
import os
import shutil

EXP = os.path.join('scripts', 'out', '_exp')
DST = os.path.join('audio-src', 'candidates')

# 当前构建进站点的候选（改这个常量 + 重跑 build-sfx.py 即可换音）
# charge flat-200：频谱全绿 + 尾段 -1.2dB（手势与旧版一致）
# burst L15-400：**契约长度 1.5s** + 质心 1962Hz（中频「雾感」，与用户认可的
#   reveal 2426Hz 同族）+ 尾段 -31dB（铺开又消散）
CHOSEN = {'charge': 'flat-200', 'burst': 'L15-400'}

# 指标 → 人话
METRICS = [
    ('centroid_Hz', '质心', 'Hz'),
    ('sub_lt60', '次低频 20-60Hz', ''),
    ('low_lt300', '低频 20-300Hz', ''),
    ('high_gt4000', '高频 >4kHz', ''),
]

LABEL = {
    'charge': ('① 屏息', 'charge', '点击水晶球后蓄势那一声 · 合同 1.0s'),
    'burst': ('② 雾散', 'burst', '牌面揭晓前雾气弥散 · 合同 1.2s'),
}


def load():
    rows = {}
    for jp in sorted(glob.glob(os.path.join(EXP, '*.json'))):
        with open(jp, encoding='utf-8') as f:
            m = json.load(f)
        name = os.path.basename(jp).split('--')[0]
        rows.setdefault(name, []).append(m)
    for name in rows:
        rows[name].sort(key=lambda r: (len(r.get('fails', [])), r.get('score', 9)))
    return rows


def fmt(v):
    if isinstance(v, float):
        return f'{v:.3f}' if abs(v) < 10 else f'{v:.1f}'
    return str(v)


def main():
    rows = load()
    os.makedirs(DST, exist_ok=True)

    # 1) 拷 mp3 进 audio-src/candidates（同目录，相对路径最稳）
    for name, items in rows.items():
        for m in items:
            src = os.path.join(EXP, f'{name}--{m["tag"]}.mp3')
            if os.path.exists(src):
                shutil.copy2(src, os.path.join(DST, f'{name}--{m["tag"]}.mp3'))
    # 旧版（被否决）也拷进来作为对照
    baks = sorted(glob.glob(os.path.join('scripts', 'out', '_raw-backup-*')))
    if baks:
        for n in ('charge', 'burst'):
            p = os.path.join(baks[-1], f'{n}-raw.mp3')
            if os.path.exists(p):
                shutil.copy2(p, os.path.join(DST, f'OLD--{n}.mp3'))

    # 2) 生成页面
    html = ["""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>屏息 · 雾散 —— 候选试听</title>
<style>
 :root{color-scheme:dark}
 body{margin:0;padding:34px 24px 70px;background:radial-gradient(circle at 50% 0%,#1b1730 0%,#0b0912 62%);
      color:#e8e4f4;font:15px/1.65 "Noto Serif SC","Songti SC",serif}
 h1{font-size:21px;font-weight:700;letter-spacing:.12em;margin:0 0 8px}
 .sub{color:#8f88a8;font-size:13px;margin-bottom:30px;max-width:860px}
 .sub b{color:#cfc7e6}
 h2{font-size:17px;letter-spacing:.1em;margin:34px 0 4px;padding-bottom:9px;border-bottom:1px solid #2b2544}
 .hint{color:#8f88a8;font-size:12.5px;margin-bottom:16px}
 .cand{border:1px solid #2b2544;border-radius:12px;padding:15px 17px;margin-bottom:11px;
       background:linear-gradient(180deg,rgba(43,37,68,.42),rgba(20,17,33,.42))}
 .cand.on{border-color:#6a5ab8;background:linear-gradient(180deg,rgba(74,63,122,.42),rgba(20,17,33,.5))}
 .cand.old{border-color:#5a2f2f;background:linear-gradient(180deg,rgba(74,40,40,.3),rgba(20,17,33,.4))}
 .hd{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:9px}
 .tag{font-size:15.5px;letter-spacing:.06em}
 .pill{font-size:11.5px;padding:2px 9px;border-radius:20px;border:1px solid #3d3563;color:#a89fd0}
 .pill.ok{border-color:#3f6b4d;color:#8fd3a4;background:rgba(63,107,77,.16)}
 .pill.no{border-color:#6b3f3f;color:#d39a9a;background:rgba(107,63,63,.16)}
 .pill.now{border-color:#6a5ab8;color:#cfc0ff;background:rgba(106,90,184,.2)}
 audio{width:100%;height:34px;margin:3px 0 9px}
 table{border-collapse:collapse;font-size:12.5px}
 td{padding:2px 14px 2px 0;color:#8f88a8;white-space:nowrap}
 td.v{color:#cfc7e6;font-variant-numeric:tabular-nums}
 td.v.bad{color:#e29a9a}
 .p{color:#6f6889;font-size:12px;margin-top:8px;font-style:italic}
 .note{margin-top:34px;padding:16px 19px;border:1px solid #4a3f7a;border-radius:12px;
       background:linear-gradient(180deg,rgba(74,63,122,.26),rgba(20,17,33,.4));
       color:#a89fd0;font-size:13px;max-width:880px}
 .note b{color:#cfc7e6}
</style></head><body>
<h1>屏息 · 雾散 —— 候选试听</h1>
<div class="sub">
  每个音生成了多个候选，<b>数字合格的标绿</b>，但合格 ≠ 好听 —— 请按耳朵挑，
  告诉我「屏息用哪个、雾散用哪个」，我替换后重跑构建即可（代码不用改）。<br>
  高亮边框那条是<b>现在已经构建进站点</b>的候选，可以先在开发者版页面里听它的实际效果。
</div>
"""]

    for name in ('charge', 'burst'):
        items = rows.get(name, [])
        if not items:
            continue
        title, en, hint = LABEL[name]
        html.append(f'<h2>{title} · <code>{en}</code></h2><div class="hint">{hint}</div>')
        # 旧版对照
        old_json = os.path.join(EXP, '..', f'..', '..')
        html.append(f'''<div class="cand old">
  <div class="hd"><span class="tag">旧版（你否决的那个）</span>
  <span class="pill no">已否决</span></div>
  <audio controls preload="metadata" src="OLD--{name}.mp3"></audio>
  <div class="p">{'雷云滚滚：次低频一大坨' if name == 'charge' else '电饭煲开盖：全是高频嘶声'}</div>
</div>''')
        for m in items:
            fails = m.get('fails', [])
            ok = not fails
            cls = 'cand' + (' on' if m['tag'] == CHOSEN.get(name) else '')
            pills = f'<span class="pill {"ok" if ok else "no"}">{"指标合格" if ok else f"{len(fails)} 项超标"}</span>'
            if m['tag'] == CHOSEN.get(name):
                pills += '<span class="pill now">当前站点在用</span>'
            pills += f'<span class="pill">influence {m.get("influence")}</span>'
            cells = []
            for key, label, unit in METRICS:
                v = m.get(key)
                bad = any(f.startswith(key) for f in fails)
                cells.append(f'<tr><td>{label}</td><td class="v{" bad" if bad else ""}">{fmt(v)}{unit}</td></tr>')
            html.append(f'''<div class="{cls}">
  <div class="hd"><span class="tag">{name}--{m['tag']}</span>{pills}</div>
  <audio controls preload="metadata" src="{name}--{m['tag']}.mp3"></audio>
  <table>{''.join(cells)}</table>
</div>''')

    html.append('''<div class="note">
  <b>指标怎么读</b>：<b>质心</b>是能量的重心频率，太低=闷雷、太高=嘶声；
  <b>次低频 20-60Hz</b>是「滚」的直接来源（旧屏息 50.6% → 现在要做到 &lt;15%）；
  <b>低频 20-300Hz</b>是「厚度」，太低会变成没底子的空气声；
  <b>高频 &gt;4kHz</b>是「嘶」，旧雾散 93.9% 全在这里。<br><br>
  <b>一个反直觉的结论</b>：中文提示词喂给 ElevenLabs 基本是失效的 ——
  同一份内容，中文稿生成的质心在 6000~7700Hz（纯嘶声），换成英文立刻落到 140~1250Hz。
  所以这几条候选全是英文稿。<br><br>
  <b>听的时候留意</b>：屏息要「厚实、缓缓浮现」，不能有「滚」；雾散要「柔软的铺开」，
  不能有「嘶」或「噗」的瞬击。若都不满意，说清是「太闷 / 太亮 / 有滚动感 / 起音太硬」，
  我按这个方向重生成 —— 每条的额度成本只有 10~12 点，可以多试。
</div></body></html>''')

    out = os.path.join(DST, 'index.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(html))
    print(f'✓ {out}')
    for name in ('charge', 'burst'):
        print(f'  {name}: {len(rows.get(name, []))} 个候选，'
              f'当前选用 {CHOSEN.get(name)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
