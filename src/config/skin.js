/**
 * 皮肤与素材槽位配置
 * ---------------------------------------------------------------
 * 代码永远只引用「槽位名」，不引用具体美术文件。
 * 换风格时：新建 public/skins/<新皮肤名>/ 目录，按同样的文件名放入素材，
 * 然后把下面 SKIN 的值改掉即可 —— 组件代码零改动。
 */

/** 当前生效的皮肤名（对应 public/skins/ 下的目录名） */
export const SKIN = 'mist-night'

/**
 * 开发工具开关（构建期注入，见 vite.config.js 的 define）。
 *
 * 打开时页面左下角有调试条：切换不限次数 / 重置今日 / 重播迎接 / 牌面总览。
 *   本地开发（vite dev）            → 开
 *   正式构建（vite build）          → 关，连代码都被摇掉
 *   2026-09-19 起只剩这两种取值：产物只走 http，调试条专属于本地开发。
 *
 * 关掉时 `DEV_TOOLS` 在产物里是**字面量 false**，Rollup 据此把
 * `DEV_TOOLS && <DevBar/>` 整支分支摇掉（连组件代码都不残留）。
 *
 * 所以这里刻意**不写 `typeof` 兜底** —— 那会让表达式无法被静态折叠，摇不掉就从「少个调试条」
 * 退化成了「正式包里带着调试条」。符号由 vite.config.js 的 define 注入，
 * vite dev / vite build 都会带上；真没注入就让它直接 ReferenceError 更醒目。
 * `=== true` 是防呆：万一哪天 define 忘了 JSON.stringify、注入成字符串 'false'，
 * 字符串是 truthy 的，会把调试条带上正式包 —— 加这一层就只会得到 false。
 */
export const DEV_TOOLS = __DEV_TOOLS__ === true

/** 抽牌模式：'unlimited' 开发测试用（可反复抽） / 'daily' 正式上线用（一天锁一次） */
export const DRAW_MODE = 'daily'

/**
 * 页面打开时的初始模式。
 *
 * 本地开发（`vite dev`）默认就是「不限次数」—— 打开即可连抽，不用先去调试条上点一下；
 * 正式产物仍是 DRAW_MODE（一天锁一次）。
 */
export const INITIAL_MODE = DEV_TOOLS ? 'unlimited' : DRAW_MODE

/** 正式上线时把 DRAW_MODE 改成 'daily' 即可，其余代码无需改动 */
export const STORAGE_KEY = 'tarot-daily::draw-record'

/**
 * 素材基址。
 *
 * 取自 Vite 的 `base`：默认（`base: '/'`）为 `/`，产出的就是原来的 `/skins/...`；
 * 用 `vite build --base ./` 构建时变成 `./`，产出 `./skins/...`。
 *
 * 为什么必须跟随 base 而不能写死 `/`：写死的话产物里是 `/skins/...`，
 * 本地双击打开（file://）时会解析到**磁盘根目录** `file:///skins/...` → 图全挂。
 * 跟随 base 后，`--base ./` 的构建在 file:// 与「站点子目录」下都能正确解析。
 *
 * 注意：`import.meta.env` 在**构建期**就被替换成字符串字面量，
 * 产物里不会残留 `import.meta`，因此不影响把产物当普通经典脚本加载。
 */
const BASE = import.meta.env.BASE_URL

/**
 * 素材槽位：固定文件名，缺图时组件会自动降级为代码绘制。
 * 每个槽位给一组候选地址（按顺序探测），优先用压缩后的 .webp，
 * 其次回退到外部工具直接导出的 .png —— 导入素材时两种格式都能用。
 */
const slot = (name) => [`${BASE}skins/${SKIN}/${name}.webp`, `${BASE}skins/${SKIN}/${name}.png`]

export const ASSETS = {
  heroBg: slot('hero-bg'),
  heroFigure: slot('hero-figure'),
  heroOrb: slot('hero-orb'),
  cardBack: slot('card-back'),
  /** 统一卡框：22 张牌共用同一张透明底素材，保证边框绝对一致 */
  cardFrame: slot('frame'),
  cardFace: (cardId) => [
    `${BASE}skins/${SKIN}/cards/${cardId}.webp`,
    `${BASE}skins/${SKIN}/cards/${cardId}.png`
  ],
  /** 全 22 张牌面的候选地址列表（首屏空闲时按需预热用，见 src/utils/prefetch.js） */
  allCardFaces: (ids) => ids.map((id) => `${BASE}skins/${SKIN}/cards/${id}.webp`)
}

