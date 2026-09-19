# 抽牌仪式「加长 + 加深沉浸」改造 · 交接指令

> **用法**：把本文件**整份**复制到新对话窗口即可。文件是自包含的，不需要额外上下文。
> **项目**：`C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app`（已上线的塔罗日签单页站，Vite + React + Tailwind 4 + Framer Motion，零后端）
> **撰写时间**：2026-09-19 · 基线数字均为当日实测

---

## 0 · 一句话任务

**把「点击水晶球 → 卡牌揭晓」这一段的节奏重新分配**，做到有蓄势、有悬念、有留白，把现在的「一秒冲完 + 两秒空转」改成一条完整有起伏的仪式曲线。

⚠️ **注意：这不是单纯「把动画调慢」。** 实测发现当前的问题不是「太快」，而是**节奏完全错位**（详见第 3、4 节）。加长只是手段之一。

---

## 1 · 开工前必读（别跳过）

按顺序读，都是短文件：

1. `PROJECT_STATE.md` —— 项目事实与历轮变更日志（**尤其第十一~十四轮**）
2. `NEXT_STEPS.md` —— 剩余工作、踩坑清单（**第 13 条讲 `--wait` 不可靠，必读**）
3. `MOTION_AUDIT.md` —— 第十一轮做的整页手感审计，含运动性格四族的设计理由
4. `src/config/skin.js` —— **唯一的时序与几何真相来源**，本次改造的主战场
5. `src/components/CardReveal.jsx`、`src/App.jsx`、`src/components/ReadingPanel.jsx` —— 抽牌三件套
6. `src/index.css` —— 抽 CSS 时先读再改，别凭印象写值

---

## 2 · 硬约束（违反即视为失败）

| # | 约束 | 说明 |
|---|---|---|
| 1 | **不引入新依赖** | 不许上 GSAP / Three.js / 任何动画库。只用现有 Framer Motion + CSS keyframes<br>⚠️ **2026-09-19 更新：本项目对此条有唯一例外 —— v2 主页的 3D 水晶球用 Three.js。** 本行写于第十五轮（抽牌仪式分拍改造），禁令动机是「现有栈够用，多一个库多一份体积与维护面」，这个动机**依然成立**，只是 v2 用真 3D 换下了这份代价。**除 v2 的球之外，本条仍然有效。** 详见 `PROJECT_STATE.md` 第十七轮与 `NEXT_STEPS.md` 第 6 节第 28 条 |
| 2 | **保持零后端** | 不新增服务端、不新增网络请求 |
| 3 | **素材槽位架构** | 代码只引用槽位名；新增视觉元素**优先纯 CSS/渐变实现**（本次不需要新素材）。若要加素材，必须在 `skin.js` 的 `ASSETS` 里声明槽位并保证缺图能降级 |
| 4 | **不动几何契约** | 卡牌尺寸与锚点（`CARD_HEIGHT` / `ANCHORS.stage.y` / `CARD_RISE` 除外，见 §6）× 标题带 × 面板的几何契约已固化，改高度必须同步改 `index.css` 里 `.card` 的 `height` 字面量。**动完必须重跑 `audit-title.js`，三处 overlap 必须仍为 0** |
| 5 | **`prefers-reduced-motion` 是硬要求** | 现在 JS 计时器**没有**做降级：reduced 用户会看到一个静止画面干等。本次加长后若不管，reduced 用户要干等 5 秒 —— **必须**同时提供 reduced 时长表（见 §7-B） |
| 6 | **动画只允许 transform / opacity / filter** | 不许对 `width/height/top/left/margin` 做关键帧动画（会重排掉帧）。`scripts/flows/audit-motion.js` 会检查 `layoutAnimatingKeyframes`，必须保持为空数组 |
| 7 | **不许用 `--wait` 抓动画帧** | 时钟基准会差出一整拍。改用**按状态轮询**：本次已给 `.scene` 加 `data-phase`（见 §7-B），验收脚本轮询它 |
| 8 | ~~**`dist-user/` 是用户查看入口**~~ **（2026-09-19 作废）** | v2 只走 http，离线通道已整体移除 → 看用户视角改用 `vite preview`。**本条不再要求重跑任何离线构建** |
| 9 | **不许 `npm run`** | 本机 npm 会走 `wsl.exe` 被安全策略拦。直接调 node 绝对路径（见附录 A） |

---

## 3 · 当前基线（2026-09-19 实测，不是推算）

