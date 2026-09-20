# -*- coding: utf-8 -*-
"""把 R29 文档里的「精确文件数」改成指向 SNAPSHOT.md。

起因：每加一个脚本，包里的文件数就变一次，而「改文档 → 重冻结 → 文件数又变」
会变成循环。**体积（7.5 / 111.6 MB）是稳的，文件数与 sha256 以清单为准。**
每条替换都断言命中恰好一次，命中数不对就整体不写。
"""
import io

EDITS = {
    'NEXT_STEPS.md': [
        (u'| 冻结快照 | `_archive/v2-2026-09-21/`：code **7.5 MB / 223 文件** · art **111.6 MB / 85 文件** · `SNAPSHOT.md` |',
         u'| 冻结快照 | `_archive/v2-2026-09-21/`：code **7.5 MB** · art **111.6 MB** · `SNAPSHOT.md`（文件数与两个 zip 的 sha256 **以那份清单为准**，文档不复述） |'),
        (u'├─ tarot-app-v2-code-2026-09-21.zip    7.5 MB / 223 文件（含 audio-src 与 scripts/out 的两个例外目录）',
         u'├─ tarot-app-v2-code-2026-09-21.zip    7.5 MB（含 audio-src 与 scripts/out 的两个例外目录）'),
        (u'├─ tarot-app-v2-art-2026-09-21.zip   111.6 MB /  85 文件（+ audio-src：四音源素材 · 候选 · 提示词台账）',
         u'├─ tarot-app-v2-art-2026-09-21.zip   111.6 MB（+ audio-src：四音源素材 · 候选 · 提示词台账）'),
        (u'对齐前 vs 后：代码包从「577 文件 / 58.6 MB，其中大半是垃圾」压到 **223 文件 / 7.5 MB**。',
         u'对齐前 vs 后：代码包从「577 个文件 / 58.6 MB，其中大半是垃圾」压到 **7.5 MB（约 1/8）**。'),
        (u'**两份清单各核一次**（223 + 85 = 308 个文件，0 不一致）→',
         u'**两份清单各核一次**（合计 300+ 个文件，0 不一致）→'),
    ],
    'PROJECT_STATE.md': [
        (u'- **快照**：`_archive/v2-2026-09-21/` —— code 7.5 MB / 223 文件 · art 111.6 MB / 85 文件 ·',
         u'- **快照**：`_archive/v2-2026-09-21/` —— code 7.5 MB · art 111.6 MB ·'),
        (u'两份清单各核一次（308 文件 / 0 不一致）→',
         u'两份清单各核一次（合计 300+ 文件 / 0 不一致）→'),
        (u'代码包从 577 文件 / 58.6 MB 压到 223 文件 / 7.5 MB。',
         u'代码包从 577 个文件 / 58.6 MB 压到 7.5 MB（约 1/8）。'),
    ],
}

fail = []
for path, pairs in EDITS.items():
    s = io.open(path, encoding='utf-8').read()
    for old, new in pairs:
        n = s.count(old)
        if n != 1:
            fail.append('%s: 命中 %d 次 -> %s' % (path, n, old[:50]))
            continue
        s = s.replace(old, new)
    if not any(f.startswith(path + ':') for f in fail):
        io.open(path, 'w', encoding='utf-8', newline='').write(s)
        print(u'✓ 已更新:', path)
    else:
        print(u'✗ 跳过:', path)

if fail:
    print(u'\n失败项：')
    for f in fail:
        print(u'  ' + f)
    raise SystemExit(1)
print(u'DONE')