/* ==========================================================================
   主视觉底板（hero plate）
   --------------------------------------------------------------------------
   问题背景：主视觉是一张整图，上面还要叠「巫师人物层 / 水晶球层」等拆层素材。
   如果背景用 CSS 的 `background-size: cover` 渲染，图像会被按视口比例裁剪缩放，
   叠层用的百分比就和「图像自身的百分比」对不上（实测 16:9 视口下球心会偏 +6.5% 画高）。

   解法：把主视觉放进一块**固定 3:2、尺寸只由视口决定**的底板 `.hero-plate`，
   图像 1:1 铺满底板（不再裁剪），底板本身按 `HERO_LAYOUT.positionY` 对齐。
   于是底板内部就是纯粹的**图像坐标系**：x/y 直接写图像里的百分比，
   所有拆层素材只要和主视觉同帧（同样 3:2 画布、同样构图）就自动对齐。
   ========================================================================== */

/** 主视觉画布比例（拆层素材必须同帧：同样的宽高比、同样的构图） */
export const HERO_FRAME = { width: 1536, height: 1024 }

/** 底板的摆放方式，对应原来的 `inset: -2%` + `background-position: center 30%` */
export const HERO_LAYOUT = {
  /** 上下各外扩的比例，避免呼吸缩放动画时露出底板边缘 */
  bleed: 2,
  /** 纵向对齐点：0 = 图像顶部贴齐，50 = 居中，30 = 原来的 `center 30%` */
  positionY: 30
}

/**
 * 锚点
 *  - `orb` 用的是**图像坐标系**（占主视觉画布的百分比），只能用在 `.hero-frame` 内部。
 *    `size` 是球直径占画布**高度**的百分比（底板内 1cqh = 画布高的 1%）。
 *    当前值由实测量出：掌心辉光中心 (49.98%, 66.4%)，双手窝出的可用圆直径约画布高的 31%
 *    （再大就会把两只手的手指几乎全盖住，反而看不出「捧」的姿态）。
 *  - `stage` 用的是**视口坐标系**，牌面落点仍按视口定位。
 */
export const ANCHORS = {
  orb: { x: 50, y: 61.5, size: 31 },
  /**
   * 牌面落点（视口坐标系）。
   *
   * 2026-09-18 手感升级：从 44 上移到 38.5。原来卡牌 48vh 占 20%→68%，
   * 而解读面板顶边在 66.4% —— **面板会压住卡牌 12.7px**（实测），牌面下框带被啃掉一条。
   * 现在卡高收到 46vh、落点上移到 38.5，牌占约 15.5%→61.5%，
   * 与面板顶边（66.4%）留出约 39px 净空，彻底不压。
   */
  stage: { x: 50, y: 38.5 }
}

/**
 * 牌的起手位置相对落点下移多少（视口高度百分比）—— 营造「自球心升起」的动势。
 * 2026-09-18：24 → 17。原来起点太远，牌在到达前有一段时间是「远处一个小点」；
 * 17% 更贴近球心，也缩短了无效行程。
 * 2026-09-19（抽牌仪式分拍）：17 → 19。升起之后插入了一拍「悬停」，
 * 行程更远 = 期盼更久，也让「停住」与「刚到位」在视觉上分得开。
 */
export const CARD_RISE = 19

/* ==========================================================================
   卡牌与标题的几何契约（2026-09-18 修「标题被卡牌盖住」）
   --------------------------------------------------------------------------
   标题带（「今夜一签」+ 副标题）改为**从卡牌顶边往上锚定**，不再从视口顶往下排。
   卡牌顶边 = ANCHORS.stage.y − 卡牌高度的一半，所以这几项必须同源：
     --card-height      卡牌高度（与 index.css 里 .card 的 height 保持一致）
     --card-height-half 上面的一半，供标题带算 bottom
     --stage-anchor-y   牌面落点（视口高百分比）
     --title-gap        标题底边与卡牌顶边之间的净空
   于是「卡牌变高 / 锚点下移」时标题会自动跟着让位，不会再被压住。
   ⚠️ 若改 CARD_HEIGHT，务必同步改 index.css 里 .card 的 height 字面量。
   ========================================================================== */
