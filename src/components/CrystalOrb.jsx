import { useState } from 'react'
import { ASSETS } from '../config/skin'
import useAssetUrl from '../hooks/useAssetUrl'

/**
 * 水晶球 = 抽牌按钮。
 *
 * `hero-orb` 透明底素材就位时，自动叠在代码绘制的球体上；
 * 缺图时纯代码绘制的球体仍然完整可点、动画照跑 —— 素材可以分步替换。
 *
 * 位置与尺寸不写在这里，全部来自 src/config/skin.js 的 ANCHORS.orb，
 * 经 applySkinVars() 灌成 CSS 变量（.orb 是 .hero-frame 的子元素，
 * 所以它的百分比就是主视觉画布里的百分比，与拆层素材天然对齐）。
 *
 * 手感（2026-09-18 升级）—— 这是全站唯一的主 CTA，升级前它对交互零反馈
 * （`:hover` / `:active` / `:focus-visible` 一条规则都没有），按下时手感是「死的」：
 *
 *   1. **按下立刻缩**（`:active` → scale .955，90ms）。这是「跟手」的来源 ——
 *      反馈不能排在「抬手之后」或某个计时器上，必须压在按下那一刻。
 *   2. **松开回弹**（本组件用 framer 做 1.06 → 1.0 的落定，260ms）。先缩再弹，
 *      手感才不是一块被压扁的贴图。
 *   3. **悬停微涨 + 光环提亮**（`:hover`，180ms），读成「可以点我」。
 *   4. **焦点环**（`:focus-visible`）。键盘用户必须看得见焦点在哪 ——
 *      这是无障碍要求，不是装饰。
 */
export default function CrystalOrb({ onDraw, disabled = false, showLabel = true, charging = false }) {
  /** undefined = 探测中 / string = 可用 / null = 没有素材，走代码绘制 */
  const orbArt = useAssetUrl(ASSETS.heroOrb)
  /** 松开后的回弹：0 = 静止，1 = 刚好松开（用于打一拍 1.06 → 1.0） */
  const [released, setReleased] = useState(false)

  const handleClick = (e) => {
    if (disabled) return
    // 先给一次「松开回弹」，再交给抽牌流程；回弹只有 260ms，不阻塞抽牌
    setReleased(true)
    window.setTimeout(() => setReleased(false), 260)
    onDraw?.(e)
  }

  return (
    <button
      type="button"
      /* ⚠️ `.orb.orb--released` 与 `.orb.orb--charging` 会短暂共存（回弹 260ms > 点击后
         同一帧就进 charging）。两个 animation 属性互相覆盖，CSS 里已让 charging 接管 ——
         所以 orbCharge 的起手值特意接在回弹的 1.06 附近，不靠回弹也不会「弹回去再缩一下」。 */
      className={`orb${released ? ' orb--released' : ''}${charging ? ' orb--charging' : ''}`}
      onClick={handleClick}
      disabled={disabled}
      aria-busy={charging || undefined}
      aria-label="点击水晶球抽一张塔罗牌"
    >
      <span className="orb__glow" aria-hidden="true" />
      <span className="orb__ring" aria-hidden="true" />
      <span className="orb__ring orb__ring--delayed" aria-hidden="true" />
      {/* ① 蓄势：内收的充能环，只在 charging 期可见 */}
      <span className="orb__charge" aria-hidden="true" />

      <span className="orb__body" aria-hidden="true">
        <span className="orb__swirl" />
        <span className="orb__nebula" />
        {typeof orbArt === 'string' && <img className="orb__art" src={orbArt} alt="" />}
        <span className="orb__sheen" />
      </span>

      {showLabel && !disabled && <span className="orb__label">轻触水晶球 · 抽取今日之牌</span>}
    </button>
  )
}
