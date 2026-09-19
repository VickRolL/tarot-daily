# NEXT_STEPS · 塔罗日签网站 剩余工作清单

> 本文档是**待办清单**，进度事实看 `PROJECT_STATE.md`。
> 新窗口接力方式：把这句话发给助手 ——
> **「读取 `C:\Users\29923\WorkBuddy\2026-09-17-19-02-52\tarot-app\PROJECT_STATE.md` 和同目录的 `NEXT_STEPS.md`，继续塔罗日签项目」**

最后更新：2026-09-19

---

## 0 · 先跑起来（30 秒）

```bash
cd "C:/Users/29923/WorkBuddy/2026-09-17-19-02-52/tarot-app"
N="C:/Users/29923/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"

# 5173 端口很可能有上一轮会话遗留的 vite 进程，先探活再决定要不要启
"$N" -e "fetch('http://127.0.0.1:5173/').then(r=>console.log('已在运行',r.status)).catch(()=>console.log('没在跑'))"
"$N" node_modules/vite/bin/vite.js          # 没在跑才需要启动
```

打开后左下角有调试条（仅开发模式）：**「牌面总览」** 一次看 22 张牌，**「一天一次 / 不限次数」** 实时切抽牌规则，
**「重播迎接」** 重新播放信封迎接动画（只重挂那一层，不动抽牌状态）。

> `DRAW_MODE` 现在是 `daily`（正式形态）。开发时想反复抽牌，用调试条切「不限次数」即可，不用改代码。
>
> ⚠️ **2026-09-19（v2 起）变更**：原先「双击根目录 `启动开发者版.cmd` → 打开构建出来的开发者版 `dist-dev/`」
> 这条路**已随离线通道整体移除**（Q1 决定：网站只走 http）。
> 调试条现在**专属于 `vite dev`** —— 需要它就起开发服务器，不必再单独构建一份带调试条的产物。

### 想看「用户视角」（没有调试条的界面）

调试条、牌面总览由 **`DEV_TOOLS`** 控制 —— 它是**构建期开关**，值由 `vite.config.js` 的 `define` 注入（`__DEV_TOOLS__`），
现在**只剩两种取值**：`vite dev` → 开 ｜ `vite build` → 关（连代码都被摇掉）。所以看用户视角不需要改任何代码。

**⚠️ 2026-09-19（v2 起）：离线通道已整体移除。** 原先有 `dist-user/`（双击 `index.html` 免服务器直看）、
`dist-dev/`、三个 `.cmd` 双击入口，以及一套 `file://` 适配（`scripts/lib/offline.mjs`）——
v2 只走 http（Q1 决策），这些已全部删除。作废的是「免服务器直看」，不是「看用户视角」：

```bash
cd "C:/Users/29923/WorkBuddy/2026-09-17-19-02-52/tarot-app"
N="C:/Users/29923/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
"$N" node_modules/vite/bin/vite.js build      # → dist/
"$N" node_modules/vite/bin/vite.js preview    # 本地 http 预览：无调试条、无牌面总览
```

**代价要记住**（Q1 当初列明过）：在你真正上线之前，能给人看的通道只有 `vite dev` / `vite preview`，
两者都要求对方装 Node。线上地址见 §2「发布上线」。v1 的离线副本没丢 ——
它在冻结快照里（`_archive/v1-2026-09-19/…-code-….zip` 内的 `dist-user/`）。

> 想重看首屏迎接动画：

### 想回到 v1（做 v2 之前的那个版本）

**两条路，互补，不互相替代。**

**1）git**（2026-09-19 建立）：`git log` 里 `bb0ad52` 就是 v1 基线，改坏了 `git restore` 回到它。
仓库约定：`core.autocrlf=false`（字节原样入库）、`.cmd` 由 `.gitattributes` 标记为**不做任何换行转换**
—— 本项目的 `.cmd` 必须 GBK + CRLF，被转成 LF 双击就是坏的，而退出码仍骗人为 0。

> ⚠️ **不要用 `git rm`** —— 本机实测它会触发**目录级误删**：只指定 10 个文件，整个 `scripts/`
> 的 29 个文件都被从磁盘抹掉（其中 19 个是非预期删除）。当时靠刚建好的基线
> `git restore --worktree scripts/` 才取回。要删文件请换别的方式，并**在删除后立刻核对文件数**。
> 详见第 6 节第 30 条。

**2）冻结快照** `_archive/v1-2026-09-19/`：

```
_archive/v1-2026-09-19/
├─ tarot-app-v1-code-2026-09-19.zip   11.8 MB / 122 文件（src · scripts · public · dist-user · 全部文档与配置）
├─ tarot-app-v1-art-2026-09-19.zip   104.2 MB /  42 文件（card-art 母版 · hero-art · concept · card-styles）
├─ SNAPSHOT.md                        构成 + 两个 zip 的 sha256 + 关键文件指纹 + 还原步骤
└─ _verify/ · _verify-full/           从 code zip 解出来**真跑过 / 逐文件核对过**的验收副本
```

校验完整性：`node scripts/verify_manifest.mjs <解出来的 tarot-app 目录>`
（脚本在工程里，不在 v1 包里 —— 它比原来文档里那条一行命令可靠，见第 6 节第 31 条）。

解到任意空目录就是完好的 v1：`unzip` 两个包 → 双击 `dist-user/index.html` 即看
（**这是最后一份离线副本了**），`npm install && npm run dev` 即继续开发。
要再冻一版（比如 v2 定稿后）：`python scripts/freeze_snapshot.py --label v2 --date <日期>`。

**冻结快照照旧要留**：git 管文本变化，快照管「随时拿回一份完整可用产物」，两者互不替代。

**改动不可回退的东西之前先冻一次**

---

## 1 · 当前完成度

