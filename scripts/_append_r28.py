# -*- coding: utf-8 -*-
"""把第二十八轮（③ flip 由用户拍板定稿 s2-50）追加进 PROJECT_STATE.md 与 NEXT_STEPS.md。
单次执行、幂等（已在则跳过）。"""
import io

PS = 'PROJECT_STATE.md'
NS = 'NEXT_STEPS.md'

R28_PS = u'''
- **2026-09-21（第二十八轮 · ③ flip 定稿：用户在五条候选里选了 `s2-50`）**
  用户听完候选试听页后给了结论：**「我会选 S2-50 这一个」**。已按选择完成替换、重建与验收。
  `charge` / `burst` / `reveal` 未动。

  - **`s2-50` 是什么**：0.5s 素材（成品 `0.522s`），英文稿
    「A snappy card flip: one short, tight, crisp snap of a single playing card
    turning over quickly, bright paper texture, sharp attack, the tail stops at once.」，
    铺满度 0.589、2 次起手、**质心 5483Hz（五条里最亮）**。
  - **⚠️ 一个必须记下来的事实：这条在手势维度上是五条里最差的。**
    成品铺满度 **0.686**（自定阈值 0.55）、末次起手 **64%**（阈值 45%）**两项超标**；
    而上一版 `s1-60` 分别是 0.200 / 32%。也就是说**用户抱怨的是「手势」，
    但最终打动他的是「音色 + 时长」**（质心最亮 8126Hz、时长最短 0.522s，
    比 `s1-60` 短 17%）。候选页上这两项超标是**明示**的，用户看过仍选它 → 耳朵拍板成立。
    → 可复用结论：**听感里的「利落」不只由 duty / 末次起手构成，还包含亮度和绝对长短**。
    要补判据应该给 `centroid_Hz` 和时长加**双侧区间**，而不是继续收紧 duty。
  - **「手势守恒」判据这次没有拦**：`s2-50` 素材 duty 0.589 > 0.5 → 被判为**持续型、免检**。
    这是判据设计的有意之处（持续型不该按瞬态标准要求），但也意味着
    **现役文件目前不受这条判据保护** —— 已在 `audio-src/README.md` ③ 节明写。
  - **新增的备份退路**：上一版 `s1-60` 的素材备份在
    `scripts/out/_raw-backup-20260921-014500/flip-raw.mp3`，
    想退回直接覆盖 `audio-src/sfx/_raw/flip-raw.mp3` 再 `build-sfx.py --force` 即可。
  - **改动**：`audio-src/sfx/_raw/flip-raw.mp3` 换成 `s2-50`；
    `_make_flip_page.py` 的 `CHOSEN` 改 `s2-50`（并把 s2-50 提到候选列表首位、
    s1-60 标注为「上一版现役」）；成品 `flip.mp3` 重出。
  - **验收**：`build-sfx.py --force` **ALL_PASS true**（flip 解码后 -18.0dB / -1.1dBFS /
    0.522s / 软削顶 0.69%，比上一版 2.13% 更低；四音响度离散 **1.9dB**）·
    `probe-sfx` dev 与 prod **各 ALL_PASS** · 8 个 flow 回归全过 · `vite build` 干净。
  - **⚠️ 顺手修掉一个「换素材换出来的构建故障」：Vite 把小音频内联进了 JS。**
    `flip.mp3` 缩到 **4010 字节**，低于 Vite 默认的 `assetsInlineLimit` **4096** →
    它被编码成 base64 data URI 塞进 JS 包，**构建产物里不再有 `flip-<hash>.mp3`**。
    症状：`probe-sfx` 那条「四个 mp3 都被下载」的判据按 `*.mp3` 文件名匹配请求，
    data URI 的 basename 不是 `.mp3` → **生产上直接判红**（dev 上仍绿，因为 dev 不内联）。
    已修：`vite.config.js` 加 `build.assetsInlineLimit`，对音视频扩展名一律返回 `false`，
    其他小资源保持默认。修完 `dist/assets/flip-CxGpJFXG.mp3` 正常产出、JS 包小了 5.3KB。
    → **教训：判据里的「资源被下载了」这类断言，会被打包器的内联优化静默击穿；
      素材变小可能改变构建行为**（阈值判据的经典陷阱）。
  - **成品实测（现役四音）**：charge 1.045s / -17.1dB / -12.0dBFS ·
    burst 1.515s / -16.1dB / -3.3dBFS · **flip 0.522s / -18.0dB / -1.1dBFS** ·
    reveal 4.049s / -17.2dB / -3.1dBFS。
'''

