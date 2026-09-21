"""
第三十二轮：把每张牌的 advice（单条）改写成 advices（3~5 条）。
- 第 0 条必须与改造前的原文逐字相同（否则就是悄悄改了用户已看过的内容）
- 每条 <= 28 字（= 改造前最长那条的字数）：面板是内容撑高的，超了必然压到卡牌
- 全局不重复：同一句话出现在两张牌上，读起来就是模板腔
输出：改写 src/data/cards.js（保持原有换行风格），并打印一份核对表。
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS = os.path.join(ROOT, 'src', 'data', 'cards.js')
DATA = os.path.join(ROOT, 'scripts', 'out', '_r32_advices.json')
CAP = 28

src = io.open(CARDS, encoding='utf-8').read()
raw = io.open(DATA, encoding='utf-8').read()
payload = json.loads(raw)
payload.pop('_note', None)

# 按出现顺序取出每个卡块：从 `id: 'major-xx'` 到 block 结束（用 advice 行定位）
id_positions = [(m.group(1), m.start()) for m in re.finditer(r"id: '(major-\d+)'", src)]
assert len(id_positions) == 22, '卡牌数量不是 22：%d' % len(id_positions)

advice_re = re.compile(r"^    advice: '([^']*)',$", re.M)
matches = list(advice_re.finditer(src))
assert len(matches) == 22, 'advice 行数不是 22：%d' % len(matches)

# 每个 advice 行归属于它前面最近的那个 id
pairs = []
for m in matches:
    owner = None
    for cid, pos in id_positions:
        if pos < m.start():
            owner = cid
        else:
            break
    pairs.append((owner, m))

report = []
seen = {}
for cid, m in pairs:
    old = m.group(1)
    new = payload.get(cid)
    assert new, '%s 在数据文件里缺失' % cid
    assert 3 <= len(new) <= 5, '%s 条数是 %d，要求 3~5' % (cid, len(new))
    assert new[0] == old, '%s 的第 0 条与原文不符：\n  原 %r\n  新 %r' % (cid, old, new[0])
    for line in new:
        assert line and line == line.strip(), '%s 有空行或有首尾空格：%r' % (cid, line)
        assert len(line) <= CAP, '%s 有一句 %d 字，超过 %d 字上限：%r' % (cid, len(line), CAP, line)
        assert line not in seen, '跨牌重复：%r（%s 与 %s）' % (line, seen.get(line), cid)
        seen[line] = cid
    assert len(set(new)) == len(new), '%s 内部有重复' % cid
    report.append((cid, len(new), [len(x) for x in new]))

# 从后往前替换，避免位置漂移
for cid, m in reversed(pairs):
    new = payload[cid]
    body = ',\n'.join('      %s' % json.dumps(x, ensure_ascii=False) for x in new)
    # json.dumps 会给字符串加双引号，这里是 JS 源码；统一换成单引号
    body = body.replace('"', "'")
    block = '    advices: [\n%s\n    ],' % body
    src = src[:m.start()] + block + src[m.end():]

io.open(CARDS, 'w', encoding='utf-8', newline='\n').write(src)

print('已改写 %s' % CARDS)
total = sum(r[1] for r in report)
print('牌数 %d · 建议总数 %d · 最长 %d 字 · 上限 %d 字'
      % (len(report), total, max(max(r[2]) for r in report), CAP))
for cid, n, lens in report:
    print('  %s  %d 条  %s' % (cid, n, lens))