| 阶段 | 状态 | 说明 |
|---|---|---|
| 需求对齐 | ✅ 完成 | 玩法 / 用户系统 / 牌库 / 抽牌规则 / 解读方式全部定稿 |
| 基础架构 | ✅ 完成 | 可运行、构建通过、素材缺失全部优雅降级 |
| 卡牌美术 | ✅ 完成 | **22 / 22 张大阿卡纳插画 + 统一卡框，已接入代码**；2026-09-18 已根治素材黑边（见第 6 节第 9 条） |
| 主视觉 | ✅ 完成 | **v2 无球版**（1536×1024），为拆层专门重绘 |
| 拆层素材 | ✅ 完成 | 水晶球透明层已就位并接入；`hero-figure` 人物层未做（可选） |
| 牌背 | ✅ 完成 | `card-back.webp`，与卡框同一套语言 |
| 上线前功能 | ✅ 完成 | 分享卡片图 / og meta / 首屏预热 / `DRAW_MODE=daily` |
| 迎接动画 | ✅ 完成 | **信封开启**（纯代码，风格与站点一致）。第十轮按用户反馈重做成**全屏斜置特写**（原版是画面正中一只小信封，被否）；可跳过、可整体关闭、「今日已抽」自动不播 |
| 整页手感升级 | ✅ 完成 | 入场/抽牌/翻牌/面板上滑四处动效按审计方案改造完成。零新增依赖、零积分；构建通过；桌面/移动/减少动效三态验证通过 |
| 抽牌仪式分拍 | ✅ 完成 | **「点击球 → 揭晓」重排成八拍**（蓄势 → 爆闪 → 升起 → **悬停★** → 预压 → 翻牌 → **留白★** → 面板），总 5.7s。根治了「答案早于牌到位 483ms」「空面板挂 1.6 秒」两个真 bug，并顺手修掉「面板侥幸不重叠（桌面只剩 3.2px 净空 / 竖屏超 19.3px）」。零新增依赖、零积分。详见 `MOTION_AUDIT.md` 第 7 节 |
| 标题遮挡修复 | ✅ 完成 | 「今夜一签」+ 副标题曾被卡牌盖住（桌面 74.4px、竖屏副标题整行）。已改为**从卡牌顶边往上锚定**，与卡牌、顶栏都不冲突；副标题文案顺序 bug 一并修好 |
| 离线副本 | ❌ **已移除** | `dist-user/` · `dist-dev/` · 三个 `.cmd` 入口 · `scripts/lib/offline.mjs` 于 2026-09-19（第十八轮）**整体删除** —— v2 只走 http（起因：`file://` 下本地图片不能当 WebGL 纹理，实测 `SecurityError`）。看用户视角改用 `vite preview`。v1 那套仍在冻结快照里 |
| git 版本控制 | ✅ 完成 | 2026-09-19 建仓，首个提交 `bb0ad52` = v1 基线（118 文件 / 70.92 MB）。`.gitignore` 排除 `_debug`/`previews`/`card-styles`/`_archive`/`dist*`；`core.autocrlf=false` + `.gitattributes` 保住 `.cmd` 的 CRLF（已逐字节验过 blob 与磁盘一致） |
| 交付形态 | 🔶 **待落地** | 改为**线上链接**（Q2 决策：静态托管 + git），不再发含离线副本的 zip。打包脚本保留给需要代码的人，已去掉离线副本逻辑与 `--no-preview` |
| 移动端 | 🔶 可用 | 竖屏实测构图成立，不塌；单独出 9:16 主视觉仍是提升项 |
| 发布上线 | ⬜ 未做 | 纯静态，`dist/` 直接托管 |

**可交付物**：`tarot-app/dist/`（构建产物，可直接静态托管）、**线上链接**（待上线，见 §2「发布上线」）、
`assets/previews/screen-*.png`

---

## 2 · 剩余工作（按优先级，附具体做法）

### ✅ P0 · 交付形态已改：线上链接（2026-09-19 决策）

原先的交付方式是「打包 zip，收包人双击 `打开网站.cmd` 免服务器直看」。**这条路已作废** ——
离线通道整体移除后 `dist-user/` 不再生成，包里也就没有可双击的副本了。

新的交付形态（Q2 决策）：

| 项 | 决定 |
|---|---|
| 托管 | **静态托管平台**（Netlify / Vercel / Cloudflare Pages 任一）—— 纯静态零后端，平台是最短路径 |
| 版本控制 | **已 `git init`**（2026-09-19）。平台接 git 后**每次推送自动出预览链接**，正好顶替被砍掉的本地双击通道 |
| 交付 | **只给线上链接** |

打包脚本**保留**（给需要看代码的人），但已瘦身：去掉离线副本相关逻辑与 `--no-preview` 选项。

```bash
PY="C:/Users/29923/.workbuddy/binaries/python/envs/default/Scripts/python.exe"
"$PY" scripts/package_project.py             # 完整包（含全部原始素材）
"$PY" scripts/package_project.py --light     # 轻量包（代码 + 运行时素材 + 验收图）
```

接收方：解压 → `npm install && npm run dev`（或直接看线上链接）。
`dist/`、`assets/_debug`、`node_modules`、`_archive` 都不进包。

> ⬜ **还差一步，且需要你本人操作**：选托管平台、登录账号、接上 git 仓库。
> 那一步涉及你的账号授权，我没有代办。

上线前若还改了代码，**记得重打**

---

### 🟠 P1 · 发布上线（最该先做）

纯静态零后端，`dist/` 丢到任何静态托管都能跑。用 WorkBuddy 的 **「发布为应用」** skill 可以一键出在线链接。

**上线后必须改三处**（否则分享卡片没有缩略图 / 标签页没图标）：
- `index.html` 里 `og:image` 与 `og:url` 现在是相对路径 `/og-cover.jpg`、`/`，
  **抓取端要求绝对地址** —— 换成 `https://你的域名/og-cover.jpg`、`https://你的域名/`
- **补一个 favicon**（2026-09-19 核出：`public/` 下只有 `og-cover.jpg` 与 `skins/`，
  `index.html` 里也没有 `<link rel="icon">` → 浏览器标签页是**空白默认图标**，作品集观感直接打折）。
  最省事的做法：从 `og-cover.jpg` 裁一个 512×512 存成 `public/icon.png`，
  再补 `<link rel="icon" href="/icon.png">` 与 `<link rel="apple-touch-icon" href="/icon.png">`
  （后者管「添加到主屏幕」的图标，移动端分享场景会用到）
- `vite.config.js` 的 `base` 默认 `/`，部署在子路径下要跟着改

**上线后建议真机验证一次跨天解锁**（2026-09-19 已在本地用 `--seed` 验过，逻辑是对的，缺真机确认）：
抽完牌 → 改系统日期到明天 → 刷新，应该能重新抽
（逻辑在 `hooks/useDrawState.js`：记录里的 `date` 和当天的 key 不同即视为可重抽）。
实测结论：昨天记录 → 球可点、迎接重播、副标题回到「静心片刻…」；今天记录 → 球禁用、副标题「这张牌，是今天的答案」。

---

### 🟠 P1 · 本地日历回看页（需求里列为「后续可加」）

抽牌记录已经在 `localStorage`（key 见 `src/config/skin.js` 的 `STORAGE_KEY`，格式 `{ date, cardId }`）。

做法：新增一个页面/弹层 → 月历视图 → 点某天看当天抽到的牌（复用 `CardFace` 渲染）。
**注意**：现在的 `useDrawState` 只存「今天」这一条，会互相覆盖。
要做回看必须先把它改成按日期累积的字典（`{ '2026-09-18': 'major-13', ... }`），
并考虑兼容已存在的单条旧格式。

---

### 🟡 P2 · 移动端专门出 9:16 竖构图主视觉（1 张图，5–10 积分）

**不紧急**：竖屏（504×784）实测已经可用 —— 底板横向被裁到画布中央 41%，
但巫师构图本来就居中，球稳稳落在手心（`orbCenterPct = 50 / 62.8`），不塌。

真要出的话：主视觉按 9:16 画布（如 1080×1920）出图，**巫师更靠上、水晶球居中偏上、下方给解读面板留白**。
代码侧不用改组件：加一段媒体查询覆盖 `ANCHORS` 与 `HERO_FRAME` 即可
（或者更彻底 —— 给皮肤加「竖屏变体目录」，`applySkinVars` 里按视口比例切 `SKIN`）。

---

### 🟡 P2 · 可选增强

- **`hero-figure` 人物层**：把巫师单独抠成透明层，就能做「背景 / 人物 / 球」三层视差（人物随鼠标微动）。
  纯锦上添花 —— 球现在已经是独立图层，核心效果（球独立发光/旋转/点击反馈）已经达成。
  做法：用无球版主视觉做参考图 image-to-image 抠出人物透明层，放 `public/skins/mist-night/hero-figure.webp`，
  组件已支持（`HeroStage` 会自动叠上），最多再微调一下 `ANCHORS`。
