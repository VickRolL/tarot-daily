import { useEffect, useRef } from 'react'
import CardFace from './CardFace'

/**
 * 牌卡完整解读（覆盖层，2026-09-20 第二十一轮）
 *
 * ── 为什么要有这一层，而不是把内容都塞进解读面板 ──────────────────────
 * 解读面板是「bottom 锚定 + 内容撑高」，可用高度只有**视口高的 38.5%**
 * （卡牌底边固定在 61.5%，上面那段就不属于它了）。实测桌面端净空只有
 * 39.2px、竖屏最长文案只剩 10.7px —— 再加几百字象征解读必然压到卡牌上。
 * 而面板一旦「限高 + 内部滚动」，底部的主 CTA 会被挤出可视区，
 * 那比压住 20px 更糟（见 index.css 里那段面板留白的注释）。
 *
 * 所以分工是：**面板负责「快读」，这一层负责「完整」**。
 * 面板的净高一个像素都不变，加深的内容全部住在这一层里。
 *
 * ── 复用 ────────────────────────────────────────────────────────────
 * 图鉴点某张牌、面板点「完整解读」，进来的都是这一层（同一份内容、同一套渲染）。
 * 从图鉴进来时它只是叠在图鉴上面，关掉即回到图鉴 —— 所以不用「返回」按钮。
 *
 * ── 今日建议：这里是**唯一**要区分「从哪扇门进来」的地方（第三十二轮）──────
 * 用户的要求：每张牌备 3~5 条今日建议，抽到哪条算哪条，**而且不能在牌之图鉴里查看**。
 *
 * 所以 `advice` 是**可选** prop：
 *   · 面板 → 完整解读：把刚抽到的那条传进来，照常显示（它就正显示在面板上，
 *     在这里藏起来反而像少了一块）；
 *   · 图鉴 → 完整解读：不传。这里渲染一句「抽到才揭晓」的说明，**一个字的建议
 *     正文都不出现**。
 * 判据是「进来的门是哪一扇」，不是「这张牌今天抽到过没有」——
 * 后者会漏：用户从图鉴点回今天抽到的那张，对象是同一个。
 *
 * 守这条口径的是 `scripts/flows/probe-advice.js` 与 `probe-gallery.js`：
 * 后者会遍历 `.detail` 的整段文本，确认里面找不到该牌的任何一条建议原文。
 */
export default function CardDetail({ card, advice, onClose }) {
  const closeRef = useRef(null)

  /* Esc 关闭 + 进来先把焦点挪到关闭键上（键盘用户不至于迷失在背后的页面上） */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="detail"
      role="dialog"
      aria-modal="true"
      aria-label={`${card.nameZh} · 完整解读`}
      onClick={onClose}
    >
      {/* 点背景关闭，但点内容区不关 —— 否则选中文字时会误关 */}
      <div className="detail__sheet" onClick={(e) => e.stopPropagation()}>
        <div className="detail__bar">
          <span className="detail__bar-kicker">
            {card.num} · {card.nameEn.toUpperCase()}
          </span>
          <button type="button" className="detail__close" onClick={onClose} ref={closeRef}>
            关闭
          </button>
        </div>

        <div className="detail__body">
          <div className="detail__art">
            <CardFace card={card} flat />
          </div>

          <div className="detail__text">
            <div className="detail__meta">
              <span>{card.element}</span>
              <span>{card.astrology}</span>
            </div>
            <h2 className="detail__name">{card.nameZh}</h2>
            <div className="detail__tags">
              {card.keywords.map((word) => (
                <span className="detail__tag" key={word}>
                  {word}
                </span>
              ))}
            </div>

            <section className="detail__block">
              <h3 className="detail__label">象征</h3>
              <p className="detail__text-body detail__text-body--quote">{card.symbol}</p>
            </section>

            <section className="detail__block">
              <h3 className="detail__label">正位含义</h3>
              <p className="detail__text-body">{card.meaning}</p>
            </section>

            {/* 今日建议：两条互斥分支。图鉴那条**只写说明、不写建议**。
                `data-advice` 是给探针用的结构标记 —— 靠它断言「哪一条分支在渲染」，
                比在整页文本里搜字符串可靠（免得某张牌的象征文案里恰好有类似措辞）。 */}
            {advice ? (
              <section className="detail__block" data-advice="revealed">
                <h3 className="detail__label">今日建议</h3>
                <p className="detail__text-body detail__text-body--advice">{advice}</p>
              </section>
            ) : (
              <section className="detail__block" data-advice="sealed">
                <h3 className="detail__label">今日建议</h3>
                <p className="detail__text-body detail__text-body--sealed">
                  抽到这张牌时才会揭晓。每张牌都备了几条，具体是哪一条，抽到那一刻才知道。
                </p>
              </section>
            )}

            <div className="detail__oath">
              <section className="detail__oath-col detail__oath-col--favor">
                <h3 className="detail__label">宜</h3>
                <ul>
                  {card.favor.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
              <section className="detail__oath-col detail__oath-col--avoid">
                <h3 className="detail__label">忌</h3>
                <ul>
                  {card.avoid.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
