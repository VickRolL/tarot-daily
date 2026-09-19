import { useEffect, useState } from 'react'
import { MAJOR_ARCANA } from '../data/cards'
import { ASSETS } from '../config/skin'
import CardFace from './CardFace'

/**
 * 牌面总览（仅开发环境可见）
 * 用途：一眼核对 22 张牌的边框是否完全统一、哪些牌还缺插画素材。
 * 牌面复用 CardFace，与抽牌场景渲染的是同一套组件。
 *
 * 「已接入插画」是运行时真实探测出来的（逐个加载 cards/<牌号> 的首个候选地址），
 * 不是写死的清单——所以以后补了新牌面，这里会自动亮起来。
 */
export default function CardGallery({ onClose }) {
  const [readyIds, setReadyIds] = useState(null)

  useEffect(() => {
    let alive = true
    const found = new Set()
    const probes = MAJOR_ARCANA.map((card) => {
      const candidates = ASSETS.cardFace(card.id)
      return new Promise((resolve) => {
        const probe = new Image()
        probe.onload = () => {
          found.add(card.id)
          resolve()
        }
        probe.onerror = () => resolve()
        probe.src = Array.isArray(candidates) ? candidates[0] : candidates
      })
    })
    Promise.all(probes).then(() => {
      if (alive) setReadyIds(found)
    })
    return () => {
      alive = false
    }
  }, [])

  const ready = readyIds ?? new Set()
  const probing = readyIds === null

  return (
    <div className="gallery">
      <div className="gallery__bar">
        <strong>牌面总览</strong>
        <span className="gallery__hint">
          {probing
            ? '正在探测素材…'
            : `共 ${MAJOR_ARCANA.length} 张 · 已接入插画 ${ready.size} 张${
                ready.size < MAJOR_ARCANA.length ? ' · 其余为缺图降级态' : ''
              }`}
        </span>
        <button type="button" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="gallery__grid">
        {MAJOR_ARCANA.map((card) => (
          <figure className="gallery__item" key={card.id}>
            <div className="gallery__card">
              <CardFace card={card} flat />
            </div>
            <figcaption className="gallery__meta">
              <span className={ready.has(card.id) ? 'gallery__dot gallery__dot--on' : 'gallery__dot'} />
              {card.num} {card.nameZh}
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="gallery__foot">
        卡框素材：{ASSETS.cardFrame.join(' → ')}　|　插画槽位：cards/&lt;牌号&gt;.webp → .png
      </p>
    </div>
  )
}
