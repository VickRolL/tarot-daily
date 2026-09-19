# MOTION_AUDIT · 塔罗日签 · 整页手感升级

> 审计对象：`C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app`
> 审计时间：2026-09-18 · 视口 1582×804（无头实测）· 目标：「开箱即惊艳、像作品集不像 demo」
> **追加：2026-09-19 抽牌仪式分拍改造（见文末第 7 节，含基线 vs 目标 vs 实测对照）**
> 约束：**不引入 GSAP / Three.js**；保持零后端与现有素材槽位架构；不改动 `skin.js` 的素材槽位约定
>
> ⚠️ **2026-09-19 注：本行的「不引入 Three.js」在 v2 已有唯一例外（3D 水晶球）。**
> 本文件记录的是**当时那次审计**的约束，作为历史原样保留；**当前有效约束以 `PROJECT_STATE.md` 为准**
> （第十七轮 · 冻结 v1 快照，含 v2 的四条决策）。GSAP 仍未引入。

---

## 0 · 审计方法

不靠目测。全部数字来自两类实测：

1. **CDP 无头实测几何**（新增探针 `scripts/flows/audit-motion.js` / `audit-draw.js`）
   —— 量出球心百分比、卡牌高度、面板高度、卡与面板重叠量、样式表里声明的时序
2. **截图对照**（`assets/_debug/audit-hero.png` / `audit-draw.png`）

审计结论中的每个数值都可在本文档第 6 节复现。

---

## 1 · 四处动效现状与问题

### 1.1 入场（`.veil` 淡出 + `.hero-plate` 聚焦）

**现状**：`veil` 从 `opacity:1, scale:1.25` → `opacity:0, scale:1.02`，`2.25s`；同时 `hero-plate` 从 `scale:1.2 / blur(16px) / opacity:0` → `scale:1.02 / blur(0)`，`2.3s`，`ease [0.22,1,0.36,1]`。定格后 `hero-plate--idle` 跑 `bgBreath 24s alternate`。

**问题（按严重度）**：

| # | 问题 | 证据 | 后果 |
|---|---|---|---|
| A1 | **两套入场动画同时启动、同时结束，读不出层次** | veil 2.25s 与 plate 2.3s 同时开跑，缓动曲线完全同一条 | 观众只感到「画面亮了一下」，没有「雾散开 → 场景显形」的因果感。这是最典型的「四平八稳」 |
| A2 | **`scale` 从 1.25 → 1.02 与 1.2 → 1.02 方向相同但速率不同**，两个缩放叠加在同一视觉上 | 两个元素同时 zoom-out，视觉上是一个更快的 zoom-out 套一个慢的 | 缩放量感被稀释，落点「软」，没有定住的一拍 |
| A3 | **`filter: blur(16px)` 全屏铺满**，在 `.hero-plate`（1678×1119 px 实测）上动画 2.3s | plate 实测 `w:1678.6 h:1119.1` | 全屏 blur 动画是 medium 级开销，2.3 秒持续；中低端机会掉帧（`transform` 预算表里 filter 属中等、且面积大） |
| A4 | **`24s alternate` 的呼吸周期太长，且是纯 `scale`** | `bgBreath` 24s，`scale 1.02 → 1.075` | 24 秒一个来回，观众在前 10 秒里几乎感知不到「活着」；而且只有缩放没有位移，读起来像缓慢对焦而不是呼吸 |
| A5 | **`opacity` 与 `filter` 同时挂在 `.hero-plate` 上** | plate 同时有 opacity 与 filter 动画 | 二者都是 grouping property，2.3s 内整块底板被反复提升为合成层；且会压平底板子树的 3D（当前无 3D 子元素，但限制了后续加人物视差层 —— 而 `NEXT_STEPS` P2 正想做这个） |

### 1.2 抽牌（点击球 → 爆闪 → 牌升起）

**现状**：`.orb` 点击 → `phase='drawing'` → 全屏 `.flash` 做 `opacity [0, 0.92, 0]`，`620ms`；同时卡牌 `initial {y: risePx, scale:0.3, opacity:0}` → `animate {y:0, scale:1, opacity:1}`，`1000ms`，`ease [0.16,1,0.3,1]`。`CARD_RISE = 24`（视口高的 24%）。

**实测**：点击 → 牌元素进 DOM 仅 **6.9ms**（所以「延迟」不是问题）。

**问题**：