**测量方式**：`scripts/flows/probe-draw-timeline.js`（**已就绪，本次新写，可直接复用**）。
逐帧采样 `.card` 的 opacity / 位置、`.card__flip` 的 rotateY 角度、`.panel` 及其子项 opacity，用「第一次满足条件」判定关键帧。

**环境**：dev 服务器，视口 1564×708（`--w 1582 --h 804`，Chrome 的 window-size 与 innerWidth 有差值，属已知现象）。
两次跑结果一致。

| 关键帧 | 实测时刻（ms，从点击算） |
|---|---|
| 点击 → 牌挂载 | 11 |
| 牌可见（opacity ≥ 0.5） | **52** |
| **翻牌开始** | **213** |
| **翻过 90°（答案开始显形）** | **295** |
| 牌升至位（y 稳定） | 696 |
| 翻到 168° | 868 |
| 翻牌结束（180°） | 1082 |
| 面板外框挂载 | 1462 |
| 面板外框到位 | 1870 |
| **首个子项（`.panel__kicker`）出现** | **3056** |
| 正文出现 | 3167 |
| 正文完全显形 | 3382 |

**复现命令**见附录 A 第 2 条。

---

## 4 · 诊断：为什么现在读起来「仓促」

四条，**每条都有实测证据**，不是猜测。

### 根因 1 · 答案在牌到位之前就揭晓了（最严重）

牌在 **213ms** 就开始翻，**295ms** 就转过 90°（正面开始显形）—— 而牌要到 **696ms** 才飞到位。

也就是说：观众看到的不是「一张牌飞出来 → 停住 → 翻开」，而是**牌一边飞一边就翻完了**。「期盼」心理需要「先看到牌背 → 牌停住 → 才翻」，现在这个结构**根本不存在**。这是仓促感的第一来源，也是最该修的一条。

### 根因 2 · 完全没有「蓄势」段

点击后 **11ms** 牌就挂载、**52ms** 就可见。没有「球开始充能 → 光聚拢 → 停顿」这一段。

期盼的本质是**动作之前的等待**。现在动作和点击同一帧发生，观众来不及产生任何预期。加长动画时长并不能补上这个 —— 必须**在牌出现之前插入一拍**。

### 根因 3 · 面板时序双重计时，导致「空面板挂 1.6 秒」🆕

这是本次实测**新发现的真 bug**，此前无人察觉：

- `App.jsx` 用 `setTimeout(..., TIMING.panelDelay)`（1420ms）切 `phase='revealed'` → 面板在 **1462ms** 挂载
- `ReadingPanel.jsx` 又在 variants 的 `transition` 根上写了 `delay: TIMING.panelDelay / 1000`（1.42s）→ **本意是再等 1.42s**

结果实测：面板外框在 **1490ms** 就开始滑动（说明根上的 `delay` **没有生效**），但子项在 **3056ms** 才出现（说明 `delayChildren: 1.54s` **生效了**）。

**推断**：在 Framer Motion 里，当每个动画属性都写了自己的 per-property config（`opacity: {...}` / `y: {...}`）时，写在 `transition` **根上的 `delay` 会被丢弃** —— per-property config 完全接管该属性。而 `delayChildren` / `staggerChildren` 是另一套编排机制，不受影响。

> ⚠️ 这条结论请用附录 A 的探针**自测确认**再依赖它。判据：`panelVisible - panelMount` 若只有几十毫秒，就说明根 `delay` 确实被丢了。

**后果**：面板外框在 1.5s 就推上来，里面**空的**，1.6 秒后才开始出字。观众看到的是一个"空壳滑上来又等半天"。这个 bug 必须一并修掉。

### 根因 4 · 环境对事件毫无反应

抽牌全程，背景（雾、星屑、暗角、副标题）**没有任何变化**。真实感来自环境对事件的响应；环境一动不动，事件读起来就像"贴在画面上的贴纸"，而不是"发生了一件有影响的事"。

---

## 5 · 目标结构：抽牌仪式分 7 拍

把当前「无结构」的时序，重排成一条有起伏的曲线：

```
① 蓄势 CHARGE      —— 球充能：光环内收、辉光提亮、雾扰动加剧、暗角压下来、副标题退出
        ↓（末尾留一小段「吸气」的静）
② 释放 RELEASE     —— 爆闪 + 冲击环，峰值成为牌起飞的助推
        ↓
③ 升起 RISE        —— 牌从球心升起，**只显牌背**
        ↓
④ 悬停 HOLD        —— 牌停住不动，只留极轻的呼吸感 ← ★期盼感的核心拍
        ↓
⑤ 预压 WARM        —— 翻牌前反向小幅后仰（anticipation before the flip）
        ↓
⑥ 翻牌 FLIP        —— 两拍到位 + 跨 90° 高光扫过
        ↓
⑦ 留白 TAIL        —— 停住，让牌面被看清
        ↓
⑧ 面板 PANEL       —— 外框推入，内容紧随其后依次亮起（**不再有 1.6s 空档**）
```