export const CARD_HEIGHT = 'min(46vh, 420px)'
export const CARD_HEIGHT_HALF = 'min(23vh, 210px)'
export const TITLE_GAP = '20px'

/* ==========================================================================
   卡牌几何（全部由 scripts/build_card_assets.py 量出并打印，换卡框时重跑脚本替换）
   注意：卡牌视觉比例跟着卡框走，不写死在 CSS 里。
   ========================================================================== */

/**
 * 卡牌整体比例（**卡片本体的比例**）。
 *
 * 2026-09-18：卡框原图右下角挂着一个吊牌（吊绳贴着右边下来、吊牌挂在右下角，
 * 吊牌本体还压在卡片本体内部）。用户决定先去掉吊牌、把卡牌收成一个干净的矩形，
 * 等跑通后再考虑装饰性外挂元素。所以现在 CARD_ASPECT 就是卡片本体本身的比例，
 * 不再含「吊牌探出卡体之外的留白」（旧值 986 / 1496 ≈ 0.659）。
 */
export const CARD_ASPECT = '960 / 1403'

/** 同上的数值形式，给 Canvas 出图用（分享卡片图需要按像素算） */
export const CARD_ASPECT_VALUE = 960 / 1403

/** 卡框插画窗口的位置（四条框带的宽度占比） */
export const FRAME_INSET = { left: '10.52%', top: '7.48%', right: '10.62%', bottom: '8.20%' }

/** 同上，数值形式（Canvas 出图用） */
export const FRAME_INSET_VALUE = { left: 0.1052, top: 0.0748, right: 0.1062, bottom: 0.082 }

/**
 * 卡框纸色（由 build_card_assets.py 从素材实测后打印）。
 * 用途：作为卡面的兜底底色。卡框素材若在边缘留了透明外边距，
 * 这里必须是纸色而不是暗色 —— 否则会从卡片外缘漏出一圈「黑边」
 * （2026-09-18：22 张牌全部中招，根因就是底色 #120a24 从卡框透明外边距漏出来）。
 */
export const CARD_PAPER = '#dfd3b9'

/**
 * 卡片本体在卡牌框内的裁剪量。
 *
 * 2026-09-18 起全为 0 —— 两层原因叠加：
 *   ① 卡框外圈的透明死区已在素材层被填成纸色（见 build_card_assets.py 的 fill_outer_margin），
 *      卡框成了不透光的实心矩形；
 *   ② 吊牌已去掉，卡牌就是卡片本体，不再有「卡体之外」的区域。
 * 插画因此 1:1 铺满整张卡牌。这份配置保留只为兼容旧卡框。
 */
export const CARD_BODY_CLIP = {
  top: '0%',
  right: '0%',
  bottom: '0%',
  left: '0%'
}

/** 同上，数值形式（Canvas 出图用） */
export const CARD_BODY_CLIP_VALUE = { top: 0, right: 0, bottom: 0, left: 0 }

/** 把上面这些量灌进 CSS 变量，组件和样式表都不用再关心具体数字 */
export function applySkinVars(root = document.documentElement) {
  const vars = {
    /* 卡牌 */
    '--card-aspect': CARD_ASPECT,
    '--frame-left': FRAME_INSET.left,
    '--frame-top': FRAME_INSET.top,
    '--frame-right': FRAME_INSET.right,
    '--frame-bottom': FRAME_INSET.bottom,
    '--body-top': CARD_BODY_CLIP.top,
    '--body-right': CARD_BODY_CLIP.right,
    '--body-bottom': CARD_BODY_CLIP.bottom,
    '--body-left': CARD_BODY_CLIP.left,
    /** 卡框纸色：卡面兜底底色，绝不能是暗色（否则卡框有透明外边距时会漏出黑边） */
    '--card-paper': CARD_PAPER,
    /** 牌名底衬高度：下框带被金线占满放不下牌名，牌名落在插画窗口内下缘 */
    '--scrim-height': '15%',

    /* 主视觉底板 */
    '--hero-aspect': `${HERO_FRAME.width} / ${HERO_FRAME.height}`,
    '--hero-aspect-num': String(HERO_FRAME.width / HERO_FRAME.height),
    /** 底板的横向总外扩系数：样式表里写作 `calc(100vw + var(--hero-bleed) * 1vw)` */
    '--hero-bleed': String(HERO_LAYOUT.bleed * 2),
    '--hero-pos-y': `${HERO_LAYOUT.positionY}%`,
    '--hero-pos-y-inv': `-${HERO_LAYOUT.positionY}%`,

    /* 水晶球（图像坐标系） */
    '--orb-x': `${ANCHORS.orb.x}%`,
    '--orb-y': `${ANCHORS.orb.y}%`,
    '--orb-size': `${ANCHORS.orb.size}cqh`,

    /* 卡牌与标题的几何契约（标题带从卡牌顶边往上锚定，见 CARD_HEIGHT 注释） */
    '--card-height': CARD_HEIGHT,
    '--card-height-half': CARD_HEIGHT_HALF,
    '--stage-anchor-y': `${ANCHORS.stage.y}%`,
    '--title-gap': TITLE_GAP,

    /* 抽牌仪式：CSS 侧的动画（球充能 / 压暗层）周期与 JS 时序同源，
       免得有人改了 DRAW_RITUAL 而样式表还停在旧数字 */
    '--rite-charge': `${DRAW_RITUAL.charge}ms`
  }
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}