| # | 问题 | 证据 | 后果 |
|---|---|---|---|
| B1 | **球本身对点击零反馈**。`.orb` 没有 `:hover` / `:active` / `:focus-visible` 任何一条规则 | 探针：`hasHoverRule:false`、`hasActiveRule:false`、`hasFocusRule:false` | **这是最伤的**：整个站唯一的主 CTA，按下时手感是「死的」。用户点下去到全屏爆闪之间没有任何「我点中了」的确认。同时键盘用户拿不到焦点环 —— 可用性缺陷，不只是手感 |
| B2 | **`CARD_RISE = 24`（192px @804）+ `scale 0.3` → 1 + `y` 与 `scale` 同一条曲线** | 卡牌从视口 24% 高度下方以 0.3 倍大小升起 | 起点太远太小，牌在到达前有一段时间是「远处一个小点」，而所有位移用同一条 `ease-out-expo`，牌上升过程读起来像贴图缩放，没有「从球心里被抽出」的方向感与重量 |
| B3 | **爆闪与牌升起同时启动、互无关照** | flash 620ms 与 cardFly 1000ms 同 t=0 | 爆闪在牌还在远处时就已经全屏白了，等牌到中央爆闪已经结束 —— 正确的因果是「爆闪给牌让位」，现在是两条平行线 |
| B4 | **没有屏幕震动 / 冲击通道** | 项目里没有任何 shake 实现 | 抽牌是本作唯一的「事件」，却完全没有impact 反馈（`handfeel.md` §8 明确：这是最多网页动效没用的通道）。结果就是「抽了，但没觉得抽到了」 |
| B5 | **`ease-out-expo` 是全局默认，抽牌与入场共用** | 入场 `[0.22,1,0.36,1]`、牌 `[0.16,1,0.3,1]` 都属同一族 | 整页只有一种「快进慢出」的运动性格，所有东西落地的味道一样 → 这是「不像作品集」的根因之一：作品集靠**运动性格的对比**分层（重物/轻物/机关的缓动各不相同） |

### 1.3 翻牌（`rotateY 0 → 180`）

**现状**：`.card__flip` `initial {rotateY:0}` → `animate {rotateY:180}`，`duration = TIMING.cardFly/1000 = 1000ms`，`delay 0.18s`，`ease [0.22,1,0.36,1]`。实测终态 `matrix3d(-1,...)` ✅ 方向已正确（2026-09-18 修过）。

**问题**：

| # | 问题 | 证据 | 后果 |
|---|---|---|---|
| C1 | **1 秒翻 180°，且用 `ease-out-expo`（绝大部分时间花在最后 20%）** | 1000ms + `[0.22,1,0.36,1]` | 牌在 0.3s 内就快转完 150°，剩下 0.7s 在磨最后 30°。观众感知是「唰一下正过来，然后卡住不动」——翻牌的关键帧（正面刚露出的那一瞬）被浪费掉了 |
| C2 | **整卡 `rotateY` 是唯一运动，没有次级反应** | 翻牌期间无任何其它元素响应 | `handfeel.md` §4：环境元素应被主运动的「速度」带动。现在牌在转，背景/雾气/粒子纹丝不动，读起来「牌是贴在上面的」，这正对应诊断表的「假 / 像贴图」 |
| C3 | **翻牌没有明暗变化**。牌背与牌面亮度接近，翻转过程缺乏「受光面转过背光面」的信息 | 牌背 `#2b1a52`、牌面卡框纸色 `#dfd3b9` 其实差很大，但**过渡是瞬切**（`backface-visibility:hidden` 硬切），中间没有任何渐变光影 | 两面的切换是「一闪」，缺少翻牌本应有的 3D 体积感 |
| C4 | **`perspective` 缺失或过小**。`.card` 只声明了 `transform-style: preserve-3d`，没有父级 `perspective` | `.stage` / `.card` 祖先链上没有 `perspective` 声明 | 没有透视的 `rotateY` 是正交投影，180° 翻转看起来像「横向压扁再张开」（宽度缩短），而不是「绕 Y 轴转」。**这是让翻牌显得廉价、像 2D 的关键技术缺陷** —— 与第十轮信封踩的坑同源，但牌这边没修 |

### 1.4 面板上滑（`ReadingPanel`）

**现状**：`.panel` `initial {y:60, opacity:0}` → `animate {y:0, opacity:1}`，`duration 0.7s`，`delay TIMING.panelDelay/1000 = 1.15s`，`ease [0.22,1,0.36,1]`。实测面板高 **270.4px = 视口 33.6%**，顶边在 **66.4%**。

**实测几何冲突**：卡牌底边在 **68%**，面板顶边在 **66.4%** → **面板压住卡牌 12.7px（卡高的 3.3%）**。截图里能直接看到面板的 `border-top` 细线横切在卡牌下框带下方。

**问题**：

| # | 问题 | 证据 | 后果 |
|---|---|---|---|
| D1 | **面板上滑会盖住卡牌底部** | 重叠 12.7px / 卡高 3.3% | 牌面（尤其下框带与牌名）被面板顶边压掉一条。而 1.3 里卡牌刚落位、观众正要细看牌面，面板就上来啃一口 —— 主次颠倒 |
| D2 | **上滑距离 60px 太小，而延迟 1.15s 太长** | `y:60 → 0`，`delay 1.15s` | 60px 的位移读不出「面板升起」，更像「淡入」；1.15 秒的延迟让面板出现的时机和翻牌脱节（翻牌 0.18+1.0=1.18s 才结束，面板在 1.15s 就启动了 → **面板和翻牌同时进行**，两个大动作抢注意力） |
| D3 | **`backdrop-filter: blur(6px)` 挂在 33.6% 视口的整块面板上并做 opacity 动画** | 面板 1582×270，带 backdrop blur | 半透明 + 背景模糊的区域做 `opacity` 动画，是移动端掉帧的经典组合；而且 blur 半径 6px 在暗底上几乎看不见，收益接近零 |
| D4 | **内部元素无 stagger**：kicker / tags / 正文 / 建议 / 按钮一次性整块出现 | 面板内 5 组内容同一条 `y` + `opacity` | 「一堆字一下就出来了」（`timeline-orchestration` 的典型症状）。没有阅读引导，眼睛不知道该先看哪 |
| D5 | **面板是纯 `y` 位移，没有「从底部抽屉推入并在边缘停住」的重量** | 单段 60px tween | 结合 D2，面板的「升起感」不足 |

