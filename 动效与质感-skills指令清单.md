# 动效与质感 · 本地 Skills 指令清单

本机 `~/.workbuddy/skills/` 下已装的、跟「网页质感 / 动效 / 视觉验证」相关的 skill 全在这里。
每个 skill 给三段：**它管什么** / **什么时候该用** / **可直接粘贴的指令**。

> 用法：在另一个对话窗口里，把「粘贴指令」整段复制过去。段落里已经写死了塔罗项目的绝对路径与关键约束，
> 所以那个窗口不需要你重新交代背景。

---

## 0. 先记住三条硬事实（粘贴指令里也会体现，但你自己要清楚）

1. **本项目技术栈是 Framer Motion，不是 GSAP**。`gsap-*` 那一整套（8 个）目前**用不上**，
   除非你决定引入 GSAP 做滚动叙事 —— 那是一个独立的技术决策，不要顺手就上。
2. **项目根目录**：`C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app`
   接手任何任务前先读同目录的 `PROJECT_STATE.md`（架构与硬约束）与 `NEXT_STEPS.md`（剩余待办）。
3. **改完任何视觉/动效参数，必须先截图再下结论**。
   命令：`node scripts/shot.mjs http://127.0.0.1:5173/ assets/previews/screen.png --w 1600 --h 900 --wait 5000 --eval-file scripts/flows/reveal.js`
   这条是项目里唯一能抓住「翻牌方向反了、动画结束停在牌背」这类 bug 的手段。

---

## 1. 总纲层 —— 一次任务只选一个主入口，别同时开

### `motion-web`（最全，动效优先的创意站总流程）
- **管什么**：从参考 → 概念 → 规格 → 实现 → 审计的完整链路。页面设计（结构 / 字阶 / 配色 / 间距）
  ＋交互编排（滚动动画、Framer Motion、GSAP、轻量 3D）。也管「手感差 / 太生硬 / 不跟手」、
  「复刻某视频或网址的动效」、「伪 3D / 抠图做纵深」、「像 AI 做的 / 没设计感」。
- **什么时候用**：要做整页级的质感升级，或要修「整体感觉不对但现在说不清哪里不对」。
- **不该用**：只改一个小过渡的时长缓动 —— 那是 `transitions-polish` 的活。

```
读 C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app\PROJECT_STATE.md 与 NEXT_STEPS.md。
这是一个已上线的塔罗日签单页站（Vite + React + Tailwind 4 + Framer Motion，零后端）。
用 motion-web skill 做一次整页手感升级：目标是「开箱即惊艳、像作品集不像 demo」。
先做审计（指出当前入场、抽牌、翻牌、面板上滑四处动效分别的问题），
给出带具体数值（时长/缓动/距离/延迟）的改造方案，我确认后再动手。
不要引入 GSAP 与 Three.js；保持零后端与现有素材槽位架构。
（⚠️ 2026-09-19 更新：v2 的 3D 水晶球已批准引入 Three.js，这是**唯一例外** —— 若本次任务涉及主页那颗球，可沿用；
GSAP 与其余新增库仍按本条拒绝。见 PROJECT_STATE.md 第十七轮）
```

### `swappable-skin-visual-site`（本项目自带架构规范，改素材相关的事先读它）
- **管什么**：「素材槽位 + 主题变量」把手艺与代码解耦，换风格只换文件不改代码。
- **什么时候用**：要换卡框 / 主视觉 / 整体配色，或问「后期换风格麻不麻烦」。
- **注意**：这个 skill 本来就是从本项目抽出来的，**当前代码就是它的一个实例**。改视觉前读一遍可以避免破坏槽位契约。

```
用 swappable-skin-visual-site skill 复核塔罗项目当前的槽位架构有没有被破坏：
C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app
重点检查：src/config/skin.js 的槽位定义、public/skins/mist-night/ 的文件命名、
以及有没有组件绕过槽位直接引用了具体美术文件。只做只读审计并列出问题，不要改代码。
```

### `superdesign`（frontend-design，通用 UI 设计准则）
- **管什么**：把界面做得现代、好看、专业的设计准则。
- **什么时候用**：觉得「排版 / 配色 / 层级就是差一口气」，需要一个通用设计视角给意见。
- **注意**：偏通用规范，不如 `motion-web` 贴合本项目。

```
用 superdesign skill 审阅塔罗项目首页的视觉设计：
C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app
先看 src/index.css 与 src/components/，再跑一次截图
（node scripts/shot.mjs http://127.0.0.1:5173/ assets/previews/audit.png --w 1600 --h 900 --wait 5000）
指出排版层级、配色克制度、留白节奏上最影响「高级感」的三处，给具体改法。
```

---

## 2. 动效实现层

