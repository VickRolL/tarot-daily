# -*- coding: utf-8 -*-
"""把 audio-src/README.md 的 ③ flip 一节与到货表更新到第二十七轮的实测状态。

为什么要写成脚本而不是手改：**每一处替换都断言命中次数**。
手改一次漏一处、或者改了 A 忘了改 B，都不会有人报错 —— 而这两处正是
「下游按它对照」的地方（合同时长、成品实测表）。
"""
import os
import sys

README = os.path.join('audio-src', 'README.md')
NEW_SECTION = os.path.join('scripts', 'out', '_readme_flip_section.md')


def replace_once(t, old, new, what):
    n = t.count(old)
    if n != 1:
        print(f'✗ {what}：期望命中 1 次，实际 {n} 次 —— 原文可能已改，请人工确认')
        return None
    return t.replace(old, new)


def main():
    with open(README, encoding='utf-8') as f:
        t = f.read()
    with open(NEW_SECTION, encoding='utf-8') as f:
        new_sec = f.read()

    # ── 1) 整节替换 ③（从标题到 ④ 的标题之间）──────────────────────────
    i = t.find('### ③ flip')
    j = t.find('### ④ reveal')
    if i < 0 or j < 0 or j <= i:
        print('✗ 找不到 ③/④ 的节的边界')
        return 2
    t = t[:i] + new_sec + t[j:]

    # ── 2) 到货情况：补一条第二十七轮的记录 ──────────────────────────
    old_note = ('>   `flip` / `reveal` 用户明确认可（「后面两个音效的效果还可以，暂时可以先」），**一点没动**。\n')
    new_note = ('>   `flip` / `reveal` 用户当时明确认可（「后面两个音效的效果还可以，暂时可以先」），**一点没动**。\n'
                '> · **2026-09-21（第二十七轮：重做 ③）**：用户第二轮意见「冗杂、像翻书、像翻了两三张牌」→\n'
                '>   `flip` 换成新素材（0.6s，一次起手）+ 三处参数重新定标。`charge` / `burst` / `reveal` 未动。\n')
    t2 = replace_once(t, old_note, new_note, '到货情况补记')
    if t2 is None:
        return 2
    t = t2

    # ── 3) 成品实测表：flip 那一行 ──────────────────────────────────
    old_row = '> | flip | 0.862s | 1.5s | -17.0dB | -0.7dBFS | **软削顶**（1.44% 样本） |\n'
    new_row = '> | flip | 0.627s | 0.6s | -18.3dB | -2.6dBFS | **软削顶**（2.13% 样本） |\n'
    t2 = replace_once(t, old_row, new_row, '成品实测表的 flip 行')
    if t2 is None:
        return 2
    t = t2

    old_spread = '> 四个音彼此响度差 **1.5dB**（burst 按设计高一点）。数字的复现方式：\n'
    new_spread = ('> 四个音彼此响度差 **2.2dB**（burst 按设计高一点；flip 是瞬态，\n'
                  '> 按整段 RMS 对齐持续音的水位会把它压平，所以设计目标就低一档 —— 见 ③ 节）。\n'
                  '> 数字的复现方式：\n')
    t2 = replace_once(t, old_spread, new_spread, '响度差那一行')
    if t2 is None:
        return 2
    t = t2

    with open(README, 'w', encoding='utf-8') as f:
        f.write(t)
    print('✓ README 已更新，新长度', len(t))
    for k in ('### ③ flip', '第二十七轮', '0.627s', '2.2dB'):
        print(f'   {k:14s} 出现 {t.count(k)} 次')
    return 0


if __name__ == '__main__':
    sys.exit(main())