**设计原则（沿用项目已确立的共识，别推翻）**：

- 「全页只有一种缓动 = demo；四种运动性格 = 作品集」。本次要新增**两族**缓动（见 §6），而不是复用 `slam`。
- **期盼感 = 动作之前的等待 + 动作之后的静止**。所以 ④ 和 ⑦ 是**新增的、不动的拍**，不是"慢动作"。加长总时长必须靠增加**拍数**，不能靠把所有曲线拖慢（那会变廉价）。
- `daily` 模式一天只抽一次，所以仪式可以长。**目标总时长定在 5.2–5.4s**（当前 3.4s，但形状是错的）。可接受区间 4.5–6.0s。**超过 6.5s 要重新评估**。

---

## 6 · 数值方案

### 6-A · 新增 `DRAW_RITUAL` 与派生的 `DRAW_BEATS`（写进 `src/config/skin.js`）

现在 `TIMING` 把「入场」和「抽牌」两件事混在一起。本次把抽牌相关的键**全部迁到一个新表**，并由它派生出「绝对时刻表」——组件只读绝对时刻，**不再各自算延迟**（这正是根因 3 的土壤）。

```js
/* ==========================================================================
   抽牌仪式分拍（2026-09-19）
   --------------------------------------------------------------------------
   单位毫秒。这里只描述「每一拍多长」，绝对时刻由 DRAW_BEATS 派生 —— 
   组件一律读 DRAW_BEATS，不许自己把几个 TIMING 相加（那样迟早对不上）。
   ========================================================================== */
export const DRAW_RITUAL = {
  charge: 1000,      // ① 蓄势（新增拍：这是期盼感的来源）
  flash: 520,        // ② 释放爆闪（原 420）
  flyDelay: 60,      //    爆闪峰值之后起飞
  fly: 1150,         // ③ 升起（原 900）
  hold: 650,         // ④ 悬停静默（新增拍 ★ 最关键）
  flipWarm: 140,     // ⑤ 翻牌预压（新增拍）
  flip: 1200,        // ⑥ 翻牌总长（原 1000；含 warm 140 + 主力 860 + 落定 200）
  flipMain: 860,     //    主力段 0→168°（原 720）
  tail: 280,         // ⑦ 看清牌面的留白（新增拍）
  panelSlide: 720,   // ⑧ 面板上滑（原 620）
  panelStagger: 72   //    面板内容依次亮起（原 60）
}

/** reduced 兜底表：无障碍用户不能等 5 秒。除必留的极短淡入外全部归零 */
export const DRAW_RITUAL_REDUCED = {
  charge: 0, flash: 120, flyDelay: 0, fly: 1, hold: 0,
  flipWarm: 0, flip: 1, flipMain: 1, tail: 0, panelSlide: 200, panelStagger: 0
}

/** 选表：组件里一律用 `const r = ritual(reduced)`，不要自己判断 */
export const ritual = (reduced) => (reduced ? DRAW_RITUAL_REDUCED : DRAW_RITUAL)

/** 绝对时刻表（ms，从点击水晶球算起）—— 唯一真相 */
export const DRAW_BEATS = (() => {
  const r = DRAW_RITUAL
  const chargeDone = r.charge                 // 爆闪起跑
  const flyAt = chargeDone + r.flyDelay       // 牌起飞
  const riseDone = flyAt + r.fly
  const holdDone = riseDone + r.hold
  const flipAt = holdDone + r.flipWarm
  const flipDone = flipAt + r.flip
  const tailDone = flipDone + r.tail
  return {
    click: 0, chargeDone, flyAt, riseDone, holdDone, flipAt, flipDone, tailDone,
    panelAt: tailDone,                        // 面板挂载时刻
    panelSettled: tailDone + r.panelSlide,
    total: tailDone + r.panelSlide
  }
})()
```

### 6-B · 目标时间轴（由上面的数字推出，等于验收表）