- **主视觉定稿**：现在用的是 v2 无球版。想换风格走 `README.md` 的换风格三步法，架构上零代码改动。
  但注意**新主视觉必须和拆层素材同帧**（同比例同构图），否则叠层会错位。
- **补 56 张小阿卡纳**：MVP 范围外，跑通后再扩（约 280–560 积分）。
- **接 LLM 做个性化解读**：需求里暂定为静态牌意库，是明确的后续升级点。
- **无障碍**：水晶球是**真 `<button>`**，所以键盘 Enter / Space 抽牌**原生就有**（2026-09-19 实测：
  `tag=BUTTON`、可聚焦、`focus-visible` 描边 3px、聚焦后激活能正常抽牌）；`:focus-visible` 已加，
  `prefers-reduced-motion` 已通过 `useReducedMotion()` 接入 `HeroStage` / `CardReveal` / `ReadingPanel` / `App` 标题；
  桌面端 orb 也已支持 `:hover` / `:active` 反馈。`.stage[aria-live=polite]` 内含牌名文字，
  抽牌时屏幕阅读器会播报牌名。
  **剩余（实测缺口）**：`.panel` 没有 `aria-live`，解读正文与「今日建议」**不会被播报**；
  另外可补一张「操作说明」的 sr-only 文案。
- **分享图加二维码**：分享图上目前只有文字水印。上线后可以把站点二维码画进页脚，扫码回流。

---

## 3 · 视觉核验工具（新窗口必读）

项目在 2026-09-18 之前**从来没有做过截图级核验**，构图全靠目测。现在有了两套手段：

### 3.1 无头截图 / 回归自检（推荐，零依赖）

```bash
cd "C:/Users/29923/WorkBuddy/2026-09-17-19-02-52/tarot-app"
N="C:/Users/29923/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"

# 静态首页
"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/shot-home.png --w 1600 --h 900

# 移动端竖屏
"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/shot-mobile.png --w 420 --h 880 --wait 4600

# 抽牌全流程（会打印球心百分比、牌背用的素材、插画加载状态、牌面文字）
"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/shot-reveal.png --eval-file scripts/flows/reveal.js

# 抽牌 → 解读面板 → 分享弹窗（会打印预览图尺寸与体积）
"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/shot-share.png --eval-file scripts/flows/share.js

# 迎接动画回归自检（会打印信封矩形、相机 matrix3d、各层 grouping 检查、动画结束后的残留节点数）
"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/shot-welcome.png --eval-file scripts/flows/welcome.js

# 抓迎接动画的某一帧（按动画状态等待，别用 --wait 猜时刻；要哪一帧写在 URL hash 里）
"$N" scripts/shot.mjs "http://127.0.0.1:5173/#open" assets/_debug/welcome-open.png \
     --w 1600 --h 900 --eval-file scripts/flows/welcome-frame.js --gpu

# 验减少动效降级（应打印 welcome:false）
"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/shot-reduced.png --reduced --eval-file scripts/flows/welcome.js

# 量「标题 / 卡牌 / 面板」三者的重叠（改过锚点或标题后必跑，重叠必须全是 0）
"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/chk-title.png --eval-file scripts/flows/audit-title.js --seed "localStorage.clear()"
"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/chk-title-m.png --w 420 --h 880 --eval-file scripts/flows/audit-title.js --seed "localStorage.clear()"

# 量整个动效系统的稳态参数（球的三态反馈 / 透视链 / 有没有动画动布局属性）
"$N" scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/audit-motion.png --eval-file scripts/flows/audit-motion.js --seed "localStorage.clear()"
```

取帧 hash 三选一：`#sealed`（信封已浮现、封印完好未翻）/ `#lift`（翻盖立起约 85°）/ `#open`（完全打开、暖光涌出）。
`welcome-frame.js` 会先点调试条的「重播迎接」把动画时钟归零，**所以只能在开发模式下用**。

`shot.mjs` 的常用参数：

| 参数 | 作用 |
|---|---|
| `--w` / `--h` | 视口尺寸（**实际 `innerWidth` 会比它小一圈**，见第 7 条） |
| `--eval-file` | 导航后执行一段页面内 JS，用来做断言 / 走到某个状态 |
| `--seed "<js>"` | 导航 → 跑这段 JS → **再重导航**；测「刷新后仍已抽」这类分支 |
| `--reduced` | 导航前打开 `prefers-reduced-motion: reduce`，验降级路径 |
| `--gpu` | 不禁用 GPU。**核对大元素必须加**，见第 12 条 |
| `--wait <ms>` | 固定等待。**只适合等静态页面，不要用来抓动画帧**，见第 13 条 |

它用 CDP 直接驱动**本机已装的 Chrome/Edge**，不需要装 `agent-browser` / `playwright`
（那要下约 500 MB 的 Chromium）。**改完视觉相关代码，跑一遍这些 flow 是最省事的验证方式。**

### 3.2 不需要浏览器的合成预览

`scripts/preview_hero.py` 在 Python 里复现 `.hero-frame` 的定位数学（常量直接从 `skin.js` 现读），
用成品素材合成「某个视口下屏幕真正看到的样子」，红框标出牌面落点。适合快速试锚点。

```bash
PY="C:/Users/29923/.workbuddy/binaries/python/envs/default/Scripts/python.exe"
"$PY" scripts/preview_hero.py                      # 默认 1600x900 / 1440x1000 / 390x844
"$PY" scripts/preview_hero.py 1920x1080 2560x1440   # 自定义视口
```

---

## 4 · 交付包说明

最新一轮：`*-2026-09-19.zip`（旧的两个 09-17 的包已废弃，内容过时）。

| 文件 | 内容 | 体积 |
|---|---|---|
| `tarot-app-handoff-2026-09-19.zip` | **完整包**：代码 + 全部原始出图 + 预览图 + **离线副本** | 197.8 MB（194 文件） |
| `tarot-app-code-2026-09-19.zip` | **轻量包**：代码 + 运行时素材（`public/`）+ **离线副本** + 验收总览图 | 22.5 MB（121 文件） |

**收包的人怎么用**：解压 → 双击根目录的 **`打开网站.cmd`** → 浏览器打开网站。
不需要 Node、不需要 Python、不需要起服务器（`dist-user/` 已按离线可用构建好）。

排除项：`node_modules`、`assets/_debug`（临时排查图）、`dist/`（正式发布用，绝对路径）、
`_archive/`（本地快照）、Vite 残留的 `vite.config.js.timestamp-*.mjs`。

> **⚠️ 2026-09-19 起交付形态改为「线上链接」**（Q2 决策：静态托管 + git）。
> 原先「打包 zip → 收包人双击 `打开网站.cmd` 免服务器直看」整条路已作废（离线通道整体移除）。
> 打包脚本**保留**给需要看代码的人，但 `--no-preview` 选项已删除，
> 打包前的 `.cmd` 编码前置自检也一并删除 —— 工程里已不存在 `.cmd`/`.bat`。

打包命令见 `PROJECT_STATE.md` 的「常用命令」。

---

## 5 · 重跑素材流水线（换素材 / 补新牌时）

