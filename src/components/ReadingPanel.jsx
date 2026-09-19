import { motion, useReducedMotion } from 'framer-motion'
import { EASE, ritual } from '../config/skin'

/**
 * 解读面板。
 *
 * ── 2026-09-19：修掉「空面板挂 1.6 秒」────────────────────────────────
 * 症状（实测）：面板外框在点击后 1457ms 就推上来了，里面**空的**，
 * 第一个子项要到 3063ms 才出现 —— 中间 1.6 秒观众看着一个空壳。
 *
 * 根因是**双重计时**：`App.jsx` 用 `setTimeout(..., panelDelay)` 决定挂载时刻，
 * 而这里又在 variants 的 `transition` **根上**写了同一个 `delay`，等于又等一遍。
 * 更隐蔽的是它「只生效一半」：实测外框在挂载后 15ms 就动了（根 `delay` 被丢弃），
 * 子项却在 1606ms 后才出现（`delayChildren` 生效）—— 因为当每个动画属性都带自己的
 * per-property config 时，根上的 `delay` 会被 per-property 完全接管，
 * 而 `delayChildren` / `staggerChildren` 是另一套编排机制，不受影响。
 *
 * 处置：**延迟只留一处** —— 完全交给 `App.jsx` 的 `beats.panelAt` 计时器，
 * 组件挂载即开始动，这里 `delayChildren` 只写相对值 0.12。
 *
 * 其余手感保留自 2026-09-18 那一轮：推入距离 120px（96 读不出「升起」）、
 * opacity 只占前 45%（先显形再继续推入）、5 组内容依次亮起给出阅读引导。
 *
 * 面板与卡牌不重叠由几何保证（卡高 46vh + ANCHORS.stage.y 38.5），本组件不参与定位。
 */
const containerVariants = (reduced, rite) => ({
  hidden: { opacity: 0, y: reduced ? 0 : 120 },
  show: {
    opacity: 1,
    y: 0,
    /* ⚠️ 这里**不许**再出现 delay。挂载时刻由 App 一处决定（见上面的注释）；
       一旦这里也写一遍，两条计时必然对不上，「空面板」就会回来。 */
    transition: reduced
      ? { duration: 0.01 }
      : {
          opacity: { duration: (rite.panelSlide / 1000) * 0.45, ease: EASE.reveal },
          y: { duration: rite.panelSlide / 1000, ease: EASE.settle },
          // 子项依次亮起（相对编排，不叠绝对延迟）
          staggerChildren: rite.panelStagger / 1000,
          delayChildren: 0.12
        }
  }
})

const itemVariants = (reduced) => ({
  hidden: { opacity: 0, y: reduced ? 0 : 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: reduced ? { duration: 0.01 } : { duration: 0.42, ease: EASE.settle }
  }
})

export default function ReadingPanel({ card, mode, onAgain, onShare, onDetail }) {
  const reduced = useReducedMotion()
  const item = itemVariants(reduced)

  return (
    <motion.section
      className="panel"
      variants={containerVariants(reduced, ritual(reduced))}
      initial="hidden"
      animate="show"
    >
      <div className="panel__inner">
        <motion.p className="panel__kicker" variants={item}>
          {card.num} · {card.nameEn.toUpperCase()}
          {/* 元素与星象（2026-09-20）：拼在**同一行**里，不另起一行 ——
              面板可用高度只有视口高的 38.5%，多一行就等于多啃掉 16~24px，
              竖屏（净空实测只剩 10.7px）直接翻负。 */}
          <span className="panel__kicker-meta">
            {card.element} · {card.astrology}
          </span>
        </motion.p>
        <motion.div className="panel__tags" variants={item}>
          {card.keywords.map((word) => (
            <span className="panel__tag" key={word}>
              {word}
            </span>
          ))}
        </motion.div>
        <motion.p className="panel__text" variants={item}>
          {card.meaning}
        </motion.p>
        <motion.p className="panel__advice" variants={item}>
          今日建议 · {card.advice}
        </motion.p>
        {/* 宜 / 忌：只在**够高的视口**显示（见 index.css 的 min-height 查询）。
            矮视口强行塞进来会把面板顶到卡牌上 —— 那比「少显示一行」严重得多。
            矮屏用户不是没有这份内容，它在「完整解读」里完整地待着。 */}
        <motion.p className="panel__oath" variants={item}>
          <span className="panel__oath-item" data-kind="favor">
            宜 · {card.favor.join(' · ')}
          </span>
          <span className="panel__oath-item" data-kind="avoid">
            忌 · {card.avoid.join(' · ')}
          </span>
        </motion.p>
        <motion.div className="panel__actions" variants={item}>
          <button type="button" className="btn" onClick={onDetail}>
            完整解读
          </button>
          {mode === 'unlimited' && (
            <button type="button" className="btn btn--primary" onClick={onAgain}>
              再抽一次
            </button>
          )}
          <button type="button" className="btn" onClick={onShare}>
            生成分享卡片
          </button>
        </motion.div>
      </div>
    </motion.section>
  )
}
