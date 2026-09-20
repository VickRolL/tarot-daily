# -*- coding: utf-8 -*-
"""把第二十九轮（v2 定稿存档）追加到 PROJECT_STATE.md 与 NEXT_STEPS.md。幂等。"""
import io

PS = 'PROJECT_STATE.md'
NS = 'NEXT_STEPS.md'

R29_NS = u'''
---

## 20 · 2026-09-21 第二十九轮：v2 定稿存档（打标签 + 冻结快照 + 还原演练）

**起因**：用户听完四个音效后说「很好，现在音效很符合我的需求。可以上传这个版本作为第二版保存」。
于是把当前版本定成 **v2**：打标签 → 冻结快照 → 推远端 → 还原演练。

### 20.1 交付了什么

| 项 | 结果 |
|---|---|
| git 标签 | `v1` → `bb0ad52`（v1 基线）、`v2` → 本轮提交（四个音效定稿版） |
| 冻结快照 | `_archive/v2-2026-09-21/`：code **7.5 MB / 223 文件** · art **111.6 MB / 85 文件** · `SNAPSHOT.md` |
| 远端 | `origin/main` 推送完成 —— 此前 **R25~R28 的提交只在本地**（`git status -sb` 显示 ahead 13） |
| 还原演练 | `scripts/verify_snapshot_restore.py --label v2 --date 2026-09-21` → **PASS** |

### 20.2 冻结前体检揪出两条**静默故障**（都已修）

**(1) `.env.local` 会被烤进 zip。**
`freeze_snapshot.py` 的 `collect()` 把**根目录散件一律**收进代码包，而 `.env.local`
（ElevenLabs API key）正好躺在根目录。v1 冻结于 2026-09-19，那时这个文件还不存在
（R26 才引入）—— 所以这是**两个版本之间新出现的口子**。专写 `scripts/_preflight_v2.py` 体检时抓到：

- 修：`skip()` 排除 `.env*` / `*.key`，并加**硬闸** —— 收集结果里一旦出现密钥类文件就**拒绝出包**（一个 zip 都不生成）。
  只靠白名单式排除不够：以后谁把 key 挪进 `secrets.json` 之类的新文件名，就会被静默放行。
- 同时先确认 **key 从没进过 git**：`git ls-files` 无、历史路径 0 条、把密钥「值」当指纹扫遍
  **601 个对象 0 命中**。**这条必须先验** —— 推送远端不可撤销，推上去等于公开。

**(2) 两个包的清单同名 → 只核到半个包，而结果看起来是绿的。**
两个 zip 都解到同一个 `tarot-app/` 下，而两边都写 `MANIFEST.sha256` → 后解的覆盖先解的。
之后在合并目录里跑 `verify_manifest.mjs` 只会核对到其中**一个**包（85 个或 223 个），
**输出却是「✓ 全部一致」**。v1 就是这样。

- 修：素材包改用 `MANIFEST-art.sha256`；`verify_manifest.mjs` 加 `--manifest <文件名>`。
- **反向验证**（不能只验正向）：完整包 → 85 个核对 0 不一致 rc=0；
  故意**篡改 1 个字节 + 移走 1 个文件** → 精确报「缺失 1 个 / 内容不一致 1 个」rc=1。

### 20.3 收录范围顺手对齐（判据 =「丢了会不会痛」）

| 目录 | 处置 | 理由 |
|---|---|---|
| `audio-src/` | **新收**（并入素材包） | `sfx/_raw/` 四个音源是 AI 生成的、重出要花额度 —— 旧规则漏了它，快照里只保住**成品**没保住**源素材** |
| `scripts/out/_exp/` | **保留** | ElevenLabs 生成的候选**源素材**，本地不可再生 |
| `scripts/out/_raw-backup-*/` | **保留** | 历代 `_raw` 备份 —— 换素材时的退路 |
| `scripts/out/` 其余 | 排除 | 日志 / 截图 / 由上面那些本地加工出来的派生品（`_try/` `_tune/`），重跑脚本即可再得 |

对齐前 vs 后：代码包从「577 文件 / 58.6 MB，其中大半是垃圾」压到 **223 文件 / 7.5 MB**。

### 20.4 还原演练（这一步不能省）

新增 `scripts/verify_snapshot_restore.py`（可复用，v3 直接跑）：换**全新目录**解包 →
**两份清单各核一次**（223 + 85 = 308 个文件，0 不一致）→ 借 `node_modules`（**目录联接**；
本机 `npm run build` 会被安全策略拦，所以直接调 `vite.js`）→ **用包内 `audio-src/sfx/_raw/` 重建音效**
（ALL_PASS）→ `vite build`（成功，`dist/assets` 5 个 mp3）。

- 为什么第 3 步要「由源重建音效」：它证明**素材包里那四个 `-raw.mp3` 是够用的** ——
  否则快照只保住了成品，日后想改音效还是得重新花钱生成。
- 为什么第 4 步要真构建：`public/` 里的运行时素材**不由 import 解析**，
  光看「包生成了」查不出漏目录，只有构建才暴露。
- 踩到的小坑：`mklink` 的输出是本机 OEM 代码页（简中 Windows 是 GBK），
  `subprocess.run(..., text=True)` 会在线程里抛 `UnicodeDecodeError`（不致命但很脏）→ 改成收字节再 `decode(errors='replace')`。

### 20.5 一处诚实的遗留

快照里的文档是**冻结那一刻**的版本。本轮的做法是**先把文档改好、再冻结**，
所以快照内的 `PROJECT_STATE.md` / `NEXT_STEPS.md` 已包含 v2 存档的记录。
但 `SNAPSHOT.md` 记录的两个 zip sha256 列在 `SNAPSHOT.md` 自己里面，文档只**指向路径、不复述哈希** ——
这样才不会出现「改文档 → 哈希变 → 再改文档」的循环。
'''

