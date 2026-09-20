"""把四段生成结果做成一个能看波形 + 能直接点播放的本地试听页。

为什么要看波形而不只看数字：AI 交回来的是「一首有起伏的曲子」还是
「一层平稳的氛围」，波形一眼就能分辨，数字要解释半天。
"""
import json
import os

ANALYSIS = 'scripts/out/_mglc_analysis.json'
OUTDIR = os.path.join('scripts', 'out', 'mglc')

LABELS = {
    'ambient-01_1': ('环境音 变体 A', '偏暗、起伏较大'),
    'ambient-01_2': ('环境音 变体 B', '偏亮、更平稳'),
    'sfx-test_1': ('音效试探 变体 A', '提示词写的是「单声翻牌」'),
    'sfx-test_2': ('音效试探 变体 B', '提示词写的是「单声翻牌」'),
}
GROUP = {
    'ambient-01_1': 'long',
    'ambient-01_2': 'long',
    'sfx-test_1': 'sfx',
    'sfx-test_2': 'sfx',
}


def wave_points(env, w=700.0, h=70.0, pad=4.0):
    lo, hi = min(env), max(env)
    span = (hi - lo) or 1.0
    xs = [pad + i * (w - 2 * pad) / (len(env) - 1) for i in range(len(env))]
    ys = [pad + (1 - (v - lo) / span) * (h - 2 * pad) for v in env]
    return xs, ys


def polygon(env):
    xs, ys = wave_points(env)
    top = ' '.join(f'{x:.1f},{y:.1f}' for x, y in zip(xs, ys))
    return f'{top} 696,66 4,66'


def main():
    with open(ANALYSIS, encoding='utf-8') as f:
        data = json.load(f)

    blocks = []
    for key, m in data.items():
        if not m:
            continue
        title, note = LABELS.get(key, (key, ''))
        pts = polygon(m['envelope_dB'])
        blocks.append(f'''    <section class="item">
      <div class="head">
        <span class="name">{title}</span>
        <span class="dur">{m['duration_s']:.1f} 秒</span>
      </div>
      <p class="note">{note}</p>
      <svg class="wave" viewBox="0 0 700 70" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="{pts}" />
      </svg>
      <audio controls preload="none" src="{key}.mp3"></audio>
      <div class="metrics">
        <span>频谱质心 {m['centroid_Hz']:.0f} Hz</span>
        <span>动态范围 {m['dynamicRange_dB']:.1f} dB</span>
        <span>能量跳变 {m['onsets']} 次（{m['onsetRate_per_s']:.2f}/秒）</span>
        <span>低频占比 {m['low_lt250'] * 100:.0f}%</span>
      </div>
    </section>''')

    html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>芒果灵创生成结果试听</title>
<style>
  :root {{
    --bg: #0f0d14;
    --panel: #17141f;
    --line: #2a2438;
    --text: #e8e2f2;
    --dim: #9a92ad;
    --gold: #e8c98a;
    --green: #5dcaa5;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; padding: 32px 20px 64px;
    background: var(--bg); color: var(--text);
    font-family: system-ui, "Microsoft YaHei", sans-serif;
    line-height: 1.6;
  }}
  .wrap {{ max-width: 780px; margin: 0 auto; }}
  h1 {{ font-size: 20px; font-weight: 500; margin: 0 0 6px; }}
  .sub {{ color: var(--dim); font-size: 13px; margin: 0 0 8px; }}
  .findings {{
    background: var(--panel); border: 1px solid var(--line);
    border-radius: 10px; padding: 14px 18px; margin: 20px 0 28px;
    font-size: 13px; color: var(--dim);
  }}
  .findings strong {{ color: var(--gold); font-weight: 500; }}
  .group {{ margin: 0 0 10px; font-size: 13px; color: var(--dim);
            letter-spacing: 0.08em; }}
  .item {{
    background: var(--panel); border: 1px solid var(--line);
    border-radius: 12px; padding: 16px 18px; margin-bottom: 16px;
  }}
  .head {{ display: flex; justify-content: space-between; align-items: baseline; }}
  .name {{ font-size: 15px; font-weight: 500; }}
  .dur {{ font-size: 13px; color: var(--green); }}
  .note {{ margin: 2px 0 10px; font-size: 12px; color: var(--dim); }}
  .wave {{ display: block; width: 100%; height: 70px; margin: 0 0 12px;
           background: #100e17; border-radius: 6px; }}
  .wave polygon {{ fill: #4a3d6b; }}
  audio {{ width: 100%; height: 36px; margin-bottom: 10px; }}
  .metrics {{ display: flex; flex-wrap: wrap; gap: 6px 16px;
              font-size: 12px; color: var(--dim); }}
</style>
</head>
<body>
<div class="wrap">
  <h1>芒果灵创 · 生成结果试听</h1>
  <p class="sub">Mureka-9.5 · score 模式 · 2026-09-20</p>

  <div class="findings">
    <strong>先看波形再听。</strong>四条波形的形态说明它们都是「一首有起伏的曲子」，
    而不是「一层平稳的氛围」，也不是「单个音效」。<br>
    最下面两条的提示词写的是 <em>一声翻牌</em> —— 模型交回来的是
    <strong>180 秒</strong>。这说明 score 模式结构上就不产出短音效。
  </div>

  <p class="group">环境氛围（提示词：幽暗寂静、无旋律无节拍）</p>
{chr(10).join(b for k, b in zip(data.keys(), blocks) if GROUP.get(k) == 'long')}

  <p class="group" style="margin-top:26px">音效试探（提示词：单声翻牌，无音乐）</p>
{chr(10).join(b for k, b in zip(data.keys(), blocks) if GROUP.get(k) == 'sfx')}
</div>
</body>
</html>
'''

    path = os.path.join(OUTDIR, 'index.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print('wrote', path, len(html), 'chars')
    for fn in sorted(os.listdir(OUTDIR)):
        print('   ', fn, os.path.getsize(os.path.join(OUTDIR, fn)))


if __name__ == '__main__':
    main()
