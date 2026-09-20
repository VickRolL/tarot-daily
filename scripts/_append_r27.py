# -*- coding: utf-8 -*-
"""把第二十七轮（③ flip 改成「一次起手」）追加进 PROJECT_STATE.md 与 NEXT_STEPS.md。
单次执行、幂等（已在则跳过）。"""
import io, os, sys

PS = 'PROJECT_STATE.md'
NS = 'NEXT_STEPS.md'

R27_PS = u'''
- **2026-09-21（第二十七轮 · ③ flip 改成「一次起手」；揪出流水线会把瞬态填满）**
  用户原话：「翻牌那里的音效效果是**符合的**，但是冗杂了点，听起来像在翻书，而翻牌要**利落一点**，
  你这个听起来像**翻了两三张牌**需要修改一下」。
  ⚠️ 注意语气：**方向是对的，只嫌手势冗杂** —— 所以这一轮**没动音色/提示词方向**，
  只把「几张牌」压成「一次起手」。这跟 ①② 那轮「方向被否决、整条重做」不是一回事。

  - **先把「像翻了两三张牌」量化**：旧 flip 拆出 **3 次起手**、首末跨度 **0.563s**、
    末次起手落在 **63%** 处，能量「铺满度」duty 从 **0.24 → 0.89**（越接近 1 越像持续噪声）。
  - **★ 根因（消融查出来的，是个静默故障）：那层「沙子」不是素材里的，是流水线自己填出来的。**
    逐级消融（`scripts/_ablate_flip.py`）：源素材 crest 25.9~28.8dB / duty 0.151
    （干净的一次瞬态），过完 **RMS 归一 + 软削顶**这一步后变成 crest 14.5dB / duty 0.891
    —— 因为源 RMS 只有 -33.5dB，要拉到目标必须加 +16.9dB，峰值溢出 → 软削顶把空隙**全填上**。
    **「利落」是被归一化这一步吃掉的**，看源文件和听成品都不容易发现。
  - **新增判据「手势守恒」**（`build-sfx.py`）：瞬态素材（duty < 0.5）**不许**被流水线填空
    （成品 duty > 0.55）或压掉动态（crest < 12dB）。**反向验证做过**：旧素材 0.241→0.891 判红、
    新素材 0.151→0.176 判绿。这条以前是**静默**的 —— 不新增判据，下一轮还会踩。
  - **生成端加「手势」维度**（`gen-sfx-elevenlabs.py`）：`n_onset` / `onset_span_s` /
    `last_onset_ratio` / `duty_20` / `crest_db`；flip 的 `TARGETS` 定为
    跨度 ≤0.20s、末次起手 ≤45%、铺满 ≤0.55、crest ≥16dB。
    反向验证：旧 material 在跨度与末次起手上直接 FAIL。
  - **解一个三角约束（天花板 × 增益 × 候选）**：要同时满足「零钳位样本 / 峰值 ≤-1.0dBFS /
    四音响度离散 ≤3.0dB」。`scripts/_tune_flip.py` 做三维扫描，最终选 **s1-60**
    （0.6s，英文短稿「a single crisp playing card flick」）+ `ceiling -4.0` + `rms -16.0`。
    为此给 `SPECS` 加了**逐音天花板** `spec.get('ceiling', PEAK_CEILING_DB)`。
  - **修一条探针假红（浏览器与流水线的量法不一致）**：`probe-sfx` 报 flip 漂 0.8dB，
    超了 0.6dB 容差。根因：**浏览器侧 RMS 算的是整文件（含编码静音尾），流水线算的是修剪后的**
    —— 翻牌稀疏，尾巴占比大，差值就显出来了（密的声音根本察觉不到）。
    → `sfx.js` 的 `measure()` 也先按 **-55dB 相对阈值**修剪静音，与 `build-sfx.py` 同一套。
    修完 `sfxStatsDrift` 空、离散 **2.2dB**。
  - **验收**：`build-sfx.py --force` **ALL_PASS true**（flip 解码后 -18.3dB / 峰值 -2.6dBFS /
    0.627s / 软削顶 2.13%；手势守恒 0.151→0.176 绿）· `probe-sfx` dev 与 prod **各 ALL_PASS**
    （`sfxStatsDrift` 空、`sfxPeakOver` 空、离散 2.2dB）· 8 个 flow 全过 ·
    `vite build` 干净（无 dev 痕迹、dist 里 `flip-DoXlLpbD.mp3` 与源一致）。
  - **交付物**：`audio-src/candidates/flip.html` —— 5 条候选（s1-50 / s2-50 / s3-50 / s1-60 / s3-60）
    各走**完整流水线**后的成品对比 + 被否决的旧版作对照，数字由指标文件生成、不手抄。
    **当前站点里放的是 s1-60**，等用户听完拍板。
'''

