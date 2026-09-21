# 今夜一签 · 塔罗日签

一个轻量的塔罗每日一签网站。首页即占卜场景：巫师手捧水晶球，点击水晶球抽出一张牌。

## 技术栈

Vite + React 18 + Tailwind CSS 4 + Framer Motion，**零后端**，抽牌记录存在浏览器本地。

## 运行

```bash
npm install
npm run dev      # 开发预览 http://127.0.0.1:5173（左下角带调试条）
npm run build    # 生产构建 → dist/（绝对路径，正式发布用）
npm run preview  # 本地 http 预览 dist/，即「用户视角」：无调试条、无牌面总览
```

### 桌面快捷方式（日常看效果用这个）

桌面上有一个 `塔罗日签.lnk`（图标取自牌背素材），双击即可：

1. 源码比 `dist/` 新时自动重新构建（直接调 vite，不走 npm —— 本机 npm 会拉起 wsl.exe 被拦）；
2. 起本地 http 服务（默认 5180，**带 Range 支持**，音频才能拖动进度条）并打开浏览器；
3. 重复双击不会叠出一堆服务：会先扫端口段找已在运行的那个，直接复用并开页面；
4. 关掉那个黑窗口 = 停止服务。

相关文件与脚本：

- `start-tarot.cmd` —— 纯 ASCII 的包装层（`.cmd` 按 ANSI 读，混中文会乱码，所以中文提示都由 node 打印），
  负责按「已知路径 → 通配扫 `.workbuddy` 托管目录 → 系统 `Program Files`」的顺序找到 node；
- `scripts/launch_preview.mjs` —— 启动器本体，参数 `--port 5180` / `--no-open` / `--no-build` / `--force-build`；
- `scripts/make_launch_shortcut.py` —— 生成图标与快捷方式；`--verify` 用 Windows 的 `IShellLink`
  把 lnk 读回来校验，`--run` 交给 Shell 打开（等价双击）。

> 手写 `.lnk` 字节流的坑（2026-09-21 实测）：不调 COM 自己拼字节也能让 `IShellLink::Load` 读出
> description/工作目录/参数/图标，**但缺 `LinkTargetIDList`，`ShellExecute` 双击会报
> `WinError 1155 没有应用程序与此操作的指定文件有关联`**（旁边用 txt 做对照可确认是 lnk 的问题、
> 不是环境没 shell）。正解是 `IShellLink::SetPath` + `IPersistFile::Save` 让系统自己写
>（`SetPath` 会生成目标 IDList）；此时 `GetPath` 能读回 target 才算真的可用。
> 本机 PowerShell 的 COM 实例化被安全策略拦，但 Python `ctypes` 调 `ole32` 是通的。

> **本项目只走 http**（2026-09-19 v2 起）。原先那套「双击 `.cmd` / 双击 `dist-user/index.html`
> 免服务器直看」的离线通道已整体移除 —— 起因是 v2 要上真 3D，而 `file://` 下本地图片
> **不能当 WebGL 纹理**（实测 `SecurityError: image element contains cross-origin data`），
> 离线副本与新主视觉无法共存。v1 的离线副本仍完整保留在冻结快照 `_archive/v1-2026-09-19/` 里。
>
> 素材基址跟随 Vite 的 `base`（源码见 `src/config/skin.js` 的 `BASE`），
> 所以用 `vite build --base ./` 构建的产物也能丢到服务器任意子目录。

## 目录结构