| 拍 | 时刻（ms） | 时长 | 说明 |
|---|---|---|---|
| ① 蓄势 | 0 → 1000 | 1000 | 球充能；**牌尚未挂载** |
| ② 释放爆闪 | 1000 → 1520 | 520 | 峰值 ≈ 1094 |
| ③ 升起 | 1060 → 2210 | 1150 | 全程只显牌背 |
| ④ 悬停 | 2210 → 2860 | 650 | **牌不动** ★ |
| ⑤ 预压 | 2860 → 3000 | 140 | 反向后仰 |
| ⑥ 翻牌 | 3000 → 4200 | 1200 | 168° @ 3860 |
| ⑦ 留白 | 4200 → 4480 | 280 | 牌面被看清 ★ |
| ⑧ 面板 | 4480 → 5200 | 720 | 外框推入 |
| 面板内容 | 4600 → 5308 | — | stagger 5 组 × 72ms + 420ms |

**净效果对比**：

| | 现在 | 目标 |
|---|---|---|
| 答案开始显形（跨 90°） | **295ms**（牌还在飞） | **约 3955ms**（牌停稳 1.7s 之后） |
| 牌到位 → 开始翻 | −483ms（**负数，翻转早于到位**） | +1030ms |
| 面板外框 → 首行内容 | **1594ms（空面板）** | 约 120ms |
| 点击 → 面板就位 | 1870ms | 5200ms |

### 6-C · 新增两族缓动（加进 `skin.js` 的 `EASE`）

```js
export const EASE = {
  reveal: [0.16, 1, 0.3, 1],
  settle: [0.22, 1, 0.36, 1],
  exit:   [0.7, 0, 0.84, 0],
  slam:   [0.2, 0.9, 0.2, 1],
  /** 蓄势（2026-09-19 新增）：慢起、末端加速 —— 读作「攒劲」，与 slam 的「快速到位」正好相反 */
  wind:   [0.55, 0, 0.85, 0.25]
}
```

翻牌要 **4 个关键帧 / 3 段曲线**，所以 `ease` 传数组：

```js
/* 预压(后仰 -6°) → 主力 → 落定 */
const warm = r.flipWarm / r.flip      // 0.1167
const main = (r.flipWarm + r.flipMain) / r.flip  // 0.8333

animate={{ rotateY: [0, -6, 168, 180] }}
transition={{
  duration: r.flip / 1000,
  delay: beats.flipAt / 1000,
  ease: [EASE.wind, EASE.slam, EASE.settle],
  times: [0, warm, main, 1]
}}
```

> ⚠️ `times` 必须严格递增、首 0 尾 1，长度 = 关键帧数。写错 Framer 会静默乱来。

### 6-D · `CARD_RISE` 与安全边界

起点 17 → **19**（视口高百分比）。行程更远 = 期盼更久。

⚠️ **不要在升起的 `y` 上用过冲曲线**（如 `[0.34, 1.4, 0.64, 1]`）：过冲方向是**向上**（飞行方向），会侵入标题带的 20px 净空。若确实想要这个手感，**必须把 `TITLE_GAP` 从 20px 提到 34px** 吸收过冲，并**用截图确认动画中段**（约 1.9–2.2s 时）标题与牌不重叠 —— `audit-title.js` 只量终态，抓不到中段。

**「被托住」的手感改用下面三个安全手段实现**（都不碰 `y`）：
1. `scale` 微过冲：0.42 → 1.025 → 1（`settle`）
2. ④ 悬停期的微幅摆动：`rotateZ: [0, -0.8, 0.8, 0]`（独立属性，Framer 会单独给 config）
3. 牌后辉光 `.card__halo` 的 opacity 脉动

---

## 7 · 逐文件改动清单

### A · `src/config/skin.js`

- [ ] 加 `DRAW_RITUAL` / `DRAW_RITUAL_REDUCED` / `ritual()` / `DRAW_BEATS`（§6-A）
- [ ] `EASE` 加 `wind`（§6-C）
- [ ] `CARD_RISE` 17 → 19，同步改注释
- [ ] **删掉 `TIMING` 里的抽牌相关键**（`orbFlash` / `cardFly` / `cardFlyDelay` / `flip` / `flipMain` / `panelDelay` / `panelSlide` / `panelStagger`），只保留入场相关的（`welcome` / `entrance` / `entranceVeil` / `entrancePlateDelay` / `entrancePlate`）
  - ⚠️ 这些键被 **4 个文件**引用，删之前先全局搜 `TIMING.`，逐个改完再删。
    已确认的引用点：`App.jsx:105,190`、`CardReveal.jsx:46-49`、`ReadingPanel.jsx:27-32`、`HeroStage.jsx:60-63`（后者用入场键，不动）
  - 顺手把 `TIMING` 的注释改成「只含入场时序；抽牌时序见 `DRAW_RITUAL`」，避免后人再加错地方