/* ==========================================================================
   缓动常量表（2026-09-18 手感升级新增）
   --------------------------------------------------------------------------
   为什么要收口：升级前全页只有一种运动性格（`ease-out-expo` 一族散落在各组件里），
   入场、抽牌、翻牌、面板读起来「落地的味道一样」—— 这是「像 demo 不像作品集」的根因之一。

   作品集靠**运动性格的对比**分层：重物 / 轻物 / 机关各有各的缓动。所以这里定四族：
     reveal → 显形：快进慢出，主角落位（保留原有默认手感）
     settle → 落定：尾部更长、更稳，用于入场收尾与面板推入
     exit   → 离场：慢起快走，只给退场用
     slam   → 冲击：快速到位后微回弹，抽牌这类「有重量的事件」用
   组件里不要再写字面量数组，一律从这张表取。
   ========================================================================== */
export const EASE = {
  /** 显形：快进慢出（原有默认，主角落位用） */
  reveal: [0.16, 1, 0.3, 1],
  /** 落定：比 reveal 尾部更长，读起来更稳（入场收尾 / 面板推入 / 内容 stagger） */
  settle: [0.22, 1, 0.36, 1],
  /** 离场：慢起快走，只用于退场 */
  exit: [0.7, 0, 0.84, 0],
  /** 冲击：快速到位后微回弹，抽牌 / 按下反馈用 */
  slam: [0.2, 0.9, 0.2, 1],
  /** 蓄势（2026-09-19 新增）：慢起、末端加速 —— 读作「攒劲」，
      与 slam 的「快速到位」正好相反。只给「充能 / 预压」这类铺垫拍用。 */
  wind: [0.55, 0, 0.85, 0.25]
}

/** 动画时序（毫秒）—— **只含入场时序**；抽牌仪式时序见下面的 DRAW_RITUAL */
export const TIMING = {
  /** 迎接动画（信封开启）总长。与 entrance 并行，不是串在它前面 */
  welcome: 2700,
  entrance: 2600,
  /** 入场内部编舞：veil 先散雾，plate 延后跟上（两者串行，不再同时开跑） */
  entranceVeil: 1400,
  entrancePlateDelay: 550,
  entrancePlate: 1500
}

/* ==========================================================================
   抽牌仪式分拍（2026-09-19）
   --------------------------------------------------------------------------
   单位毫秒。这里只描述「每一拍多长」，绝对时刻由 drawBeats() 派生 ——
   组件一律读时刻表，**不许自己把几个时长相加**（那样迟早对不上，
   2026-09-19 的「空面板挂 1.6 秒」bug 就是这么来的：App 的计时器与
   ReadingPanel 内写的 delay 各算了一遍）。
   ========================================================================== */