R27_NS = u'''
## 18 · 2026-09-21 第二十七轮：③ flip 改成「一次起手」（并揪出「流水线填满瞬态」）

用户原话：**「翻牌那里的音效效果是符合的，但是冗杂了点，听起来像在翻书，
而翻牌要利落一点，你这个听起来像翻了两三张牌需要修改一下」。**

### 18.1 先读语气：**方向对，只改手势**

「符合的」= 音色/方向通过，不用重做。所以这一轮**没有换提示词方向**，
只把「翻两三张」压成「一次起手」。这与 ①② 那轮（方向被否决 → 整条重写）性质不同，
别把两轮的做法弄混。

### 18.2 ★ 静默故障：**是流水线把瞬态填满的，不是素材**

旧 flip 的手势量出来是：**3 次起手**、首末跨度 **0.563s**、末次起手落在 **63%**、duty **0.24 → 0.89**。

逐级消融（`scripts/_ablate_flip.py`）证明「像翻书的那层沙子」出现在**归一化那一步**：

| 阶段 | crest | duty |
|---|---|---|
| 源素材 | 25.9~28.8dB | 0.151（干净的一次瞬态） |
| RMS 归一 + 软削顶后 | 14.5dB | **0.891** |

原因很朴素：源素材 RMS 只有 -33.5dB，拉到目标要加 **+16.9dB**，峰值溢出 →
**软削顶把两次瞬态之间的空隙全填上了**。「利落」就是这么被吃掉的。

→ 结论：**这不是素材质量问题，是流水线的副作用**。素材再好，只要增益给够就会重演。

### 18.3 新增判据：**手势守恒**（`build-sfx.py`）

> 瞬态素材（duty < 0.5）**不许**被流水线填空（成品 duty > 0.55）、也不许被压掉动态（crest < 12dB）。

**反向验证**：旧素材 0.241→0.891 **判红**，新素材 0.151→0.176 **判绿**。
这条以前**完全是静默的** —— 不补上，下一轮换素材还会再踩一次。

同时生成端（`gen-sfx-elevenlabs.py`）加了手势维度并在生成时先筛：
`n_onset` / `onset_span_s` / `last_onset_ratio` / `duty_20` / `crest_db`；
flip 的 `TARGETS` = 跨度 ≤0.20s · 末次起手 ≤45% · 铺满 ≤0.55 · crest ≥16dB。

### 18.4 三角约束：天花板 × 增益 × 候选

flip 峰值系数大，三个约束互相拉扯：**零钳位样本** · **峰值 ≤-1.0dBFS** · **四音响度离散 ≤3.0dB**。
`scripts/_tune_flip.py` 做三维扫描，最终 **s1-60**（0.6s，英文短稿
「a single crisp playing card flick: one quick, sharp snap」）+ `ceiling -4.0` + `rms -16.0`。

> 顺手加的机制：`SPECS` 支持**逐音天花板** `spec.get('ceiling', PEAK_CEILING_DB)`。
> 全局 -2.8dBFS 对 flip 不够，单点覆盖比全局调低更安全（不影响另外三个音）。

### 18.5 一条探针假红：浏览器与流水线**量法不一致**

`probe-sfx` 报 `flip -19.1 vs -18.3`（漂 0.8dB > 0.6dB 容差）。

根因：**浏览器侧 RMS 算的是整文件（含编码静音尾），流水线算的是修剪后的**。
翻牌稀疏、尾巴占比大，差值就显出来了；密的声音（charge/burst/reveal）察觉不到。

→ `src/audio/sfx.js` 的 `measure()` 也先按 **-55dB 相对阈值**修剪静音（`TRIM_PAD_S = 0.02`），
与 `build-sfx.py` 的 `trim_silence` 用同一套规则。修完 `sfxStatsDrift` 空、离散 **2.2dB**。

> 通用规则：**量同一个物理量，两边的预处理必须先对齐**。否则「同一指标两个数」会长期误报，
> 而且只在稀疏素材上暴露 —— 修起来像玄学。

### 18.6 验收（全部通过）

| 项 | 结果 |
|---|---|
| `build-sfx.py --force` | **ALL_PASS true**；flip 解码后 **-18.3dB / -2.6dBFS / 0.627s / 软削顶 2.13%** |
| 手势守恒 | flip 0.151→0.176（绿）；反向验证旧素材 0.241→0.891 判红 |
| 响度离散 | **2.2dB**（charge -17.1 / burst -16.1 / flip -18.3 / reveal -17.2） |
| `probe-sfx` dev | **ALL_PASS**，`sfxStatsDrift` 空、`sfxPeakOver` 空 |
| `probe-sfx` prod(4199) | **ALL_PASS**，抓到 `flip-DoXlLpbD.mp3` / `burst-CcC0X5pC.mp3` 等新哈希 |
| 回归 8 flow | `probe-sfx-off` / `probe-ambient` / `probe-devbar-sfx` / `probe-charge` / `audit-title` / `audit-draw` / `dev-verify` 全过 |
| `vite build` | 干净；`devbar` / `setForceSynth` 零命中，dist 的 flip 哈希与源一致 |

### 18.7 剩下的一步：**用户用耳朵拍板**

候选对比页：`audio-src/candidates/flip.html` —— 5 条候选（`s1-50` / `s2-50` / `s3-50` /
`s1-60` / `s3-60`）**各走完整流水线**后的成品 + 被否决的旧版作对照，
数字由指标文件生成、不手抄。**当前站点里放的已经是 s1-60**，可在开发者版直接感受。

若要换：改 `scripts/_make_flip_page.py` 的 `CHOSEN` → 拷进 `audio-src/sfx/_raw/flip-raw.mp3`
→ 重跑 `build-sfx.py`（记得 `--force`）。

已知可调的取舍：s1-60 的尾巴 0.10s 淡出。**若还嫌不够利落**，把 `SPECS.flip` 的
`fade_out` 收到 0.06 并重跑 —— 那是耳朵的活，不是指标的活。

### 18.8 这一轮的可复用套路（三条）

1. **用户说「像 X」时，先把 X 量化成一个可测的手势量**（这里是 onset 数 / 跨度 / 末次位置 / duty）。
   量出来了才能证明改动真的把 X 消掉了，否则只是「感觉短了点」。
2. **出现「源素材干净、成品脏」时，先做逐级消融，别先怀疑素材。** 这一轮 90% 的时间花在
   找那层沙子是哪来的，答案是流水线自己造的。
3. **判据要覆盖「保持」而不是只覆盖「达到」**：原有判据全在管「响度够不够、有没有削顶」，
   没一条管「瞬态有没有被填平」—— 于是故障静默。**手势守恒**就是补这个缺口。
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

append(PS, u'第二十七轮 · ③ flip 改成', R27_PS)
append(NS, u'## 18 · 2026-09-21 第二十七轮', R27_NS)
print(u'DONE')