```
tarot-app/
├─ scripts/                      素材流水线与开发工具（详见下文「全部脚本」）
├─ public/skins/<皮肤名>/        美术素材（按皮肤分目录，换风格就换这里）
│   ├─ hero-bg.webp              背景层（已就位：v2 无球版，巫师双手托举、掌心留空）
│   ├─ hero-figure.webp          巫师人物层（透明底，未做，架构上可选）
│   ├─ hero-orb.webp             水晶球层（透明底，已就位）
│   ├─ card-back.webp            牌背（已就位）
│   ├─ frame.webp                统一卡框（22 张共用，已就位）
│   └─ cards/major-00.webp …     22 张大阿卡纳牌面（全部就位）
├─ src/config/skin.js            皮肤名、素材槽位、主视觉底板与锚点、卡框几何、动画时序
├─ src/config/lqip.js            首屏主视觉占位图（内联 data URI，脚本生成）
├─ src/data/cards.js             22 张大阿卡纳文案（名称 / 关键词 / 牌意 / **今日建议 3~5 条**）
│                                今日建议是「抽到才揭晓」：抽牌那一刻随机取一条连同牌号一起落盘，
│                                **牌之图鉴里看不到任何一条**（`CardDetail` 由「进来时的门」决定露不露）
├─ src/utils/shareCard.js        分享卡片图（Canvas 复刻牌面三层 + 竖版排版）
├─ src/utils/prefetch.js         牌面空闲预热
├─ src/hooks/useDrawState.js     抽牌记录（unlimited / daily 两种模式）
├─ src/hooks/useAssetUrl.js      素材多格式探测（webp → png）
├─ src/audio/                    声音：BGM 与四个音效，**都是 AI 素材、合成兜底**
│   ├─ engine.js                 底座：ctx / 总线 / 程序化厅堂混响 / 包络工具
│   ├─ autostart.js              「缺省开」的兑现：第一次用户手势里 unlock + 起 BGM
│   │                            （浏览器不允许非手势启动 AudioContext，所以缺省开 ≠ 一打开就出声）
│   ├─ ambient.js                环境音（`assets/audio/ambient-loop.mp3` 60s 无缝循环）
│   └─ sfx.js                    四个音效（蓄势 / 释放 / 翻牌 / 揭晓），素材 + 合成兜底
├─ src/components/               场景分层组件
│   ├─ EnvelopeWelcome.jsx       迎接动画：全屏斜置的信封开启（纯代码绘制）
│   ├─ HeroStage.jsx             主视觉底板：背景层 + 人物层 + 水晶球（图像坐标系）
│   ├─ MistLayer.jsx             雾气层
│   ├─ ParticleField.jsx         Canvas 星屑粒子
│   ├─ CrystalOrb.jsx            水晶球（即抽牌按钮）
│   ├─ CardReveal.jsx            抽牌 + 3D 翻牌
│   ├─ CardFace.jsx              牌面三层（插画 / 卡框 / 文字），抽牌与总览共用
│   ├─ SmartImage.jsx            图片多格式回退
│   ├─ CardGallery.jsx           牌面图鉴（**用户可开**，入口在顶栏「牌之图鉴」）
│   ├─ CardDetail.jsx            完整解读覆盖层（从图鉴或解读面板进来）
│   ├─ ReadingPanel.jsx          牌意解读面板
│   ├─ ShareDialog.jsx           分享卡片图弹窗
│   ├─ SoundToggle.jsx           声音开关：**喇叭图标**，左上角品牌下方。
│   │                            缺省开，真正起播在第一次用户手势里（`src/audio/autostart.js`）
│   └─ DevBar.jsx                开发调试条
└─ src/index.css                 主题变量 + 全部视觉样式
```


## 牌面是怎么组成的

一张牌 = **三层**，自下而上：

1. **插画层** `cards/<牌号>.webp`(或 .png) —— 只有画面，**不含任何文字与边框**
2. **卡框层** `frame.webp` —— 22 张共用同一张透明底素材，边框因此绝对统一
3. **文字层** 罗马数字 + 牌名 —— 由代码渲染，随时可换字体 / 语言 / 大小

这么分层的意义：AI 出图容易把文字画糊、把边框画歪；把边框和文字交给代码，22 张的一致性就有了保证，将来想换边框样式也只换一张图。

生成插画时的提示词请务必带上「画面中不能出现任何文字、字母、数字、签名或水印」，出图后用 `scripts/build_card_assets.py` 统一裁掉底部水印边缘并压成 WebP。

## 怎么换风格（这是重点）

代码只引用「槽位名」，从不引用具体美术文件，所以换风格不需要改任何组件：

1. 在 `public/skins/` 下新建一个目录，比如 `paper-ink/`
2. 按**完全相同的文件名**把新素材放进去（`hero-bg.webp`、`hero-orb.webp`、`card-back.webp`、`frame.webp`、`cards/major-00.webp` …）。**`.webp` 与 `.png` 都支持**，同名的 .webp 优先
3. 打开 `src/config/skin.js`，把 `SKIN` 改成 `'paper-ink'`；如果新构图的球位置不同，改 `ANCHORS.orb`（见下节）；**如果换了卡框素材**，跑一次 `build_card_assets.py`，把它打印出来的 `CARD_ASPECT` / `FRAME_INSET` / `CARD_BODY_CLIP` / `CARD_PAPER` 四个值贴回 `skin.js`