---

## 2 · 改造方案（带具体数值）

设计原则（围绕「作品集感」）：

> **给每个动作一个独立的运动性格**。入场 = 慢而有因果；抽牌 = 短促有力带冲击；翻牌 = 有透视、有体块、有明暗；面板 = 晚到、从下推入、内容逐条亮。
> 全页只有一种缓动 = demo；全页四种性格 = 作品集。

新增一个 `EASE` 常量表收口（放 `skin.js`），避免缓动散落在组件里：

```js
export const EASE = {
  reveal:  [0.16, 1, 0.30, 1],   // 显形：快进慢出（保留，做主角落位）
  settle:  [0.22, 1, 0.36, 1],   // 落定：更稳，尾部更长（入场/面板）
  exit:    [0.70, 0, 0.84, 0],   // 离场：慢起快走
  slam:    [0.20, 0.90, 0.20, 1],// 冲击：快速到位后微回弹（抽牌）
  drift:   null                   // 呼吸：交给 CSS 关键帧
}
```

### 2.1 入场 → 「雾先散，场景后定，落定一拍」

| 项 | 现状 | 改为 |
|---|---|---|
| 编舞 | veil 与 plate 同时 | **串行**：veil 先走（0 → 1.5s），plate 在其后半程跟上（0.55s 起） |
| veil | `opacity 1→0, scale 1.25→1.02`, 2.25s | `opacity 1→0`, **1.4s**, `EASE.reveal`；`scale 1.18→1.06`（幅度减小，只是陪衬） |
| plate | `scale 1.2→1.02, blur 16→0, opacity 0→1`, 2.3s | `scale 1.14 → 1.0`（落点收到 1.0）, **1.5s**, `EASE.settle`, **delay 0.55s**；`blur` 从 16px 降到 **9px**，且**只在前 0.4s 内归零**（用 keyframes `[0,9,0]` + `times`) |
| plate opacity | 与 scale 同段 | `0 → 1` 只占前 0.45s（`times: [0, 0.3, 1]`），先亮起来再继续推近 |
| 定格呼吸 | 24s `scale 1.02→1.075` | **14s**，且叠加位移：`translate3d(0, -0.6%, 0) scale(1.0 → 1.028)`，`ease-in-out`, `alternate` |
| 落定一拍（新增） | 无 | plate 到位后给一个 **120ms / 1.5px** 的极轻位移回弹（`slam` 尾巴），把「定住」变成有重量的一拍 |

> 因果链变成：**雾从中央散开（1.4s）→ 场景在雾后逐渐清晰并推近落定（0.55→2.05s）→ 轻回弹定住**。
> 并为后续 `hero-figure` 人物层视差留出干净的 3D 空间（plate 上不再叠 opacity/filter 动画，改挂在专用内层）。

### 2.2 抽牌 → 「按下就响，爆闪让位，牌被抽出」

| 项 | 现状 | 改为 |
|---|---|---|
| 球按下反馈（新增，**最高优先级**） | 无 | 三条都要：<br>`:hover` → `scale(1.03)` + `glow` 提亮，**180ms** `EASE.settle`<br>`:active` → `scale(0.955)`，**90ms** `EASE.slam`（按下立刻缩，这是「跟手」的来源）<br>`:focus-visible` → 2px 光环 + `outline-offset: 6px`（可访问性必需） |
| 按下→松开 | 点完即走 | 松开后球**回弹到 1.06 再落回 1.0**（`spring` 手感，共 **260ms**），再交给爆闪 |
| 爆闪 `.flash` | `[0, 0.92, 0]` / 620ms / 与牌同时 | **前置且缩短**：`[0, 0.95, 0]` / **420ms** / `easeOut`，起播在 **t=0**，牌起飞延迟到 **t=0.10s** —— flash 的峰值（~t 0.10s）刚好成为牌起飞的助推 |
| 牌升起 | `y:192px→0, scale 0.3→1`, 1000ms, 单一 expo | **拆成两段属性**：<br>`y: 192 → 0`，**900ms**，`EASE.slam`（快速到位 + 微回弹）<br>`scale: 0.42 → 1`（起点不要 0.3，太小），**820ms**，`EASE.settle`<br>`opacity: 0 → 1` 只占前 **180ms** |
| 位移起点 | 视口 24% 高（192px） | 改为 **17%**（约 137px）—— 更贴近球心，减少「远处小点」阶段 |
| 屏幕震动（新增） | 无 | 牌落位瞬间（t = 0.90s）触发一次 shake：**幅度 4px / 时长 0.32s**，x 轴 `sin(t*47)`、y 轴 `sin(t*31+1.3)`，`max` 不 `sum`（`handfeel.md` §8）。作用在 `.scene` 的包裹层 `translate` 上，不动布局 |
| 次级反应（新增） | 无 | 牌升起时，雾气层与粒子层接受一个**速度耦合**的推力：`jitter = clamp(cardVel, -1.2, 1.2)`，以 `damping 0.90` 的松弹簧驱动，幅度 ±6px / ±1.4°（雾）/ ±0.9°（粒子）。牌停下后残余抖动自然衰减 → 场景「被推动」了 |

