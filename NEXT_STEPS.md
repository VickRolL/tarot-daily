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
| **水晶球 3D 化** | ✅ 完成 | 第二十轮换成**真 3D（three.js）**——项目唯一已批准的依赖例外。基础贴图构建期烤好（运行时 1 次采样），`transmission` 折射背景这条路走不通（three 采的是场景环境，不是 canvas 背后的 DOM），改为「内部星云 + 冷蓝菲涅尔边 + 镜面高光」。指针视差实测高光质心位移 +42.5px；无 WebGL 自动降级回 2D 球。首屏只多 ~8.3 KB gzip（three 是独立懒加载 chunk）。见 `PROJECT_STATE.md` 第二十轮 |
| **手部前景层** | ✅ 完成 | 手从背景抠成独立层（31 KB）压在球前，否则「手托着球」变成「球压在手尖上」。遮挡实测 **10.1% < 15%** 上限；与底板同相位呼吸避免重影 |
| **女巫的脸（二次）** | ✅ 完成 | 用户要求「连鼻子和嘴巴都不要看见」。实测脸框**比周围更暗**（L 0.0462 vs 0.0695），问题是局部对比不是亮度 → 用**引导插值暗场**压掉五官（核心 p99−p50 0.0529 → 0.0078，局部对比能量 −74%），页面级 3× 放大 + 极端对比拉伸确认不可读 |
| 牌背 | ✅ 完成 | `card-back.webp`，与卡框同一套语言 |
| 上线前功能 | ✅ 完成 | 分享卡片图 / og meta / 首屏预热 / `DRAW_MODE=daily` |
| 迎接动画 | ✅ 完成 | **信封开启**（纯代码，风格与站点一致）。第十轮按用户反馈重做成**全屏斜置特写**（原版是画面正中一只小信封，被否）；可跳过、可整体关闭、「今日已抽」自动不播 |
| 整页手感升级 | ✅ 完成 | 入场/抽牌/翻牌/面板上滑四处动效按审计方案改造完成。零新增依赖、零积分；构建通过；桌面/移动/减少动效三态验证通过 |
| 抽牌仪式分拍 | ✅ 完成 | **「点击球 → 揭晓」重排成八拍**（蓄势 → 爆闪 → 升起 → **悬停★** → 预压 → 翻牌 → **留白★** → 面板），总 5.7s。根治了「答案早于牌到位 483ms」「空面板挂 1.6 秒」两个真 bug，并顺手修掉「面板侥幸不重叠（桌面只剩 3.2px 净空 / 竖屏超 19.3px）」。零新增依赖、零积分。详见 `MOTION_AUDIT.md` 第 7 节 |
| **牌意加深** | ✅ 完成 | 第二十一轮：22 张各补 `element` / `astrology` / `symbol` / `favor[2]` / `avoid[2]`。`symbol` 写「这个象征在说什么」而**不描述画面**（否则读者会拿文字核对插画）。正逆位按用户裁定**不做** |
| **牌之图鉴** | ✅ 完成 | 第二十一轮：从「开发者专用总览」改成**用户可开的覆盖层**（顶栏「牌之图鉴」入口、22 格键盘可达）。**简单版**：不可搜索 / 不分类，只是「这副牌长什么样」的一览 |
| **完整解读层** | ✅ 完成 | 第二十一轮新增 `CardDetail.jsx`。**关键判断：加深内容不进面板** —— 面板可用高度只有视口高 38.5%，净空实测桌面 39.2px / 竖屏最坏 10.7px，塞不进几百字；改成「限高+滚动」又会让主 CTA 滑出可视区。所以面板负责**快读**、覆盖层负责**完整**。图鉴与它**叠加**而非互斥 → 不需要返回按钮 |
| **两侧漂浮低语** | ✅ 完成 | 第二十一轮：主页左右各 5 条隐喻/低语轮切，`charging` 拍换成仪式短句。**两层拆 transform**（外层视差 / 内层漂浮）；相位按「同侧条目摊满一个周期」算（首版按全局序号累加 → 右侧空 9 秒、且齐亮齐灭）。`pointer-events:none` + `z-index:5`（> 手层 3）；`≤900px` 整层隐藏；reduced 退化成静态子集 |
| **字号放大** | ✅ 完成 | 第二十二轮：用户反馈「标题与副标题太小、低语也小」。根因是**上限锁死**（`clamp(24px,3vw,36px)` 的 3vw 在 1200px 宽以上就超 36 → 桌面端永远 36px）。标题改 `clamp(26px, min(3.6vw, calc(12.4vh - 42.4px)), 54px)`，**vh 项是从几何契约反推的**（不是拍的），矮视口才不会被顶出屏幕上边缘。副标题 13→18px、低语 11–14→13–18px（锚点 x 从 12/14 收到 10/11.5 让出宽度）。顺带修掉窄屏标题与「牌之图鉴」二维相交的真 bug（窄屏藏掉顶栏日期腾空档） |
| **音效** | ✅ 完成 | 第二十二轮建（现场合成）→ 第二十三轮全部重做 → **第二十五轮换成 AI 素材**（`src/audio/sfx.js` + `SoundToggle.jsx`）：四个音走 `assets/audio/sfx/*.mp3`（**素材优先、合成兜底**，52 KB），时刻取自 `drawBeats` 那张节拍表。**默认关**，ctx 只在用户手势里建。开关在左上角（品牌下方）—— 不进顶栏（那是窄屏标题字号的预算）、不放右下角（会被解读面板盖住） |
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
- **✅ 中文衬线字体（第二十三轮做「标题」这一块；牌名/低语/正文仍留系统栈）**：
  第二十一轮把它列为「美感上最大的一处欠账」，第二十三轮用户直接点到了它
  （「标题的文字不够有特色，可以参考**罗马艺术字**」）—— 标题是唯一被放到 40–54px 的元素，
  系统那档宋体在这个尺寸下横画发虚，所以先只换它。

  **做法（比原计划省事得多，建议沿用）：不要 `fonttools pyftsubset`。**
  Google Fonts 的 CSS2 API 有一个 `text=` 参数，直接返回**只含指定字符**的 woff2：
  ```
  https://fonts.googleapis.com/css2?family=Cinzel:wght@400..900&text=<URL编码的字符集>&display=swap
  ```
  ⚠️ 必须带一个现代 Chrome UA，否则返回的是 TTF 而不是 woff2。

  **不要手搓这段 fetch —— 跑 `node scripts/fetch-title-fonts.mjs`。**
  第二十三轮我手搓的一次性 fetch 把没做百分号编码的 `·` 直接塞进 URL → Google 回 **HTTP 400 错误页** →
  我把它当字体存成了 `title-latin.woff2`（1.7 KB，内容是 HTML）。**坏字体是静默的**：浏览器逐字符回退，
  不报错、CSS 看不出来、截图也未必看得出来 ——「标题用了罗马碑刻体」这个结论就一直挂着，
  直到第二十四轮在构建产物里发现一段 CSS 内联 data URI 解出来是 `<html ... Error 400` 才露馅。
  脚本把校验写进流程，而不是靠人记得：① `text=` 一律 `encodeURIComponent`（URL 里绝不出现裸非 ASCII）
  ② 落盘**前**先验 `wOF2` 魔数 ③ 验不过就抛错退出、**绝不写坏文件进 `src/`**。
  追加字体只改 `SPECS` 数组，幂等可重跑。

  **验收只认 `node scripts/probe-fonts.mjs <url>`（问浏览器「这个字是谁画的」），不要肉眼看。**
  三条判据：**A** `document.fonts` 里三张脸的 status 都是 `loaded`（坏文件会停在 `error`）；
  **B** 逐字形 —— 把三个 woff2 各自挂成独立族名，用 CDP `CSS.getPlatformFontsForNode` 确认
  每个字都由 web 字体（`isCustomFont`）绘制；**C** 页面真实节点（`.headline__title` /
  `.headline__sub` / `.topbar__brand`）也确实用上了。
  dev 与**生产构建**两种形态都要跑 —— 生产里两个小字体是 CSS 内联的 data URI，是浏览器里另一条代码路径。
  ⚠️ 判据只能用 `isCustomFont`，**不能拿族名比对**：`getPlatformFontsForNode` 报的是
  **字体文件 name 表里的族名**，我把它挂成 `PROBE LATIN` 它照样报 `Cinzel`；而且自定义宋体与
  系统 Noto Serif SC 报出来的族名**一模一样**。

  实测产物（第二十四轮修正后）：

  | 文件 | 字重 | 内容 | 体积 |
  |---|---|---|---|
  | `title-latin.woff2` | 400..900（可变） | `TAROT·` | 1.82 KB |
  | `title-han.woff2` | 900 | `今夜一签` | 1.63 KB |
  | `title-han-400.woff2` | 400 | `日签` + 全部副标题文案 | 6.57 KB |

  合计 **10.0 KB**，零外部请求、零运行时依赖（生产构建里前两个被 vite 内联成 data URI，
  反而顺手解决了 `file://` 下的相对路径问题）。授权：Cinzel 与 Noto Serif SC 均为 **SIL OFL 1.1**。

  ⚠️ **汉字字重只有 400 / 900 两档，所以任何用 `var(--font-title)` 的地方字重只能取这两个值。**
  我一度把顶栏品牌设成 `font-weight: 600`，结果 600 被就近匹配到 **900 脸**，而 900 子集里有「签」没有「日」
  →「日」继续往后回退、落到**系统装的** Noto Serif SC 上 —— 同一个词被两种字体画。
  400 是安全的：Latin 与 Han 都精确命中各自的 400 档（实测品牌右缘 140.7px，与改前逐位一致，
  说明 Cinzel 400/600 的字符宽度相同，窄屏标题的横向余量不受影响）。

  ⚠️ 改了标题带文案（主标题 / 三套副标题 / 品牌名）就要**同步改两处**：
  `fetch-title-fonts.mjs` 的 `SPECS` 与 `probe-fonts.mjs` 的 `EXPECTED` —— 两边配套，漏一边就查不出来。

  想扩到全站（牌名 44 字 + 低语 200 余字 + 各种 UI 文案，去重约 400–600 字）用同一手法即可，
  预计 woff2 100–250 KB。⚠️ 别整包放全套字库（思源宋体全集 15 MB+，首屏直接崩）。
  ⚠️ 扩的时候必须**覆盖全**：漏字会回退到系统宋体，同一行里出现两种宋体，比不换还难看。
- **✅ 已做（第二十五轮）· 音效四个音换成 AI 素材**：`src/audio/sfx.js` 现在是
  **素材优先、合成兜底**（与 `ambient.js` 同一套双路结构）。素材由 `scripts/build-sfx.py`
  从 `audio-src/sfx/_raw/` 修剪+配平产出，四个音彼此响度差 **1.2dB**。
  ⚠️ 改动任何音频代码前先读 `sfx.js` 头部那几条规矩，并跑 `probe-sfx` + `probe-sfx-off`；
  换素材后还要跑 `python scripts/build-sfx.py --force`（它自带 ALL_PASS 自检）。
  **后续可扩的方向**（都还没做）：
  · 图鉴翻页 / 详情打开的轻音（现在只有抽牌这条线有声音）；
  · 音量滑杆（现在是固定 `MASTER_GAIN = 0.34`）；
  · 环境底噪 —— 已经在第二十三轮做成「幽暗寂静」环境音了（`ambient.js`）；
  · `audio-src/audition.html` 是四音试听台（含按仪式节拍连播），换素材时用它验收耳朵。
