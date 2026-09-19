# HERO_V2_PROMPT.md —— v2 主视觉（真 3D 球版）出图规格与提示词

> 这份文件是 v2 的**唯一一张图**的规格书。出图前先读第 1 节（它决定了构图为什么必须往中央挤），
> 第 3 节是可以直接粘贴的提示词，第 5 节是出图后的处理与验收。
>
> 状态：**草案 · 待用户过目后出图**（出图要花积分，项目红线：批量出图前必须确认）

---

## 0 · 这张图要交出什么

- 女巫**肩部以上特写**：帽檐压得很低，**脸几乎完全在帽檐阴影里**（眼睛不可见）
- **单手**（另一只手必须从画面里彻底消失），放大到球前，环住球的下缘
- 画面中央**留一块空位**给 3D 水晶球 —— **不画球**
- 画风 / 笔触 / 色调 / 光感与 v1 完全一致（用 v1 母版做 image-to-image）
- 卡牌、牌面、牌背**一律不动**

---

## 1 · 先看事实：这张图在屏幕上会被裁成什么样

这一节是构图的全部依据。**不先算清楚就出图，会得到第二张「被裁过的桌面构图」**。

### 1.1 可见窗口的推导

`.hero-frame`（`src/index.css:64`）的尺寸与对位：

```
width  = max(104vw, 104vh × 1.5)      /* --hero-bleed = 4 */
top    = 30%    →  translateY(-30%)   /* 位移按元素自身高度算 */
aspect-ratio: 3 / 2
```

可见窗口是**尺度无关**的，只有两种情况：

| 视口 | 底板尺寸 | 可见的图像坐标窗口 |
|---|---|---|
| 宽屏（宽度主导）例 1564×708 | 1626×1084 | **x ≈ [2%, 98%]（几乎全宽）** · **y ≈ [10%, 76%]** |
| 窄高屏（高度主导）例 393×852 | 1329×886 | **x ≈ [35%, 65%]（只剩中央 30%）** · y ≈ [1%, 97%] |

宽屏越扁，纵向窗口越窄：1920×800 → y ∈ [12%, 72%]；1366×768 → y ∈ [6%, 87%]。
手机越窄长，横向窗口越窄：393×852 → 29.6%；360×640 → 36%。

> **两条约束压在不同轴上**：纵向是**宽扁屏**裁的，横向是**手机**裁的。
> 所以「必须被看见的东西」要落进一个**中央盒子**：

```
                x ∈ [33%, 67%]
        y=12%  ┌───────────────┐
               │               │
               │   中央安全盒   │   ← 宽扁屏在这里裁上下
               │  34% × 60%    │     手机在这里裁左右
               │               │
        y=72%  └───────────────┘
```

### 1.2 揭晓态的实测（`assets/_debug/probe-panel-orb.js`，1564×708）

| 元素 | 实测 rect | 结论 |
|---|---|---|
| 球 | 336×336 @ x614..950 / y386..722 | 下缘**超出视口 14px**（宽扁屏上球的下缘本来就会被裁） |
| 卡牌 | 223×326 @ y110..435 | 底边 = 视口 61.5% |
| 面板 | 1564×233 @ y475..708 | 顶端是**渐变**：透明 → 26% 处 0.82 → 底部 0.97 |
| 球心 | 视口 78.2% 高 | 面板顶在 67.1% → **球有 73.5% 落在面板之下**，面板文字正好压在球心上 |

所以「球是网页中心」这件事**只完整成立于待抽态**（也是首次访客看到的那一屏）；
抽完之后球的可见部分只有上缘约 44%（因为面板顶端是透明渐变，不是硬盖）。

---

## 2 · 构图规格（画布百分比，必须照做）

| 元素 | 规格 | 理由 |
|---|---|---|
| 画布 | 3:2（1536×1024） | `HERO_FRAME`；所有拆层素材必须同帧 |
| 帽尖 | 允许被上缘裁掉 | y<12% 在宽扁屏上不可见，本来也看不到 |
| **帽檐** | 横向可**主动溢出**到 x 30%–70% 之外 | 手机上会被裁 —— 这是「近距离特写」的效果，不是意外 |
| **脸** | y ≈ 24–34%，**必须落在 x ∈ [33%, 67%]** | 五官是必须看见的部分 |
| 肩 / 袍 | y 34–46%，横向可溢出 | 溢出部分是「随设备被裁的余量」 |
| **球位空区** | 圆心 **(50%, 61%)**、直径 **≥46%（画布高）** | 46% 是目标球径（31%）的 1.5 倍 → 球在空区里有 **±7% 的平移自由度** |
| 空区内 | 只允许稀薄暗雾 | **不许画任何球体 / 光球 / 球状光晕**（AI 的本能就是补一颗球） |
| **手** | 从画面下缘伸入，指尖最高到 **y ≈ 68%**，手腕在 y≥80% 处被下缘裁掉 | 指尖 ≤y70% 有两个硬理由：① 只覆盖球体**下部约 20% 高度**（= 面积遮挡 ≈15%，这是用户定的上限）② 卡牌底边在画布 y≈50.5%，手不得越线 |
| 手的位置 | **x ∈ [33%, 67%] 内**（左或右待定） | 否则手机上只剩一根手指 |
| 主光 | **左上前方**（冷月光） | 帽檐因此在脸上投影 —— 这就是「脸被阴影盖住」的物理来源，不是画上去的一块黑 |