### B · `src/App.jsx`

- [ ] `<main className={...} data-phase={phase}>` —— **加 `data-phase`**，让验收脚本能轮询相位（替代不可靠的 `--wait`）。这是本次验收的地基，**先做这一步**
- [ ] 同处按 `phase === 'charging'` 加 `scene--charging` 类（供 CSS 做环境响应）
- [ ] `handleDraw` 改成三段（**引入新的 `charging` 拍**）：

```js
const handleDraw = useCallback(() => {
  if (phase !== 'idle') return
  const card = pickRandomCard()
  save(card.id)            // 立刻落盘：用户中途关页也不丢今日记录
  markCardWarmed(card.id)
  prefetchCards(ALL_CARD_IDS, 3)
  const b = DRAW_BEATS
  setPhase('charging')     // ★ 新增拍：球充能，**牌此时还不挂载**
  pushTimer(() => { setCurrentCard(card); setPhase('drawing') }, b.chargeDone)
  pushTimer(() => setPhase('revealed'), b.panelAt)
}, [phase, save])
```
  - 注意：`currentCard` 的挂载推迟到 `chargeDone`，这是「蓄势期看不到牌」的关键
  - `handleAgain` / `handleModeChange` 已有的 `clearTimers()` 会正确打断仪式，**别动**
- [ ] 爆闪的 `duration` 改用 `DRAW_RITUAL.flash / 1000`，`times` 从 `[0, 0.26, 1]` 收到 `[0, 0.18, 1]`（更短促，峰值更锐）
  - 爆闪挂载条件 `phase === 'drawing'` **不用改** —— `drawing` 现在正好从 `chargeDone` 开始，时机天然对齐
- [ ] `headlineSub`：仪式期间（`charging` / `drawing`）返回 `''`，让副标题在蓄势时退出（静下来才是期盼感）
  - ⚠️ 别破坏已有的那条顺序约束：`phase === 'revealed'` 必须排在 `locked` **之前**（daily 模式下 `locked` 恒为真，顺序反了会让刚抽出的牌配错副标题）
- [ ] 标题的 `motion.section` 在 `charging` 期可轻微上移淡出（可选，P2）
- [ ] 给 `HeroStage` 传 `drawing={phase === 'charging'}`，透给球
- [ ] `showOrbLabel` 改成 `{!locked && phase === 'idle'}`，蓄势时让提示文字先退场

### C · `src/components/CrystalOrb.jsx`

- [ ] 新增 `charging` prop → `className` 加 `orb--charging`；加 `aria-busy={charging}`
- [ ] 按钮内新增充能元素：`<span className="orb__charge" aria-hidden />`（收束光环）
- [ ] ⚠️ **特异性陷阱**：`.orb.orb--charging` 必须写在 `.orb.orb--released` **之后**，且用同等特异性（两个类）。上一轮就踩过：`.orb.orb--released` 输给 `.orb:not(:disabled):active` 导致"松手先弹回再缩一下"的抽搐
- [ ] `.orb--released` 的 260ms 回弹与 `orb--charging` 会短暂共存。两个 `animation` 属性会互相覆盖 —— 建议让充能动画在前 25% 内几乎不动（把 260ms 让给回弹），或直接让 charging 接管。**改完必须实测点击手感**（探针量不到，要截图/手动）

### D · `src/components/CardReveal.jsx`（改动最大）

- [ ] 升起：`delay = DRAW_BEATS.flyAt / 1000`；`opacity` 前 200ms；`y` = `r.fly`（`slam`）；`scale` = `r.fly * 0.86`（`settle`，带微过冲见 §6-D）
- [ ] **翻牌 `delay` 从 `flyDelay + 0.06` 改为 `DRAW_BEATS.flipAt / 1000`** ← 这是本次最关键的修复
- [ ] 翻牌改成 4 关键帧 + 3 段曲线（§6-C）
- [ ] `.card__eclipse` 与 `.card__sheen-sweep` 的 `delay` 同步改为 `beats.flipAt`；高光扫过的 delay 改为 `flipAt + flipMain/2`（约 3430ms），时长 240 → 300ms
- [ ] **新增 `.card__halo`**：牌身后的辉光，④悬停期 opacity 脉动（0.35 ↔ 0.75，1.3s 一个来回；或 0 → 0.75 单次）。纯 CSS 渐变 + opacity 动画，**不加素材**
- [ ] ④悬停期的「被托住」三件套见 §6-D（**禁止在这拍动 `y`**：会与升起的 y 过渡打架，且可能吃掉标题净空）
- [ ] 加 `data-flip-at={DRAW_BEATS.flipAt}` 便于验收
- [ ] `reduced` 分支：全部 `duration: 0.01`，且**不挂** halo / eclipse / sheen
- [ ] 保留 `willChange` 只在动画期开、结束收回的现有做法

