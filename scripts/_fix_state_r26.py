"""修掉 PROJECT_STATE.md 被 shell 反引号替换写坏的那一段，并更正标题。

⚠️ 教训（值得记住）：**不要在 `bash -c "..."` 的双引号里写含反引号的文本。**
反引号在双引号内是命令替换 —— 实测它把 `脚本名` 当成命令执行了，
并且把替换结果（这里是空串）塞回文本里，于是每个反引号处都留下一个空洞。
→ 传文本给 Python 一律走**文件**，别走 shell 内联字符串。

用法：python scripts/_fix_state_r26.py
"""
import os

P = 'PROJECT_STATE.md'
CH = os.path.join('scripts', 'out', '_changelog_r26.md')
MARK = '- **2026-09-21（第二十六轮 · ①② 音效用 ElevenLabs 重做）**'

t = open(P, encoding='utf-8').read()

# 1) 砍掉被写坏的追加段（从标记到文件末尾）
i = t.find(MARK)
if i > 0:
    t = t[:i].rstrip() + '\n'
    print(f'已砍掉被写坏的段落（自 {i} 起）')
else:
    print('未找到坏段落（可能已修过）')

# 2) 追加正确内容
add = open(CH, encoding='utf-8').read().rstrip() + '\n'
t = t.rstrip() + '\n\n' + add

# 3) 更正 ⚠️ 标题 —— 那两个音已经换掉了，标题还写着「被否决、待替换」
old_title = '> ### ⚠️ 音效现状：③ flip / ④ reveal 用户认可；① charge / ② burst **被否决、待替换**'
new_title = ('> ### 音效现状：③ flip / ④ reveal 用户认可；① charge / ② burst '
             '**已重做并接进站点（待用户试听拍板）**')
if old_title in t:
    t = t.replace(old_title, new_title)
    print('⚠️ 标题已更正')
else:
    print('⚠️ 标题未命中（检查是否已改）')

open(P, 'w', encoding='utf-8').write(t)
print(f'PROJECT_STATE.md 已修复，长度 {len(t)}')

# 4) 体检：确认没有残留的「空洞」（反引号成对、无双空格夹中文标点的断裂）
import re
pairs = t.count('`')
print(f'反引号数量 {pairs}（应为偶数 → {"OK" if pairs % 2 == 0 else "异常"}）')
holes = re.findall(r'[\u4e00-\u9fff]：\s*（', t)
print(f'疑似空洞（「：」后紧跟「（」）：{len(holes)} 处')