### 2.3 翻牌 → 「给透视、给体块、给明暗」

| 项 | 现状 | 改为 |
|---|---|---|
| **透视（必修）** | 祖先链无 `perspective` | `.stage` 上加 `perspective: 1400px`，`.card__flip` 保持 `preserve-3d`。**1400px** 是「长焦」：变形小、体块感在，不会变成鱼眼 |
| 角度曲线 | `0 → 180`, 1000ms, 单一 expo | **拆两拍**：<br>`0° → 168°`，**720ms**，`EASE.slam`（主力，快）<br>`168° → 180°`，**280ms**，`EASE.settle`（收尾落定）<br>总长 **1.0s** 不变，但「正面露出」的瞬间提前约 200ms，且结束时有落定感 |
| 起播 | `delay 0.18s` | `delay 0.16s`（与牌起飞对齐，起飞 0.90s 后牌已基本到位，0.16+0.90 ≈ 1.06s 开始翻，衔接自然） |
| 牌面露出瞬间（新增） | 无 | 在 `rotateY` 跨过 **90°** 时（约 t=0.42s）给 `.card` 叠加一次极短的**高光扫过**：一条 12% 宽的白色渐变斜带从左到右扫过牌面，**240ms**，`opacity 0 → 0.5 → 0`。这是「翻开的一瞬」被点亮的那个 keyframe |
| 明暗过渡（新增） | `backface-visibility` 硬切 | 牌背与牌面交界处加一层 `.card__eclipse`：随 `rotateY` 从 1 → 0 的 `box-shadow: inset 0 0 60px rgba(0,0,0,0.55)`（用 `rotateY` 驱动，90° 时最暗），给翻牌一个「转身时侧面背光」的中间态 |
| 次级反应（新增） | 无 | 翻牌过程中球的光环加速脉冲一次（`orbRing` 临时缩短到 0.9s 一轮，翻完恢复 4.2s）；球芯星云自转速度乘 1.6 倍 800ms 后回落 |

### 2.4 面板上滑 → 「晚到、推入、逐条亮」

| 项 | 现状 | 改为 |
|---|---|---|
| **先解决重叠（必修）** | 面板顶 66.4% 压住卡底 68%，重叠 12.7px | 卡牌落点上移：`ANCHORS.stage.y` 从 **44 → 38.5**，卡高从 **48vh → 46vh**（`min(46vh, 420px)`）→ 牌占 15.5%–61.5%，面板顶 66.4%，**净空 4.9% ≈ 39px**，彻底不压 |
| 面板上滑距离 | `y: 60 → 0` | `y: 96 → 0`（**96px**，够读成「推入」） |
| 面板时长/延迟 | 0.7s / delay 1.15s（与翻牌同时） | **0.62s / delay 1.42s**，`EASE.settle`。此时翻牌（0.16+1.0=1.16s）已结束 → **面板严格在翻牌收尾之后登场**，不再抢戏<br>（`TIMING.panelDelay` 从 1150 → 1420） |
| 面板透明度 | 与 y 同段 | `opacity 0 → 1` 只占前 **45%**（先显形再继续推） |
| 内容 stagger（新增） | 5 组一次出现 | 按 `kicker(0) → tags(0.06) → text(0.12) → advice(0.20) → actions(0.28)`，每组 `y: 12 → 0` + `opacity`，单组 **0.42s** `EASE.settle`。总编排 ≈ 0.70s，读完一屏有节奏 |
| `backdrop-filter` | `blur(6px)` 全程 | 降到 **3px**，并且**只在 `prefers-reduced-motion: no-preference` 下启用**；低端机/减少动效下直接 `none`（暗底上 3px 与 6px 无差别，但省一整层合成） |
| 面板顶边 | 1px 实线 `border-top` | 换成 **1px 渐变发丝线**（两端透明、中间亮），呼应卡框金线语言，消掉「截图里那条横切细线」的廉价感 |

### 2.5 顺带修的（低成本、影响大）