export const DRAW_RITUAL = {
  charge: 1000, // ① 蓄势（新增拍：这是期盼感的来源，牌此时尚未挂载）
  flash: 520, // ② 释放爆闪（原 420；峰值 ≈ click + charge + flash×0.18）
  flyDelay: 60, //    爆闪峰值之后起飞
  fly: 1150, // ③ 升起（原 900；全程只显牌背）
  /**
   * ④ 悬停静默（新增拍 ★ 最关键）。
   *
   * ⚠️ 这里比交接方案（650）**加长了近一倍**，是实测倒推的结果：
   * 「答案不得在牌停稳前显形」这条验收线要求 `flip90 − 牌到位 ≥ 1500ms`，
   * 而实测「跨 90°」发生在主力段（slam 曲线）的**前 13%**——
   * 也就是翻转一开始没多会儿答案就露出来了。slam 是刻意选的「快速到位」曲线，
   * 改不得（改成慢起会失去「啪地翻开」的力道），所以只能让翻转**更晚开始**。
   * 反推：hold ≥ 1500 − flipWarm − 0.13×flipMain ≈ 1110，取 1150 留余量。
   * 副作用是总时长从 5.4s 涨到 5.6s —— 仍在「可接受区间 4.5–6.0s」内。
   */
  hold: 1150,
  flipWarm: 140, // ⑤ 翻牌预压（新增拍：反向小幅后仰）
  flip: 1200, // ⑥ 翻牌总长（原 1000；含 warm 140 + 主力 860 + 落定 200）
  flipMain: 860, //    主力段（原 720）
  tail: 280, // ⑦ 看清牌面的留白（新增拍）
  panelSlide: 720, // ⑧ 面板上滑（原 620）
  panelStagger: 72 //    面板内容依次亮起（原 60）
}

/** reduced 兜底表：无障碍用户不能等 5 秒多。除必留的极短淡入外全部归零 */
export const DRAW_RITUAL_REDUCED = {
  charge: 0,
  flash: 120,
  flyDelay: 0,
  fly: 1,
  hold: 0,
  flipWarm: 0,
  flip: 1,
  flipMain: 1,
  tail: 0,
  panelSlide: 200,
  panelStagger: 0
}

/** 选表：组件里一律用 `const r = ritual(reduced)`，不要自己判断 */
export const ritual = (reduced) => (reduced ? DRAW_RITUAL_REDUCED : DRAW_RITUAL)

/**
 * 绝对时刻表（ms，从点击水晶球算起）—— **唯一真相**。
 *
 * ⚠️ 交接方案里写的是从 DRAW_RITUAL 直接派生的常量；这里改成**按 reduced 取参数**的函数，
 * 否则 reduced 用户虽然拿到的是 0.01s 的动画，App 的计时器却仍按 5.6s 排 ——
 * 正是交接文档 §5 第 5 条警告的那件事（「必须同时提供 reduced 时长表」）。
 * `DRAW_BEATS` 仍然导出，等于 `drawBeats(false)`，供探针 / 断言脚本对照。
 */
export const drawBeats = (reduced = false) => {
  const r = ritual(reduced)
  const chargeDone = r.charge // ① 结束 → 爆闪起跑、牌挂载
  const flyAt = chargeDone + r.flyDelay // ③ 牌起飞
  const riseDone = flyAt + r.fly
  const holdDone = riseDone + r.hold // ④ 结束
  const flipAt = holdDone + r.flipWarm // ⑤ 结束 → ⑥ 起跑（旋转动画自身也从这里开始）
  const flipDone = flipAt + r.flip
  const tailDone = flipDone + r.tail // ⑦ 结束 → 面板挂载
  return {
    click: 0,
    chargeDone,
    flashDone: chargeDone + r.flash,
    flyAt,
    riseDone,
    holdDone,
    flipAt,
    flipDone,
    tailDone,
    panelAt: tailDone,
    panelSettled: tailDone + r.panelSlide,
    total: tailDone + r.panelSlide
  }
}

/** 正常动效下的绝对时刻表（探针 / 文档 / 断言用；组件内请用 drawBeats(reduced)） */
export const DRAW_BEATS = drawBeats(false)

/**
 * 迎接动画（信封开启）开关
 *
 * - `enabled: false`  → 完全不播放，直接走原有的场景入场（组件不挂载）
 * - `skipWhenDrawn`   → 今日已经抽过牌就不再播放。此时页面直接呈现今天的牌，
 *                       仪式感留给「还没抽」的那一刻，也免得刷新一次看一遍
 *
 * 另外 `prefers-reduced-motion: reduce` 会强制关掉（在 App.jsx 里判断）。
 * 动画本身可以随时点击 / 按键跳过。
 */
export const WELCOME = {
  enabled: true,
  skipWhenDrawn: true
}

/** 首屏空闲时预热多少张牌面（避免首次抽牌时插画还在下载，见 src/utils/prefetch.js） */
export const PREFETCH_COUNT = 6