### `animate`（从零做一段动效，并写出代码）
- **管什么**：按「该不该动 → 为什么动 → 用什么工具 → 动哪些属性 → 什么曲线和时长 → 怎么被打断 → 怎么退场」的顺序做决策，并落地实现。
- **什么时候用**：要给某个新元素加动效，或重做某一段过渡。

```
用 animate skill 重做塔罗项目的「牌自球心升起 → 3D 翻牌」这一段。
项目：C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app
相关文件：src/components/CardReveal.jsx、src/components/CardFace.jsx、
src/config/skin.js 的 TIMING 与 CARD_RISE、src/index.css。
技术栈 Framer Motion，别引入新库。
要求：先给我决策清单（每一档的取舍理由），我确认后再改代码；改完必须用 scripts/shot.mjs 截图验证结束态。
```

### `transitions-dev`（32 个可直接粘贴的 CSS 过渡）
- **管什么**：徽标、下拉、弹窗、面板展开、页面切换、卡片尺寸变化、数字滚动、图标切换、加载骨架、
  手风琴、Toast、点赞、开关……每个都是带 `t-*` 命名空间与 `prefers-reduced-motion` 保护的即插即用片段。
- **什么时候用**：要加某个**具体而常见**的界面过渡，且希望是生产级、可直接粘贴的。

```
用 transitions-dev skill 给塔罗项目加这几处过渡：
① 解读面板上滑（ReadingPanel）② 分享弹窗开合（ShareDialog）
③ 开发调试条（DevBar）的展开收起 ④ 抽牌按钮的 hover / active 反馈
项目：C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app
用 skill 里对应的现成片段，别自己造。全部带上 prefers-reduced-motion 保护。
改完跑 scripts/shot.mjs 截图确认。
```

### `apple-design`（Apple 式物理动效与弹簧手感）
- **管什么**：手势驱动 UI、弹簧动画、拖拽 / 滑动 / 底部抽屉、动量与可打断过渡、半透明材质与纵深、
  字体光学尺寸与字距、`prefers-reduced-motion`。
- **什么时候用**：要「跟手」「有物理感」「像 iOS」，或要做可打断的过渡。

```
用 apple-design skill 把塔罗项目的抽牌交互改成「可打断、有物理惯量」的手感：
现在点水晶球后是一段固定的 2.6s+1.0s 定时动画，中途不可交互。
项目：C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app
想让它变成：按下即刻起手（不等入场动画结束）、期间再次点击可以加速/跳过、
牌落位用弹簧而不是固定时长曲线。技术栈 Framer Motion。
先给方案与具体弹簧参数（stiffness / damping / mass），我确认后再改。
```

### `emil-design-eng`（Emil Kowalski 的 UI 打磨哲学）
- **管什么**：组件设计的「看不见的细节」，什么该动、什么不该动、什么时候少即是多。
- **什么时候用**：整体已经能跑，但想「再上一个台阶」；或者担心自己加的动效太多太吵。

```
用 emil-design-eng skill 审阅塔罗项目当前的动效克制度：
C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app
现在首页有：雾气漂移、球内星云流转、呼吸发光、光环脉冲、粒子上升、入场 2.6s、抽牌三段。
哪些是「让产品变好」，哪些是「让产品变吵」？给出该删/该减/该保留的清单与理由。只给意见，先别改。
```

---

## 3. 动效审计与打磨层（改现有动效，而不是新加）

### `review-animations`（评审一段动效，默认挑刺）
- **管什么**：以高工艺标准审阅动效代码，默认倾向「提出问题」，通过是要挣来的。
- **什么时候用**：你刚改完一段动效，想知道「够不够好」。

```
用 review-animations skill 审阅塔罗项目的翻牌与面板上滑这两段动效代码
（src/components/CardReveal.jsx、CardFace.jsx、ReadingPanel.jsx、src/index.css 相关部分）。
项目根目录 C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app
严格挑刺，别客气。按严重程度排序，每条给出具体改法与数值。
```

### `improve-animations`（全代码库动效审计 + 可执行改造计划）
- **管什么**：把整个项目的动效代码当资深顾问来审，产出**优先级排序的审计报告 + 每个改动的独立实施方案**，
  方案要自包含到能交给别的 agent 或更便宜的模型直接执行。只读源码，不改。
- **什么时候用**：「让这个应用感觉更好」这种范围很大的诉求；或者你想把改造拆成多轮分别执行。

```
用 improve-animations skill 对塔罗项目做一次全量动效审计并产出实施方案。
项目：C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app
先把 PROJECT_STATE.md 的「视觉架构（六条硬约束）」和「动画时序」两节读完，方案不能破坏这些约束。
输出：① 按优先级排序的问题清单 ② 每个问题一个自包含的实施方案（改哪个文件、改成什么、验收标准）。
只读，不要动代码。
```