R28_NS = u'''
## 19 · 2026-09-21 第二十八轮：③ flip 定稿（用户在候选里选了 `s2-50`）

用户原话：**「我会选 S2-50 这一个」**。已按选择替换、重建、验收完毕。
`charge` / `burst` / `reveal` 未动。

### 19.1 选了什么

| | `s2-50`（现役） | `s1-60`（上一版） | 旧版（被否） |
|---|---|---|---|
| 素材时长 | 0.5s（成品 **0.522s**） | 0.6s（成品 0.627s） | 1.0s（成品 0.862s） |
| 成品质心 | **8126Hz** | 6142Hz | — |
| 成品时长 | **0.522s** | 0.627s | 0.862s |
| 成品铺满度 | **0.686** ⚠️ | 0.200 | 0.869 |
| 末次起手位置 | **0.641** ⚠️ | 0.317 | 0.774 |
| 软削顶 | 0.69% | 2.13% | 1.44% |

稿子（英文，直连 ElevenLabs 的必须条件）：
```
A snappy card flip: one short, tight, crisp snap of a single playing card
turning over quickly, bright paper texture, sharp attack, the tail stops at once.
```

### 19.2 ★ 记一笔：用户抱怨的是「手势」，最后打动他的是「音色 + 时长」

`s2-50` 是五条候选里**手势最"满"**的一条 —— 铺满度 0.686、末次起手 64%，
**两项都超过我们按他第一轮意见定的阈值**（0.55 / 0.45），而上一版 `s1-60` 是 0.200 / 0.317。
候选页上这两项超标是**明示**的（红字 + 「2 项超标」pill），用户看过仍然选它。

他选它的理由从数据上很清楚：**质心 8126Hz（五条里最亮）+ 时长 0.522s（最短）**。

> **可复用结论**：听感里的「利落」不是单一维度。这次量出来的「手势」抓住了
> 「有几下、挤不挤在开头」；但**亮度（质心）和绝对长短同样在起作用**，
> 而当时的判据只给了质心一个**很宽的单侧下限**（600~9500Hz），等于没约束。
> → 要补就补 `centroid_Hz` 的**双侧区间**和时长区间，**不是继续收紧 duty**。
> → 也别因此推翻「手势守恒」判据：它抓的是**真故障**（流水线把瞬态填平、旧版 0.24→0.89），
>   这次没拦是因为 `s2-50` **素材本身** duty 0.589 > 0.5，被判为持续型、免检 —— 判据在按设计工作。

### 19.3 判据现状（要诚实记的）

- 「手势守恒」**目前没有在看守现役文件**（`s2-50` 被判持续型）。这是设计内的豁免，
  但必须写在文档里，否则下一个人会以为现役文件被守住了。已在 `audio-src/README.md` ③ 节明写。
- 其余判据照常：峰值不过满刻度（pinned 0）、响度离散 ≤3dB（实测 **1.9dB**）、
  四音素材全部走素材路、探针在 dev 与 prod 各跑一次。

### 19.4 验收（全部通过）

| 项 | 结果 |
|---|---|
| `build-sfx.py --force` | **ALL_PASS true**；flip 解码后 **0.522s / -18.0dB / -1.1dBFS** / 软削顶 **0.69%** |
| 响度离散 | **1.9dB**（charge -17.1 / burst -16.1 / flip -18.0 / reveal -17.2） |
| `probe-sfx` dev | **ALL_PASS**，`sfxStatsDrift` 空、`sfxPeakOver` 空 |
| `probe-sfx` prod | **ALL_PASS** |
| 回归 8 flow | `probe-sfx-off` / `probe-ambient` / `probe-devbar-sfx` / `probe-charge` / `audit-title` / `audit-draw` / `dev-verify` 全过 |
| `vite build` | 干净 |

### 19.5 退路

上一版 `s1-60` 的素材备份在 `scripts/out/_raw-backup-20260921-014500/flip-raw.mp3`。
想退回：覆盖 `audio-src/sfx/_raw/flip-raw.mp3` → 改 `_make_flip_page.py` 的 `CHOSEN` →
`build-sfx.py --force`。

### 19.6 ★ 换素材换出来的构建故障：**Vite 把小的音频内联进了 JS**

`flip.mp3` 从 4997 字节缩到 **4010 字节**，**低于 Vite 默认的 `assetsInlineLimit` = 4096**。
于是它被编码成 base64 data URI 塞进 `index-*.js`，**`dist/assets/` 里再也没有 flip 的 mp3**
（其余三个大于 4096，照旧是独立文件）。

| | 修之前 | 修之后 |
|---|---|---|
| `dist/assets/flip-*.mp3` | **不存在**（被内联） | `flip-CxGpJFXG.mp3` 4010B |
| `index-*.js` 体积 | 336,328 B | 330,982 B（−5.3KB，正是那份 base64） |

**症状与判据的关系**：`probe-sfx` 的 `PASS_sfxDownload` 按 `*.mp3` **文件名**匹配网络请求
（`baseName(url).startsWith(assetName)`）。data URI 的 basename 是 `data:audio/mpeg;base64,...`，
不以 `.mp3` 结尾 → **匹配不到** → `sfxHits.length = 3 < 4` → **生产判红**。
而 **dev 上仍然是绿的**（dev 不套 `assetsInlineLimit`，照常发 `flip.mp3` 这个 URL）——
所以这条故障**只有 prod 那一轮**会现形，正是「dev 与 prod 各跑一次」这条规矩救的。

**修法**（`vite.config.js`）：对音视频扩展名一律不内联，其余资源保持 Vite 默认。
```js
build: {
  assetsInlineLimit: (filePath) =>
    /\\.(mp3|m4a|aac|ogg|oga|wav|flac|mp4|webm)$/i.test(filePath) ? false : undefined
}
```
音频本来就该走独立文件（可单独缓存、可 Range、不进 JS 包）。

> **通用教训**：「资源被下载了」这类判据会被**打包器的内联优化**静默击穿。
> 而且触发条件是**素材尺寸跨过某个阈值**（4096）—— 换个更小的素材就会让它发生，
> 跟「改了什么业务逻辑」毫无关系。**凡是判「某个文件被请求了」的断言，
> 都要同时在 dev 与 prod 各跑一次**，因为内联/哈希/拍平这些都只发生在构建那一步。

### 19.7 另一条操作教训：**探针在跑的时候不要往工程里写文件**

`vite dev` 的 watcher 覆盖整个工程根目录。第一轮跑 8 个 flow 的时候，
我在同一时间写了 `scripts/_append_r28.py`（以及改 `vite.config.js`），
于是 dev server 触发了 **full-reload**，探针页面正在跑的 eval 被换掉 →
`shot.mjs` 等不到结果，**卡死 5 分钟以上**（日志停在第一条 flow）。
→ 规矩：**探针跑之前把所有文件写入做完**；跑的过程中不要动工程内的文件。
（顺带印证了本项目一直强调的：这种卡死**不会报错**，只会「什么都不发生」。）

### 19.8 交付方式的一条经验：**本地 HTML 直接预览会静默无声**

候选页用相对路径引同目录的 mp3。用「直接预览 HTML 文件」的方式打开时，
预览面板**只发 HTML、不同目录下的 mp3** → 实测 `flip--s2-50.mp3` 返回 **404**，
页面看起来完全正常（播放器在、按钮在、数字在）但**一点声音都没有**。
→ 正确做法：起一个支持 Range 的本地静态服务（`audio-asset-qa` 技能里的 `serve_range.py`）
并绑定到 `audio-src/candidates/`，把 **localhost URL** 交给预览面板。
已实测：7 个文件全 200、Range 请求返回 `206`（能拖进度条）。
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

append(PS, u'第二十八轮 · ③ flip 定稿', R28_PS)
append(NS, u'## 19 · 2026-09-21 第二十八轮', R28_NS)
print(u'DONE')
