import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ANCHORS, ASSETS, CARD_RISE, EASE, drawBeats, ritual } from '../config/skin'
import useAssetUrl from '../hooks/useAssetUrl'
import CardFace from './CardFace'

function viewportHeight() {
  if (typeof window === 'undefined') return 900
  return window.innerHeight || 900
}

/**
 * 抽牌动画：牌自水晶球位置升起 → **停住悬停** → 反向预压 → 3D 翻转揭晓 → 留白看清牌面。
 * 牌面本身由 CardFace 渲染（插画 / 卡框 / 文字三层）。
 *
 * 牌背优先用 `card-back` 素材；没有素材时退回代码绘制的几何花纹。
 *
 * ── 2026-09-19 抽牌仪式分拍（本轮核心）────────────────────────────────
 * 上一版的问题不是「太快」，而是**顺序错了**：牌在 213ms 就开始翻、295ms 就转过 90°，
 * 而它要到 696ms 才飞到位 —— 观众看到的是「一边飞一边就翻完了」，
 * 「先看到牌背 → 牌停住 → 才翻开」这个结构根本不存在。实测证据见 MOTION_AUDIT。
 *
 * 现在这一段由三个**绝对时刻**切开（全部来自 `drawBeats()`，本组件只读、不算）：
 *
 *   ① 升起 `beats.flyAt`    —— 只显牌背；y 走 slam、scale 走 settle（带微过冲）
 *   ② 悬停 `beats.riseDone → holdDone` —— **牌不动**（★ 期盼感的核心拍）。
 *      不能在这拍动 `y`（会和升起的 y 过渡打架，还可能吃掉标题 20px 净空），
 *      所以「被托住」用手感三件套表达：scale 微过冲 + rotateZ 微摆 + 牌后辉光脉动。
 *   ③ 翻牌 `beats.flipAt`   —— 4 关键帧 3 段曲线：预压(-6°) → 主力(168°) → 落定(180°)
 *
 * ⚠️ 翻牌延迟从「起飞后 0.06s」改成**绝对时刻**，这是本轮最关键的一处修复。
 * 上一版把延迟写成相对值，等于让「升起」和「翻转」各自计时 —— 两者必然错位。
 *
 * 透视（perspective）挂在 CSS 的 .stage 上 —— 见 index.css 里的说明，
 * 这是让 rotateY 看起来像「绕轴转身」而不是「横向压扁」的前提。
 */