### 为什么空区要「比球大」而不是「正好」

空区 46% vs 球 31% → 球心可以在空区里平移 ±7.5%（画布高）。
这意味着**新图把空区画偏一点，锚点也不用改**；也意味着你选的「图上说了算」不会立刻牵动
`ANCHORS.orb` / `CARD_RISE` / 卡牌面板契约 —— 这三样一动就是功能改动。

> ⚠️ 但要说清耦合：`CARD_RISE`（现 19vh）是**为「牌从球心升起」调的** —— 实测牌底起飞点落在球心上。
> 球心一旦真挪，`CARD_RISE` 必须跟着重算，否则牌会从球**下方**起飞。所以本轮先把空区**瞄在 v1 球心**。

---

## 3 · 提示词

### 3.1 中文（可直接粘贴）

```
以参考图为准，完全保持它的画风：暗夜厚涂油画质感、冷紫暗色调、雾气与星尘的画法、笔触与颗粒。
只改构图，不改风格，不改色调。

全新构图（3:2 横幅，女巫肩部以上特写）：
· 一位戴巨大宽檐尖顶巫师帽的女巫，占满画面。帽檐压得极低，
  整张脸几乎完全埋在帽檐的阴影里，只能勉强看出下颌与唇的轮廓，眼睛完全看不见。
  深色长发从帽檐下垂落，遮住两侧脸颊。
· 女巫通体极暗，接近剪影。只有帽檐上缘、左侧肩线、以及手指的轮廓
  被一道紫罗兰色的冷边光勾出。脸上不要出现任何明亮的细节。
· 画面正中央留出一块完全空无的区域：不要画任何球体、光球、玻璃球或球状光晕。
  这块空区是一个圆，圆心在画面横向正中、纵向约 61% 处，直径约为画面高度的 46%。
  空区里只允许有稀薄的暗雾，不要有清晰的物体边缘。
· 画面下缘伸入一只手（只有一只，另一只手必须完全不出现在画面里）：
  手背朝外、手指微微收拢，拇指在一侧、其余四指在另一侧，
  从下方环住那块空区的下缘，像是正托住一颗看不见的球。
  指尖最高不超过画面高度的 68%；手腕与小臂在画面下缘被裁掉。
· 背景是深紫色的夜雾与稀疏星尘，向四周淡出。背景比人物更暗，
  不要有任何抢眼的亮部或强对比结构。
· 主光来自左上前方（冷月光），帽檐在脸上投下阴影，帽檐上缘与左侧肩线各有一道细边光。

不能出现：任何文字、字母、数字、签名、水印、logo、边框；
第二只手或另一侧的手指；水晶球 / 玻璃球 / 光球 / 球状发光体；
清晰的人脸五官；明亮的背景；对称的双臂。
```

### 3.2 English（同一份，给偏好英文的模型）

