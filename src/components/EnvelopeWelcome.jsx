import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { TIMING } from '../config/skin'

/**
 * 迎接动画 · 信封开启
 * ----------------------------------------------------------------------
 * 用户进入页面时先看到一封火漆封缄的信：封印碎裂、上翻盖翻开、
 * 暖光与星屑从开口涌出来，光雾散尽后露出后面的场景。
 * 设计意图：把「抽牌」这件事包装成「收到一封信」。
 *
 * **构图是「极近距离的大特写」**（第二版，取代了第一版）：
 * 信封放大到四边全部溢出视口、整封带一个斜角 + 一点 3D 前倾，
 * 镜头几乎贴在信封开口上 —— 画面里只会看到上翻盖那块大三角、内腔与中央的火漆封印。
 * 第一版是一只完整的小信封浮在画面正中，用户反馈「太传统的小信封」，
 * 所以这一版要的是扑面而来的压迫感，而不是「桌上摆着一封信」。
 * 相机的角度/大小/位置全在 CSS 的 `.env-cam` 上（--env-rot / --env-tilt / --env-shift-y）。
 *
 * 四条设计约束：
 *
 * 1) **纯代码绘制**，不用 AI 出的信封图。两个原因：
 *    ① 入场动画要立刻可见，依赖网络图片会先闪一下暗场/空白；
 *    ② 出图要花积分（项目定过红线），而信封这种几何造型代码完全能做。
 *    顺手继承了站点的「纸 + 金箔」语言：米白厚卡纸取卡框的纸色家族，
 *    金色发丝边呼应卡框的金线，火漆封印沿用牌背的**八芒星**母题。
 *
 * 2) **与原有入场动画并行**，不额外增加等待：场景自身的入场（.veil 散去 +
 *    底板聚焦）从 t=0 就在信封背后照常跑，信封在 TIMING.welcome 时刻退场时
 *    场景已经就位。所以抽牌可点击的时机和加这个动画之前**完全一样**。
 *
 * 3) **随时可以跳过**：任意点击 / 按键都会把动画快速收尾（见 SKIP）。
 *    开头 SKIP.guard 秒内忽略点击，免得「点一下让窗口获得焦点」就把动画吃掉。
 *
 * 4) 信封内部的「空腔」是**静态**的（`.env__cavity`）：它的形状与上翻盖完全一致，
 *    盖着时被翻盖整块遮住，翻盖一转开就自己露出来，不需要任何显隐动画。
 *
 * 分层的职责（每一层只干一件事，改的时候别混）：
 *   .welcome__stage → 铺满视口 + 提供**相机透视**（perspective 只作用于直接子元素）
 *   .env-cam        → 相机角度：斜角 + 3D 前倾，以及整封的大小与位置
 *   .env-in         → 入场的淡入 / 缩放落定
 *   .env            → 退场的淡出 / 朝镜头推近
 *   .env__*         → 信封自身的零件
 *
 * 时间轴全部集中在 T 里，单位秒、相对本组件挂载时刻，方便整体调快调慢。
 * 舞台尺寸、纸色、金箔、封印都在 src/index.css 的「迎接动画 · 信封」一节。
 */

/* 正常时间轴。end 必须 ≤ TIMING.welcome / 1000 */
const T = {
  envInDur: 0.85, // 信封浮现
  sealGlowAt: 0.78, // 火漆封印亮起
  crackAt: 1.12, // 封印碎裂、微闪
  flapAt: 1.24, // 上翻盖上抬
  flapDur: 0.6,
  spillAt: 1.28, // 开口涌出的暖光（.env__bloom）
  speckAt: 1.36, // 星屑升起
  /* 退场刻意压在翻盖翻完之后再等一拍（1.24+0.6=1.84）。
     早先 outAt=1.94 时「完全打开」这个状态只存在 0.1s，
     观众几乎看不到开口就淡掉了 —— 留 0.26s 才读得出来。 */
  outAt: 2.1, // 信封朝镜头推近、化进暗场
  outDur: 0.34,
  burstAt: 2.28, // 交卸闪光
  veilOutAt: 2.3, // 暗场退去，露出场景
  end: 2.62 // 组件卸载
}