export default function CardReveal({ card }) {
  /** 牌背素材：undefined = 探测中 / string = 可用 / null = 缺图，用 CSS 牌背兜底 */
  const cardBack = useAssetUrl(ASSETS.cardBack)
  const hasBackArt = typeof cardBack === 'string'
  /** 减少动效：去掉位移/缩放/翻转/挥光，只留淡入；也不挂 halo 与 eclipse */
  const reduced = useReducedMotion()
  const beats = useMemo(() => drawBeats(reduced), [reduced])
  const rite = useMemo(() => ritual(reduced), [reduced])
  /** 动画期开 will-change，收工收回（常驻 will-change 反而降帧） */
  const [animating, setAnimating] = useState(true)

  const risePx = useMemo(() => (CARD_RISE / 100) * viewportHeight(), [])

  /* ---------- ⚠️ 延迟的基准是「本组件挂载」，不是「点击」 ----------
     本组件在 `beats.chargeDone` 才挂载（蓄势期刻意不挂牌），而 Framer 的 `delay`
     是从**动画被触发那一刻**算起的 —— 所以绝对时刻必须减掉挂载点。
     另外 Framer 有一条容易踩的规则：**只要某个属性写了 per-property config，
     根上的 `delay` 就会被完全接管（等于丢弃）**。所以下面每个属性都自带 `delay`。
     （ReadingPanel 的「空面板挂 1.6 秒」是同一个规则的另一个受害者。）
     实测证据：不写 per-property delay 时，牌在挂载后 30ms 就开始淡入，
     而翻转要等到挂载后 3.5s —— 两件事差了整整一拍。 */
  const T0 = beats.chargeDone
  const at = (ms) => Math.max(0, ms - T0) / 1000

  const fly = rite.fly / 1000
  const flip = rite.flip / 1000
  const riseDelay = at(beats.flyAt)
  const flipDelay = at(beats.flipAt)

  /* ---------- 相机（.card）的时间轴 ----------
     一条轨道从起飞一直排到「看清牌面」，各属性用各自的 duration / times 叠在上面。
     这样 rotateZ 的微摆可以横跨「升起 + 悬停」两拍，而不必再叠一层计时器。 */
  const swaySpan = Math.max(1, beats.holdDone - beats.flyAt)
  const frac = (t) => (t - beats.flyAt) / swaySpan
  const riseFrac = frac(beats.riseDone) // 升起结束
  const holdEndFrac = frac(beats.holdDone) // 悬停结束

  const haloSpan = Math.max(1, beats.tailDone - beats.flyAt)
  const hFrac = (t) => (t - beats.flyAt) / haloSpan
  const hRiseFrac = hFrac(beats.riseDone)
  const hHoldEndFrac = hFrac(beats.holdDone)
  const hFlipStartFrac = hFrac(beats.flipAt)
  const hFlipEndFrac = hFrac(beats.flipDone)

  /* ---------- 翻牌：4 关键帧 / 3 段曲线 ---------- */
  const warmFrac = rite.flipWarm / rite.flip // 0.1167
  const mainFrac = (rite.flipWarm + rite.flipMain) / rite.flip // 0.8333

  const flipAnimate = reduced ? { rotateY: 180 } : { rotateY: [0, -6, 168, 180] }
  const flipTransition = reduced
    ? { duration: 0.01 }
    : {
        duration: flip,
        delay: flipDelay,
        /* ⚠️ ease 传数组时长度必须 = 关键帧数 − 1，times 必须严格递增、首 0 尾 1。
           写错 Framer 不会报错，只会静默乱来（正好是「查半天查不出原因」的坑）。 */
        ease: [EASE.wind, EASE.slam, EASE.settle],
        times: [0, warmFrac, mainFrac, 1]
      }

  /* ---------- 牌后辉光 ----------
     外层管「整体亮度」（跟随仪式推进），内层用 CSS 关键帧做 1.3s 的呼吸脉动。
     两层 opacity 相乘 —— 这样悬停拍的「活着」不需要另开计时器。 */
  const haloAnimate = reduced
    ? { opacity: 0 }
    : { opacity: [0, 0.45, 0.62, 0.8, 0.5, 0.55] }
  const haloTransition = reduced
    ? { duration: 0.01 }
    : {
        duration: haloSpan / 1000,
        delay: riseDelay,
        ease: 'easeInOut',
        times: [
          0,
          hRiseFrac,
          hRiseFrac + (hHoldEndFrac - hRiseFrac) * 0.6,
          hFlipStartFrac,
          hFlipEndFrac,
          1
        ]
      }

  return (
    <div className="stage" aria-live="polite">
      <div className="stage__anchor" style={{ left: `${ANCHORS.stage.x}%`, top: `${ANCHORS.stage.y}%` }}>
        <motion.div
          className="card"
          data-flip-at={beats.flipAt}
          data-mounted-at={beats.chargeDone}
          /* ③ 升起：y / scale / opacity 各自一条曲线，错开才有「有重量的东西被抽出来」。
             scale 带一点过冲读作「被托住」；y 绝不能过冲（会向上侵入标题带净空）。
             ⚠️ 每个属性都自带 delay —— 根上的 delay 会被 per-property config 接管掉。 */
          initial={reduced ? { opacity: 0 } : { y: risePx, scale: 0.42, opacity: 0, rotateZ: 0 }}
          animate={reduced ? { opacity: 1 } : { y: 0, scale: 1, opacity: 1, rotateZ: [0, 0, -0.7, 0.7, 0] }}
          transition={
            reduced
              ? { duration: 0.01 }
              : {
                  opacity: { duration: 0.2, delay: riseDelay, ease: EASE.reveal },
                  y: { duration: fly, delay: riseDelay, ease: EASE.slam },
                  scale: {
                    duration: fly * 0.86,
                    delay: riseDelay,
                    ease: [EASE.settle, EASE.settle],
                    times: [0, 0.88, 1]
                  },
                  /* ④ 悬停：极轻的左右摆动（±0.7°），让「停住」不等于「冻住」 */
                  rotateZ: {
                    duration: swaySpan / 1000,
                    delay: riseDelay,
                    ease: 'easeInOut',
                    times: [
                      0,
                      riseFrac,
                      riseFrac + (holdEndFrac - riseFrac) * 0.35,
                      riseFrac + (holdEndFrac - riseFrac) * 0.8,
                      1
                    ]
                  }
                }
          }
          onAnimationComplete={() => setAnimating(false)}
          style={reduced || !animating ? undefined : { willChange: 'transform, opacity' }}
        >
          {/* 牌后辉光：纯 CSS 渐变 + 两段 opacity，不加素材。
              ⚠️ translateZ(-60px) 把它压到牌面之后 —— .card 是 preserve-3d 容器，
              翻转中牌面会绕 z=0 平面来回穿，不推远的话辉光会从牌面中间透出来。 */}
          {!reduced && (
            <motion.span
              className="card__halo"
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={haloAnimate}
              transition={haloTransition}
            >
              <span className="card__halo-core" />
            </motion.span>
          )}

          {/* 翻牌方向：CardFace 自带 rotateY(180deg)，所以外层从 0 转到 180 才是
              「先看到牌背 → 翻出牌面」。写成 180 → 0 会反过来，动画结束时停在牌背上
              （这个 bug 一直藏着，因为之前没有截图核验手段，直到用 CDP 截图才发现）。 */}
          <motion.div className="card__flip" initial={{ rotateY: 0 }} animate={flipAnimate} transition={flipTransition}>
            <div className={`card__side card__back${hasBackArt ? ' card__back--art' : ''}`}>
              {hasBackArt ? (
                <img className="card__back-img" src={cardBack} alt="" />
              ) : (
                <div className="card__back-mark">塔罗</div>
              )}
            </div>
            <CardFace card={card} />
          </motion.div>

          {/* 侧向背光：翻到侧面时最暗，正对镜头时最亮 —— 给翻转一个体积感。
              纯装饰，减少动效时不挂。 */}
          {!reduced && (
            <motion.span
              className="card__eclipse"
              aria-hidden="true"
              initial={{ opacity: 1 }}
              animate={{ opacity: [1, 0.85, 0.15, 0.85, 1] }}
              transition={{ duration: flip, delay: flipDelay, times: [0, 0.22, 0.5, 0.78, 1] }}
            />
          )}

          {/* 高光扫过：跨过 90° 之后一道斜白带从左掠过牌面 —— 翻牌唯一的「被点亮」瞬间。
              90° 出现在主力段前 13%（实测），所以这一扫排在 flipAt + flipMain/2。 */}
          {!reduced && (
            <motion.span
              className="card__sheen-sweep"
              aria-hidden="true"
              initial={{ opacity: 0, x: '-130%' }}
              animate={{ opacity: [0, 0.5, 0], x: ['-130%', '130%'] }}
              transition={{
                duration: 0.3,
                delay: at(beats.flipAt + rite.flipMain / 2),
                times: [0, 0.5, 1],
                ease: 'easeOut'
              }}
            />
          )}
        </motion.div>
      </div>
    </div>
  )
}