```bash
cd "C:/Users/29923/WorkBuddy/2026-09-17-19-02-52/tarot-app"
PY="C:/Users/29923/.workbuddy/binaries/python/envs/default/Scripts/python.exe"

# 新牌面插画丢进 assets/card-art/<牌号>/ （目录里一张图即可，文件名随意）
"$PY" scripts/build_card_assets.py        # 牌面：去水印 + 裁切 + 导出 WebP + 合成预览
"$PY" scripts/verify_card_assets.py       # ✅ 必跑：验收卡框无透明洞 + 吊牌已抹净 + 22 张牌面无残留浅色边带
                                          #   退出码 0 才算通过（边缘允许 ≤6px 的缩放振铃，见第 6 节第 10 条）

# 主视觉/球/牌背的原始出图丢进 assets/hero-art/{bg,orb,back}/
"$PY" scripts/build_hero_assets.py        # 背景镜像去水印 / 球抠白底 / 牌背缩放
"$PY" scripts/build_lqip.py               # ⚠️ 换主视觉后必须重跑
"$PY" scripts/build_og_cover.py           # ⚠️ 换主视觉后必须重跑

"$PY" scripts/contact_sheet.py            # 22 张原始插画总览
"$PY" scripts/package_project.py          # 完整包
"$PY" scripts/package_project.py --light  # 轻量包
```

新增牌面后记得把牌号加进 `scripts/build_card_assets.py` 的 `ARTS`（打上中文名 / 英文名 / 罗马数字 / 配色说明）。

---

## 6 · 已知问题与坑（接手前必读）

1. **ImageGen 不能并行调用** ⚠️
   - 同一轮里发多个出图请求，会**串目录**（都写进第一个 `output_dir`）甚至**静默失败**（返回别的请求的结果）
   - 必须**一张一张出**。出完立刻核对落盘路径，再继续下一张
   - 应对：`output_dir` 每类素材单独一个目录（`assets/hero-art/bg` / `orb` / `back`），
     脚本按目录扫描取图，这样即使文件名不可控也不会错位

2. **`background: transparent` 经常返回白底 RGB**
   - 2026-09-18 出水晶球时实测又踩了一次
   - 兜底：`scripts/build_hero_assets.py` 的 `key_out_white()` ——
     最暗通道 + 四角泛洪填充 + 腐蚀 1px + 轻微羽化。脚本会自动检测有没有 alpha 通道并决定要不要抠

3. **AI 出图永远有右下角水印**
   - 牌面：统一裁掉底部 5%（水印固定在画面最底边）
   - 主视觉 / 牌背：用**镜像修补**（`repair_by_mirror()`，左右近似对称所以看不出来）
   - 卡框：形态学开运算（浅色材质上的半透明水印）
   - 不要手改，跑脚本

4. **主视觉叠层必须和背景同坐标系** ⚠️ 本轮踩得最深的坑
   - 背景千万**不要**回去用 `background-size: cover`，那样叠层百分比和图像百分比对不上
   - 现在全部走 `.hero-frame` 固定 3:2 底板，详见 `PROJECT_STATE.md` 的「主视觉底板与坐标系」
   - 新素材必须**同帧**（同比例同构图），否则一定会错位

5. **本机 bash 缺 coreutils，`rm` 也不可用**
   - `ls` / `find` / `head` / `grep` / `sed` / `tail` / `mkdir` / `cp` 用绝对路径：`"/c/Program Files/Git/usr/bin/ls.exe"`
   - `rm` 即使调 `rm.exe` 也会被 safe-delete 包装拦下。**删文件改用 Python**：
     `"$PY" -c "import shutil,pathlib; shutil.rmtree(pathlib.Path('x'), ignore_errors=True)"`
   - 传 Windows 路径给原生 exe 时，`/c/...` 会被错误翻译成 `c:\c\...`；**改用 `cd "C:/..."` 后接相对路径**

6. **5173 端口常有遗留进程**
   - 启动前先探活；能返回本项目内容就直接复用，别用 `--strictPort` 硬碰（会直接报 Port already in use）

7. **Chrome 无头模式拿不到预期视口**
   - `--window-size` 传的是外窗口尺寸，实际 `innerWidth/innerHeight` 会小一圈（1600×900 → 1582×804）
   - 要精确控制视口就多给点余量

8. **`assets/_debug/prof-reveal/` 删不掉**
   - 那是 CDP 截图留下的临时 Chrome profile，被 safe-delete 拦下了
   - 不影响交付（`package_project.py` 会排除整个 `assets/_debug`），想清可手动删

9. **卡框素材的「透明死区」会变成一圈黑边**（2026-09-18 已根治，但换卡框时会重现）
   - 原图里卡片四周留了一圈白底、右下吊牌挂在这圈留白里 → 抠图后留白变透明，
     而裁边 bbox 由「卡片 + 吊牌」共同决定，留白被保留成卡框的透明外边距
   - 这一带**卡框不画、插画又按裁切比例不画**，漏出的就是卡面兜底底色。
     合成预览里 RGBA→RGB 会把透明像素变成纯黑 —— 这就是「22 张牌全都有黑边」的真相
   - 现在 `build_card_assets.py` 的 `fill_outer_margin()` 会把与画布四边连通的透明区泛洪填成纸色，
     卡框成为「实心矩形 + 中央开窗」；纸色实测为 `CARD_PAPER = '#dfd3b9'`，
     **必须与 `src/config/skin.js` 的同名常量、CSS 的 `--card-paper` 保持一致**
   - 改完跑 `scripts/verify_card_assets.py` 验收（只看 alpha ≤ 8 的真透明，别看 alpha > 250，
     否则抗锯齿像素会误报）。另一个坑：插画原图常带一条平坦的浅色边（实测 22 张里 17 张顶部中招），
     脚本用「亮度 + 平坦度」双条件自适应裁掉，且要**循环收敛**（正义 / 死神裁一轮后会再露出 3px）
   - 注：去掉吊牌后卡牌裁到卡片本体，这圈外边距已不存在，`fill_outer_margin()` 现在只作保险丝

10. **吊牌已去掉，卡牌是完整矩形 —— 三个几何值必须同批粘**（2026-09-18）
   - 用户决定去掉卡框右下角的吊牌（外圈填纸色后它从「悬空」变成「趴在纸色上」，更别扭），
     卡牌 = 卡片本体。脚本里 `CROP_TO_CARD_BODY = True` / `REMOVE_TAG = True`，默认都开
   - `CARD_ASPECT` 从 `986 / 1496`（≈0.659）变成 **`960 / 1403`（≈0.6842）**；
     插画窗口随之变为 left 10.52 / top 7.48 / right 10.62 / bottom 8.20（%）；牌面导出 768×1123
   - ⚠️ **这三个值加上 `CARD_PAPER` 必须一次流水线跑出来后一起粘**，单独改一个必然错位
     （它们都依赖「裁到本体」之后的新尺寸）。`build_hero_assets.py` 与 `preview_hero.py`
     已改成从 `skin.js` 现读比例，不会再出现脚本按旧比例、素材按新比例的错位
   - 吊牌是**压在卡体内部**的，光裁不够：`remove_hanging_tag()` 用**左侧镜像**补图
     （卡框左右镜像对称，仅左侧宝石与右下吊牌例外）。镜像取样写成 `sx0 = w - x1` 会二次翻转、
     把右边缘整条弄透明（残差 60042 px），正确是 `sx0 = x0`
   - **裁边 vs 缩放的取舍**：必须「先裁边再缩放」，否则 768×1123 再裁会缩水成 733×1096，
     破坏「插画与卡框同尺寸同比例」的契约。代价是 LANCZOS 在**亮色牌**上会重新生成 1–5px
     「亮且平」的细线 —— 那是缩放振铃不是残边，会被不透明卡框内沿完全盖住，
     所以验收脚本给 `EDGE_TOL=6` 容忍量，别追着裁
   - **`_edge_stats()` 的采样步长曾是漏检根因**：原沿扫描轴按 3px 采样，768 宽只采到 x=765，
     **永远看不到最外侧 1–2 列**。改成扫描轴逐像素、垂直轴 3px 后立刻抓出 major-06 / major-15
   - 想回到带吊牌的旧形态：`CROP_TO_CARD_BODY = False` + 把 `skin.js` 三个值换回 `986 / 1496` 那组