| 项 | 说明 |
|---|---|
| E1 | **Framer Motion 动画完全没接 `prefers-reduced-motion`**：项目只在 CSS 里关了循环动画，`CardReveal` / `ReadingPanel` / `HeroStage` 的 tween 全部照跑（`useReducedMotion` 零处引用）。方案：组件改用 `useReducedMotion()`，减少动效时 tween 时长收到 **0.01s**、去掉位移只留 opacity |
| E2 | **`TIMING` 表更新**：`orbFlash 620→420`、`cardFly 1000→900`、`panelDelay 1150→1420`，并新增 `shake 320` / `flip 1000` |
| E3 | **所有新增动画只用 `transform` + `opacity`**（cheap tier）；`blur` 只在入场前 0.4s 用且从 16→9px 减小面积开销 |
| E4 | **`will-change` 收口**：抽牌瞬间给 `.card` 加 `will-change: transform, opacity`，动画结束移除（`handfeel.md` 明确：常驻 `will-change` 反而降帧） |
| E5 | 面板/卡牌/球的所有新增时长与缓动**统一收口到 `skin.js` 的 `TIMING` + `EASE`**，保持「改一处全局生效」的现有约定 |

---

## 3 · 优先级

| 级别 | 项 | 理由 |
|---|---|---|
| **P0（必修，直接影响「成熟度」）** | 2.3 的 `perspective` 缺失；2.2 的球 `:active/:focus-visible`；2.4 的卡/面板重叠；E1 reduced-motion | 前三个是**缺陷**不是口味：没有透视的翻牌是 2D 假 3D；无焦点环是无障碍硬伤；卡被面板压掉一条是构图事故 |
| **P1（作品集感的主体）** | 2.1 入场串行重构；2.2 冲击 + 次级反应；2.3 两段翻牌 + 高光扫过；2.4 stagger | 这四条决定了「像不像作品集」 |
| **P2（锦上添花）** | 2.2 的 shake、2.3 的光环联动、2.4 的渐变发丝线 | 有则更精致，无也不残 |

---

## 4 · 明确不做

- ~~不引入 GSAP / Three.js（保持 Framer Motion + CSS，零新增依赖）~~
  → **⚠️ 2026-09-19：v2 的 3D 水晶球已批准引入 Three.js，这是唯一例外。**
  本条其余部分仍然有效：**GSAP 依然不引入**，其余处的动效仍只用 Framer Motion + CSS。
- 不改素材槽位约定、不改 `ASSETS` 结构、不动皮肤目录
- 不改牌库 / 文案 / 分享逻辑 / 迎接动画（信封）—— 信封那套参数是上一轮专门调过的，本轮不碰
- 不新增出图（0 积分消耗）
- 不做 `hero-figure` 人物层（属 `NEXT_STEPS` P2，需出图）

---

## 5 · 验收方式

改动后跑（沿用项目已有的零依赖 CDP 工具，不装新东西）：

```bash
cd "C:/Users/29923/WorkBuddy/2026-09-17-19-02-52/tarot-app"
N="C:/Users/29923/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"

"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/after-idle.png  --w 1600 --h 900 --seed "localStorage.clear()" --wait 5200
"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/after-draw.png  --w 1600 --h 900 --eval-file scripts/flows/audit-draw.js --seed "localStorage.clear()"
"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/after-mobile.png --w 420 --h 880  --seed "localStorage.clear()" --wait 5200
"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/after-reduced.png --reduced --eval-file scripts/flows/audit-motion.js
"$N" node_modules/vite/bin/vite.js build      # 构建必须通过
```

**量化判据**（写进 `scripts/flows/`，不靠目测）：

| 判据 | 目标 |
|---|---|
| 卡与面板重叠 | `overlapPx == 0` 且净空 ≥ 30px |
| 球的可交互反馈规则 | `hasHoverRule && hasActiveRule && hasFocusRule` 全为 `true` |
| 翻牌透视 | `.stage` 的 `perspective != 'none'` |
| 减少动效 | `--reduced` 下 `card`/`panel` 的 computed `transition`/动画时长 ≈ 0.01s |
| 只动 transform/opacity | 新增 keyframes 里不出现 `top/left/width/height` |
| 构建 | `vite build` 通过，体积增幅 < 4 KB |

---

## 6 · 复现审计数字

```bash
N="C:/Users/29923/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/audit-probe.png --eval-file scripts/flows/audit-motion.js --seed "localStorage.clear()"
"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/audit-draw.png  --eval-file scripts/flows/audit-draw.js  --seed "localStorage.clear()"
```

实测原始值（视口 1582×804）：

| 量 | 值 |
|---|---|
| 球心 | 视口 `50% / 73%`（在画面下三分之一） |
| 球直径 | 340px |
| `.orb` hover / active / focus 规则 | `false / false / false` |
| `.hero-plate` 尺寸 | 1678.6 × 1119.1 px |
| `.hero-plate` 常驻动画 | `bgBreath 24s alternate`（纯 scale） |
| 卡牌 | 264 × 385.9 px = 视口高 **48%**，占 20% → 68% |
| 面板 | 1582 × 270.4 px = 视口高 **33.6%**，顶边 **66.4%** |
| 卡 / 面板重叠 | **12.7px**（卡高 3.3%） |
| 翻牌终态 | `matrix3d(-1,0,0,0, 0,1,0,0, 0,0,-1,0, 0,0,0,1)` ✅ 方向正确 |
| 点击 → 牌进 DOM | 6.9ms（延迟不是问题） |
| 循环动画清单 | mistDrift / orbBreath / orbRing / orbSwirl / orbNebula / orbArtSpin / labelBreath / bgBreath |