愿意的话还可以在 `src/index.css` 顶部的 `:root` 里调整 `--glow`（光晕色）、`--mist-alpha`（雾浓度）、`--gold`（点缀色）、字体变量，让 UI 文字与新素材的色调一致。

**任何一层素材缺失都不会报错**：水晶球会退化成代码绘制的球体，牌背会退化成 CSS 几何花纹，牌面插画会退化成程序化渐变底 + 代码绘制的符号，卡框会退化成 CSS 描边框，背景会退化成程序化渐变。所以拆层素材可以分步补齐，先跑通流程再逐步替换。

### ⚠️ 两条必须遵守的约束

**① 主视觉与所有拆层素材必须「同帧」** —— 同样的宽高比（3:2）、同样的构图。
因为叠层靠百分比对齐：一旦某层画布比例不同，球就会跑偏。

**② 锚点有两套坐标系，不要混用**（都在 `src/config/skin.js` 的 `ANCHORS`）：

| 锚点 | 坐标系 | 单位 | 用在哪 |
|---|---|---|---|
| `ANCHORS.orb` | **图像坐标系** | `x`/`y` 是主视觉画布的百分比；`size` 是画布**高度**的百分比 | 只能用在 `.hero-frame` 内部 |
| `ANCHORS.stage` | **视口坐标系** | 视口百分比 | 牌面落点 |

背景**不能**用 `background-size: cover` 渲染 —— `cover` 会按视口比例裁剪缩放图像，
叠层百分比就和图像百分比对不上了（实测 16:9 下球会偏 +6.5% 画高、直径小 11vmin）。
现在就放在一块固定 3:2 的底板 `.hero-frame` 里，图像 1:1 铺满不裁剪，底板内部天然就是图像坐标系。

改完锚点想快速看效果，跑 `"$PY" scripts/preview_hero.py`（不需要浏览器，直接在 Python 里复现底板的定位数学合成预览）。


## 牌面素材流水线

```bash
"C:/Users/29923/.workbuddy/binaries/python/envs/default/Scripts/python.exe" scripts/build_card_assets.py
```

做六件事：① 抹掉浅色材质上的半透明白水印（形态学开运算）② 卡框抠出透明开口并按内容裁边 ③ **把卡框外圈的透明死区填成纸色**，让卡框成为不透光的实心矩形（详见下条）④ 量出插画窗口与卡片本体的几何比例，打印成可直接粘进 `skin.js` 的常量 ⑤ 牌面按卡框比例裁切、**自适应裁掉四边残留的浅色边带**、压成 WebP ⑥ 合成「插画 + 卡框 + 文字」成品预览图。

跑完后建议立刻跑一次验收：

```bash
"$PY" scripts/verify_card_assets.py
```

它检查两件最容易翻车的事：卡框四边有没有「真透明」的洞（有洞 = 卡面底色会从外缘漏出来，视觉上就是一圈黑边），以及 22 张牌面四条边有没有残留的浅色边带。全部为 0 才算通过。

### 关于卡框的「透明死区」（2026-09-18 踩过的坑）

原图里卡片本体四周留了一圈白底，右下角的吊牌挂在这圈留白里。抠图后这圈留白变成透明，
而裁边用的是「卡片 + 吊牌」共同决定的外框，所以留白被保留了下来，成为卡框素材的透明外边距
（吊牌形态下实测：上 0 / 左 5 / 右 14 / 下 36 px @768 宽）。于是**卡框不画、插画又按裁切比例不画的那一带，
漏出的就是卡面的兜底底色** —— 22 张牌全部中招，看起来就是「半成品黑边」。
（2026-09-18 去掉吊牌后，卡牌裁到卡片本体，这圈外边距已不复存在；`fill_outer_margin()` 仍保留作为保险丝。）

现在由脚本的 `fill_outer_margin()` 在素材层根治：把「与画布四边连通的透明区」泛洪填成纸色
（中央插画开口是封闭区域，泛洪到不了，不受影响），卡框从此是「实心矩形 + 中央开窗」。
实测全图真透明占比 65.8%，正好等于插画窗口面积，外沿零空洞。
纸色由脚本实测并打印为 `CARD_PAPER`，`src/config/skin.js` 里同名常量与 `--card-paper` 变量必须与之一致。

### 关于卡牌右下角的吊牌（2026-09-18 已去掉）