11. **3D 透视必须挂在「直接父元素」上，而且不能被 grouping 属性压平**（2026-09-18 迎接动画，改了别踩）⚠️
   - `perspective` **只作用于直接子元素**。「信封上翻盖的 3D 翻转」要求 `perspective` 挂在翻盖的父级
     `.env__flap-slot` / 舞台 `.welcome__stage` 上 —— 挂到更外层等于没有
   - ⚠️ 更要命的是：`opacity`（< 1）、`filter`、`clip-path`、`mix-blend-mode` 都是 **grouping property**，
     一旦出现在**挂着 `perspective` 的那一层自己**身上，就会把它整棵子树的 3D 压平成 2D
     → 症状是**位置全对、但完全没有透视**，翻盖像一块平板翻过来，非常廉价
   - 所以信封的「相机层」`.env-cam` 必须干净：它只负责 `rotateZ` 斜角 + `rotateX` 前倾 + 尺寸 + 位置。
     入/退场的淡入淡出放在**它的子层** `.env-in` 上（那里有 opacity 是安全的，只会压平它自己那层的结果）
   - `flows/welcome.js` 里 `camGrouped` / `slotGrouped` 两条断言就是守这个的，别删

12. **无头截图默认的软件光栅化会「静默丢图层」**（2026-09-18 排查了半小时）⚠️
   - `shot.mjs` 默认带 `--disable-gpu`。在这种软件光栅化下，**超过约 2400px 的大元素上挂 `filter` 的 SVG
     会整块不渲染** —— 信封放大到 2400px 后，截图里火漆封印整个消失
   - 迷惑点：DOM 尺寸、`fill`、`getBoundingClientRect`、`elementFromPoint` **全部正常**，
     只有截图上没有 → 会以为是自己 CSS 写错了
   - **核对大元素时给 `shot.mjs` 加 `--gpu`**。真机（有 GPU）本来就是对的，这纯粹是**验证工具的假阳性**
   - 判断口诀：**截图说「没有」而 DOM 说「有」时，先怀疑光栅化，别急着改代码**

13. **不要用 `--wait` 抓动画帧**（2026-09-18）
   - 时钟基准是 `Page.loadEventFired`，而 React 挂载比它早，再加上 CDP 往返延迟，
     实测能差出**整整一拍**：想抓「封印完好」却抓到封印已经裂开（封印不透明度已经是 0）
   - 改用**按动画状态轮询**：`scripts/flows/welcome-frame.js` 读封印不透明度与翻盖的
     `matrix3d` 的 `m22`（= `cosθ`），等条件满足再让 `shot.mjs` 截图
   - `--wait` 只留给「等静态页面资源加载完」这种场景

14. **`.cmd` 必须是 GBK + CRLF，否则双击就是坏的，而且退出码还骗人**（2026-09-19）⚠️
   - 用工具（编辑器 / 本会话的写文件工具）默认写 UTF-8 + LF 时，cmd.exe 解析会错乱：
     报一堆 `'xxx' 不是内部或外部命令`，**而进程退出码仍是 0** —— 用「退出码 0」判断可用性是错的
   - 对照实验：同样内容 CRLF 正常、LF 报错。所以**必须实测，不能靠看**
   - 编码要用 **GBK（zh-CN 控制台的 OEM 代码页）**，并且**别再配 `chcp 65001`**：
     UTF-8 文件配 chcp 65001 会串码；纯 UTF-8 不配 chcp 则中文注释会被按 GBK 读坏语法结构
   - 工具链 `scripts/fix_cmd_encoding.py` 与其「打包前置门槛」**已于 2026-09-19 随 `.cmd` 一起删除**
     —— 工程里已不存在 `.cmd`/`.bat`。这条现在只作**历史教训**保留：将来若再加 `.cmd`，
     `.gitattributes` 里的 `*.cmd -text -diff` 与 `core.autocrlf=false` 仍会保住它的 CRLF
   - 顺带：本项目里 `start-user-preview.cmd`

15. **验证「双击能不能打开」必须用真的双击路径**（2026-09-19）⚠️
   - 中文文件名的 `.cmd` 从 Git Bash 直接调会被编码搞坏，测不出真结果；
     要用 Node 起 `cmd.exe`（`execFileSync('cmd.exe', ['/c', 路径])`），并用 `TextDecoder('gbk')` 解码输出
   - 桌面的 COM 自动化（`WScript.Shell`）被本机安全策略拦截 —— 建 `.lnk` 走不通。
     退路是写 `.url`（纯文本 INI），但 `.url` 指向 `file:///` 能不能拉起浏览器**必须先证**：
     让测试页发一个 `http://127.0.0.1:8123/ping` 的 `<img>` 请求，本机监听收到即证明可用
     （见 `assets/_debug/test-url-shortcut.mjs`）

16. **`file://` 下离线打开的两处拦路石**（2026-09-19，上一版结论「必须起 http」是错的）
   - ① 素材基址：`import.meta.env.BASE_URL` 默认 `/` → `/skins/...` 在 `file://` 下是**磁盘根目录**。
     解法：`vite build --base ./`，源码侧用 `src/config/skin.js` 的 `BASE` 常量跟随
   - ② 脚本类型：`<script type="module" crossorigin>` 在 `file://` 下必被 CORS 拦（`#root` 永远为空）。
     解法：产物 JS 零 `import`/`export`/`import.meta`/动态 `import()`，可安全改成 `<script defer>` +
     补 `'use strict';` 还原 ESM 严格模式语义
   - 唯一功能差异：`file://` 下 canvas 被污染，「生成分享卡片」`toBlob` 抛 `SecurityError`（弹窗已给准确提示）
   - **判据要写成决定性的**：压缩后素材路径变成变量拼接（`Fr="./", e=>[\`${Fr}skins/…\`]`），
     所以不能简单找 `"/skins/"`（永远找不到，白的自检）。正确做法是查**每个 `skins/` 前面那段里的基址字面量**
     是不是裸的 `"/"` —— 拿 `dist/`（应为 `"/"`）和 `dist-user/`（应为 `"./"`）双向验，能过才算判据有效