---

## 7 · 抽牌仪式分拍（2026-09-19）

> 视口 1564×708（`--w 1582 --h 804`，Chrome 的 `window-size` 与 `innerWidth` 有差值）
> 目标：把「点击水晶球 → 卡牌揭晓」重排成**有蓄势、有悬念、有留白**的仪式曲线

### 7.1 这一轮要解决的不是「太快」，是「节奏错位」

四条根因，每条都有实测证据（基线见 §7.3）：

| # | 根因 | 基线实测 | 后果 |
|---|---|---|---|
| 1 | **答案在牌到位之前就揭晓了**（最严重） | 牌 213ms 就开始翻、**295ms 已跨 90°**，而牌 696ms 才飞到位 → `牌到位 − 开始翻` = **−483ms** | 观众看到的是「牌一边飞一边就翻完了」。「先看到牌背 → 牌停住 → 才翻」这个期盼结构**根本不存在** |
| 2 | **完全没有蓄势段** | 点击后 **11ms** 牌就挂载、**52ms** 就可见 | 期盼的本质是「动作之前的等待」，而动作和点击同一帧发生，来不及产生预期 |
| 3 | **面板双重计时 → 空面板挂 1.6 秒** | 外框 1462ms 挂载、**1490ms 就开始滑**（根 `delay` 被丢弃），子项 **3056ms** 才出现 | 一个空壳滑上来又等 1.6 秒才出字 |
| 4 | **环境对事件毫无反应** | 雾 / 星屑 / 暗角 / 副标题全程不变 | 事件读起来像「贴在画面上的贴纸」，而不是「发生了一件有影响的事」 |

**所以加长的不是曲线，是拍数。** 新增两拍**不动的静**（④ 悬停、⑦ 留白）——「期盼感 = 动作之前的等待 + 动作之后的静止」。

### 7.2 七拍结构与缓动分配

```
① CHARGE  球充能：光环内收、辉光提亮、雾扰动加剧、暗角压下、副标题退出   ← 牌此时**尚未挂载**
② RELEASE 爆闪 + 冲击环，峰值成为牌起飞的助推
③ RISE    牌从球心升起，**全程只显牌背**
④ HOLD    牌停住不动，只留极轻的呼吸感（rotateZ 微摆 + halo 脉动）      ← ★ 期盼感的核心拍
⑤ WARM    翻牌前反向小幅后仰 −6°（anticipation before the flip）
⑥ FLIP    4 关键帧 / 3 段曲线：0 → −6 → 168 → 180，跨 90° 高光扫过
⑦ TAIL    停住，让牌面被看清
⑧ PANEL   外框推入，内容紧随其后依次亮起（**不再有空档**）
```

**新增第二族缓动 `EASE.wind = [0.55, 0, 0.85, 0.25]`（蓄势：慢起、末端加速，读作「攒劲」）**，与 `slam`（快速到位）正好相反。这样全页的运动性格从四族变五族，仪式内部的「铺垫拍 / 冲击拍 / 落定拍」各自有性格，而不是所有东西共用一条 expo。

### 7.3 基线 vs 目标 vs 实测

| 指标 | 基线（改前） | 方案目标 | **实测（改后）** |
|---|---|---|---|
| 点击 → 牌可见 | 52ms | ≥ 950ms | **1129ms** |
| 牌到位 → 开始翻 | **−483ms**（翻转早于到位） | +1030ms | **+1801ms** |
| **牌到位 → 跨 90°（答案显形）** | **−401ms** | ≥ 1500ms | **+1833ms** ★ |
| 翻完 → 面板挂载（留白） | −608ms（面板早于翻完） | ≥ 200ms | **+346ms** |
| 面板挂载 → 首行内容出现 | **1606ms**（空面板） | ≤ 300ms | **205ms** ★ |
| 点击 → 面板就位（总时长） | 1870ms | 5200–5400ms | **5512ms** |
| `--reduced` 总时长 | 未降级（要干等 5s） | ≤ 600ms | **27ms** |
| 牌 vs 面板重叠 | 0（桌面侥幸 3.2px 净空） | 0 | **0（净空 39.2px）** |
| 构建体积 | CSS 38.48 / JS 289.98 KB | 增幅 < 4KB（原预算） | CSS 41.45 / JS 292.66 KB（**+5.7KB**，超出原预算 1.7KB，见 §7.5 第 4 条） |

绝对时刻表（唯一真相在 `skin.js` 的 `drawBeats(reduced)`，组件只读时刻、不许自己把时长相加）：