- **⬜ 正逆位（用户 2026-09-20 明确「先不用考虑」）**：**不要**为了「以后好加」而在 `cards.js` 里
  预留 `reversed` 之类的半成品字段 —— 后接手的人会误以为已经支持。真要做时是一次完整改造：
  文案 ×2、`CardFace` 的 180° 展示、抽牌随机源、分享卡片、图鉴与详情层的展示口径都要动。

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
| `--mobile` | **真正的手机视口**（走 CDP `Emulation.setDeviceMetricsOverride`）。只给 `--w 420` 会被 Chrome 的最小窗口宽顶到 504，打不到移动断点，见第 36 条 |
| `--dpr <n>` | `--mobile` 时的 `deviceScaleFactor`（默认 2） |

它用 CDP 直接驱动**本机已装的 Chrome/Edge**，不需要装 `agent-browser` / `playwright`
（那要下约 500 MB 的 Chromium）。**改完视觉相关代码，跑一遍这些 flow 是最省事的验证方式。**

#### 批量运行器（一次跑多组视口 / 多组状态）

散着敲命令容易出错，且本机 bash 是**降级 shell**：`\` 换行 + `&&` 串联的长命令会被拆坏，
而且**退出码照样是 0** —— 你会以为跑过了，其实什么都没跑（所以绝不能用退出码判断成败）。
这几个运行器内部一律走 Node `spawnSync` + 参数数组，**不经过 shell**，这类问题一次消失：

| 脚本 | 干什么 |
|---|---|
| `scripts/run-flows.mjs <flow…>` | 通用批量跑（`audit-title audit-draw audit-motion reveal share`） |
| `scripts/verify-orb3d.mjs` | 3D 球三层核验 × 5 组视口/状态（norm / 真机 mobile / reduced ×2 / wide） |
| `scripts/verify-halo.mjs` | 充能光晕消融实验（全量 / 隐 `.orb__charge` / 隐 `.orb__glow`），配 `scripts/_check_halo.py` 做径向亮度归属 |
| `scripts/fetch-title-fonts.mjs` | **重新生成标题字体子集**（Google Fonts `text=` 端点 + `wOF2` 魔数校验）。改标题文案后跑它，见 §2 的字体那条 |
| `scripts/probe-fonts.mjs <url>` | **字体探针**：验「每个字到底是谁画的」。自带 CDP 驱动、不经过 `--eval-file`（页面内拿不到 `CSS.getPlatformFontsForNode`）。三条判据 A/B/C 全过才 exit 0 |
| `scripts/build-ambient.py <音频…>` | **BGM 素材处理**：AI 长氛围曲 → 无缝循环 mp3。等功率交叉淡化消接缝（不是「听不出来」，是**环上根本没有接缝**）+ 单声道 ABR 编码。`--probe` 只看指标不产出，末尾打印 `ALL_PASS`（判据是「接缝处跳变 ≤ 全曲 99.9 百分位 ×1.25」） |

**探针清单**（都在 `scripts/flows/`，用 `run-flows.mjs` 调）：

| flow | 验什么 | 为什么必须真跑 |
|---|---|---|
| `probe-whispers` | 数量 10 / `pointer-events:none` / `z-index > 3` / 几何带 / 零相交 / 轮切节奏 / 窄屏整层隐藏 / reduced 全亮不动 | 低语是**绝对定位 + 百分比锚点**，会不会压到标题取决于「文本实际宽度 × 锚点位置」，**肉眼看不出「还差多少 px」**；而越界的表现只是「文字和标题叠在一起」，截图里容易被当成设计如此 |
| `probe-gallery` | 入口**命中测试**（不是能点，是点得到）/ 22 格 / 插画真加载 / 详情叠加在图上 / Esc 回图鉴 / 关闭回场景 / 横向不溢出 | 「产物里有这个按钮」和「按钮点了有用」是两件事 —— 第十一轮就吃过一次「按钮在、点了没用、且零报错」（第 21–23 条） |
| `probe-panel-worst` | **逐张遍历 22 张牌**，量每张的面板净空与重叠，报最坏 3 张。⚠️ **只能在开发模式跑**（依赖页内调试条） | `audit-draw` 只抽**随机一张**，抽不到文案最长的那张 → 拿不到最坏情况。这里靠写 `localStorage` 记录 + 切开发模式把 22 张**确定性地**过一遍 |
| `probe-sfx` | 音效的**结构事实**：开关初始态与持久化、`AudioContext` 是否真被建出来且 `state === 'running'`、四类音频节点是否真连上、开关在面板弹出后是否仍可点。第二十五轮又加了**端到端三条**：四个素材都下到且 200 / 走的素材路不是兜底 / **出厂那一份的响度极差 ≤3dB、解码峰值 ≤0dBFS、时长对合同**（见 §15.5） | **无头环境听不到声音**，但「没声音」的根因几乎总是结构问题：ctx 在非手势栈里被建成 `suspended`（**不报错、只是哑**）。做法是把 `window.AudioContext` 包成计数类，再给 `createOscillator/createBufferSource/...` 打钩子。⚠️ 加了素材路之后还要能分辨「**路走对了**」与「**路上运的货是对的**」——后者只有量解码后的样本才答得了 |
| `probe-sfx-off` | **反向**：从没点过开关的用户，抽完整张牌也不该被建出 `AudioContext` | 只验「开了会响」的话，`unlock()` 写成无条件的照样通过（第一版就是）。**判据要双向验**（第 19 条） |
| `probe-ambient` | **10 条判据**（§13 之前是 4 条，第二十四轮扩到 10）：① mp3 真的 `fetch` 到且 200 ② **走的是素材路不是偷偷退回合成**（`osc` 增量 = 0 且 buffer 时长 > 10s）③ **MP3 的编码器延时/尾零被排除在循环之外**（循环区外峰值 < 1e-3、区内 > 0.01、循环长 59.5–60.5s）④ 1.2s 内零自停 ⑤ 抽牌时 0.18→0.063 ⑥ 之后回到 0.18 ⑦ 关开关后活着的源全被 stop ⑧ 零报错 | ⚠️ **「素材没加载成功 → 悄悄退回合成」是本轮新增的一类静默故障**：页面照样有声音、控制台照样干净、截图照样看不出，只有细听才知道放的不是那首。所以第 ②③ 条必须用**结构**判（`createOscillator` 增量 + `loopStart/loopEnd` + 直接读 `getChannelData` 看循环区内外峰值），不能用「有没有声音」判 |
| `probe-devbar-sfx` | **调试条音效区的 11 条**（§16）：控件齐全 / 素材预载到位 / 点一个音走 **asset** / 切「合成」走 **synth** / A/B 高亮与真实模式一致 / 连播四拍全 asset / 左上角开关同步成开 / 调试条自己可点、不吃水晶球、不吃「再抽一次」/ 不超出视口 / 零报错。⚠️ **只在 dev 上有意义**，在 prod 上跑**预期失败**（`.devbar` 不存在）—— 那正是「判据是活的」的证据 | 这个调试区唯一的价值是「听到真实的那一份」，而它最容易坏的方式**是静默的**：素材没解码完就播 → 落回合成路 → 页面上照样有声音、控制台照样干净，「你以为在检查 AI 素材，其实在听合成音」。人耳分不出，只能判「点了这个按钮，那个音**实际**走了哪条路」 |
| `audit-title` | 副标题↔牌面净空 ≥30px / 标题带不被顶出屏幕上缘 / 标题与副标题的**墨迹**与顶栏各段文字**零二维相交** / 碑铭线落在副标题下方与牌面之间 | 「标题靠上、和副标题重叠」这类问题里，**挪卡牌本身是无效的**（标题带是从卡牌顶边往上锚定的，两者一起平移，间距恒等于 `TITLE_GAP`），必须量到这个间距才不会改错方向（§12.3） |

```bash
"$N" scripts/verify-orb3d.mjs      # 末尾打印 ALL_PASS true/false
"$N" scripts/run-flows.mjs audit-draw reveal share
"$N" scripts/run-flows.mjs probe-whispers probe-gallery --w 1582 --h 804
"$N" scripts/run-flows.mjs probe-whispers --w 504 --h 784    # 窄屏：低语整层应 display:none
"$N" scripts/run-flows.mjs probe-panel-worst --reduced       # 最坏净空（门槛 8px）；⚠️ 走 dev 端口
"$N" scripts/run-flows.mjs probe-sfx probe-sfx-off           # 音效：开了会响 / 没开不建 ctx
"$N" scripts/run-flows.mjs probe-ambient                      # BGM：下到了 / 走的素材路 / 循环干净 / duck / 停得掉
"$N" scripts/run-flows.mjs audit-title --w 1100 --h 700      # 窄屏：标题不得撞上顶栏、不得被顶出上缘

# BGM 素材：换素材 / 调循环长度 / 调音量时（--probe 只看指标不产出）
"$N" scripts/build-ambient.py scripts/out/mglc/ambient-01_1.mp3 --probe
"$N" scripts/build-ambient.py 输入.mp3 -o src/assets/audio/ambient-loop.mp3 \
      --loop 60 --xfade 3.5 --kbps 48

# 字体：改了标题带文案 → 先重抓子集，再问浏览器「谁画的」（A/B/C 三条判据，exit 0 才算过）
"$N" scripts/fetch-title-fonts.mjs
"$N" scripts/probe-fonts.mjs http://127.0.0.1:5173/          # dev
"$N" scripts/probe-fonts.mjs http://127.0.0.1:4199/          # 生产构建（字体是内联 data URI，另一条路径）