### E · `src/components/ReadingPanel.jsx`（顺手修掉根因 3）

- [ ] **把 `delay` 从 variants 的 `transition` 根上删掉**
  - 推荐做法：**延迟完全交给 `App.jsx` 的 `b.panelAt` 计时器**（挂载即开始动），组件内 `delay: 0`。这样只有一处计时，根除双重计时
  - 备选：把 `delay` 写进**每个属性自己**的 config（`opacity: { ..., delay }` / `y: { ..., delay }`）。**但不要两个都做** —— 那就是现在的 bug
- [ ] `delayChildren` 改为相对值 `0.12`（不再叠加绝对延迟）
- [ ] `y` 距离 96 → **120px**
- [ ] `panelSlide` 620 → 720；`panelStagger` 60 → 72（由 `r` 取）
- [ ] `reduced` 时 `panelSlide` 用兜底表的 200ms

### F · `src/index.css`

- [ ] `.orb--charging` 及 keyframes（充能：环内收、`filter: brightness` 提亮、球体微涨 1 → 1.05）
- [ ] `.orb__charge` 样式
- [ ] ⚠️ `.orb` 的 `transform` **必须始终包含 `translate(-50%, -50%)`** —— 球靠它定位，漏了会瞬间跳到右下角
- [ ] 蓄势的环境响应（**新增独立图层，不要去改已有的 `.scene__vignette`** —— 它的 `opacity` 是默认的 1，没法再加深）：
  - 新增 `.scene__charge-dim`：`position: absolute; inset: 0;`，暗色径向渐变，蓄势期 opacity 0 → 0.45（`wind` 曲线，1s）
  - `.scene--charging .mist__band--1/2/3`：`animation-duration` 缩短到 60%（=扰动加剧），亮度略提
  - 或通过 `.scene--charging { --mist-alpha: 0.85 }` 提升雾浓度（**当前值先读 `:root` 里的定义再定**）
- [ ] `.card__halo` 样式
- [ ] 可选 `.draw-burst`：释放瞬间的冲击环（`scale 0.4 → 1.5`、`opacity 1 → 0`、700ms）
- [ ] `@media (prefers-reduced-motion: reduce)` 块（`index.css:1717`）**把上述所有新动画加进 `animation: none !important` 名单**，并把 `.scene__charge-dim` 的 opacity 归 0
- [ ] ⚠️ 所有新 keyframes 只动 `transform / opacity / filter`

### G · `src/components/ParticleField.jsx`（P1，可选，收益高但有风险）

- [ ] 新增 `converge` prop（0 → 1）：星屑向球心收束 + 亮度提升
- [ ] 球心用**实测**取，不要算：`document.querySelector('.orb')?.getBoundingClientRect()` 的中心。球在 `.hero-plate` 内用百分比定位，视口坐标不能从常量推
- [ ] **硬要求**：`converge === 0` 时行为必须与现在**逐帧等价**，否则会改坏已有观感。改完先跑一次对照截图

### H · `src/components/MistLayer.jsx`（P1，可选，成本极低）

- [ ] 新增 `intense` prop → `className` 加 `mist--intense`，其余交给 CSS（F 里已列）。这是「环境响应」里性价比最高的一条

### I · 验收脚本：`scripts/flows/audit-draw.js` 升级为「节拍审计」

现在的版本只量稳态几何。改造成带**断言**的节拍审计（复用 `probe-draw-timeline.js` 的采样逻辑，加上门槛判定与 PASS/FAIL 输出）：

| 断言 | 门槛 | 为什么 |
|---|---|---|
| `cardVisible - click` | ≥ 950ms | 蓄势确实存在 |
| `flipStart - riseSettled` | ≥ 550ms | 悬停拍存在，翻转不与升起重叠 |
| **`flip90 - riseSettled`** | **≥ 1500ms** | ★ 答案不得在牌停稳前显形 |
| `panelMount - flipDone` | ≥ 200ms | 留白拍存在 |
| `contentVisible - panelMount` | **≤ 300ms** | ★ 不许再出现空面板 |
| 总时长（panelSettled） | 4800 – 6000ms | 整体在目标区间 |
| `--reduced` 下的总时长 | ≤ 600ms | 无障碍兜底 |