17. **⚠️ Framer Motion：只要任一属性带了自己的 per-property config，写在 `transition` 根上的 `delay` 就完全不生效**
   （2026-09-19，同一个机制**咬了两次**，是本项目最隐蔽的一个坑）
   - 症状一：`ReadingPanel` 外框在挂载后 15ms 就滑动（根 `delay` 被丢弃），子项却按 `delayChildren`
     晚 **1.6 秒**才出现 → **一个空壳滑上来干等 1.6 秒**
   - 症状二：`CardReveal` 按「绝对时刻」写进 `transition.delay` 后，翻转整体**晚了一拍**
   - 机理：`opacity: {...}` / `y: {...}` 这类 per-property config **全权接管该属性的计时**，根 `delay` 不参与；
     而 `delayChildren` / `staggerChildren` 是**另一套编排机制**，照常生效 → 两套计时各跑一半
   - **两条修法（二选一，绝不能都做）**：① `delay` 写进**每个属性自己**的 config；
     ② **整条链只留一处计时**（本项目选这条：挂载时刻由 `App` 的 `beats.panelAt` 决定，组件内 `delay: 0`）
   - **⚠️ 还有一层**：`CardReveal` 是在 `chargeDone` 才挂载的，而 Framer 的 `delay` 从**动画触发那一刻**算起 ——
     所以写进 delay 的必须是「绝对时刻 − 挂载时刻」：`at(ms) = Math.max(0, ms − T0) / 1000`
   - **判据**：跑 `probe-draw-timeline.js` / `audit-draw.js` 看 `contentVisible − panelMount`，
     正常应 ≤ 300ms；若是 1.5s 量级，就是又踩到了

18. **⚠️ 动了状态机（phase）就要回头检查所有「吃 state 的 effect」**（2026-09-19）
   - 症状：点击水晶球后整场仪式在 **1ms** 内被杀掉，控制台报 `TypeError: duration must be non-negative`
   - 根因：`handleDraw` 第一件事是 `save(card.id)` 落盘 → `setRecord` → 触发「今日已抽」的 effect →
     `setPhase('revealed')`，把刚设好的 `charging → drawing → revealed` **整条链冲掉**
   - 修法：该 effect 加 `RESTING_PHASES = new Set(['welcome','entrance','idle'])` 守卫，
     **只在静息相位**才自动呈现今天的牌
   - 教训：**「落盘 / 保存记录」这类副作用会和「状态机编排」抢同一份 state**。新增相位后必须把所有
     `useEffect(..., [someState])` 过一遍

19. **⚠️ 面板是「内容撑高」，而卡牌下缘以下只剩视口的 38.5%** —— 别只看 `overlapPx`，要看**净空**（2026-09-19）
   - `ANCHORS.stage.y`(38.5) + 卡高一半(23vh) = 卡牌底边固定在 **61.5%** → 面板最多只能用 **38.5%**
   - 面板高度随牌面文案长度变化，用 `--seed` 把文案最长的两张（**major-01 魔术师 / major-15 恶魔，各 98 字**）
     钉住实测：**桌面 38.1% → 净空仅 3.2px**（不是没撞，是侥幸）；**竖屏 41.3% → 超出 19.3px**
     （截图里能直接看到卡牌下框带的金饰被面板渐变顶边压暗）
   - **❌ 不要用「给面板限高 + 内部滚动」来修**：面板底部的「生成分享卡片」是主 CTA，
     一旦限高滚动它会被挤出可视区 —— 比压住 20px 渐变更糟
   - ✅ 正确做法：对**矮视口**（`@media (max-height: 780px)`）收紧面板纵向留白（`padding` + 4 处 `margin`，约 36px），
     让内容自然装下。改后净空 桌面 39.2px / 竖屏最坏牌 10.7px
     （危险区从约 710px 开始，阈值取 780 是给字体度量差异留余量；**大屏保持原有舒展间距**）
   - `audit-draw.js` 已增加 **`clearancePx`** 上报：`overlapPx == 0` 可能是「刚好压线」，
     净空才是「还剩多少余量」。**以后加长牌面文案，盯着净空看**

20. **量「长文案牌」的面板高度不用反复抽牌 —— 用 `--seed` 把它钉在已揭晓状态**（2026-09-19，很好用）
   ```bash
   "$N" scripts/shot.mjs "file:///.../dist-user/index.html" out.png --w 504 --h 784 \
     --seed "localStorage.setItem('tarot-daily::draw-record', JSON.stringify({date:'2026-09-19', cardId:'major-15'}))" \
     --eval-file assets/_debug/probe-panel.js
   ```
  记录格式就是 `{ date: 'YYYY-MM-DD', cardId: 'major-XX' }`（见 `hooks/useDrawState.js`），
  且 `WELCOME.skipWhenDrawn` 会让迎接动画自动跳过，量起来更快。
  （抽牌是随机的，靠反复跑 audit 撞不到你想测的那张牌）

21. **⚠️ 批量替换「同一个含义的多处判断」时，逐处确认形态一致**（2026-09-19）
   - 症状：开发者版里「牌面总览」按钮**点了完全没反应**，控制台零报错
   - 根因：把 `import.meta.env.DEV` 换成构建期开关 `DEV_TOOLS` 时，`replace_all` 的判据写成了
     `{import.meta.env.DEV && (`（**带了左括号**）→ 只命中 DevBar 那一处；
     另一处是 `{import.meta.env.DEV && galleryOpen && ...`（后面跟的是变量、不是括号），**没被替换**，
     在构建产物里恒为 `false` → `CardGallery` 永远不挂载
   - 为什么静态自检没抓到：产物里确实有「牌面总览」四个字（DevBar 的按钮文案在），
     「开发入口齐全」这条断言照样通过 —— **查字符串查不出「按钮在、点了没用」**
   - 教训：① 替换判据只取最短唯一子串，别顺手带上括号/空格这类与语义无关的字符；
     ② 换完必须 `grep` 全文复核残留；③ 这类问题只有**运行时真点一遍**才发现（见第 22 条）

22. **✅ 两个开关的产物要「配对断言」，单侧断言抓不到一半的错误**（2026-09-19）
   - ⚠️ **2026-09-19（第十八轮）后本条的适用场景已消失**：`VITE_DEV_TOOLS` 那支开关随离线通道移除，
     现在只有 `vite dev` / `vite build` 两种取值，**没有「另一份产物」可以配对**。
     留作方法论：将来若再出现「一份源码 + 两个开关产出两份产物」，仍然要一正一反配对断言
   - `dist-user` 断言「**不该**有调试条文案」，`dist-dev` 断言「**必须**有」—— 同一份源码、两个开关、一正一反。
     任一侧失效都会立刻红：define 写错导致两边都开 → 用户版红；两边都关 → 开发者版红。
     只查一侧的话，「两边都关」会**静默通过**（用户版本来就是「不该有」）
   - 再加一条**独立**旁证：体积交叉验证。正式 `dist/` 与 `dist-user/` 的 JS 尺寸必须**完全相等**
     （实测都是 292.67 kB），开发者版 294.66 kB（+1.99 kB）。
     尺寸相等说明 DevBar / CardGallery 真的被摇掉了 —— 这和上面两条字符串断言是两条互不依赖的证据链