卡框原设计的右下角挂着一个吊牌，吊绳贴着右边下来、吊牌本体还压在卡片本体内部。
把外圈填成纸色之后，吊牌从「悬空挂在星空上」变成「趴在纸色衬底上」，反而更别扭。
用户决定先去掉它、把卡牌收成一个干净的矩形，装饰性外挂元素等项目跑通后再议。

脚本现在固定做两件事（`CROP_TO_CARD_BODY` / `REMOVE_TAG`，都默认开）：

1. **裁到卡片本体**：`card_body_rect()` 逐行逐列取最外侧不透明像素，只统计中段条带再取中位数，
   这样被吊牌撑出去的那几行不会把边界框带偏。结果 960×1403，即现在的 `CARD_ASPECT`
2. **镜像补图**：吊牌与吊绳有一部分压在卡体内部，光裁不够。卡框左右镜像对称
   （除左侧宝石与右下吊牌外实测左右一致），所以拿**左侧镜像位置**的内容翻转贴过去，
   接缝做 6px 羽化

想回到带吊牌的旧形态，把 `CROP_TO_CARD_BODY` 置 `False`，再把 `skin.js` 的三个几何值
换回旧值（`986 / 1496` 那一组，脚本注释里有）即可。

## 动画时序

全部时序参数集中在 `src/config/skin.js` 的 `TIMING` 里，可整体调快调慢。三段互不阻塞。

### ① 迎接动画 · 信封开启（`TIMING.welcome` = 2700ms）

进页面覆盖**整个视口**的「信封开启」。构图是**斜置的特写**：信封不是正着摆在页面中央的小物件，
而是**一张铺满全屏的、倾斜 15° 的纸**，相机贴得很近、焦点落在那道开口上（详见下一节）。

| 时刻 | 动作 |
|---|---|
| 0 | 信封自暗场浮现（0.85s） |
| 0.78s | 火漆封印亮起 |
| 1.12s | 封印碎裂、微闪 |
| 1.24s | 上翻盖 `rotateX(-142°)` 翻起（0.6s），内腔与封口暖光露出 |
| 1.28s / 1.36s | 开口涌出暖光 / 星屑升起 |
| 2.1s | 信封朝镜头推近、化进暗场（0.34s）——**「完全打开」这一帧刻意留 0.26s** 供看清 |
| 2.28s | 交卸闪光 |
| 2.3s | 暗场退去，露出场景 |
| 2.62s | 组件卸载 |

任意点击 / 按键可快进收尾（开头 0.26s 内的点击不算，免得「点窗口获得焦点」把动画吃掉）。
`WELCOME.enabled` 一键关，`WELCOME.skipWhenDrawn` 让「今日已抽」不播放，`prefers-reduced-motion: reduce` 强制关。

### ② 场景入场（`TIMING.entrance` = 2.6s）+ ③ 常驻循环

- `0 – 2.6s` 入场：雾气自中央散开，背景由模糊放大逐渐聚焦。水晶球在这一段结束后才可点
- `2.6s 起` 常驻循环：雾气带漂移、球内星云流转、呼吸发光、光环脉冲、粒子上升
- 点击水晶球：球体爆闪 → 牌自球心升起 → 3D 翻牌 → 解读面板上滑

**迎接动画与场景入场并行**，所以加了它也不会让「可抽牌」的时机变晚。

### 信封的相机与分层（改构图前必读）

大特写的关键是**把「相机」和「被拍的东西」拆成两层**——否则一改角度整个信封就跟着飘：

| 层 | 职责 | 关键约束 |
|---|---|---|
| `.welcome__stage` | 提供相机 **透视** | `perspective: max(170vw, 232vh)`。**`perspective` 只作用于直接子元素**，所以它必须是 `.env-cam` 的直接父级 |
| `.env-cam` | 信封在世界里的姿态：斜角 / 前倾 / 尺寸 / 位置 | `rotateZ(-15deg) rotateX(-9deg)`；宽 `max(136vw, 186vh)`（手机 `max(200vw, 200vh)`）。**这一层绝对不能再挂 `opacity` / `filter` / `clip-path`** |
| `.env-in` / `.env` | 入退场淡入淡出、内部零件 | `.env__flap-slot` 自己再挂一份 `perspective` |

三条硬约束：