- [ ] 保留现有的 `overlapPx`（牌 vs 面板）断言，仍须为 0
- [ ] 输出**落盘再读**（`> file 2>&1`），本机 shell 管道不可靠

---

## 8 · 验收清单（全绿才算完成）

```
[ ] 1. 节拍审计（桌面 1582×804）七条断言全 PASS
[ ] 2. 节拍审计（移动 504×784）全 PASS —— 竖屏卡牌更高，节拍应一致
[ ] 3. --reduced 下总时长 ≤ 600ms，且页面上看不到任何新增动画
[ ] 4. audit-title.js：overlapTitleCard / overlapSubCard / overlapHeadlineCard 全为 0
[ ] 5. audit-draw.js：overlapPx（牌 vs 面板）为 0
[ ] 6. audit-motion.js：layoutAnimatingKeyframes 仍为空数组
[ ] 7. 球三态（hover / active / released / charging）规则均在位，且点击无抽搐
[ ] 8. 截图人工确认：蓄势期画面、悬停期牌背、翻牌中段、终态（四张）
[ ] 9. 构建通过（vite build 无报错）
[ ] 10. 全套回归：reveal.js / share.js / audit-draw.js 全绿
       ⚠️ welcome.js 必须跑**开发服务器**（它要点 DevBar 的「重播迎接」，生产构建不渲染 DevBar）
```

---

## 9 · 收尾与产物同步

- [ ] `MOTION_AUDIT.md` 新增一节「抽牌仪式分拍」，附**基线 vs 目标对照表**（§3 / §6-B 直接搬）
- [ ] `PROJECT_STATE.md`：变更日志加本轮；更新顶部「最后更新」日期
- [ ] `NEXT_STEPS.md`：更新完成度表；把本次新踩的坑写进「已知问题与坑」
- [x] ~~**重跑 `scripts/build_user_preview.mjs`**（否则 `dist-user/` 离线副本仍是旧节奏）~~
  —— **2026-09-19 作废**：脚本与离线副本均已删除，无需重跑
- [ ] 再跑一次 `vite build` 让 `dist/` 同步
- [ ] 若要重新交付：改 `scripts/package_project.py` 的 `STAMP` 为当天日期（否则与旧包同名直接覆盖）
- [ ] 清理 `assets/_debug/` 里本轮的临时图（**保留** `probe-baseline.png` 作基线证据）

---

## 10 · 负面清单（不要做的事）

| ❌ | 原因 |
|---|---|
| 引入 GSAP / Three.js / 新动画库 | 项目已定：现有栈足够，多一个库就多一份体积与维护面。<br>⚠️ **2026-09-19 更新：v2 的 3D 水晶球是「唯一已批准的例外」（用 Three.js，理由与代价见 `PROJECT_STATE.md` 第十七轮）。这条判据本身不变 —— 除那一处，其余新增渲染库/动画库仍按本行拒绝。** |
| 加音效 | 项目**没有音频素材**，且自动播放有策略限制。要做单独立项 |
| 把「加长」实现成**所有曲线统一变慢** | 那会整体变廉价。加长必须靠**增加不动的拍**（④⑦），靠拍与拍的对比产生节奏 |
| 改卡牌尺寸 / 锚点 / 面板位置 | 会破坏已固化的几何契约（标题带靠 `--card-height-half` 算让位，两边必须同源） |
| 改 `DRAW_MODE` | 保持 `daily` |
| 动 `dist/` 的构建方式 | 2026-09-19 前这条的理由是「离线双击能开」（`--base ./` + 产物经典脚本化）。离线通道已移除，但 `--base` 有独立价值（**站点子目录**部署），`BASE` 常量继续跟随 Vite 的 `base` —— **别改成写死 `/`** |
| 用 `--wait` 抓动画帧 | 时钟基准会差出一整拍（NEXT_STEPS 第 13 条） |
| 用 `npm run` / 管道 | 本机 npm 走 wsl 被拦；管道不可靠。用附录 A 的绝对路径 + 落盘再读 |
| 在 ④悬停拍动 `y` | 与升起的 y 过渡打架，且可能吃掉标题 20px 净空 |

---

## 附录 A · 命令速查（直接复制）

```bash
cd "C:/Users/29923/WorkBuddy/2026-09-17-19-02-52/tarot-app"
N="C:/Users/29923/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
P="C:/Users/29923/.workbuddy/binaries/python/envs/default/Scripts/python.exe"
```