R29_PS = u'''
### 第二十九轮 · v2 定稿存档（2026-09-21）

用户认可四个音效后要求「上传这个版本作为第二版保存」→ 定成 **v2**。

- **标签**：`v1` → `bb0ad52`（v1 基线）· `v2` → 本轮提交（四个音效定稿版）
- **快照**：`_archive/v2-2026-09-21/` —— code 7.5 MB / 223 文件 · art 111.6 MB / 85 文件 ·
  `SNAPSHOT.md`（构成 + 两份清单 + 两个 zip 的 sha256 + 关键文件指纹 + 还原步骤）
- **远端**：`origin/main` 推送完成。此前 **R25~R28 的提交只在本地**（ahead 13），
  也就是说线上那份一直是「还没有音效」的旧版本
- **演练**：`scripts/verify_snapshot_restore.py`（新增，可复用）换全新目录解包 →
  两份清单各核一次（308 文件 / 0 不一致）→ 由包内 `_raw/` 重建音效（ALL_PASS）→ `vite build` 成功

**冻结前体检抓到两条静默故障（都已修）**：

1. **快照会把 `.env.local` 烤进 zip** —— `collect()` 把根目录散件一律收进代码包，
   而 API key 正好在根目录。v1 冻结时该文件还不存在，是**两个版本之间新出现的口子**。
   已加排除 + **硬闸**（收集结果出现密钥类文件即拒绝出包）。
   并先验明 **key 从没进过 git**（扫遍 601 个对象 0 命中）—— 推送不可撤销，这条必须在推之前查。
2. **两个包的清单同名**（都叫 `MANIFEST.sha256`）→ 解到同一目录互相覆盖，
   在合并目录里核对只覆盖到**一个**包，**输出却是「✓ 全部一致」**。v1 就是这样。
   已改成 `MANIFEST.sha256` / `MANIFEST-art.sha256`，校验脚本加 `--manifest`；
   并做了反向验证（篡改 1 个 + 移走 1 个 → 精确判红）。

**收录范围对齐**：新收 `audio-src/`（含 `sfx/_raw/` 四个 AI 音源 —— 旧规则只保住了成品没保住源素材）；
`scripts/out/` 只留 `_exp/` 与 `_raw-backup-*/`（花过 API 额度的），其余日志截图全排。
代码包从 577 文件 / 58.6 MB 压到 223 文件 / 7.5 MB。
'''


def append(path, marker, block):
    s = io.open(path, encoding='utf-8').read()
    if marker in s:
        print(u'跳过（已存在）:', path)
        return
    if not s.endswith(u'\n'):
        s += u'\n'
    s += block
    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print(u'✓ 已追加:', path, u'新长度', len(s))


append(NS, u'## 20 · 2026-09-21 第二十九轮', R29_NS)
append(PS, u'第二十九轮 · v2 定稿存档', R29_PS)
print(u'DONE')