| 拍 | 起 | 止 | 时长 |
|---|---|---|---|
| ① 蓄势 | 0 | 1000 | 1000 |
| ② 释放爆闪 | 1000 | 1520 | 520（峰值 ≈1094） |
| ③ 升起 | 1060 | 2210 | 1150 |
| ④ 悬停 ★ | 2210 | 3360 | **1150** |
| ⑤ 预压 | 3360 | 3500 | 140 |
| ⑥ 翻牌 | 3500 | 4700 | 1200（168° @ 4500） |
| ⑦ 留白 ★ | 4700 | 4980 | 280 |
| ⑧ 面板 | 4980 | 5700 | 720 |

### 7.4 两处与交接方案不同的决定（都是实测倒推）

1. **④ 悬停从方案里的 650ms 加长到 1150ms。**
   方案要求 `flip90 − 牌到位 ≥ 1500ms`，但实测「跨过 90°」发生在主力段（`slam` 曲线）的**前 13%** —— 也就是翻转一开始没多会儿答案就露出来了。`slam` 是刻意选的「快速到位」曲线，改成慢起会失去「啪地翻开」的力道，**改不得**；所以只能让翻转更晚开始，反推 `hold ≥ 1500 − 140 − 0.13×860 ≈ 1110`，取 1150 留余量。副作用是总时长从 5.4s 涨到 5.6s，仍在可接受区间 4.5–6.0s 内。

2. **`drawBeats` 从「常量」改成「按 reduced 取参数的函数」。**
   方案里 `DRAW_BEATS` 是直接从 `DRAW_RITUAL` 派生的常量。但那样 reduced 用户拿到的虽是 0.01s 的动画，`App` 的计时器却仍按 5.6s 排 —— 元素早早到位、面板却 5 秒后才挂载。所以改成 `drawBeats(reduced)`，组件里一律 `drawBeats(useReducedMotion())`。`DRAW_BEATS` 仍导出（= `drawBeats(false)`），供探针与断言对照。

### 7.5 这一轮暴露/根治的问题（按重要度）

1. **★ `ReadingPanel` 的「空面板」根因被确认并推广成一条通用规律。**
   原文推断「Framer Motion 里写在 `transition` **根上**的 `delay` 会被丢弃」——本轮实测复现并被**同一机制第二次咬到**（`CardReveal` 的翻牌延迟也整体晚了一拍）。
   **规律（写进代码注释，勿删）：只要有任何动画属性带了自己的 per-property config（`opacity: {...}` / `y: {...}`），根上的 `delay` 就完全不参与该属性的计时，per-property config 全权接管。** 而 `delayChildren` / `staggerChildren` 是另一套编排机制，照常生效 —— 两套计时各跑一半，就是「空壳先上来、内容晚 1.6 秒」的真相。
   修法：`delay` 要么写进**每个属性自己**的 config，要么**整条链只留一处计时**（本轮选后者：挂载时刻由 `App` 的 `beats.panelAt` 一处决定，组件内 `delayChildren` 只写相对值 0.12）。
   ⚠️ **`CardReveal` 还多一层**：它是在 `beats.chargeDone` 才挂载的，而 Framer 的 `delay` 从**动画触发那一刻**算起，所以写进 delay 的必须是「绝对时刻 − 挂载时刻」：`at(ms) = Math.max(0, ms − T0) / 1000`。

2. **★ 一个把整场仪式在点击后 1ms 就杀掉的 bug（TypeError: `duration must be non-negative`）。**
   `handleDraw` 第一件事是 `save(card.id)` 落盘，而 `save` 会 `setRecord` → 触发「今日已抽」的 effect → `setPhase('revealed')`，**把 `charging → drawing → revealed` 的整条链冲掉**。
   修法：effect 加 `RESTING_PHASES = new Set(['welcome','entrance','idle'])` 守卫，只在**静息相位**才自动呈现今天的牌。
   教训：**「保存记录」这类副作用会和「状态机编排」抢同一份 state**，加了新相位就要回头检查所有吃 state 的 effect。

3. **★ 牌与面板的重叠是「侥幸不重叠」，不是「不重叠」—— 本轮一并根治。**
   面板是 `bottom` 锚定 + **内容撑高**，所以面板高度取决于抽到的牌文案有多长；而卡牌底边固定在 `ANCHORS.stage.y + 卡高/2` = 视口高的 **61.5%** → 面板**可用高度只有 38.5%**。
   用 `--seed` 把文案最长的两张牌（魔术师 / 恶魔，各 98 字）钉在已揭晓状态实测：

   | 视口 | 面板高 | 占视口 | 结果（改前） |
   |---|---|---|---|
   | 1564×708 桌面 | 269.4px | 38.1% | 净空仅 **3.2px** —— 不是没撞，是侥幸 |
   | 504×688 竖屏 | 284.3px | 41.3% | **超出 19.3px**，压在卡牌下框带上（截图可见金饰被压暗） |

   **为什么不用「限高 + 内部滚动」**：面板底部的「生成分享卡片」是主 CTA，一旦限高滚动，它会被挤出可视区 —— 比压住 20px 渐变更糟。
   **处置**：`index.css` 对 `max-height: 780px` 的矮视口收紧面板纵向留白（`padding` 与 4 处 `margin`，共约 32–36px），让内容自然装下。改后实测净空 **桌面 39.2px / 竖屏 10.7px（最坏牌）**。
   阈值取 780 的理由：危险区从约 710px 开始（可用高度 = 38.5% × 视口高），留余量给字体度量差异；大屏显示器保持原有舒展间距。
   ⚠️ **同时给 `audit-draw.js` 增加 `clearancePx`（净空）**：只看 `overlapPx == 0` 会漏掉「只剩 3px 就撞上」这种侥幸状态。以后加长牌面文案，要盯着净空而不是盯着 0。

