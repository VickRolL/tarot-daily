import { useState } from 'react'
import { ASSETS } from '../config/skin'
import SmartImage from './SmartImage'

/**
 * 牌面（不含翻转动画），自下而上三层，任何一层缺失都不会报错：
 *   1) 插画层  cards/<id>.webp|png —— 按卡片本体裁剪，缺图退化为程序化渐变底
 *   2) 卡框层  frame.webp|png      —— 22 张共用同一张素材，边框绝对统一（含右下吊牌）
 *   3) 文字层  罗马数字 + 牌名      —— 由代码渲染，永远清晰、可随时换字体或语言
 *
 * 卡框开口位置、卡片本体裁剪量、卡牌比例都在 src/config/skin.js 里，
 * 由 main.jsx 统一灌进 CSS 变量，因此本组件不需要任何几何常量。
 *
 * 抽牌场景与牌面总览共用此组件，保证两处渲染完全一致。
 */
export default function CardFace({ card, flat = false }) {
  const [hasArt, setHasArt] = useState(true)
  const [hasFrame, setHasFrame] = useState(true)

  const faceClass = [
    'card__side',
    'card__face',
    hasArt ? 'card__face--art' : 'card__face--code',
    hasFrame ? 'card__face--framed' : '',
    flat ? 'card__face--flat' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={faceClass}>
      {/* ① 插画层 */}
      {hasArt ? (
        <SmartImage
          className="card__art"
          sources={ASSETS.cardFace(card.id)}
          alt=""
          onAllFailed={() => setHasArt(false)}
        />
      ) : (
        <div className="card__art card__art--fallback" aria-hidden="true" />
      )}

      {/* ② 统一卡框层 */}
      {hasFrame ? (
        <SmartImage
          className="card__frame-img"
          sources={ASSETS.cardFrame}
          alt=""
          onAllFailed={() => setHasFrame(false)}
        />
      ) : (
        <div className="card__frame" aria-hidden="true" />
      )}

      {/* ③ 文字层 */}
      <span className="card__num">{card.num}</span>
      <div className="card__caption">
        <h3 className="card__name">{card.nameZh}</h3>
        <p className="card__name-en">{card.nameEn}</p>
      </div>

      {/* 无插画时补一个代码绘制的符号，避免牌面太空 */}
      {!hasArt && <div className="card__glyph" aria-hidden="true" />}
    </div>
  )
}
