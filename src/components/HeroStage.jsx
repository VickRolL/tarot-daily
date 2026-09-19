import { motion, useReducedMotion } from 'framer-motion'
import { ASSETS, EASE, TIMING } from '../config/skin'
import useAssetUrl from '../hooks/useAssetUrl'
import CrystalOrb from './CrystalOrb'
import { HERO_BG_LQIP } from '../config/lqip'

/**
 * 主视觉舞台 = 一块固定 3:2 的底板 `.hero-frame`，内部是**图像坐标系**。
 *
 * 三层素材按槽位叠放，任意一层缺失都不报错：
 *   1) hero-bg      主视觉背景（必要时可再叠 hero-figure 人物层）
 *   2) hero-figure  巫师人物透明层（可选；与主视觉同帧即可自动对齐）
 *   3) hero-orb     水晶球透明层，由 CrystalOrb 渲染成可点击的抽牌按钮
 *
 * 水晶球挂在 `.hero-frame` 上而不是 `.hero-plate` 上：
 * 这样呼吸缩放的动画不会带着可点击的球一起放大缩小。
 *
 * 入场编舞（2026-09-18 手感升级）：**雾气先散、场景后定，两者串行不并列**。
 * plate 延迟 TIMING.entrancePlateDelay 再起跑，并拆成「先亮起来 → 再推近落定」两段，
 * 结束时有极轻的一拍回弹。blur 从 16px 减到 9px 且只在前段归零（缩小全屏滤镜的时间与面积开销）。
 */
export default function HeroStage({ entranceDone, onDraw, orbDisabled, showOrbLabel, charging = false }) {
  const heroBg = useAssetUrl(ASSETS.heroBg)
  const heroFigure = useAssetUrl(ASSETS.heroFigure)
  /**
   * 手部前景层（v2 3D 化新增）。手画在主视觉里，而 3D 球的 canvas 叠在背景之上
   * —— 球会把手盖住。所以把手抠成一层（scripts/build_hero_hand.py），
   * 用高于 `.orb` 的 z-index 叠在球前面，读作「手托着球」。
   *
   * ⚠️ 它**只在 `entranceDone` 之后挂载**，这是刻意的：
   *   · 入场期（scale 1.14 → 1）背景里的手还在原位，此时不挂前景层也不会缺手，零额外开销；
   *   · 入场结束那一帧 plate 的 scale 正好落回 1，两层像素**完全重合**，切换不可见；
   *   · 定格后两层挂同一个 `bgBreath`（`.hero-plate--idle`），同相呼吸 → 不会出双影。
   *     （如果两层不同步，背景里的手会和前景层的手分离，看起来就是重影。）
   */
  const heroHand = useAssetUrl(ASSETS.heroHand)
  /** 减少动效时：去掉推近与模糊，只留淡入，且时长压到近零 */
  const reduced = useReducedMotion()

  const bgFailed = heroBg === null
  const bgStyle = bgFailed
    ? undefined
    : { backgroundImage: HERO_BG_LQIP ? `url(${HERO_BG_LQIP})` : undefined }

  const plateClass = `hero-plate${entranceDone ? ' hero-plate--idle' : ''}`

  const layers = (
    <>
      {heroBg && <img className="hero-layer hero-layer--bg" src={heroBg} alt="" style={bgStyle} />}
      {heroFigure && <img className="hero-layer hero-layer--figure" src={heroFigure} alt="" />}
    </>
  )

  return (
    <div className={`hero-frame${bgFailed ? ' hero-frame--fallback' : ''}`}>
      {entranceDone ? (
        <div className={plateClass} aria-hidden="true">
          {layers}
        </div>
      ) : (
        <motion.div
          className="hero-plate"
          initial={reduced ? { opacity: 0 } : { scale: 1.14, opacity: 0, filter: 'blur(9px)' }}
          animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1, filter: 'blur(0px)' }}
          /* 按属性分别给曲线：opacity / blur 先快速完成（前 45%），
             scale 走满全程 —— 于是读起来是「先显形，再推近落定」，
             而不是所有属性一起动（那样只有一种味道，是升级前的老问题）。 */
          transition={
            reduced
              ? { duration: 0.01 }
              : {
                  delay: TIMING.entrancePlateDelay / 1000,
                  opacity: { duration: (TIMING.entrancePlate / 1000) * 0.45, ease: EASE.reveal },
                  filter: { duration: (TIMING.entrancePlate / 1000) * 0.4, ease: EASE.reveal },
                  scale: { duration: TIMING.entrancePlate / 1000, ease: EASE.settle }
                }
          }
          aria-hidden="true"
        >
          {layers}
        </motion.div>
      )}

      <CrystalOrb onDraw={onDraw} disabled={orbDisabled} showLabel={showOrbLabel} charging={charging} />

      {/* 手部前景层：z-index 高于 .orb，让手出现在 3D 球前面。
          整层铺满画布但只有手部像素不透明，且 pointer-events: none —— 不能吃掉球的点击。 */}
      {heroHand && entranceDone && (
        <div className="hero-hand hero-plate--idle" aria-hidden="true">
          <img className="hero-layer" src={heroHand} alt="" />
        </div>
      )}
    </div>
  )
}