23. **⚠️ 无头环境里首个动画的实际耗时远长于标称值，等待一律用轮询**（2026-09-19）
   - 迎接信封标称 2.62s，实测 `.welcome` 卸载发生在 **5.17s**
     （无头软件光栅化下，大 DOM 挂载 + 多层 CSS 动画的开销被放大）
   - 第一版 `dev-verify.js` 用固定 `sleep(3400)` 就断言「信封已退场」，直接假阴性；
     改成 `waitFor(() => !$('.welcome'), 9000)` 轮询后一次通过
   - 同理「等面板内容出现」「等牌面总览把 22 张插画探测完」全部改成轮询。
     **固定 sleep 在无头环境里只会写出时快时慢的假阴性**，不值得为省几行代码去赌

24. **⚠️ 可见性 ≠ 可点性：要用 `elementFromPoint` 打在元素中心才算「能点」**（2026-09-19）
   - 症状：调试条（横排贴底）**盖住了面板的「再抽一次」**（相交 2487 px²），
     而**所有功能断言照样全绿** —— `.click()` 是程序化调用，**绕过命中测试**，被盖住的按钮照样能触发
   - 正确判据：`document.elementFromPoint(r.x + r.width/2, r.y + r.height/2)` 返回的是不是它自己（或其后代）
   - **⚠️ 量之前必须 `settle()` 等位移动画停稳**：面板「贴底 + 上滑」，文字先到、位移后到；
     文字一出现就量会拿到 `null`（点在视口外），**是假阴性不是真遮挡**
     （实测量到 y782 而 `innerHeight` 只有 708；静止后是 y650..688，命中正常）。
     这和「固定 sleep 等动画」是同一类错误，**同一类机制本项目咬了两次**
   - **⚠️ 判据要能区分「目标自己就住在遮挡物里」**：调试条自己的按钮命中调试条是正常的，
     写成「命中元素在调试条内就报警」会把它们全部误报。必须加「目标本身不在调试条内」这个前提
   - 现成工具：`assets/_debug/probe-fit.js`（量盒子 / 命中 / 相交面积），`scripts/flows/dev-verify.js` 第 ④.5 段

25. **⚠️ 无头 Chrome 的 `--h 804` ≠ `innerHeight 804`**（2026-09-19）
   - 实测 `--h 804` → `innerHeight 708`；`--w 1582` → `innerWidth 1564`（窗口 chrome 吃掉约 96px 高、18px 宽）
   - **任何「有没有出屏幕」的判断，必须先把 `innerWidth/innerHeight` 打出来再比**，
     否则会把「元素本来就在视口外」误判成「被别的元素挡住了」—— 两者结论完全相反

26. **⚠️ 拿临时 grep 复核脚本自检时，扫描范围要跟自检一致**（2026-09-19）
   - `build_user_preview.mjs` 的反向断言**只扫 JS** 文件，判据是四个字面量
     （`重播迎接 / 抽牌模式 / 牌面总览 / 重置今日`），实测 0 命中 —— 这是「调试条被摇掉」的正确判据
   - 但用 `grep -r` 扫**整个 `dist-user/`** 会多出两类命中：`README.txt`（它**故意**写着「没有调试条…」）
     和样式表（`.devbar` 有 5 条规则、**449 字节 / 40.66 kB** 的**死 CSS**，用户版没有任何元素带这个类）
   - 死 CSS 不修是权衡结果：清掉需要给构建流程加一段 CSS 重写，为 0.4 kB 增加一个失败点不划算。
     **别把它当漏做**，也别因为 grep 有命中就以为自检失效 —— 是扫描范围不匹配

27. **⚠️ 备份「生成了」≠「可用」：必须换个路径解出来真跑一遍**（2026-09-19 冻结 v1 快照时）
   - 本工程**没有版本控制**，做破坏性改造前用 `scripts/freeze_snapshot.py` 封快照。但生成 zip 只证明**写盘成功**，
     不证明**还原可用** —— 离线副本能双击打开完全依赖相对路径自包含，一旦漏打包 `skins/`，
     zip 照样生成成功、哈希照样对得上，解出来却是一片裂图
   - 正确验收：从 zip 里只解 `dist-user/` 到**一个全新路径**，无头跑完整流程。实测记录：
     31 文件 / 6.02 MB，`index.html` 与源目录**逐字节一致**；迎接 1360 ms 退场 → 点球 → 1119 ms 出牌；
     图片数 **2 → 2 → 5**（`hero-bg` 1536 · `hero-orb` 768 · `card-back` 620 · `major-17` 768 · `frame` 768）；
     **三个阶段裂图均为 0**，且无 `file:///skins` 式「磁盘根目录」路径
   - **⚠️ 反面教训（比正面更值钱）**：第一版探针跑在**信封还在场**时，DOM 里只有 2 张预载图，
     于是「0 裂图」是**假阳性** —— 真正会因路径失效而裂的是**牌面与主视觉**，它们在抽牌后才出现。
     **量「资源有没有加载」必须等到资源真的该出现的那一刻**，不能在冷启动瞬间量
   - 顺手记住：归档目录 `_archive/` 必须加进 `package_project.py` 的 `EXCLUDE_DIRS`，
     否则交付包凭空胖 116 MB 且毫无用处

28. **⚠️ 「不引入新依赖」只剩一个例外：v2 的 3D 水晶球用 Three.js**（2026-09-19 决策）
   - 原禁令写在**三份指令性文档**里（共五个位置）：`DRAW_RITUAL_BRIEF.md` 的「约束表第 1 行」与「不可接受」清单、
     `MOTION_AUDIT.md` 的文档头「约束」行与「明确不做」一节、`动效与质感-skills指令清单.md` 的 `motion-web` 提示词末尾
     （**按位置找，别按行号** —— 这几份还在持续编辑，行号会漂）。
     **这五处已于 2026-09-19 就地加注「唯一例外」**，原判据与动机保留 —— 不要把它们改回无条件禁令，
     也不要拿它们当「不能上 Three.js」的依据
   - **解禁的代价（用户已明确认领）**：gzip 体积 106.7 kB → 约 234.8 kB（three 全量 +128.1 kB，实测）；
     项目出现**第一个新运行时依赖**；`file://` 双击通道**作废**（本地图片在 file:// 下不能当 WebGL 纹理，
     `texImage2D` 抛 `SecurityError`）→ 产物只走 http，详见第 29 条
   - **例外只覆盖那一颗球**：GSAP 仍不引入；其余处仍只用 Framer Motion + CSS。
     审批新依赖时先问「是不是在说那颗球」，不是的话按原禁令拒绝
   - 判据：`package.json` 的 `dependencies` 里出现 `three` 且**只有** `three` 这一项新增，才算守规矩