```
Keep the reference image's painting style exactly: dark impasto oil texture, cold-violet palette,
the same fog and stardust rendering, the same brushwork and grain.
Change the composition only. Do not change the style or the palette.

New composition (3:2 landscape, close-up of the witch from the shoulders up):
· A witch in an enormous wide-brimmed pointed hat fills the frame. The brim is pulled very low;
  her face is almost entirely buried in the brim's shadow — you can barely make out the jaw and lips,
  the eyes are completely invisible. Long dark hair falls from under the brim, covering both cheeks.
· She is extremely dark, close to a silhouette. Only the upper edge of the brim, the left shoulder line
  and the outline of the fingers catch a thin violet rim light. No bright details anywhere on the face.
· Leave a completely empty region in the exact centre of the image: do NOT paint any sphere,
  orb, light-ball, glass ball or spherical glow. The empty region is a circle whose centre is
  horizontally centred and about 61% down the image, with a diameter of about 46% of the image height.
  Only thin dark fog inside it — no hard edges of any object.
· One single hand enters from the bottom edge (only one hand; the other hand must not appear at all):
  back of the hand facing out, fingers slightly curled, thumb on one side and the other four fingers
  on the other, cupping the lower edge of that empty region as if holding an invisible sphere.
  Fingertips reach no higher than 68% of the image height; the wrist and forearm are cut off by the bottom edge.
· Background: deep violet night fog and sparse stardust fading out. The background must be darker
  than the figure — no eye-catching highlights, no strong-contrast structures.
· Main light from the upper-left front (cold moonlight), so the brim casts a shadow across the face,
  with a thin rim light along the brim's top edge and the left shoulder line.

Must NOT contain: any text, letters, numbers, signature, watermark, logo or border;
a second hand or fingers on the other side; a crystal ball, glass sphere, orb, light-ball or spherical glow;
clearly rendered facial features; a bright background; symmetrical arms.
```

---

## 4 · 出图的工具参数

| 参数 | 值 | 说明 |
|---|---|---|
| `image1` | `assets/hero-art/bg/参考这张塔罗主视觉_….png`（v1 母版） | image-to-image；**必须给参考图**，否则会画出「另一个女巫」 |
| `size` | **1536×1024** | ① 工具明确支持的尺寸 ②`build_hero_assets.py` 的 `HERO_SIZE` 就是这个，出 2048 也会被缩回来 |
| `quality` | high | |
| `input_fidelity` | 先给**高** | 保画风优先。若构图**没跟着变**（AI 太保守），降一档再来 |
| `output_dir` | 单独目录（例 `assets/hero-art/bg/v2/`） | **一次只出一张，不要并行**（ImageGen 并行会串目录 / 静默失败） |
| `background` / `footnote` | 不传 | 不要透明底（背景是满版画），不要水印 |

---

## 5 · 出图之后的处理与验收

### 5.1 落盘（顺序很重要）

1. **先把 v1 那张挪走**：`assets/hero-art/bg/参考这张…png` → `assets/hero-art/bg/_v1/`
   （`find_src()` 取目录里**排序第一张**图，两张并存一定取错）
2. 新图放进 `assets/hero-art/bg/`
3. `"$PY" scripts/build_hero_assets.py` → 产出 `public/skins/mist-night/hero-bg.webp`（1536×1024）
4. 换主视觉后**必须重跑** `build_lqip.py` 与 `build_og_cover.py`，否则模糊底与分享封面和实际画面对不上

### 5.2 关于水印

`build_hero_assets.py` 用 `repair_by_mirror(region=(0.78, 0.90, 1.0, 1.0))` 修右下角水印，
前提是**背景左右近似对称**。v2 只有一只手，这个前提弱化了。
但水印区（y ≥ 90%）落在**任何视口都不可见的带**里（可见窗口最高到 y≈87%），所以：
- 镜像修补**看不出来**，可以照跑
- 但要**目视核对一次**：修补有没有把手的袖口镜像到右侧去

### 5.3 验收（不靠肉眼，靠量）

| 判据 | 怎么量 | 期望 |
|---|---|---|
| 空区圆心与直径 | Python 量新图里的暗区（或直接量「掌心辉光/最暗连通区」） | 圆心 ≈(50%, 61%)、直径 ≥46%；**偏差 ≤5% 就直接沿用 v1 锚点** |
| 脸/球位/手是否在中央安全盒内 | 跑 `scripts/preview_hero.py` 出 504×784 的合成图 | 三者在 x ∈ [33%, 67%] 内可见 |
| 球与空区的净空 | 球径 31% 叠在空区上 | 球边缘距空区边缘 ≥4%（画布高） |
| 不破坏既有契约 | `scripts/flows/audit-draw.js` + `audit-title.js` | 标题/卡牌/面板重叠仍为 0 |

---

## 6 · 待确认（出图前请逐条拍板）

1. **空区圆心是否就钉在 v1 球心 (50%, 61%)**（换取 `ANCHORS.orb` / `CARD_RISE` 零改动）
2. **手在左侧还是右侧**（当前按「左下伸入、引向中央」写）
3. **手机上帽檐要不要完整**（要完整 ⇒ 帽檐必须 ≤34% 宽 ⇒ 头比 v1 还小；两者的取舍见第 1 节）
4. **是否接受「球的下缘在宽扁屏上被裁 2–5%」**（v1 已如此；要完整就得把球心再上移 5%，而 `CARD_RISE` 要 19 → ~9）