/* 跳过时间轴 */
const SKIP = {
  guard: 0.26, // 这段内的点击不算「跳过」
  outDur: 0.34,
  flapDur: 0.26,
  end: 0.56
}

const EASE_OUT = [0.22, 1, 0.36, 1]
const EASE_FLAP = [0.52, 0.04, 0.3, 1]

/** 确定性伪随机（不要 Math.random，否则每次渲染星屑都会跳） */
function rand(i, salt) {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return v - Math.floor(v)
}

/**
 * 火漆蜡块轮廓。
 *
 * 正圆 + 径向渐变无论怎么调都像一颗玻璃珠 —— 蜡的说服力全在**不规则的轮廓**上。
 * 这里用两个不同频率的正弦叠加做半径扰动（确定性、连续、首尾自然闭合），
 * 再把折线点用二次贝塞尔平滑成闭合曲线。
 */
function waxBlob(points = 22, rBase = 45, cx = 50, cy = 50) {
  const P = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2 - Math.PI / 2
    const wobble = Math.sin(i * 2.399) * 0.05 + Math.sin(i * 1.117 + 0.9) * 0.038
    const r = rBase * (1 + wobble)
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  })
  const at = (i) => P[(i + points) % points]
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const f = (n) => n.toFixed(2)

  const start = mid(at(0), at(1))
  let d = `M ${f(start[0])} ${f(start[1])}`
  for (let i = 1; i <= points; i += 1) {
    const c = at(i)
    const m = mid(at(i), at(i + 1))
    d += ` Q ${f(c[0])} ${f(c[1])} ${f(m[0])} ${f(m[1])}`
  }
  return `${d} Z`
}

/** 星屑 */
function buildSpecks(count) {
  return Array.from({ length: count }, (_, i) => ({
    key: i,
    /* 出发点横向位置。大特写下信封左右两侧都在画面外，所以收窄到
       开口正对的那一段（34%~66%），否则大半星屑会飘到画面外浪费掉 */
    x: 34 + rand(i, 1) * 32,
    drift: (rand(i, 2) - 0.5) * 120,
    delay: rand(i, 3) * 0.42,
    dur: 0.75 + rand(i, 4) * 0.5,
    size: 7 + rand(i, 5) * 9,
    gold: rand(i, 6) > 0.58
  }))
}

const WAX_PATH = waxBlob()

/** 压印母题：两个正方形叠成八芒星，与牌背一致 */
function sigil(stroke, offset) {
  return (
    <g
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinejoin="round"
      transform={offset ? `translate(${offset[0]} ${offset[1]})` : undefined}
    >
      <rect x="28" y="28" width="44" height="44" />
      <rect x="28" y="28" width="44" height="44" transform="rotate(45 50 50)" />
    </g>
  )
}