### `transitions-polish`（把已存在的动效对齐到动效 token 尺度）
- **管什么**：扫描 duration / distance / scale / blur / easing 五个维度，指出每个值应该引用哪个 token，
  以及「什么时候这个值才对」（开关不对称、hover 进 vs 出、错位延迟、意图延迟）。
- **什么时候用**：「时长感觉不对」「太慢/太快」「错位动画乱了」「把硬编码时长统一成 token」。

```
用 transitions-polish skill 把塔罗项目的动效参数全部对齐到动效 token 尺度。
项目：C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app
重点看 src/config/skin.js 的 TIMING 与 src/index.css 里散落的 duration/easing 硬编码。
要求：先列出所有散落的硬编码值 → 指出每个该映射到哪个 token（按用途匹配，不是按数值接近）→
再给出收口方案（建议统一进 skin.js 的 TIMING）。先给方案，我确认再改。
```

### `find-animation-opportunities`（找出「该动但没动」的地方）
- **管什么**：扫描代码或界面，找出**应该动但现在没动**的地方，并否掉一切不该动的。只读，给精确数值，不实现。
- **什么时候用**：「这里还能加点什么让页面更活？」「感觉哪里是死板的」

```
用 find-animation-opportunities skill 扫一遍塔罗项目，找出该动但没动的地方。
项目：C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app
必须同样用力地否掉不该加的（这个站是「神秘、克制、仪式感」，不是热闹）。
输出：值得做的几处 + 明确不建议动的几处，各给理由与具体数值。只读。
```

---

## 4. 术语词典

### `animation-vocabulary`（把「那个 Q 弹的东西」翻译成专业术语）
- **管什么**：反向查词。你用大白话描述一个动效，它给你准确术语（方便你去搜、去要求、去写 prompt）。
- **什么时候用**：「就是那种……弹一下的」「iOS 那个橡皮筋效果叫什么来着」。只命名，不设计不实现。

```
用 animation-vocabulary skill 帮我把下面这些大白话翻译成准确术语，
每条给「术语名 + 一句话定义 + 典型参数范围」：
① 弹窗打开时从中心"噗"地弹出来 ② 列表项一个接一个冒出来
③ 鼠标移上去卡片轻轻翘起一角 ④ 数字像老虎机一样滚上去 ⑤ 页面切换时淡出淡入
```

---

## 5. GSAP 系列（本项目**暂不使用**，除非你决定引入）

装了 8 个，只有在**决定把滚动叙事交给 GSAP** 之后才有意义。不要零散地引入。

| skill | 管什么 |
|---|---|
| `gsap-core` | 核心 API：`gsap.to/from/fromTo`、缓动、duration、stagger、`matchMedia`（响应式 + reduced-motion） |
| `gsap-timeline` | 时间线：`gsap.timeline()`、位置参数、嵌套、播放控制 —— 做复杂编排时用 |
| `gsap-scrolltrigger` | 滚动联动、pin 钉住、scrub 擦洗 —— **做滚动叙事的主入口** |
| `gsap-plugins` | Flip / Draggable / Inertia / Observer / SplitText / ScrambleText / SVG / 物理 / CustomEase 等 |
| `gsap-react` | React 集成：`useGSAP`、ref、`gsap.context()`、卸载清理 |
| `gsap-utils` | `clamp` / `mapRange` / `interpolate` / `random` / `snap` / `wrap` / `pipe` 等工具 |
| `gsap-performance` | 只用 transform、避免 layout thrashing、`will-change`、批处理、稳 60fps |
| `gsap-frameworks` | Vue / Svelte 等（**本项目用不到**） |

**如果哪天要做「滚动叙事版」首页**，正确的粘贴方式是先做一个技术决策，再让 GSAP 那套介入：

```
我要给塔罗日签做一个「滚动叙事版」首页：往下滚时巫师缓缓抬手、水晶球升到视线中心、雾气随之聚拢。
项目：C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app
先别写代码。用 gsap-scrolltrigger + gsap-timeline + gsap-react skill 回答我：
① 用 GSAP ScrollTrigger 是不是当前最优解？Framer Motion 的 useScroll 能不能更简单？
② 两者混用会不会打架？给一个明确的取舍建议与技术栈结论。
```

---

## 6. 长页滚动叙事（做「滚动版」时才用）

### `scroll-craft`（高端滚动驱动落地页）
- **管什么**：规划访客旅程、页面语法、情绪峰值与专属记忆点；分层 hero、克制动效、独立的移动端构图；
  可以用素材也可以生成写实素材；语义化 HTML；并**用视觉方式验证桌面 / 移动 / reduced-motion 三种状态**。
- **什么时候用**：要做品牌级滚动体验、电影感 hero、scrollytelling；或抱怨「这看起来像个模板」。