1. **`perspective` 只影响直接子元素** —— 挂错层 = 3D 全部失效
2. **`opacity` / `filter` / `clip-path` 是 grouping property**，出现在透视元素**自己**身上会把它的整棵子树压平成 2D。所以 `.env-cam` 必须干净
3. **透视值要跟着信封尺寸走**，不能写死 `900px`。信封放大到满屏后，固定值 = 极端畸变；用 `max(170vw, 232vh)` 才随视口一起缩放

### 大特写的明度关系（不然整个屏幕是一坨米色）

纸铺满全屏之后，「信」的立体感全靠**明度差**撑，别指望轮廓线：

- **本体要比上翻盖暗**（`#e9dcc2 → #c9b998` vs 翻盖 `#fdf7ea → #e5d9bd`）——「一片纸盖在另一片纸上」的层次
- **内腔要真的暗**（`#6a5436 → #120c06`）——亮起来就变成「贴着张深色纸」，暗下去才有深度
- **开场光晕不能上 `mix-blend-mode: screen`** —— 纸本来就很亮，screen 会把整屏米白洗成灰紫。用普通 alpha 叠加 + 以腔口为圆心的径向渐变（中心约 30% 高、半径还没到四角就衰减到 0）

## 迎接动画的开关与自检

- 调试条（仅开发模式）的**「重播迎接」**只重挂信封那层，不动抽牌状态
- `scripts/flows/welcome.js` 是回归自检：断言**信封铺满视口**（矩形 ≤ 0 / ≥ vw,vh）、相机层是 `matrix3d`、`perspective` 挂在正确层级、`.env-cam` 与 `.env__flap-slot` 上没有 grouping 属性、内腔与翻盖同形、动画结束后遮罩卸载干净、水晶球可点击
- `scripts/flows/welcome-frame.js` 按**动画状态**（封印不透明度 / 翻盖 `cosθ`）等待，再交给 `shot.mjs` 截图 —— 用 `--wait` 猜时间点会差出整整一拍（取帧目标写在 URL hash，见「全部脚本」）

## 抽牌模式

- `DRAW_MODE = 'daily'`：正式上线用，一天锁一次，刷新仍是同一张牌（**当前默认**）
- `DRAW_MODE = 'unlimited'`：开发测试用，可反复抽

两种模式都写在 `src/config/skin.js` 顶部，改一个字符串即可切换，组件代码无需改动。

开发模式下左下角有调试条，可以实时切换两种模式、重置今日记录，还能打开**牌面总览**一次看到 22 张牌面（用于核对边框是否统一、哪些牌还缺插画）。

## 待办

剩余工作看 **`NEXT_STEPS.md`**（含优先级、具体做法、成本与踩坑提醒）。当前最高优先级：

- [ ] 发布为在线链接（纯静态站；把 `index.html` 里的 `og:image` / `og:url` 换成线上绝对地址）
- [ ] 本机日历回顾页（按日期翻看抽过的牌）
- [ ] 移动端竖构图主视觉（9:16；当前 3:2 底板在手机上靠裁切过渡，够用但不精致）
- [ ] 可选：`hero-figure.webp` 独立人物层、LLM 生成解读、无障碍（键盘 / 读屏）优化

已完成：

- **22 张大阿卡纳牌面插画 + 统一卡框**（`assets/previews/contact-sheet-framed.png` 可一次核对全部 22 张）
- **三张拆层素材**：`hero-bg.webp`（无球主视觉）、`hero-orb.webp`（透明底水晶球）、`card-back.webp`（牌背）
- **分享卡片图**：Canvas 复刻牌面三层，竖版 1080×1920 导出
- **迎接动画**：进页面播放「信封开启」——**全屏、斜置、贴近开口的大特写**，纯代码绘制，风格与站点一致；
  可点击跳过、可一键关闭、可在「今日已抽」时自动不播
- **上线前收尾**：og / twitter 分享 meta、首屏主视觉预加载、牌面空闲预热、`DRAW_MODE` 已切 `'daily'`

## 全部脚本

