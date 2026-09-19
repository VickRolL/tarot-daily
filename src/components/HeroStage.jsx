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
    </div>
  )
}