```
用 scroll-craft skill 给塔罗日签规划一个滚动叙事版落地页（先只出规划，不写代码）。
项目：C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app
现有素材：public/skins/mist-night/ 下的 hero-bg / hero-orb / card-back / frame / 22 张牌面。
现有约束：见 PROJECT_STATE.md 的「视觉架构（六条硬约束）」，不要破坏。
要：访客旅程分段、每段的目的与情绪、「情绪峰值」放在哪、移动端单独构图要怎么做。
```

---

## 7. 视觉验证（**改完必跑**）

### `web-visual-qa`（零依赖 CDP 截图 + 页面内 JS 断言）
- **管什么**：驱动本机已装的 Chrome/Edge 截图并执行页面内 JS，核验布局锚点、素材是否**真的**加载
  （而不是静默走了 CSS 兜底）、动画结束态、弹窗流程。不需要 Playwright（那要拉 ~500MB Chromium）。
- **什么时候用**：改完任何视觉参数之后。**这是本项目的强制步骤**。

```
用 web-visual-qa skill 验证塔罗项目当前状态（dev server 在 http://127.0.0.1:5173）。
项目：C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app
要核验：① 水晶球实际落点是否命中 ANCHORS.orb 的图像坐标百分比
② hero-bg / hero-orb / card-back / frame / 当前牌面五层素材的 naturalWidth 是否都 > 0（有没有退化）
③ 翻牌动画结束后停在正面而不是牌背 ④ 牌的包围盒与预期比例是否一致
跑 scripts/shot.mjs + scripts/flows/reveal.js，把实测数字贴给我，别只给结论。
```

---

## 8. 顺带可用的素材类 skill

| skill | 管什么 | 什么时候用 |
|---|---|---|
| `image-cog` | CellCog 出图 / 改图：文生图、图生图、角色一致性、产品摄影、参考图生成、风格迁移、贴纸、漫画、GIF | 要重做卡框、主视觉、补新牌面时的**出图** |
| `baoyu-image-gen` | 多后端 AI 出图（GPT Image 2 / Google / 通义 / 智谱 / 即梦 / Seedream 等），支持参考图、比例、批量 | 上面的备选，或需要指定某个后端 |
| `baoyu-image-cards` | 小红书 / 微信图文风格的信息图卡片系列（12 种视觉风格 / 8 种版式 / 3 套配色） | 做**推广图 / 小红书配图**，不是站内素材 |
| `text-to-lottie` | 生成 / 修改 Lottie JSON 动画（文字、logo、载入、图标、状态反馈、微交互、图表动画） | 想把某个动效做成可复用的 Lottie 资产 |

> ⚠️ **出图的铁律**（本项目踩过最深的坑）：**ImageGen 必须一张一张出，不能并行**。
> 同一轮发多个请求会串 `output_dir`、甚至静默失败少出图。每张牌单独一个
> `assets/card-art/<牌号>/` 目录，脚本按目录扫描取图（不依赖文件名），出完立刻核对落盘目录。

---

## 9. 给塔罗项目的推荐执行顺序

如果你要把「质感」这件事系统性地推一轮，按这个顺序最省事、返工最少：

1. **先诊断，别先动手** → `improve-animations`（全量审计 + 可执行方案，只读）
2. **找出遗漏** → `find-animation-opportunities`（该动没动的地方，同时否掉不该动的）
3. **统一标尺** → `transitions-polish`（把散落的时长/缓动收口成 token）
4. **逐个实现** → `animate`（新做）/ `transitions-dev`（套现成片段）/ `apple-design`（要手感与可打断）
5. **每次改完立刻验证** → `web-visual-qa`（**不可跳过**）
6. **交付前终审** → `review-animations` + `emil-design-eng`（挑刺 + 克制度）

`motion-web` 是「整页从设计到动效」的总入口，想一次性做完就是个好选择；
但它覆盖范围很广，如果你只想改一小块，用第 4 步里对应的专项 skill 更精准、也更省 token。

---

## 10. 两个提醒

- **别在同一个任务里同时加载多个「总纲级」skill**（`motion-web` / `scroll-craft` / `superdesign`），
  它们各自都有一套完整的方法论与优先级，同时上会互相打架、也会把上下文塞满。
  一次只开一个主入口，需要时再补一个专项 skill。
- 本机 skills 目录目前**有轻微冗余**：`animate` / `review-animations` / `improve-animations` /
  `find-animation-opportunities` 四个的边界虽然清楚，但和 `motion-web` 的动效章节有重叠；
  `transitions-dev` 与 `transitions-polish` 是「装过渡」和「改过渡」的分工，容易混。
  建议做一次整理（合并或明确标注各自入口），但不要现在批量删 —— 先跑一轮看哪几个真的用得上。