export default function EnvelopeWelcome({ onDone }) {
  const [fast, setFast] = useState(false)
  const finished = useRef(false)
  const specks = useMemo(() => buildSpecks(26), [])

  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    onDone()
  }, [onDone])

  /* 收尾：正常走完 T.end，跳过快进到 SKIP.end */
  useEffect(() => {
    const id = setTimeout(finish, (fast ? SKIP.end : T.end) * 1000)
    return () => clearTimeout(id)
  }, [fast, finish])

  /* 任意点击 / 按键都能跳过 */
  useEffect(() => {
    let armed = false
    const arm = setTimeout(() => {
      armed = true
    }, SKIP.guard * 1000)
    const skip = () => {
      if (armed) setFast(true)
    }
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)
    return () => {
      clearTimeout(arm)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [])

  const flapT = fast
    ? { duration: SKIP.flapDur, ease: EASE_FLAP }
    : { delay: T.flapAt, duration: T.flapDur, ease: EASE_FLAP }

  return (
    <div className="welcome" aria-hidden="true">
      {/* 暗场：整块不透明。信必须落在一个干净的暗底上，场景会透过来就脏了 */}
      <motion.div
        className="welcome__veil"
        initial={{ opacity: 1 }}
        animate={fast ? { opacity: 0 } : { opacity: [1, 1, 0] }}
        transition={
          fast
            ? { duration: SKIP.outDur, ease: 'easeIn' }
            : { duration: T.end, times: [0, T.veilOutAt / T.end, 1], ease: 'linear' }
        }
      />

      {/* 舞台铺满视口，负责提供**相机透视**。
          透视必须挂在这一层：`perspective` 只作用于它的**直接子元素**，
          所以 .env-cam 必须是它的直接子元素，中间不能夹别的层 */}
      <div className="welcome__stage">
        {/* 相机：斜角 / 3D 前倾 / 整封大小 / 纵向位置。纯 CSS 的一层 ——
            transform 留给相机角度，动画交给里面的 .env-in / .env，
            两者分开才不会互相覆盖 */}
        <div className="env-cam">
          {/* 入场：从暗场里浮现 + 稍微往回收一点，像镜头落定 */}
          <motion.div
            className="env-in"
            initial={{ opacity: 0, scale: 1.07 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: T.envInDur, ease: EASE_OUT }}
          >
            {/* 退场：朝镜头推近并淡出，把画面交还给暗场 */}
            <motion.div
              className="env"
              initial={{ opacity: 1, scale: 1 }}
              animate={fast ? { opacity: 0, scale: 1.05 } : { opacity: 0, scale: 1.09 }}
              transition={
                fast
                  ? { duration: SKIP.outDur, ease: 'easeIn' }
                  : { delay: T.outAt, duration: T.outDur, ease: 'easeIn' }
              }
            >
              {/* 信封本体：米白厚卡纸 + 三片折页构成的「背面」 */}
              <div className="env__body">
                <div className="env__panel env__panel--l" />
                <div className="env__panel env__panel--r" />
                <div className="env__panel env__panel--b" />
                {/* 折痕：斜向发丝线用 SVG 画（CSS 渐变做斜线既麻烦又不准） */}
                <svg className="env__seams" viewBox="0 0 146 100" preserveAspectRatio="none">
                  <g
                    stroke="#a8853f"
                    strokeOpacity="0.5"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  >
                    <line x1="73" y1="58" x2="0" y2="0" />
                    <line x1="73" y1="58" x2="146" y2="0" />
                    <line x1="73" y1="58" x2="0" y2="100" />
                    <line x1="73" y1="58" x2="146" y2="100" />
                  </g>
                </svg>
              </div>

              {/* 内腔 + 打进内腔的光 + 两条受光纸口。
                  形状与上翻盖一致，盖着时被整块遮住，不需要显隐动画。
                  大特写里这块内腔就是画面的主角，所以光给得比第一版足 */}
              <div className="env__cavity" />
              <div className="env__cavity-glow" />
              <svg className="env__cavity-edge" viewBox="0 0 146 100" preserveAspectRatio="none">
                <g
                  stroke="#ffeec6"
                  strokeOpacity="0.64"
                  strokeWidth="2.4"
                  vectorEffect="non-scaling-stroke"
                >
                  <line x1="73" y1="58" x2="0" y2="0" />
                  <line x1="73" y1="58" x2="146" y2="0" />
                </g>
              </svg>

              {/* 金箔角星（位置按大特写的可见区域重新摆过，见 CSS 注释） */}
              <svg className="env__corner env__corner--l" viewBox="0 0 24 24">
                <path
                  d="M12 1 L14.4 9.6 L23 12 L14.4 14.4 L12 23 L9.6 14.4 L1 12 L9.6 9.6 Z"
                  fill="#d8b877"
                  fillOpacity="0.68"
                />
              </svg>
              <svg className="env__corner env__corner--r" viewBox="0 0 24 24">
                <path
                  d="M12 1 L14.4 9.6 L23 12 L14.4 14.4 L12 23 L9.6 14.4 L1 12 L9.6 9.6 Z"
                  fill="#d8b877"
                  fillOpacity="0.68"
                />
              </svg>

              {/* 月相压印：呼应牌背的「八芒星与月相」，落在大三角尖端正下方。
                  月牙用「大圆挖掉偏移小圆」的 mask 做 ——
                  手算两段圆弧的 sweep flag 太容易翻车 */}
              <svg className="env__moon" viewBox="0 0 100 100">
                <defs>
                  <mask id="tarot-moon-mask">
                    <rect width="100" height="100" fill="#000" />
                    <circle cx="46" cy="50" r="34" fill="#fff" />
                    <circle cx="61" cy="50" r="28" fill="#000" />
                  </mask>
                </defs>
                <rect
                  width="100"
                  height="100"
                  fill="#d8b877"
                  fillOpacity="0.62"
                  mask="url(#tarot-moon-mask)"
                />
                <path
                  d="M83 26 l2.4 8.2 8.2 2.4 -8.2 2.4 -2.4 8.2 -2.4 -8.2 -8.2 -2.4 8.2 -2.4 z"
                  fill="#d8b877"
                  fillOpacity="0.62"
                />
              </svg>

              {/* 上翻盖：绕信封顶边 rotateX 翻到背后。3D 透视挂在 .env__flap-slot 上，
                  不能挂在有 opacity/filter 的祖先上（那些是 grouping property，会把 3D 压平） */}
              <div className="env__flap-slot">
                <motion.div
                  className="env__flap"
                  initial={{ rotateX: 0 }}
                  animate={{ rotateX: -142 }}
                  transition={flapT}
                >
                  <div className="env__flap-shadow">
                    <div className="env__flap-face">
                      <div className="env__flap-face-in" />
                      {/* 盖面上的内嵌金线：呼应卡框下框带的双金线，
                          也把大特写下这块很空的亮面收一收，不至于是一片平纸 */}
                      <svg
                        className="env__flap-inlay"
                        viewBox="0 0 146 100"
                        preserveAspectRatio="none"
                      >
                        <polygon
                          points="4,4 142,4 73,92"
                          fill="none"
                          stroke="#c9a463"
                          strokeOpacity="0.34"
                          strokeWidth="1"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                      <motion.div
                        className="env__flap-shade"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={
                          fast
                            ? { duration: SKIP.flapDur }
                            : { delay: T.flapAt + 0.28, duration: 0.5 }
                        }
                      />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* 开口涌出的暖光。
                  第一版这里是「信封背后的光晕 + 向上的光柱」，但那两个都依赖
                  「信封完整地摆在画面里」：现在信封四边都溢出视口，光晕被完全遮住、
                  光柱则冲到画面外。所以改成这一层 —— 从开口朝镜头方向漫出来的大范围辉光，
                  排在翻盖**之后**，于是它会漫过纸面与翻盖边缘，读起来就是「光涌出来了」 */}
              <motion.div
                className="env__bloom"
                initial={{ opacity: 0, scale: 0.62 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={
                  fast
                    ? { duration: SKIP.outDur, ease: 'easeOut' }
                    : { delay: T.spillAt, duration: 0.95, ease: 'easeOut' }
                }
              />

              {/* 星屑 */}
              {specks.map((s) => (
                <motion.span
                  key={s.key}
                  className={`env__speck${s.gold ? ' env__speck--gold' : ''}`}
                  style={{ left: `${s.x}%`, width: s.size, height: s.size }}
                  initial={{ opacity: 0, y: 0, x: 0 }}
                  animate={
                    fast
                      ? { opacity: 0, y: -90 }
                      : { opacity: [0, 1, 0], y: [0, -320], x: [0, s.drift] }
                  }
                  transition={
                    fast
                      ? { duration: SKIP.outDur, ease: 'easeOut' }
                      : { delay: T.speckAt + s.delay, duration: s.dur, ease: 'easeOut' }
                  }
                />
              ))}

              {/* 火漆封印：坐在上翻盖的尖端上。
                  位置用独立的 translate 居中，transform 留给动画 */}
              <div className="env__seal-slot">
                <motion.div
                  className="env__seal"
                  initial={{ opacity: 1, scale: 1 }}
                  animate={
                    fast
                      ? { opacity: 0, scale: 1.3, filter: 'blur(4px)' }
                      : {
                          opacity: [1, 1, 0],
                          scale: [1, 1.07, 1.45],
                          filter: ['blur(0px)', 'blur(0px)', 'blur(6px)']
                        }
                  }
                  transition={
                    fast
                      ? { duration: SKIP.flapDur * 0.8, ease: 'easeOut' }
                      : { delay: T.crackAt, duration: 0.44, times: [0, 0.28, 1], ease: 'easeOut' }
                  }
                >
                  <motion.svg
                    className="env__seal-svg"
                    viewBox="0 0 100 100"
                    initial={{ opacity: 0.8 }}
                    animate={{ opacity: [0.8, 1, 0.86] }}
                    transition={
                      fast
                        ? { duration: 0.2 }
                        : { delay: T.sealGlowAt, duration: 0.9, ease: 'easeInOut' }
                    }
                  >
                    <defs>
                      <radialGradient id="tarot-wax" cx="40%" cy="34%" r="76%">
                        <stop offset="0%" stopColor="#4a2a6b" />
                        <stop offset="46%" stopColor="#31184f" />
                        <stop offset="100%" stopColor="#180c2c" />
                      </radialGradient>
                    </defs>

                    {/* 蜡块本体：低对比渐变 + 不规则轮廓 = 蜡，而不是玻璃球 */}
                    <path d={WAX_PATH} fill="url(#tarot-wax)" />
                    <path
                      d={WAX_PATH}
                      fill="none"
                      stroke="rgba(232, 201, 138, 0.3)"
                      strokeWidth="1.1"
                    />

                    {/* 压印：先压一道暗影，再上金色，形成阳刻的立体感 */}
                    {sigil('rgba(14, 5, 28, 0.6)', [0.7, 1])}
                    {sigil('#e8c98a')}
                    <circle
                      cx="50"
                      cy="50"
                      r="36"
                      fill="none"
                      stroke="#e8c98a"
                      strokeOpacity="0.3"
                      strokeWidth="1"
                    />
                    <circle cx="50" cy="50" r="2.6" fill="#f2dcac" />
                  </motion.svg>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* 交卸闪光：信封退场的同时把画面交还给场景，避免「啪」地硬切 */}
      <motion.div
        className="welcome__burst"
        initial={{ opacity: 0 }}
        animate={fast ? { opacity: 0 } : { opacity: [0, 0.55, 0] }}
        transition={
          fast
            ? { duration: SKIP.outDur }
            : { delay: T.burstAt, duration: 0.36, times: [0, 0.3, 1], ease: 'easeOut' }
        }
      />

      {/* 跳过提示：够用就好，不抢戏 */}
      <motion.span
        className="welcome__hint"
        initial={{ opacity: 0 }}
        animate={fast ? { opacity: 0 } : { opacity: [0, 0.72, 0.72, 0] }}
        transition={
          fast
            ? { duration: 0.1 }
            : { duration: T.end, times: [0, 0.36, 0.8, 1], ease: 'linear' }
        }
      >
        点击跳过
      </motion.span>
    </div>
  )
}