**① 启动开发服务器**（后台跑，别用 `npm run dev`）

```bash
"$N" node_modules/vite/bin/vite.js --port 5199 --strictPort
```

**② 抽牌时间轴探针**（本次新写，已就绪；落盘再读，管道不可靠）

```bash
"$N" scripts/shot.mjs http://127.0.0.1:5199/ assets/_debug/ritual.png \
  --w 1582 --h 804 --wait 4200 --eval-file scripts/flows/probe-draw-timeline.js \
  > assets/_debug/_ritual.txt 2>&1

"$P" -c "import io,re;s=io.open('assets/_debug/_ritual.txt',encoding='utf-8').read();print(re.search(r'eval 返回： (.*)',s).group(1))"
```

**③ reduced 对照**

```bash
"$N" scripts/shot.mjs http://127.0.0.1:5199/ assets/_debug/ritual-reduced.png \
  --w 1582 --h 804 --wait 4200 --reduced \
  --eval-file scripts/flows/probe-draw-timeline.js > assets/_debug/_ritual-r.txt 2>&1
```

**④ 几何与动效审计**

```bash
"$N" scripts/shot.mjs http://127.0.0.1:5199/ assets/_debug/a-title.png \
  --w 1582 --h 804 --wait 5200 --eval-file scripts/flows/audit-title.js
"$N" scripts/shot.mjs http://127.0.0.1:5199/ assets/_debug/a-draw.png \
  --w 1582 --h 804 --wait 5200 --eval-file scripts/flows/audit-draw.js
"$N" scripts/shot.mjs http://127.0.0.1:5199/ assets/_debug/a-motion.png \
  --w 1582 --h 804 --wait 5200 --eval-file scripts/flows/audit-motion.js
```

**⑤ 构建烟测**

（原先这里是「build + 重建离线副本」；2026-09-19 起离线副本已随离线通道删除。）

```bash
"$N" node_modules/vite/bin/vite.js build
```

---

## 附录 B · 关键文件速查表

| 文件 | 角色 | 本次改动 |
|---|---|---|
| `src/config/skin.js` | **时序 / 几何 / 缓动唯一真相** | 新增 `DRAW_RITUAL` / `DRAW_BEATS` / `ritual()` / `EASE.wind`；`CARD_RISE` 17→19；删抽牌相关 `TIMING` 键 |
| `src/App.jsx` | 编排层（phase 状态机 + 计时器） | `data-phase`、`charging` 拍、三段计时、副标题退出、环境类 |
| `src/components/CardReveal.jsx` | 升起 / 悬停 / 翻牌 | 翻牌延迟改为绝对时刻（**核心修复**）、4 关键帧、halo、悬停拍 |
| `src/components/ReadingPanel.jsx` | 解读面板 | **删掉根上的 `delay`**（修双重计时 bug）、y 96→120 |
| `src/components/CrystalOrb.jsx` | 抽牌按钮 | `charging` prop + 充能元素 |
| `src/components/MistLayer.jsx` | 雾 | `intense` prop（P1） |
| `src/components/ParticleField.jsx` | 星屑 | `converge` prop（P1） |
| `src/index.css` | 样式 / keyframes | 充能、halo、暗角层、reduced 兜底 |
| `scripts/flows/probe-draw-timeline.js` | **本次新写的实测探针** | 直接复用；改造 `audit-draw.js` 时抄它的采样逻辑 |

---

## 附录 C · 开工顺序建议

1. **先加 `data-phase`，跑一次探针**，确认你测到的基线与 §3 一致（先证明测量可信）
2. 再改 `skin.js` 的表（不碰组件，先把"账"立好）
3. 改 `App.jsx` 的三段计时 → 跑探针，确认 `cardVisible` 从 ~52ms 变成 ~1000ms
4. 改 `CardReveal.jsx` 的翻牌延迟 → 跑探针，确认 `flip90 - riseSettled` 转正且 ≥1500ms
5. 修 `ReadingPanel.jsx` 的双重计时 → 跑探针，确认 `contentVisible - panelMount ≤ 300ms`
6. 最后做视觉层（充能 / halo / 环境响应 / 粒子 / 雾）
7. 全量回归 + 更新文档 + 重建产物（`vite build` 即可；离线副本已删除，不再有 `dist-user/` 要重建）

> 每改一步就跑一次探针。这个改造的价值全在**时间轴的形状**上，靠肉眼判断不了 —— 必须看数字。
