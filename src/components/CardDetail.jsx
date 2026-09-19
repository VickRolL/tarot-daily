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
 */
export default function CardDetail({ card, onClose }) {
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

            <section className="detail__block">
              <h3 className="detail__label">今日建议</h3>
              <p className="detail__text-body detail__text-body--advice">{card.advice}</p>
            </section>

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