29. **⚠️ v2 起产物只走 http，`file://` 双击通道作废**（2026-09-19 决策）
   - **事实基础**：`file://` 下 WebGL 能跑（WebGL2 上下文、抗锯齿、float 渲染目标全可用），但
     **本地图片不能当纹理** —— `texImage2D` 抛 `SecurityError: The image element contains cross-origin data`；
     `fetch` / XHR 读本地文件同样被拦。所以「真 3D 球映出女巫」这件事在 `file://` 下做不到
     （除非把纹理内联成 data URI —— data URI 可以当纹理，这是唯一可行但很别扭的退路）
   - **用户决策**：接受以**上线效果优先**，放弃本地双击通道
   - **处置（2026-09-19 第十八轮已执行）**：`dist-user/` · `dist-dev/` ·
     `scripts/lib/offline.mjs` · `build_user_preview.mjs` · `build_dev_preview.mjs` ·
     `serve_user_preview.mjs` · `fix_cmd_encoding.py` · `打开网站.cmd` · `start-user-preview.cmd` ·
     `启动开发者版.cmd` · `flows/offline-open.js` · `flows/offline-share.js` —— **全部删除**。
     `dist-user/` 与 `dist-dev/` 移到 `_archive/_removed-2026-09-19/`（本机删目录不可信，见第 30 条）。
     **连带改掉**：`package.json` 去掉 `user:build`/`user:serve`；`vite.config.js` 去掉 `VITE_DEV_TOOLS` 分支；
     `ShareDialog.jsx` 去掉 `file://` 报错分支及那句指向 `.cmd` 的提示；`package_project.py` 去掉离线副本与
     `.cmd` 编码前置自检；`freeze_snapshot.py` 去掉对 `dist-user` 的**硬断言**（不删它下次冻结会报假警报）；
     `scripts/flows/dev-verify.js` 的运行目标从 `dist-dev` 改为开发服务器。
     `--base` 参数**保留** —— 绝对路径 `/skins/…` 在「站点子目录」下会挂，`BASE` 常量继续跟随 `base`
   - 好消息：v1 冻结快照 `_archive/v1-2026-09-19/` 里整套都在，任何一项都能取回

30. **⚠️ 本机 `git rm` 会触发目录级误删**（2026-09-19 实测，代价极大）
   - **现象**：`git rm` 只指定了 10 个文件，执行后**整个 `scripts/` 目录的 29 个文件全部从磁盘消失**，
     其中 19 个是我没有指定的（`git status` 里显示为未暂存的 ` D`，即"工作区被删但索引还在"）
   - **能救回来，完全是因为几分钟前刚 `git init` 并提交了 v1 基线**：
     `git restore --worktree scripts/` 一行把 19 个文件全部取回（已逐个核对）
   - **结论**：① **破坏性操作前必须先有提交** —— 这不是洁癖，这是本次唯一的救命绳；
     ② 删文件别用 `git rm`；③ 任何删除之后**立刻用文件数核对**，别信退出码（它是 0）；
     ④ 本机删目录本身也不可信（`rm` 被安全删除拦截，`shutil.rmtree` 同样），
     要"移除"大目录就用 `shutil.move` 挪到 `_archive/_removed-<date>/`
   - 同一坑的近亲：`rm` 被拦时可能**不报错就结束**，所以"命令成功"≠"东西删了"

31. **⚠️ 别把校验命令塞进多层转义里**（2026-09-19）
   - 快照清单里原本贴了一条 `node -e "…split('\n')…"` 的一行命令。它要穿过
     「双引号 bash 串 → JSON → Python 模板 → `.format()` → markdown」**五层转义** ——
     实测渲染出来的反斜杠数量就偏了：命令**长得完全正确**，但切不出行，
     静默报"核对 0 个文件，不一致 0"，是一个**永远绿灯的假检查**
   - 解法：写成真脚本 `scripts/verify_manifest.mjs`（可传目标目录），零转义层，
     并且自己保证"一条记录都没核对到"时**报错而不是报通过**
   - 配套教训：**校验脚本必须做反向测试** —— 造一个"正常 / 内容被改 / 文件缺失"的三合一
     样本喂给它。这个反向测试当场抓出了脚本自己的一个真 bug：
     Windows 上清单行尾的 `\r` 会被拼进路径，导致**连正常的文件也被报成缺失**

32. **⚠️ 构图规格必须拿「可见窗口」核对，不能只看画布坐标**（2026-09-19，代价 = 1 张出图）
   - **现象**：v2 主视觉按规格把「手」画在画布 y 61%–88%（依据是球的下缘与卡牌底线），
     单看画布没有错；但宽扁屏的可见窗口下缘**只到 y≈75.7%**（1564×708 实测 y[10.4%, 75.7%]）
     → 桌面上**手完全在可见窗口之外**。手机（可见窗口 y 到 97.3%）里手却完整可见。
   - **判据**：`.hero-frame` 的 `width = max(104vw, 104vh×1.5)` 决定可见窗口是**尺度无关**的，
     只要两种极端：宽扁屏裁上下（最窄 y[10%, 76%]）、窄高屏裁左右（最窄 x[35%, 65%]）。
     所以「必须被看见的东西」要落进 **x ∈ [35%, 65%] × y ∈ [12%, 72%]** 这个中央安全盒。
     **下面那条线是 y≈76%，不是 100%。**
   - 现成工具：`assets/_debug/preview_hero_v2.py` 直接打印每种视口的可见窗口百分比，
     并复用 `scripts/preview_hero.py` 的 CSS 数学合成 —— 别自己另算一份。
   - 同源陷阱：**想验证「某物是否可见」时不要只截一张图肉眼看**。这张图暗场占比极高，
     手在暗部里肉眼看不出来，必须「裁剪 + 自动对比拉伸」才能判定它到底在不在可见区
     （`crop_hero_v2.py` + `ImageOps.autocontrast`）。

33. **⚠️ 本机沙箱会静默丢弃 git 的远端跟踪引用；TLS 报错是偶发的**（2026-09-19）
   - `gh repo create --private --source=. --push` **成功**（`gh api` 独立核实：远端 `main` = 本地 HEAD，
     111 个 blob，仓为 private），但本地 `git branch -vv` 一直显示 `[origin/main: gone]`。
   - 根因：`git fetch origin` 会打印 `* [new branch] main -> origin/main`，
     但 `git show-ref` 里 **`refs/remotes` 一条都没有** —— 引用写入被沙箱丢掉了。
     这不影响推送，只是本地看不到 ahead/behind。**要读远端状态就用 `git ls-remote`（可用）或 `gh api`。**
   - 另一条：`git ls-remote` 曾报 `未能为 SSL/TLS 安全通道建立信任关系 / 远程证书无效`
     （本机 `http.sslBackend = schannel`）。**这是偶发，重试即通**，不要据此改 SSL 配置。
   - 结论：**验证推送有没有成功，要用 `gh api repos/<owner>/<repo>/commits/main`，
     不能看 `git branch -vv`，也不能只看推送命令的退出码。**

---

## 7 · 成本红线

图片生成每张 5–10 积分。**已完成约 30 张**（22 张牌面 + 卡框 + 主视觉 v1 + 主视觉 v2 无球版 + 水晶球 + 牌背 + 历史测试图若干）。
**剩余美术需求约 1–2 张**（手机竖构图，可选），预计 **5–20 积分**。批量出图前必须先跟用户确认。

---

## 8 · 沟通与偏好备忘

- 用户是**数字媒体技术**专业出身，能看懂视觉/技术细节，可以直接讲原理，不必过度简化
- 用户明确要求过：**配色不锁死**，每张牌按牌性选色，一致性靠「技法 + 卡框」——不要为了统一而牺牲牌性
- 用户很在意**换风格的成本**，所以架构上要始终守住「素材槽位化 + 缺图优雅降级」这两条
- 用户偏好**先跑通流程再打磨美术**，不要在没有可运行东西的情况下长时间讨论方案
- 出图前**必须先确认积分消耗**，这是用户定过的红线