# 生产构建要另起一个服务才跑得动 flow（4188/5173 都是 dev）
"$N" node_modules/vite/bin/vite.js build
"$N" node_modules/vite/bin/vite.js preview --port 4199 --strictPort
APP_URL=http://127.0.0.1:4199/ "$N" scripts/run-flows.mjs audit-draw audit-motion
```

> ⚠️ 运行器只保证「**返回了结果**」，**不等于「断言全过」** —— 每个 flow 的 return JSON 里都带一个
> `PASS` 子对象和 `ALL_PASS`，**必须看那个字段**。运行器末尾也会提醒这件事。

**排查「蓝紫色气泡」这类疑难视觉时，用消融（一抹一层再量差值）而不是形状推断** ——
径向平均值分不清「环」和「盘」，见第 37 条。

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

34. **🐛 React.StrictMode 下 WebGL context 会被自己人杀掉 → 3D 静默退回 2D**（2026-09-19，代价 = 半天）
   - **现象**：3D 球明明渲染出来了，`onReady` 却从不触发，`.orb--has3d` 类没挂上，2D 球的内层动画也没关。
     DOM 在、CSS 在、球「看起来也能用」——**所有肉眼可见的迹象都是正常的**。
   - **根因**：原实现让 React 渲染 `<canvas ref>`，three 往那个 ref 上建 context。
     而 `<React.StrictMode>`（`main.jsx`）在开发期会「挂载 → 立刻卸载 → 再挂载」，
     **React 会复用同一个 DOM 节点** → 第一个实例卸载时 `forceContextLoss()` 掉的，
     正是第二个实例刚要用的那个 context → 第二个实例建不出 context → 失败 → 降级。
   - **解法**：**让 three 自己建 canvas**（`renderer.domElement` + `host.appendChild`），
     完全不要 React 渲染 canvas；清理时再把这张 canvas 从宿主里摘掉。
     每次挂载都用新 canvas，这类竞态直接消失。
   - **判据**（别再靠「球看起来对不对」）：
     ① 只查 DOM 不够 —— 必须问那张 canvas 上的 GL 是否**活着**：`gl.isContextLost()` 必须为 `false`；
     ② `.orb__canvas` 只能有 **1 张**，多于 1 张说明卸载时没摘干净。
     两条都写进了 `scripts/flows/probe-orb3d.js`。

35. **⚠️ GLSL 注释里不许出现反引号（这个坑踩了两次）**（2026-09-19，代价 = 两次白跑截图）
   - 着色器是写在 JS **模板字符串**里的。注释里一个反引号会**当场把模板字符串截断** →
     剩下的 GLSL 变成 JS 语法 → Vite 转换直接 500 → **整个 hero 白屏**。
     同理 `${` 会被当插值表达式。
   - **为什么特别坑**：错误信息的落点是「Missing semicolon」，指着一个 GLSL 变量名，
     完全看不出是注释里的标点问题；而且**只有在页面白屏时才暴露**，代码本身读起来毫无异样。
   - **预检习惯**（比跑一轮截图快得多）：改完组件先
     `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/src/components/X.jsx`，
     **不是 200 就是转换失败**，先修再截图。这条已写进 `OrbCanvas.jsx` 的注释。

36. **⚠️ Windows 上 `--window-size` 压不到手机宽度；测手机必须走 CDP 覆盖**（2026-09-19）
   - Chrome 窗口有**最小宽度**：`--window-size=420,880` 实测得到的 `innerWidth` 是 **504**，
     所有移动端断点都不会命中。`DRAW_RITUAL_BRIEF.md` §8.2 记的「移动 504×784」就是这个原因，不是笔误。
   - `scripts/shot.mjs` 已加 `--mobile` / `--dpr`，走 `Emulation.setDeviceMetricsOverride`
     （顺带把 DPR 设上，否则 3D 球的绘制缓冲按 DPR 1 测，和真机不符）。实测 390×844 / DPR 2 生效。

37. **⚠️ 判断「某层贡献了什么」要用消融，不能用单张图的曲线形状反推**（2026-09-19）
   - 场景：球外面有一圈紫色，要判断是 `.orb__glow` 还是 `.orb__charge` 画的。
     第一版拿一张图做**径向亮度平均**、找断崖 —— 得出的结论是错的方向，
     照着改 CSS **越改越糟**（贴球那圈贡献从 +3.5 涨到 +24）。
   - 根因：**径向平均区分不了「环」和「盘」**。同一条曲线可以来自细环，也可以是实心盘，
     而这两层恰好一个是环一个是盘（`.orb__charge` 是 `radial-gradient(transparent 50%, …66%, transparent 82%)` 的环）。
   - 正确做法：**消融一层再拍一张**（同一拍、同一视口，每次只隐藏一个候选），
     用 `A − B` 得到该层的贡献。工具：`scripts/verify-halo.mjs` + `scripts/_check_halo.py`。
   - 附带教训：这层还挂着无限循环动画（`orbBreath` / `orbRing`），
     两次截图会落在不同相位 → **只比较同一次实验内部的差值，不要拿不同状态的绝对值比**。
   - 还有一条流程教训：**别在没确认归因之前就改文件**。当时的改动最后原样回退了，
     只留下一条「查证记录」注释 —— 那是对的收尾方式（把结论留下，不要留没作用的规则）。

38. **⚠️ 自检判据本身也要「双向验」，否则会在合法状态上假失败**（2026-09-20，第二十一轮）
   - 实例：`probe-whispers` 有一条 `spreadSane`，断言「同屏亮着的低语条数落在 **3–9**」——
     这是为「齐亮齐灭」那个 bug 写的门槛。但 `prefers-reduced-motion` 下**10 条全亮是设计**
     （降级成静态子集）→ 一跑 reduced 必然假失败。宽屏正常、reduced 一跑就红，很容易被当成页面坏了。
   - **判据规则**：只对「一个动态过程」成立的门槛（节奏、抖动、变化量），**不能无差别套到固定画面上**。
     写之前先问「这条路经下，什么算正常」。
   - **验证方式**：任何一条新判据，都要拿一个**应当命中**的样本和一个**应当干净**的样本各跑一次
     （本项目已有先例：`verify_manifest.mjs` 用「正常 / 被改 / 缺失」三合一样本反向验出脚本自己的 bug）。
     只在一种状态下跑过的判据，等于没验。
   - 同轮的第二例：`probe-whispers` 的窄屏几何检查。`≤900px` 时整层 `display:none`，
     `getBoundingClientRect()` 全返回 0 → 右侧「内边缘 ≥ 66%」拿到 0 直接翻负。
     修法是**先认清「这一轮根本没有几何可量」**（`hostHidden` → `measurable = false`），再让几何判据短路。

39. **⚠️ 同一个元素上挂两个 `transform` 会互相覆盖 —— 必须拆成父子两层**（2026-09-19 起反复踩，第二十一轮再现）
   - 场景：低语标签既要**指针视差**（跟着鼠标微动），又要**自身漂浮**（关键帧上下飘）。
     两者都是 `transform`，写在一个元素上 → 后生效的整个顶掉前一个，表现是「视差没了」或「不飘了」。
   - **解法**：外层 `.whisper` 只做视差（`--wx/--wy`），内层 `.whisper__text` 只做漂浮关键帧。
     与主视觉的 `.hero-frame`（定位层）/ `.hero-plate`（动画层）是**同一个套路**。
   - 顺带一条：视差偏移走 **CSS 变量**（`--wx/--wy/--depth`）而不是直接写 `style.transform` ——
     这样内层的漂浮关键帧和它互不干涉，也不用在 JS 里自己算矩阵。

40. **🐛 排相位不要用「数组全局序号累加」，要用「同容器内的序位摊满一个周期」**（2026-09-20，代价 = 两轮返工）
   - 首版：`delay = staggerMs * index`，`index` 是**整个 10 条数组**里的下标。
     两个后果，肉眼都看不出根因：
     ① **右侧空着** —— 左 5 条排完后，右侧第 1 条等 **8.5s** 才第一次出现（全局序号把它拖过去了）；
     ② **齐亮齐灭** —— 固定延迟堆叠让所有「亮」的窗口都挤在周期的前 6.8s 里（周期 9.4s），
        采样得到 `10/6/2` 这种节奏：确实在变，但变成**整体齐涨齐落**。
   - **正确写法**：`offset = rank * cycle / groupSize`（`rank` = **同侧**序号、`groupSize` = **同侧**总数），
     再按 `(now - start) % cycle` 算本地相位 —— 这样**首次出现就已经处在稳态相位**，
     不会「先全部亮相再各自漂移」。改完实测同屏条数稳在 6–8。
   - **为什么试错代价高**：`只看「变没变」的断言永远测不出来** —— 它确实在变。
     所以 `probe-whispers` 额外采样了「同屏条数序列」，把 `10/6/2` 这种病态节奏钉在判据里。

41. **⚠️ `SmartImage` 渲染出来的 `<img>` **自己**就带那个类，不是包一层 div**（2026-09-20）
   - 选择器写成 `.gallery__hit .card__art img`（**后代**）时，永远匹配不到 → 断言恒为 `false`，
     而页面其实完全正常。正确写法：`.gallery__hit img.card__art`。
   - 通用提醒：**先确认 DOM 的实际形状，再写选择器**；一条断言恒 false 且不改页面也照样 false 时，
     第一嫌疑是选择器，不是功能。

---


42. **⚠️「往上长」的元素有第二道天花板：只量「和下面的东西撞没撞」，会漏掉「被屏幕上缘裁掉」**（2026-09-20）
   - 背景：标题带是**从卡牌顶边往上锚定**的（第十五轮为了修「标题被卡牌盖住」才改成这样）。
     于是 `audit-title` 一直在量「标题 vs 卡牌」——**这个判据是向下看的，而标题是往上长的**。
     改大字号时才发现：真正的上限是**视口顶**和**顶栏的文字**，而这两条**根本没有探针在量**。
   - 危险在于它是**静默**的：标题被顶出屏幕上缘不会报错、也不会溢出滚动条
     （`.scene` 是固定视口的 `overflow: hidden`），只是那一行字的上半截不见了。
     而且只在矮视口发作 —— 1564×604 这类窗口平时根本测不到。
   - **修法**：给 `audit-title` 补 `band` 四组量 ——
     `roomToViewportTop`（离视口顶还有多少 px）、`intrudesTopbarBy`（伸进顶栏那条 y 带多少）、
     `titleText/subText`（用 **Range** 量文字**墨迹**，`h1` 的整行宽度没有意义）、
     以及与顶栏各段文字的**二维相交**。
   - 更根本的一条：**字号不要靠手调系数，要从几何契约反推**。
     标题带高 = `1.06F + 间距 + 副标题高`，字墨迹还会溢出 `0.19F`；
     卡牌顶边 = `0.385h − min(0.23h, 210px)`；要求墨迹顶边 ≥ 4px
     → `F ≤ 0.124h − 42.4`，于是 CSS 里直接写 `calc(12.4vh - 42.4px)`。
     比「试出来 6vh 差不多」靠谱得多，而且**换视口高度不用重试**（实测 h=604 时它自动降到 32.5px）。

43. **🐛 音频的失败模式是「不报错的哑巴」，而且它会藏在某一条分支里**（2026-09-20）
   - **第一层：`AudioContext` 必须在用户手势的调用栈里创建。**
     不在手势里 `new AudioContext()` → Chrome 不抛异常、不报 error，只把 ctx 挂成 `suspended`
     → 之后所有声音都是哑的，**控制台干干净净**。查起来像见鬼。
     合法的时机只有两处，都在手势里：用户点音效开关、用户点水晶球。
   - **第二层（更容易漏）：别只在「某一条分支」里建 ctx。**
     第一版把 `unlock()` 写在蓄势音那一支里，而蓄势音有 `if (!reduced)` 守卫。
     于是 `prefers-reduced-motion` 的用户**永远不会**走到那一支 ——
     而揭晓铃是从 `panelAt` 的**定时器**里触发的，那时早已脱离手势栈 → 建出来的 ctx 是 suspended → 全程无声。
     规律：**只要有一条路径的第一次发声发生在 setTimeout 里，就必须在点击那一帧无条件先把引擎建好。**
   - **第三层：这个「不报错」的特性会骗过反向验证。**
     `unlock()` 很容易被写成无条件的（第一版就是），代价是给「从没开过音效的用户」白建一个音频图 ——
     没有任何判据会发现它。所以专门写了 `probe-sfx-off`：**从没点过开关的用户抽完整张牌，实例数必须是 0**。
     只验「开了会响」的话，无条件 unlock 永远通过（同第 19 条）。
   - **怎么验（在听不到声音的前提下）**：把 `window.AudioContext` 换成计数包装类收集实例
     （模块里是调用时才读 `window.AudioContext` 的，所以包装有效），
     再给 `createOscillator / createBufferSource / createGain / createBiquadFilter` 打钩子，
     并**单独数 `osc.start()` 的次数** —— 只断言「工厂函数被调用」不够，没 `start()` 的节点是死的。
     判据落在：实例数、`ctx.state === 'running'`、各类节点计数、
     以及**常规态与 reduced 态的节点数必须不同**（实测 8/3 vs 4/1，两条互不依赖的证据）。
   - 一条工程规矩：**增益一律走包络**（`linearRamp` 起、`exponentialRamp` 落），
     且指数斜坡的终点写 `0.0001` 而不是 `0` —— 硬切 `gain.value` 会在波形中间留台阶，听感就是「啪」的爆音。

44. **⚠️ 判据取边界时要取「容器」，不要取「叶子节点」**（2026-09-20，同一个判据改了两版）
   - 场景：判断「居中标题的可用横向空档」，先写成取顶栏里所有**叶子文字**节点的左右边界。
     拿到右边界 **351**（「日期」那段文字的左边缘）—— 判据报「标题安全」，
     而右侧那一组的**容器**其实从 **274** 就开始了（里面还有「牌之图鉴」按钮）。
     **拿 351 当边界等于凭空多给 77px**，真有重叠也报不出来。
     改回 `.topbar > *`（直接子元素 = 左右两组）之后，立刻抓出窄屏标题与「牌之图鉴」相交 59px。
   - 规律：问「另一边从哪儿开始」，要问**那一侧整体的外缘**，而不是内部某段文字的位置。
     叶子节点只适合回答「这段文字占多宽」。

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

---

## 9 · 2026-09-19 第八轮：主视觉第 2 版已换装（球径 40%），两条待拍板

**当前生效**：主视觉换成 `assets/hero-art/bg/hero-v2b.png`（用户自己的参考图作为构图来源），
球径 `ANCHORS.orb.size` **31 → 40**，`x`/`y`/`CARD_RISE`/卡牌面板契约**零改动**。
完整记录（含三张图的亮度分布对照、四个失败修法）见 **`HERO_V2_PROMPT.md` 第 9、10 节** —— 那是本轮的权威文档。

**验证结论**：`audit-draw` 8 条断言全过、`overlapPx 0`、净空 39.2px、总时长 5568.9ms；
`audit-title` 三处重叠全 0；真页面探针实测球心 canvas (50, 61.5)、球径 40%。
截图：`assets/previews/v2b-idle-{wide,phone}.png`、`v2b-reveal-{wide,phone}.png`。

**⚠️ 本轮同时改了 `.scene__vignette`**（顶部 0.72→0.48、底部 0.92→0.74，空间形状不变）。
原因：旧暗角按 v1 的亮雾/中调标的，新图是「近黑主体」，两者叠加后人物直接消失。
安全性有数：新页面 p90/p99 **比旧版更高**（+12% / +31%）。要回退改回 `index.css` 里那两行原值即可。

**待用户拍板的两条（都未处理）**：

1. **手在桌面端只露出一段** —— 亮部最高到画布 y=60.4%，最扁窗口（1564×708）可见下缘 y75.7%，
   所以只看得到 15.3% 的一段手（16:9 窗口会多一截）。两条路：手再往上挪（= 改成「沿球侧缘抓」，**要重出图 5–10 积分**），
   或下调 `HERO_LAYOUT.positionY`（牵动主视觉取景，属功能层）。
2. **女巫读起来是近黑剪影** —— 「维持纯暗雾」+「主体压黑」两条决定的直接结果。
   参考图那张脸同样全黑，区别是它背后有亮星云托轮廓。要更清楚，杠杆是给头部后方加一层亮雾（第八轮未选）。

**回退方式**：`HERO_V2_PROMPT.md §9` 的 `gb/_raw/…13-28-21.png` 是出图原样，
`gb/_v2/` 是上一版主视觉，`gb/_v1/` 是 v1 母版 —— 换回任一张只需挪进 `bg/` 根目录并重跑
`build_hero_assets.py` + `build_lqip.py` + `build_og_cover.py`。

---

## 10 · 2026-09-20 第二十一轮：内容与美感补齐（当前状态）

**版本已选定**：用户确认「3D 效果已经初步达成我想要效果了，**暂时可以选定这个版本**」——
即第二十轮的 3D 球 + 手部前景层 + 脸部压暗那一版，是本轮的基线。

**本轮做完的四件事**（细节见 `PROJECT_STATE.md` 第二十一轮）：
① 22 张牌意加深（元素/星象/象征/宜忌）；② 用户可开的「牌之图鉴」（简单版）；
③ 新增**完整解读覆盖层**（加深内容住这里，解读面板一个像素没动）；④ 主页两侧**漂浮轮切低语**。
**零新增依赖、零积分消耗。**

**§9 那两条待拍板的处置**：
1. **手在桌面端只露出一段 —— 用户已裁定「先不改了」**（第二十轮原话），并且手已抠成独立前景层压到球前
   （遮挡实测 10.1% < 15% 上限）。这条**不再挂着**。
2. **女巫读起来是近黑剪影 —— 仍有效，且第二十轮又往前走了一步**：用户要求「连鼻子和嘴巴都不要看见」，
   已用引导插值暗场把核心区五官对比压掉 74%（`p99−p50` 0.0529 → 0.0078）。
   现在的问题不是「脸太清楚」而是**整体偏剪影**；若要更清楚，杠杆仍是「头部后方加一层亮雾」（未选）。

**下一步（按优先级）**：
1. **发布上线** —— 唯一实质待办，需用户本人选平台并登录（纯静态，`dist/` 直接托管）
2. 可选增强：中文衬线子集字体 / Web Audio 合成音效（见 §2 P2，都不花积分）
3. 本地日历回看页 / 移动端 9:16 主视觉 / 小阿卡纳 56 张（见 §2）

---

## 11 · 2026-09-20 第二十二轮：字号放大 + 音效合成（当前状态）

用户原话：「标题与副标题太小了，包括旁边的低语也是，需要加大字体。然后音效你看着合成试试看。」**零新增依赖、零积分。**

**做完的**
① 标题 36 → **45.4px**（1564×708）/ **54px**（高视口）/ 32.5px（矮视口自动缩）；副标题 13 → 18px；低语 11–14 → 13–18px。
   字号公式改成**从几何契约反推**（`calc(12.4vh - 42.4px)`），不是试出来的系数。
② 音效：`src/audio/sfx.js` 现场合成四个音（蓄势嗡 / 释放啪 / 翻牌唰 / 揭晓叮），
   时刻全部取自 `drawBeats`；默认关；开关在左上角（品牌下方）。
③ 顺带修掉一个真 bug：窄屏标题与「牌之图鉴」**二维相交 59px**（窄屏藏掉顶栏日期腾出空档）。

**验收**：`audit-title` 三档视口 `titleHitsTopbar` 全空、overlap 全 0；`probe-whispers` 宽窄全过；
`probe-panel-worst` 22/22 最坏净空 39.2px；`audit-draw` 8/8；`probe-gallery` 全过；
**`probe-sfx` + `probe-sfx-off` + `--reduced` 三态全绿**；`vite build` 415 modules / JS 313.65 kB。

**下一步**：仍然只有**发布上线**（需用户本人）；可选增强见 §2 P2（中文衬线子集字体是美感上最大的欠账）。
音效可以继续扩：图鉴/详情的轻音、音量滑杆（现在固定 `MASTER_GAIN = 0.34`）。

---

## 12 · 2026-09-20 第二十三轮：音效重做 + 环境音 + 卡牌下挪 + 标题罗马风（当前状态）

用户原话（四件事）：
> 「音效的风格很不符合我们的主题，点击之后牌出来前的声音和汽车加速的音效很像……
>   牌出来的声音很像拍了一下鼓，这种音色也不符合，牌翻转也是鼓，同样不符合，
>   最后牌展示的叮一声也不符合体感……另外我认为背景音乐也要有，是那种**幽暗寂静**的感觉。
>   然后再说说整体篇幅，目前卡牌有点靠上，与副标题有点重叠，需要下挪一点。
>   然后标题的文字不够有特色，可以参考**罗马艺术字**进行修改」

**零新增依赖、零积分**（字体 14.6 KB 来自 Google Fonts 子集端点，见 §2 P2）。

### 12.1 音效：四个音全部重做（`src/audio/engine.js` + `sfx.js`）

用户的四条反馈指向同一件事：上一版四个音里有三个是「**有明确音高 + 快起音 + 低频能量集中**」，
而人耳对这三件事的归类是**又快又硬的机械/打击事件**：

| 音 | 上一版的配方 | 为什么被听成那个 | 这一版 |
|---|---|---|---|
| 蓄势 | 96→148Hz 三角波 + 193→291Hz 正弦 + 低通 260→900Hz | **上行扫频 + 滤波开口 = 引擎从怠速拉转速** | 两条只差 0.35Hz 的低音（拍频 0.35/s）+ 两层气声缓慢拱起，**一个频率都不动**，靠音量拱形表达积蓄 |
| 释放 | 噪声脉冲 + 128→54Hz 正弦，attack 4ms | **快速下滑的低频正弦 = 底鼓**（一个不差） | 高通气声 + 低频**气**层（不是正弦）+ 一声慢起的低音底座；200Hz 以下零瞬态 |
| 翻牌 | 带通噪声 + 420→300Hz 正弦「木质嗒」 | **有音高的短促击打 = 手鼓** | 三层噪声错开 28ms，**零振荡器**；attack 从 3ms 放宽到 16ms |
| 揭晓 | 659Hz 基音 + 1/2.01/2.99/4.21 泛音，attack 12ms | **快起音的亮铃 = 电子提示音** | 换成**颂钵**：196Hz 基音 + 失谐副基音 + 钟形模态比 2.76/5.40/8.93，attack 180ms、余韵 6s |

**判据（写进 `engine.js` 文件头，后来者请守）**：
> **凡是在 50ms 内把能量堆到 200Hz 以下的写法，一律不许出现。**

另加**程序化厅堂混响**（`makeIR()`：噪声 × 频率相关衰减 + 前 55ms 早期反射 + 左右声道去相关）。
合成音「廉价」往往不是音色问题，是**没有空间** —— 干声贴着耳朵像玩具。
零素材、零依赖，`ConvolverNode` + 现算脉冲响应即可。

### 12.2 环境音（`src/audio/ambient.js`，新增）

按「幽暗寂静」四层平铺，目标是**让人听见「空间」而不是「音乐」**：
① 双失谐低音 55 / 55.4Hz（0.4Hz 拍频 = 缓慢起伏，**刻意不写和弦进行**，一有进行就变成「一首曲子」会抢戏）
② 风：噪声 → 低通，截止被 **0.035Hz** 的 LFO 在 200–480Hz 之间推（28.6 秒一个周期 = 声音自己在呼吸）
③ 稀疏点缀：每 14–30 秒一声，五声音阶随机取音，起音 1.2 秒 —— 是「远处有什么在响」，不是伴奏
④ 整条总线走混响（wet 0.5）

礼仪三条：抽牌时 **duck 到 35%**（那 5.6 秒是音效的主场）；页面切后台自动静音；开关默认关、淡入 3.5s。
⚠️ **drone 不能用 `tone()` 那种一次性包络节点搭** —— 第一版想把 `tone()` 改造过来
（建完再断开它内部的包络、把 stop 推到 86400 秒），又绕又脆弱，正解是自己建 `osc → 固定增益 → mix`，
淡入淡出只由 `bgm` 这一个节点负责。

### 12.3 几何：只挪卡牌是**没用的**（重要）

用户说「卡牌有点靠上，与副标题有点重叠，需要下挪一点」。但：

> ⚠️ **标题带是从卡牌顶边往上锚定的**（`.headline { bottom: 100% − anchorY + halfH + gap }`），
> 所以「只把牌往下挪」根本没用 —— 标题带会**跟着一起往下挪**，
> 副标题与牌面之间那 20px 纹丝不动，改了等于没改。
> **要拉开距离只能改 `TITLE_GAP`**，而改它会把标题带整块往上顶（顶端余量很薄）。

于是用「**下移换空间**」：落点 38.5% → 40%、卡高 46vh → 43vh（下半 23 → 21.5）
→ 牌面顶边 15.5% → **18.5%**（牌往下走 20–24px），而 `TITLE_GAP` 20 → **38px**
→ 标题带绝对位置净变化只有 +0.4px(@612) / +3.2px(@708)，**副标题与牌之间的净空翻倍**。

而且底边 40 + 21.5 = **61.5%，与改前完全相同** —— 面板净空一点没损失（这是刻意的：
竖屏下那个净空只剩 10.1px，扣不起）。实测 708 高下最坏净空仍是 **39.2px**，与改前逐位一致。

标题字号公式随之重推：`calc(12.4vh − 42.4px)` → `calc(14.8vh − 56.8px)`。
⚠️ 这个常数**第一版写成了 −53.6**（少减 3.2px），实测 612 高视口下标题墨迹距屏幕顶只剩 3.1px、
已经吃进安全线。**反推公式是唯一有效的自查方式**：量出 `headline.y` 与实际墨迹顶边之差，
和公式里假设的 0.19·F 对一遍。

窄屏另外撞了一次墙：把上限提到 40/42px 后，「今」的左边缘 141.5 撞上「TAROT · 日签」的右边缘 143.9
（**二维相交 2.4px**）。横向才是紧的那一头，解出上限是 **38px**；想让窄屏标题再大，
必须先动顶栏（收品牌字距 / 缩成「TAROT」/ 图鉴改图标按钮，三条路按代价排序写在 index.css 里）。

### 12.4 标题：罗马碑刻体

- **换字**：`--font-title` = Cinzel（拉丁，真·Trajan 一脉）+ Noto Serif SC 900（汉字）。
  罗马碑刻的判据是「衬线 + 竖粗横细 + 字面方正」，中文里对应粗宋 —— 系统那档宋体在 40–54px 下发虚。
  子集端点用法见 §2 P2，三个文件合计 14.6 KB。
  副标题也换成同族 400（否则「标题是 Noto 宋、副标题是 SimSun 宋」两种宋体叠在一起）。
  > ⚠️ **本条的拉丁字体当时是坏的**（`title-latin.woff2` 装的是 Google 的 HTTP 400 错误页，
  > 只是静默回退所以没被发现）。第二十四轮修好了，见 §13。
  > 上面那个「14.6 KB」也是按坏文件算的，修正后合计 10.0 KB。
- **碑铭线**：主铭文之下压一道短横线（罗马碑刻的标准构成）。
  做成**真实元素** `.headline__rule` 而不是伪元素 —— 伪元素没有 `getBoundingClientRect()`，
  量不了位置也就断言不了「有没有越到牌面上」。
- **刻痕质感**：两层极轻的 `text-shadow`（上暗下亮）模拟「凿进石头、光从上方照下来」。
  幅度压到 0.16/0.55，一旦看得清就变成描边，廉价感立刻出来。

### 12.5 验收

| 探针 | 结果 |
|---|---|
| `probe-ambient`（新）| **ALL_PASS** — 节点增量 4 osc + 1 buf；1.2s 内零自停；gain `0.18 → 0.063 → 0.18`；关开关 `stop()` ×5 |
| `probe-sfx` 常规 / `--reduced` | **ALL_PASS** — 常规 9 osc / 9 buf / 13 start；reduced 恰好 5 osc / 1 buf（只留揭示钵），双向确认 |
| `audit-title` 宽 / 窄 | 4 项全过 — 副标题↔牌面 **38px**、标题墨迹距顶 ≥4px、与顶栏**零相交**、碑铭线在副标题下 6px / 离牌面 31px |
| `probe-panel-worst` 宽 / 窄 | ALL_PASS — 708 高最坏净空 **39.2px**（与改前逐位一致）；688 高 24.5px（原 10.1） |
| `probe-whispers` / `probe-gallery` / `audit-draw` / `verify-orb3d` | 全过（`audit-draw`: 卡牌 43vh / top 18.5% / bottom 61.5% / overlap 0 / clearance 39.2） |

`vite build`：**417 modules**，JS 317.87 kB（gzip 112.41，+4.2 kB = 音效重做 + 环境音 + 混响），
CSS 45.89 kB，字体 woff2 6.39 + 6.54 kB 独立产出（Cinzel 1.7 KB 被 Vite 内联进 CSS）。

**抓到的真问题**（都不看运行结果发现不了）：
1. **白屏**：`sfx.js` 里 `export { muteAll }` 但 `import` 漏了它 → 浏览器抛
   `Export 'muteAll' is not defined in module`，**求值期**抛、整站白屏、控制台只有这一条。
   教训：转发导出和局部导入是两套东西，**同名不冲突，但也互不覆盖**。
2. **标题字号公式常数推错 3.2px**（见 12.3）。
3. **窄屏上限提上去就撞顶栏**（见 12.3）—— 纵向算得再准也没用，横向才是紧的那一头。

**下一步**：仍然只有**发布上线**（需用户本人选平台并登录；纯静态，`dist/` 直接托管）。
音效可继续扩：图鉴/详情的轻音、音量滑杆（现在固定 `MASTER_GAIN = 0.34`）；
环境音可加「抽牌时 BGM 换调」之类，但要注意别把它做成「曲子」。

---

## 13 · 2026-09-20 第二十三轮收尾：拉丁字体是坏的（已修）+ 字体验收入代码

这一节没有新需求，是**做完 §12 之后自检发现的真 bug**。留在这儿是因为它的教训比 bug 本身值钱。

### 13.1 发生了什么

§12.4 说「标题换了罗马碑刻体」。**但那个拉丁字体从来没生效过。**

`title-latin.woff2` 里装的不是字体，是 **Google 返回的 HTTP 400 错误页 HTML**
（1.66 KB，开头是 `<html lang="en" dir="ltr">…Error 400 (Bad Request)`）。
成因是我手搓的一次性 fetch 把 `text=` 里没做百分号编码的 `·` 直接塞进了 URL，Google 拒了，
而我把响应体原样当字体存了下来。两个汉字文件是真字体（`wOF2` 开头），所以只有拉丁那一档是坏的。

**为什么一直没发现 —— 这才是重点：**

1. 浏览器 `font-family` 是**逐字符回退**的。坏文件加载失败 → 直接跳到栈里下一个字体 → 页面照常渲染。
2. **不报错、不警告、Console 干净。** 坏字体不产生任何异常。
3. 截图看不出。回退到的是系统宋体/Times，同样是衬线体，「挺好看的」——
   而**我根本不知道 Cinzel 应该长什么样**，所以「看起来对」这个判据在这里是无效的。
4. `vite build` 无感：1.7 KB 的 woff2 被内联成 CSS data URI，构建产物里也只是多了一小段 base64。
5. 我自己在 §12.5 写下的验收表里，字体那一栏是**空的** —— `probe-ambient` / `probe-sfx` /
   `audit-title` / `probe-panel-worst` 全都验的是音效和几何，**没有一个探针碰过字体**。

真正的暴露点是第二十四轮我顺手检查构建产物，发现有一段 data URI 解出来是 HTML。

### 13.2 修了什么

| 项 | 内容 |
|---|---|
| 字体本体 | `title-latin.woff2` 重抓，**落盘前验 `wOF2` 魔数**。顺带把两个汉字子集也按精确字符集重抓（旧的可能多抓了字） |
| 字重声明 | Latin 那张是**可变字体**（Google 对 `Cinzel:wght@400..900` 回的就是 `font-weight: 400 900` 一条），`@font-face` 从 `font-weight: 600` 改成区间 `400 900` |
| 品牌字重 | `.topbar__brand` 显式写 `font-weight: 400`。**不能写 600**：汉字脸只有 400/900 两档，600 会被就近匹配到 900 脸，而 900 子集里有「签」没有「日」→「日」继续回退到**系统装的** Noto Serif SC，同一个词两种字体 |
| 体积 | 1.82 + 1.63 + 6.57 = **10.0 KB**（旧的 14.6 KB 里 1.7 KB 是垃圾） |

### 13.3 新增两个脚本，把「靠人记得」换成「跑不出来就报错」

- **`scripts/fetch-title-fonts.mjs`** —— 抓字体子集。校验写进流程：
  ① `text=` 一律 `encodeURIComponent`；② 落盘**前**验 `wOF2` 魔数；
  ③ 验不过就抛错退出（`exit 1`），**绝不把坏文件写进 `src/`**。
  追加字体只改 `SPECS` 数组，幂等可重跑。
- **`scripts/probe-fonts.mjs <url>`** —— 字体探针，自带 CDP 驱动（**不能**做成 `--eval-file` flow：
  页面内拿不到 `CSS.getPlatformFontsForNode`）。三条判据：

  | 判据 | 问什么 | 能抓到什么 |
  |---|---|---|
  | A | `document.fonts` 里三张脸的 `status` | 坏文件停在 `error`（本次这一类） |
  | B | 逐字形：三个 woff2 各自挂独立族名，问「这个字是谁画的」 | 子集**缺字**（漏字 → 落到系统字体） |
  | C | 页面真实节点（标题/副标题/品牌）的渲染字体 | CSS **没接上**（字体没问题但没生效） |

  **A / B / C 分别对应「文件坏了」「文件缺字」「没接上」三种不同的故障**，缺一条就会漏检一种。

### 13.4 两个判据设计上的坑（写下来免得再踩）

1. **`getPlatformFontsForNode` 报的是字体文件 name 表里的族名，不是 CSS 里声明的族名。**
   我把文件挂成 `PROBE LATIN`，它照样报 `Cinzel`；挂成 `PROBE HAN900`，报 `Noto Serif SC Black`。
   第一版判据拿族名比对 → **全部假 FAIL**。
   正解：只看 `isCustomFont`（`custom === true` 才算 web 字体）。
2. **自定义宋体与系统装的 Noto Serif SC，报出来的族名一模一样**（都是 `Noto Serif SC`）。
   这也是 13.2 表里「品牌字重」那个 bug 能被抓到、而不是被族名掩盖掉的原因。
   如果判据写成「族名在白名单里就算过」，那个 bug 会**静默通过**。

### 13.5 两条该带走的结论

- **「看起来对」不能作为字体正确的判据** —— 回退后的字体也是衬线体，而且我不知道正品长什么样。
  字体只有**问浏览器自己**才算数。（这条可以推广：任何「静默回退 / 静默降级」的机制，
  视觉验收都无效，必须问运行时。）
- **做视觉改造时，验收表比改造本身更容易漏。** §12.5 的验收表看着挺全（4 个探针全绿），
  但它只覆盖了我改动最大的部分（音效、几何），字体那一栏是空的 —— 而**字体恰恰是这次唯一出错的东西**。
  下次列验收表的规则：**按「我改了什么」逐条列，而不是按「我有什么探针」列。**

### 13.6 本轮验收

| 项 | 结果 |
|---|---|
| `probe-fonts` **dev**（5173） | A/B/C **全 PASS** — 6 字由 Cinzel、4 字由 Noto Serif SC Black(900)、32 字由 Noto Serif SC(400) |
| `probe-fonts` **生产构建**（4199） | A/B/C **全 PASS** — 两个小字体走 CSS 内联 data URI 这条路径同样正确 |
| 构建产物字节校验 | 内联 data URI ×2 + 独立 woff2 ×1，**三个都是 `wOF2` 开头**（+1860 / +1664 / 6724 字节） |
| `audit-title` 宽 1564×708 | 4 项全过 — 副标题↔牌面 38px、标题距顶 17.1px、与顶栏零相交、碑铭线 6px / 31px |
| `audit-title` 窄 1082×604 | 4 项全过 — 品牌右缘 **140.7px，与宽屏逐位一致**（说明 Cinzel 400/600 字符宽度相同，窄屏横向余量不受影响） |
| 回归 8 个 flow（生产构建） | `probe-ambient` 7 PASS / `probe-sfx` 7 PASS / `probe-sfx-off` ALL_PASS / `probe-panel-worst` ALL_PASS（最坏净空 51.4px）/ `probe-whispers` ALL_PASS / `probe-gallery` ALL_PASS / `audit-draw` **pass:true**（卡牌 43vh / top 18.5% / bottom 61.5% / overlap 0 / clearance **39.2px**，与改前逐位一致）/ `audit-motion` 无异常 |
| 目视 | 品牌名 `TAROT · 日签` 现在是真 Cinzel（R 的直腿、A 的尖顶能认出来）；主标题重字重宋体 + 碑铭线 + 刻痕 |

`vite build`：**417 modules**，JS 327.76 kB（gzip 112.42），CSS 48.40 kB（+2.5 kB = 内联进去两个小字体），
`title-han-400` 独立产出 6.72 kB。

> `probe-panel-worst` 与 `probe-whispers` 的 `welcome-frame.js` 一样**只能在开发模式跑**（依赖页内调试条），
> 生产构建上会返回 `"调试条不存在"` —— 别把它当失败，换 dev 端口重跑即可。

**下一步不变**：发布上线（§2 P1）。字体若要扩到全站，务必**连 `probe-fonts` 的 `EXPECTED` 一起扩**，
否则探针查的字比字体少，等于没查。


## 14 · 2026-09-20 第二十四轮：BGM 换成 AI 素材 + 音效改用 AiSounds 生成

起因是用户两条消息：①「你用芒果灵创生成的 bgm 效果不错」②「好像无法生成短时长的音效，
我这里推荐用 Aiwave 来制作音效」。所以这一轮做了两件独立的事：**BGM 落地成素材**、
**音效换成 AI 生成**（后者需要用户在平台侧操作，方案已备好）。

### 14.1 BGM：从纯合成改成「素材优先、合成兜底」

第二十三轮的环境音是**纯合成**的，理由是当时假设「音频素材零新增」。
用户明确说 AI 生成的那版更好听 → 那条假设**被用户推翻**，改为用素材。

- 素材：`src/assets/audio/ambient-loop.mp3`，**350,820 B (342.6 KB)**
- 来源：`scripts/out/mglc/ambient-01_1.mp3`（芒果灵创 Mureka-9.5，205.7s / 3.29 MB）
- 加工：`scripts/build-ambient.py --loop 60 --xfade 3.5 --kbps 48`
  → 60 秒无缝循环、单声道、48kbps ABR、峰值 −3.0 dBFS、RMS −17.1 dBFS

**为什么单声道不丢空间感**（这条反直觉，别改回去）：站内 BGM 要送进 `engine.js` 那条
程序生成的**立体声**混响，左右宽度由 IR 去相关产生 —— 宽度来自混响，不来自源。
所以源用单声道：省一半体积、避免低码率立体声的相位摆动，空间感一点不损失。

**合成那版没删。** 它现在承担三个职责：`file://` 直接打开时 `fetch` 被 CORS 挡掉 → 退回它；
素材缺失/解码失败 → 退回它；以及它是**永不重复**的（拍频 + 缓变滤波 + 随机点缀），
是「素材循环听腻了」时的备选。接线在 `startAmbient()`：素材路同步建图、异步载入，
载入失败才 `buildSynth()`。

### 14.2 MP3 循环的坑：编码器延时 + 尾部补零（**必读**）

MP3 编码会在**头部写入约 576~1152 个采样点的延时**、**尾部补零**对齐帧。
这些字节解码后是**真静音**，而 `decodeAudioData()` 按规范**不剥掉它们**
（LAME 写在 Xing/LAME 头里的 gapless 信息，Chrome 不解）。
结果：每循环一圈多出 20~30ms 静音 —— 在连续 drone 上就是一个可闻的「噗」。

修法不是重新编码，是用 **`loopStart` / `loopEnd`** 把这段静音排除在循环之外
（见 `ambient.js` 的 `audibleRange()`，带**上限保护**：最多各剥 3000 点，
免得把素材本身很轻的头尾误判成静音而切掉真内容）。

本机实测：头剥 **345 点**、尾剥 **107 点**（共 ≈9.4ms），循环区 60.039s。
探针直接读 `getChannelData` 断言「循环区外峰值 < 1e-3、区内 > 0.01」——
这是「剥的正好是补零、没切到内容」的唯一直接证据。

### 14.3 两个「判据本身写错」的教训（比 bug 更值钱）

| 现象 | 真因 | 教训 |
|---|---|---|
| `probe-ambient` 的 `loopTrim` 恒为假，但代码是对的 | 断言里**写死了 44100** 换算秒数。`decodeAudioData` 会把音频**重采样到 AudioContext 的采样率**（本机 48000，不是文件的 44100）→ 缓冲区是 60.048×48000 而不是 ×44100。改用 `buffer.sampleRate` 后立刻通过 | **判据本身可以错，而且错了以后看起来像被测对象有问题。** 所以断言要用「被测对象自己报出来的参数」换算，不要用你记忆里的常量 |
| `lameenc` 抛 `RuntimeError: Invalid mode` | `set_vbr()` 收的是**模式常量**（`VBR_OFF`/`VBR_RH`/`VBR_ABR`/`VBR_MTRH`），不是布尔值。传 `1` 会炸 | 第三方 C 扩展的参数语义要**实际探测**（`dir(lameenc)` 一行就能列出常量），别照印象写 |

### 14.4 音效：为什么换平台 + 换成什么

**芒果灵创做不了短音效，这是结构问题不是调参问题。** 实测：它只有
`music` / `score` / `dubbing` 三种模式，**没有 SFX**。用「生成一声翻牌」的提示词提交，
两个变体都交回来 **180 秒**的整首曲子。它擅长长氛围，短音效这条路是堵死的。

**改用 AiSounds（爱声音坊）**，`aiwave.art` 跳转到 `aisounds.cn`：

- 音效引擎是 **ElevenLabs Sound Effects**（1–30 秒，原生支持 Loop）
- 语义层 DeepSeek V4 Pro 优化中文提示词 → **写中文效果更好**
- 有「项目音效包」，就是为成组 UI / 游戏音效交付做的
- 注册送 200 积分，无需绑卡；商用允许（游戏/短视频/播客/广告，不能转售）

⚠️ **搜「AIWave」会撞到至少四个同名但无关的产品**（`aiwave.live` 是卖大模型 API 的网关、
`audiowaveai` 是 TTS 应用、`airwaveai.com` 是工具导航站），有些收录站还把 aiwave 写成
「歌曲生成工具、无 API、不支持二次集成」——**那是错的**（把两个产品混成一个了）。

**四个音的提示词、时长、交付契约写在 `audio-src/README.md`**，直接照抄即可。
要点是四条提示词里都要带上那半页「不要」（无音乐/旋律/节奏/鼓点/打击、
无人声、无低频轰响、无尖锐咻声、无有音高的敲击）——那正是第二十三轮四个音被否掉的原因。

**BGM 是从哪来的（provenance）** —— 这几个 `_` 前缀脚本就是那条链路，留着可复用：

| 脚本 | 作用 |
|---|---|
| `scripts/_poll_mglc.py` | 轮询芒果灵创的异步音频任务直到落地 |
| `scripts/_mglc_download.py` | 把结果下到本地（**返回的 URL 带签名和时效，不能直接引用**） |
| `scripts/_mglc_analyze.py` | 解码后量形态（时长 / 频谱质心 / 动态范围 / 能量跳变率） |
| `scripts/_mglc_viewer.py` + `_serve_range.py` | 生成试听页并起一个**支持 Range** 的本地服务（`http.server` 不支持分段请求，3 分钟的曲子不能拖进度条） |

⚠️ 原始 mp3 在 `scripts/out/mglc/`（**被 `.gitignore` 排除**，不进仓库），
所以 `build-ambient.py` 的命令示例在新克隆的机器上跑不了 —— 换素材时把新文件放进去即可。

**下一步（等用户把文件放进 `audio-src/sfx/`）** —— ✅ **第二十五轮全部做完，见 §15**：

1. ~~写 `scripts/build-sfx.py`：去首尾静音 → 按时长裁齐 → 尾端 30ms 淡出防截断爆音
   → **四个音按 RMS 统一配平**（四次独立生成的响度一定参差，不配平就会
   「有的听不见、有的吓人」，这步不能省）→ 编码进 `src/assets/audio/`~~
   ✅ 做了，而且发现「配平」不是调参问题：**峰值受限时 RMS 有数学上界**（见 §15.2）
2. ~~改 `src/audio/sfx.js` 成素材优先、合成兜底（与 `ambient.js` 同一套路）~~ ✅
3. ~~扩 `probe-sfx`：加「四个素材都下到且 200」「走的素材路不是兜底」「四个音的 RMS 差 ≤ 3dB」
   三条判据 —— 尤其是第二条，它对应 §14.1 那类**静默退回**故障~~ ✅
   ⚠️ 但「四个素材都下到」那条**第一版写错了**：它匹配 dev 的 URL 形状 `/sfx/`，
     在生产（资源被拍平成 `/assets/<name>-<hash>.mp3`）上永远匹配不到 → 见 §15.4

### 14.5 本轮验收

| 项 | 结果 |
|---|---|
| `build-ambient.py` 两个变体 | 变体1 342.6 KB / 接缝比 0.944；变体2 340.8 KB / 接缝比 0.36 —— **都 PASS**（判据 ≤1.25）。选了**变体1**（质心 626Hz 更暗 = 更贴合「幽暗」，跳变 0.51/秒 更少 = 更像氛围层而不是曲子） |
| `probe-ambient`（prod 4199） | **10/10 PASS** — `sourceKind: "asset"`、`onDelta {osc:0, buf:1}`、mp3 fetch **200**、buffer 60.048s/48000Hz/单声道、循环区 60.039s、循环区外峰值 5.4e-5 & 9.97e-5、区内 0.297、duck 0.18→0.063、recovered、`stopsOnOff 1 ≥ liveSources 1`、零报错 |
| 回归 7 个 flow（prod 4199） | `probe-sfx` 10/10、`probe-sfx-off` 5/5、`audit-title` 4/4、`probe-whispers` 8/8、`probe-gallery` 9/9、`audit-draw` **pass:true**（牌 43vh / top 18.5% / bottom 61.5% / overlap 0 / clearance **39.2px**，与第二十三轮逐位一致）、`audit-motion` 无异常 |
| `probe-panel-worst`（dev 4188） | **ALL_PASS** — 22 张全过，最坏净空 **50.1px**，零重叠 |

`vite build`：**418 modules**，JS 318.85 kB（gzip 112.82），CSS 48.42 kB，
`ambient-loop-SkECQZSt.mp3` 350.82 kB 作为独立哈希资源产出
（生产下从 JS 里解析到的引用路径也验过：`200 / audio/mpeg / 350820 B`）。

**体积预算参照**：站里单张卡牌 webp 是 280–335 KB，22 张 ≈ 6.6 MB，JS 约 1.07 MB。
BGM 342.6 KB **比一张卡牌图还小**，加进来是合适的。

> ⚠️ **`file://` 下 BGM 会退回合成**（`fetch` 被 CORS 挡）。
> 这是**设计如此**，不是 bug —— 别为了「让 file:// 也有 BGM」去改成 `<audio>` 元素：
> 那样一来 `createMediaElementSource` 在 `file://` 下会被 taint 成静音，
> 二来开关就管不住它了（duck / 静音全失效）。


---

## 15 · 2026-09-20 第二十五轮：四个音效换成 AI 素材（当前状态）

§14 把四个音的提示词和交付契约写好了，这一轮把剩下的做完：限流重置后手工生成
flip（1s / 20 点）与 reveal（4s / 80 点，余额 140→0），四个音全部落地并接进站里。
**这一轮的价值主要在「接线时抓出来的三个真故障」上**，不是生成本身。

### 15.1 接线形态（与 `ambient.js` 同一套双路结构）

```js
const assetUrls = import.meta.glob('../assets/audio/sfx/*.mp3', {
  query: '?url', import: 'default', eager: true
})
```

- **glob 而不是硬编码路径**：目录为空、或缺其中某个文件，**都不报错** ——
  正好匹配「素材分批到货」的现实（限流下是到一段处理一段），到货一个多一个键。
- **预载时机**：第一声 `charge` 就在抽牌点击里，靠 play 时现 `fetch + decode` 来不及。
  所以 `engine.unlock()` 在**手势栈里同步**派发 `tarot:audio-ready`，`sfx.js` 监听后开始预载。
- **合成配方一个字没删**，它兜三种情况：素材没到货 / `file://` 下 fetch 被 CORS 挡 / 解码失败。

### 15.2 ★ 故障一：响度离散 19.5dB（flip 几乎听不见）

原 `normalize()` 写的是「RMS 增益与峰值增益取更严者」。flip 的素材是
**很轻的床体 + 一记 6ms 爆裂**（峰值系数 **28.5dB**，0.77% 的样本占掉 4.83dB 能量），
于是被整体降增益压到 **RMS -30.6dB** —— 页面上听不见。README 明写「统一按 RMS 对齐，
否则有的音听不见、有的音吓人」。

**★ 核心方法论：先算「指标在当前约束下的理论上界」，再决定是调参还是目标本身不可达。**

峰值钉在天花板时，**RMS 有数学上界** —— 上界就是逐样本硬削顶后的 RMS
（每个样本取到能取的最大值）。实测 flip 的上界只有 **-17.3dB**，离 -14dB 目标差 3.3dB：
**靠限幅永远到不了**。我先用限幅器参数网格调了 12 组，结果全是 -16.7~-16.9dB
（纹丝不动）才反应过来方向错了。

→ 到不了只有两条路：**接受偏差**，或**付失真**。flip 选了软削顶（tanh，二分找
「最少失真」的电平），并把**被削样本占比**当可审计数字报出来（1.44%）。
而且是**逐素材决定**（`SPECS[*].clip`）：宽频噪声瞬态被饱和听着像「响了一点」；
**reveal 的颂钵有音高**，饱和会变成闷响 → 它宁可抬天花板也不削。
「只在特定素材上成立的门槛，不能无差别套到所有素材。」

### 15.3 ★ 故障二：出厂 mp3 过满刻度（浏览器解码 burst +0.7dBFS）

天花板原本设 -0.3dBFS，注释写「给编码留了 0.3dB」—— 那句是**没量过的假设**。
实测 mp3 过冲 **1.0~1.7dB**，而且**随内容变化**（reveal 同一电平却一点不冲），
所以只能按最坏情况留余量。天花板改 **-2.8dBFS**。

**为什么是 -2.8**：`build-ambient.py` 那条线从一开始用的就是 **-3dBFS**
（`target_peak`，注释「留出编码器的余量，避免削顶」）—— **音效这边才是那个异类**。
第一版我按 -1.8 改，结果 flip 正好落在 **0.0dBFS**：python 报 -0.1、Chrome 报 0.0，
同一条音两个解码器差 0.1dB，判据会**随机变红**。卡着零点过的绿灯不是绿灯。

**关键：天花板下移，四个 rms 目标必须同步下移同样的量**（2.5dB）。
这样「峰值到天花板的距离」「限幅压多少」「软削顶削多少」**逐位不变** ——
证据是 flip 的削顶电平从 -5.5 → -8.0dBFS（正好差 2.5），**被削比例 1.44% 一模一样**。
反例：只降天花板不动目标 → 有 headroom 的 charge 不受影响、顶着天花板的另三个被压低
→ **相对对齐被破坏**，正是这个脚本要修的那类故障。

> ⚠️ **过冲在 python 侧看不见**：`miniaudio` 的解码输出被钳在 ±1.0
> （burst 有 **6 个样本精确落在 1.000000**、s16 路径 4 个撞到 32767）。
> 所以原来那条「解码峰值 > 0dBFS」判据是**死判据**，写多少年都不会红。
> → 换成**指纹判据**：「不许出现被钳在满刻度的样本」（连续音频里成片出现精确的
>   1.0 不可能是巧合，那是过冲被截断的签名）。复现证据：`scripts/_probe_mp3peak.py`。
>   真正量得出过冲幅度的是浏览器：`probe-sfx` 的 `sfxNoClip`。

### 15.4 两条判据本身写错了（比故障更值得记）

| 判据 | 错在哪 | 怎么改 |
|---|---|---|
| `build-sfx.py` 的「解码峰值 > 0dBFS」 | 解码器钳位 → **永远不可能成立**，死判据 | 换成「不许出现被钳样本」的指纹判据 |
| `probe-sfx` 的「四个素材都下到且 200」 | 匹配的是 **dev 的 URL 形状** `/sfx/`；生产里 Vite 把资源**拍平**成 `/assets/<name>-<hash>.mp3`，**一次 fetch 都匹配不到** | 改成按**文件名**匹配（dev 是 `charge.mp3`、prod 是 `charge-<hash>.mp3`，都 startsWith） |

⚠️ **这是同一个坑的第三次**：**「只在某一条实现路径上成立的门槛，不能套到另一条路径」**
—— 前两次是「振荡器（合成）vs 缓冲区（素材）」「素材 vs 合成」，这次是 **URL 形状**。
第一次它表现为**假失败**（正确状态被判红），第三次表现为**假绿的邻居**：
在 dev 上绿得毫无理由，只是因为 dev 的目录恰好叫 `sfx`。

### 15.5 探针补上端到端判据：量「出厂那一份」

`NEXT_STEPS` §14.4 第 3 条挂着「四个音的 RMS 差 ≤ 3dB」，这一轮补完。
做法：`sfx.js` 在**解码回调里**实测每个音（时长 / RMS / 峰值），经 `__tarotSfx.stats`
暴露给探针（**在回调里算一次并缓存** —— `__tarotSfx` 是 getter，探针的 waitFor 会轮询读它）。

三条判据（阈值都是**先量后定**，实测值见 `scripts/out/_sfx_build.json` 的 `rt_*` 列）：

| 判据 | 阈值 | 实测 |
|---|---|---|
| 响度极差 | ≤ 3dB | **1.2dB** |
| 解码峰值 | ≤ 0dBFS | **-4.8 / -1.2 / -0.7 / -3.1**（charge/burst/flip/reveal） |
| 时长 vs 合同 | ±0.12s | 1.045 / 1.045 / 0.862 / 4.049s |

**为什么必须这一层**：前面每条判据都只证明「路走对了」，证明不了「**路上运的那批货是对的**」
—— `dist` 里躺着上一版旧文件就是这么静默发生的。
量的对象是**浏览器解码后的样本**：生成 → `build-sfx.py` → 构建 → HTTP → `decodeAudioData`，
整条链路只在这个点上合拢。

### 15.6 本轮验收（全部在 prod 4199 上跑）

| 项 | 结果 |
|---|---|
| `probe-sfx`（dev + prod 各一次） | **ALL_PASS true**，16 条判据全绿；`sfxFetches` 4 个哈希资源全 200 |
| `build-sfx.py` 自检 | **ALL_PASS true** — 响度偏离目标 0.4~0.7dB、无被钳样本、flip 软削顶 1.44% |
| `probe-sfx-off` / `probe-ambient` | **ALL_PASS true** |
| 回归 5 个 flow | `audit-title` 4/4、`audit-draw` **pass:true**（8 条 ok）、`audit-motion` ok、`reveal` 素材全加载、`share` 分享卡 blob 260KB |
| `vite build` | ✓ 3.93s，`index-DClMUVcF.js` 320.67 kB（gzip 113.58），四个音效独立哈希资源 |

### 15.7 遗留

1. **`burst` / `flip` 只有 1.0s**（合同写 1.5s）—— 生成结果本身短了，`fit_duration`
   只截断不拉伸（拉伸会弄坏起音形状）。有点数后可重生成覆盖，脚本无需改。
2. **`reveal` 只有 4.0s**（合同 5s）—— 余额只够 4 秒；尾巴少了 1 秒余韵，落点仍成立。
3. 音效仍**只有抽牌这一条线**有声；图鉴翻页 / 详情打开、音量滑杆都还没做。
4. **发布上线**仍未做（纯静态，`dist/` 直接托管）。

## 16 · 2026-09-20 第二十五轮补：开发者版的音效调试台（DevBar）

用户原话：「请给我开发者版本，我要反复检查音效的效果」。

### 16.1 为什么落点在 DevBar，而不是新建一个试听页

「开发者版本」在这个项目里**有确切含义**：`vite dev` + 左下角那条调试条。
`vite.config.js` 写得很清楚 —— 曾有过 `VITE_DEV_TOOLS=1 vite build` 产「带调试条的成品」
那条通道，已随离线通道移除；现在调试条**专属于 `vite dev`**，
`__DEV_TOOLS__` 在 `vite build` 下是字面量 false，`DEV_TOOLS && <DevBar/>` 被整支摇掉。

所以不必另造一个游离的试听页。`audio-src/audition.html` 仍在，但它只播**文件**（`<audio>` 元素），
不走站点的播放链 —— 拿它检查「页面上的音效」是不准的。把能力加在 DevBar 上，正式产物零代价。

### 16.2 加了什么

| 控件 | 作用 |
|---|---|
| 屏息 / 雾散 / 丝绢 / 颂钵 | **逐个试听**。这是这个区的全部理由 —— 四个音在正式站点里只随仪式出现一次、间隔 3.7s，想反复听某一拍就得反复走完整场抽牌 |
| 连播四拍 | 按仪式的真实间隔连播，时刻**直接取 `DRAW_BEATS`**（不手写数字，免得与仪式漂移） |
| 循环 | 连播完自动重来，反复检查用 |
| 素材 / 合成 | **A/B 切换**：`forceSynth` 钩子让同一个音在两条实现之间切，共用同一个 ctx / 总线 / 混响 |

### 16.3 三个不可省的细节（缺一个就会听到错误的结论）

1. **必须等素材就绪再播。** 素材是**逐音异步** fetch+decode 的，点下去就播 → 落回合成路
   →「你以为在检查 AI 素材，其实在听合成音」。做法：播放前先 await 该音进入 `__tarotSfx.loaded`
   （超时也放行 —— 宁可响一个合成音，也不要点了没反应）。
2. **预热要抢在第一次播放之前。** 监听页面上的**第一次 `pointerdown`（capture）**就 `unlock()`，
   它会在手势栈里派发 `tarot:audio-ready` → sfx 开始预载。实测第一次播放的素材等待因此降到 **102ms**。
3. **A/B 必须在同一条链路上。** 分两个页面各听一遍不算对比 —— 中间隔着不同的 ctx / 总线 / 混响，
   听出来的差异说不清是素材的还是链路的。

另外：点这里的任何一个音 = 用户要听，所以顺手把开关打开（音效标志位 + 总线取消静音），
但**不启环境音**（底下垫一层 BGM 只会让判断更难做）。
左上角那个开关靠 `tarot:sound-changed` 事件同步 —— **否则会出现「左上角显示声音关、而音效实际在响」**，
两个控件各说一套比不显示还糟。（正式产物里 DevBar 被摇掉，这个监听退化成空转订阅。）

### 16.4 新的 `probe-devbar-sfx`（11 条判据，只在 dev 上有意义）

见 §表格里的那一行。⚠️ **它必须能红** —— 在 prod 上跑它是**预期失败**（`.devbar` 不存在），
这正是「这条判据是活的」的证据。实测 prod `ALL_PASS=false` ✓。

### 16.5 验收

| 项 | 结果 |
|---|---|
| `probe-devbar-sfx` dev 1582×804 | **ALL_PASS true（11/11）** — 素材等待 102ms、四音 `kinds` 全 `asset`、A/B 真的 `asset↔synth`、`abState=["素材:高亮","合成:-"]` |
| 同上 矮视口 1280×620 | **ALL_PASS true** — 调试条 431px 高，y 77→508，仍在视口内 |
| 回归 | `probe-sfx` / `probe-sfx-off` / `probe-ambient` ALL_PASS · `audit-title` 4/4 · `audit-draw` 8 条 ok · `audit-motion` / `reveal` / `share` 正常 · `probe-gallery` ALL_PASS 9/9 |
| `dev-verify` 命中测试 | 调试条长到 431px 后，「再抽一次」「生成分享卡片」「重播迎接」三条 `coveredByDevbar` **全 false**、`clickable` 全 true（这个元素历史上真挡住过「再抽一次」） |
| `vite build` | ✓ 4.85s，产物里 `devbar` / `连播四拍` / `屏息` / `颂钵` **零命中**；`setForceSynth` / `isForceSynth` 也被摇掉，只剩 `__tarotSfx` getter 里一个 `forceSynth` 字段 |

### 16.6 顺手清掉一条「永远为空、又永远不报警」的判据

`dev-verify` 的 ⑥ 段还在找调试条里**早已被删掉的**「牌面总览」按钮：
`btnByText` 返回 undefined、`?.click()` 是空操作 → `gallery.items` 永远是 0、`openedMs` 永远是 null，
而报告里**没有任何字段会因此变红**。

图鉴这一轮对用户开放了（入口在顶栏「牌之图鉴」），它不再是「开发模式专属」的功能，
验证归属 `probe-gallery`（实测 ALL_PASS 9/9）。已把该段移出 `dev-verify`，
并把 `PROJECT_STATE.md` 里那条「产物不该含 `CardGallery`」的旧断言一并更正 ——
被摇掉的只有 `DevBar`，图鉴本来就该在正式产物里。


## 17 · 2026-09-21 第二十六轮：替换被否决的 charge / burst（ElevenLabs 通道）

用户原话：「抽牌阶段的前两个音效还是不对劲……点击球的那个屏息听起来像雷云滚滚……
雾散听起来就像电饭煲烧开了……修改的风格尽量要偏向于给人心情安定的那种感觉……
可以用 ElevenLabs 来生成音效」。

诊断与提示词重写见 §5dd87da / §b88db18 两条提交；本节只记**通道落地时踩的两个坑**。

### 17.1 ⚠️ 端点：文档页名 ≠ REST 路径（会误判成 key 问题）

| 写法 | 结果 |
|---|---|
| `POST /v1/text-to-sound-effects/convert` | **404** `{"detail":"Not Found"}` |
| `POST /v1/sound-generation` | ✅ 正确（无 key 时回 401，可用来判定路径对不对） |

混淆来源：官方文档**页面 URL** 是 `/docs/api-reference/text-to-sound-effects/convert`，
Python SDK 的方法名也叫 `text_to_sound_effects.convert`，但**真实 REST 端点**是
`/v1/sound-generation`（`eleven_text_to_sound_v2` 模型）。已修进 `gen-sfx-elevenlabs.py` 并加注释。

> 排查手法可复用：拿 `-d '{}'` 空 body 打一次，**401 = 路径对（只是没鉴权）**，
> **404 = 路径错**。这样不必烧额度就能定位端点。

### 17.2 ★ 当前卡点：key 缺 `sound_generation` 权限

用户给的 key（`sk_1684…58b9`）**本身有效**（`/v1/text-to-sound-effects/convert` 回 401、
`/v1/user` 回 401 但原因是 `missing the permission user_read` —— 说明是**受限 key**），
但打生成端点报：

```
HTTP 401  authentication_error / missing_permissions
"The API key you used is missing the permission sound_generation to execute this operation."
```

**处置（需要用户在浏览器里操作，代码侧无法绕过）**：
1. 打开 https://elevenlabs.io/app/settings/api-keys
2. 编辑密钥 `sk_1684…58b9`（或新建一个），在权限勾选里**打开 Sound Effects**（即 `sound_generation`）
   — 这个 key 显然是按最小权限建的，要逐项授权
3. 存好后再跑：`python scripts/gen-sfx-elevenlabs.py --only charge burst`
   （key 已写在 `.env.local`，脚本自动读，**无需再动任何配置**）

顺带：如果把 `user` / `user_read` 也勾上，就能看到套餐与剩余额度（`/v1/user`）。
**商用授权注意**：免费层（$0/月，10k credits）含 Sound Effects，但**商用授权要 Starter（$6/月）起**。

### 17.3 网络：生成长请求偶发被掐断（已加重试）

首次调用报 `SSL: UNEXPECTED_EOF_WHILE_READING`。实测同刻 `curl` 打同一域名是通的
（空 body → 401，t=2.9s），所以不是墙、也不是 key —— 是**生成请求要跑十几秒、连接被中途掐断**。
已在 `generate()` 里加 **3 次重试（2s/4s 退避）+ `Connection: close`**；
401/402/403/422 这类**确定性**错误不重试，直接抛带处置建议的信息。

### 17.4 四个坑，其中两个是**方法论级的**（2026-09-21 续完）

权限打开后一路跑通，但过程中撞出四件事。前两件属于「以后还会遇到」的：

**★ 坑一：直连 ElevenLabs 写中文提示词基本等于随机。**
同一份内容、同一时长，四个中文变体（influence 0.3 / 0.7）**全部**产出高频嘶声 ——
质心 **5846~7681Hz**、4kHz 以上占 **48~60%**；换成英文立刻落到目标区间
（burst 1254Hz、charge 140Hz）。
⚠️ **所以「写中文比写英文好」只对 AiSounds 那个壳成立** —— 它中间挂了一层 DeepSeek。
我们直连 API，没有那层。
**教训：换通道时，上一通道的「提示词经验」不能直接搬 —— 那可能是壳带来的，不是模型的。**

**★ 坑二：长负面清单 + 高 influence 会把「禁止的东西」渲染出来。**
同一份 373 字中文稿：influence 0.7 → charge 质心 1708Hz；抬到 0.85 → **5935Hz**。
理由直白：稿子里「不要嘶声 / 不要风啸 / 不要白噪声」是**一长串声学名词**，
高 influence 下模型努力贴近文本 → **被点名的东西反而出现了**。
→ 与第二十五轮「正面描述的声学名词会被逐字实现」是同一件事的两面：
**点名什么就来什么，写「不要」也算点名。** 现在一律**短稿、只做正面描述**。

**坑三：`text` 有 450 字符硬上限**（英文 803 字符实测被 400 拒，`text_too_long`）。
已在客户端拦一道，免得烧一次请求才发现。

**坑四（最有价值）：指标合格 ≠ 听感合格 —— 频谱全绿但「手势」是错的。**
三条 charge 候选**频谱判据全绿**，可包络在结尾塌到了 -22.5 / -11.9 / -9.1dB，
而节拍表里 burst 的 `at=1000ms` **正好是 charge 的结束点** ——
等于「蓄势蓄到自己先静了，两拍之间露出空档」。
→ 补了 `env_tail_db`（末段 1/8 相对峰值，下限 -6dB）并**做了反向验证**
（那三条必须判红、旧 charge 的手势 -2.6dB 必须判绿；实测两条维度互相独立：
`en-180` 频谱绿/包络红、`en-0.7` 频谱红/包络绿 —— 证明它不冗余）。
→ 选出 `flat-200`：质心 363Hz、次低频 1.7%、**尾段 -1.2dB**。
**方法论：指标能证明「不吵、不闷」，证明不了「这条音的手势对不对」。**
改的时候要**先锁手势、再修频谱，一次只动一个变量**。

### 17.5 另一笔旧账：判据里的期望值不许手抄（已修）

`probe-sfx.js` 里写着 `CONTRACT_DUR = {charge:1.0, burst:1.0, flip:0.82, reveal:4.0}` ——
那四个数**不是契约，是从当时的产物量出来的**（`burst:1.0` 的来历是 AiSounds
只支持整数秒）。而 `burst` 的合同时长在项目里**同时存在三个数**：
README 与 `build-sfx.py` 的 `SPECS.target` 写 **1.5s**、`JOBS` 写 1.2s、探针写 1.0s。
换成 ElevenLabs（支持小数秒）按契约生成到 1.5s 后，探针立刻**假红** ——
代码、产物、契约其实都是对的。

→ 三处统一到 **1.5s**；探针的期望值改成**由产出方写出**：
`build-sfx.py` 落 `scripts/out/_sfx_expect.js`，`run-flows.mjs` 贴在 flow 前面注入。
判据变成「浏览器拿到的 == 流水线刚产出的」，**这才是「dist 里是不是旧文件」的真判据**。
反向验证做过：把期望值改错 → 立刻红，并能点名是哪个音漂了（`burst 时长 1.515s vs 流水线 1.3s`）。
另把「不超拍」单列为硬约束（超了会撞下一拍），而「短于契约」只作信息记录 ——
`flip` / `reveal` 短于契约是用户已接受的，判红等于制造一条**永远红**的判据。

**通用规则：判据的期望值必须来自产出方。手抄在判据里一定会随产物过期，而且过期是静默的。**

### 17.6 验收（全部通过）

| 项 | 结果 |
|---|---|
| 生成端 | charge `flat-200` 与 burst `L15-400` 对 `TARGETS` **全绿** |
| `build-sfx.py --force` | **ALL_PASS true**；响度偏离 charge 0.6 / burst 0.6 / flip 0.4 / reveal 0.7 dB；charge 纯限幅零削顶 |
| 成品实测 | charge 1.045s / -17.1dB / -12.0dBFS · burst **1.515s** / -16.1dB / -3.3dBFS |
| `probe-sfx` dev | **ALL_PASS（17 条）**，`sfxStatsDrift` 空、`sfxOverContract` 空 |
| `probe-sfx` prod(4199) | **ALL_PASS**，抓到的正是新哈希资源 `burst-CcC0X5pC.mp3` / `charge-BUC3WM8E.mp3` |
| 回归 | `probe-sfx-off` / `probe-ambient` / `probe-devbar-sfx` / `audit-title` / `audit-draw` 全过，`"pass":false` 零命中 |
| `vite build` | ✓ 7.82s；产物里 `devbar` / `连播四拍` / `屏息` / `setForceSynth` **零命中** |

### 17.7 剩下的一步：**用户用耳朵拍板**

指标能说明「不吵、不闷、手势对」，**说明不了「像不像这一场占卜该有的声音」**。
候选对比页：`audio-src/candidates/index.html`（23 条候选，含被否决的旧版作对照，
数字由指标文件生成、不手抄）。用 DevBar 或该页试听后，若要换：
改 `scripts/_make_candidate_page.py` 的 `CHOSEN` → 拷进 `_raw/` → 重跑 `build-sfx.py`。

已知可调的一处取舍：charge 现在走 `100Hz×1` 轻量高通，**偏「厚」**；
若觉得太闷，把 `SPECS.charge` 改回 `'hpf': 240, 'passes': 2` 重跑即可 ——
那是耳朵的活，不是指标的活。