4. **构建体积比原预算超了 1.5KB（+5.5KB vs +4KB 预算）。**
   增量来自：`EASE.wind` + 充能/暗角/halo/冲击环四组 keyframes + `ParticleField` 的 `converge` 收敛逻辑 + 面板矮视口的媒体查询。都属于「仪式感」的正面成本，且 gzip 后 CSS +9.59KB / JS +99.79KB 仍在合理量级，**未新增任何依赖**。

### 7.6 验收结果（2026-09-19，全部打在产物 `dist-user/` 上）

| 验收项（交接清单第 8 节） | 结果 |
|---|---|
| 1. 节拍审计（桌面 1582×804）八条断言 | ✅ `pass=true`，总时长 5512ms，净空 39.2px |
| 2. 节拍审计（竖屏 504×784） | ✅ `pass=true`，总时长 5504ms，净空 35.3px；最坏文案牌单独复测净空 10.7px |
| 3. `--reduced` 总时长 ≤ 600ms | ✅ 27ms，且页面上看不到任何新增动画 |
| 4. `audit-title.js` 三处 overlap | ✅ 桌面 / 竖屏 **全为 0** |
| 5. `audit-draw.js` `overlapPx` | ✅ 0（并新增报告净空） |
| 6. `audit-motion.js` `layoutAnimatingKeyframes` | ✅ 空数组（新增 keyframes 只动 `transform / opacity / filter`） |
| 7. 球四态（hover / active / released / charging） | ✅ 规则在位；实测 scale 轨迹 `maxJump 0.045`，无「回弹与充能打架」的抽搐 |
| 8. 四张关键帧人工确认 | ✅ `r-charge`（牌未挂载 / 副标题退场 / 场景压暗）、`r-hold`（只显牌背、停稳、球心升起）、`r-flip`（93°、边缘朝前 + 高光扫过）、`r-final`（面板与卡牌清晰分离） |
| 9. `vite build` | ✅ 406 modules，CSS 41.45KB / JS 292.66KB |
| 10. 全套回归 | ✅ `reveal.js` / `share.js`（1080×1920，254KB）/ `welcome.js` 全绿；另加 `file://` 离线副本自检（`#root` 10983 字符、素材相对路径加载、零控制台报错） |

### 7.7 复现方式

```bash
cd "C:/Users/29923/WorkBuddy/2026-09-17-19-02-52/tarot-app"
N="C:/Users/29923/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
P="C:/Users/29923/.workbuddy/binaries/python/envs/default/Scripts/python.exe"

# 三态节拍审计（**落盘再读**，本机管道不可靠）
"$N" scripts/shot.mjs http://127.0.0.1:5199/ assets/_debug/a-draw.png --w 1582 --h 804 --eval-file scripts/flows/audit-draw.js > assets/_debug/_a1.txt 2>&1
"$N" scripts/shot.mjs http://127.0.0.1:5199/ assets/_debug/a-draw-m.png --w 504 --h 784 --eval-file scripts/flows/audit-draw.js > assets/_debug/_a2.txt 2>&1
"$N" scripts/shot.mjs http://127.0.0.1:5199/ assets/_debug/a-draw-r.png --w 1582 --h 804 --reduced --eval-file scripts/flows/audit-draw.js > assets/_debug/_a3.txt 2>&1

# 四张关键帧（按**动画自身状态**轮询取帧，不用 --wait 猜时刻）
for f in charge hold flip final; do
  "$N" scripts/shot.mjs "http://127.0.0.1:5199/#$f" "assets/_debug/r-$f.png" --w 1582 --h 804 --wait 4400 --gpu --eval-file scripts/flows/ritual-frame.js
done
```

**逐张量「长文案牌」的面板高度**（用 `--seed` 把某张牌钉在已揭晓状态，不必反复抽牌）：

```bash
# 文案最长的两张是 major-01 魔术师 / major-15 恶魔（meaning + advice 各 98 字）
"$N" scripts/shot.mjs "file:///.../dist-user/index.html" assets/_debug/p-devil-m.png --w 504 --h 784 \
  --seed "localStorage.setItem('tarot-daily::draw-record', JSON.stringify({date:'2026-09-19', cardId:'major-15'}))" \
  --eval-file assets/_debug/probe-panel.js
```