```bash
PY="C:/Users/29923/.workbuddy/binaries/python/envs/default/Scripts/python.exe"

# 美术流水线：读 assets/ 下的原图 → 产出 public/ 下的成品
"$PY" scripts/build_card_assets.py       # 牌面：去水印 + 抠卡框 + 裁切 + 导出 WebP + 合成预览
"$PY" scripts/build_hero_assets.py       # 主视觉三件套：hero-bg / hero-orb（自动抠白底）/ card-back
"$PY" scripts/build_lqip.py              # 生成首屏占位图（LQIP），写入 src/config/lqip.js
"$PY" scripts/build_og_cover.py          # 合成 1200×630 社交分享封面 public/og-cover.jpg

# 核对 / 打包
"$PY" scripts/verify_card_assets.py      # 验收：卡框是否有透明洞 + 22 张牌面是否有残留浅色边带
"$PY" scripts/contact_sheet.py           # 22 张原始插画总览
"$PY" scripts/preview_hero.py            # 不开浏览器，纯 Python 复现底板定位数学，合成主视觉预览
"$PY" scripts/package_project.py         # 打包（--light 轻量包）

# git / 快照（2026-09-19 起）
git log --oneline                        # bb0ad52 = v1 基线
git tag -l                               # v1 / v2 —— v2 = 四个音效全部定稿那一版

# 校验快照 zip 解出来的目录是否完好（**两个包各核一次**）
node scripts/verify_manifest.mjs <目录>                                  # 代码包
node scripts/verify_manifest.mjs <目录> --manifest MANIFEST-art.sha256   # 素材包
# 冻结 / 演练（v3 定稿后照这个来）
"$PY" scripts/preflight_freeze_secrets.py                                # 先查密钥会不会被卷进包
"$PY" scripts/freeze_snapshot.py --label v3 --date <日期>
"$PY" scripts/verify_snapshot_restore.py --label v3 --date <日期>         # 换全新路径解出来真跑一遍

# 无头截图 QA（零依赖，直接驱动本机已装的 Chrome/Edge）
node scripts/shot.mjs http://127.0.0.1:5173/ assets/previews/screen.png --w 1600 --h 900 \
     --eval-file scripts/flows/reveal.js

# 抓迎接动画的某一帧：按动画状态等待再截图（别用 --wait 猜时刻）
node scripts/shot.mjs http://127.0.0.1:5173/#open assets/previews/welcome-open.png \
     --w 1600 --h 900 --eval-file scripts/flows/welcome-frame.js --gpu
```

新牌面插画丢进 `assets/card-art/<牌号>/`（目录里一张图即可，文件名随意），跑一次 `build_card_assets.py` 就会自动接进站点。
新的主视觉原图丢进 `assets/hero-art/{bg,orb,back}/`，跑 `build_hero_assets.py` 就会接进对应的皮肤目录。

`shot.mjs` 通过 CDP 驱动本机浏览器导航、执行一段页面内 JS、再截图，`scripts/flows/` 下有现成的自检流程：

- `reveal.js` —— 点水晶球 → 等翻牌 → 打印球的实测落点（占画布百分比）、各层素材的 `naturalWidth`、牌面文字，用来核对锚点是否偏了、素材有没有悄悄退化成 CSS 兜底
- `share.js` —— 走到分享弹窗 → 打印弹窗状态、预览图尺寸、导出体积、保存按钮是否可用
- `welcome.js` —— 迎接动画回归自检：断言信封铺满视口、相机层是 `matrix3d`、`perspective` 挂在直接父元素上、`.env-cam` / 翻盖槽位没有 grouping 属性、内腔与翻盖同形、动画结束后遮罩卸载干净、水晶球可点击
- `welcome-frame.js` —— 按**动画状态**等待某一帧再截图，抓信封大特写用它。
  要哪一帧写在 **URL hash** 里：`#sealed`（封印完好未翻）/ `#lift`（翻盖立起）/ `#open`（完全打开、暖光涌出）。
  它会先点一下调试条的「重播迎接」把动画时钟归零，**所以只能在开发模式下用**

`shot.mjs` 的常用参数：`--w/--h`（视口）、`--reduced`（开 `prefers-reduced-motion` 验降级）、
`--seed`（导航后跑一段 JS 再重导航，测「刷新即已抽」这类分支）、`--gpu`（见下）。

> ⚠️ **无头软件光栅化会静默丢图层**：默认的 `--disable-gpu` 下，超过约 2400px 的大元素上挂 `filter` 的 SVG
> 会整块不渲染 —— 信封上的火漆封印就这么「消失」过一次（DOM 尺寸、填充色、命中测试全都正常，只有截图上没有）。
> **核对大元素时加 `--gpu`**，否则你会去修一个根本不存在的 bug。

**改完任何视觉参数都应该先跑一次截图**，比肉眼猜快得多。这套工具是项目里第一次具备截图级验证能力，它当场抓出过一个「翻牌方向反了、动画结束后显示牌背」的 bug。
