import { MAJOR_ARCANA } from '../data/cards'
import CardFace from './CardFace'

/**
 * 牌之图鉴（覆盖层，2026-09-20 第二十一轮）
 *
 * ── 这一轮改了什么，为什么 ──────────────────────────────────────────
 * 上一版只在 `DEV_TOOLS` 为真时挂载 —— 定位是**开发工具**（「一眼核对 22 张牌的
 * 边框是否完全统一、哪些牌还缺插画」），所以它带着素材探测点、把「已接入插画
 * N 张」写在标题旁边、脚注写着素材槽位名。对开发者有用，对用户全是噪音。
 *
 * 于是这一轮把它**分成两件事**：
 *   · 素材核对交给脚本与 `contact_sheet.py`（本来就是自动化的活，不需要人眼看）
 *   · 这里专心做**给用户的图鉴**：只看得到牌，点进去看完整解读
 * 代价是丢掉了「哪些牌缺图」的即时提示 —— 但那件事 `CardFace` 自己会兜底
 * （缺图退化为程序化渐变底），不会崩，所以不算真丢了能力。
 *
 * ── 为什么点进去是 CardDetail 而不是把文案摊在格子里 ──────────────────
 * 22 张 × 完整解读（象征 + 含义 + 建议 + 宜忌）平铺会变成一篇没有重点的长文。
 * 网格只负责「选择」，阅读交给 CardDetail 专注做。
 */
export default function CardGallery({ onClose, onPick }) {
  return (
    <div className="gallery" role="dialog" aria-modal="true" aria-label="牌之图鉴">
      <div className="gallery__bar">
        <strong>牌之图鉴</strong>
        <span className="gallery__hint">
          22 张大阿卡纳 · 点任意一张看完整解读
        </span>
        <button type="button" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="gallery__grid">
        {MAJOR_ARCANA.map((card) => (
          <figure className="gallery__item" key={card.id}>
            {/* 用 div + role="button" 而不是 <button>：CardFace 的根是 div，
                而 <button> 只允许短语内容，塞 div 进去是无效 HTML
                （浏览器能忍，但键盘与辅助技术的表现会变得不可预期）。 */}
            <div
              className="gallery__hit"
              role="button"
              tabIndex={0}
              aria-label={`查看 ${card.nameZh} 的完整解读`}
              onClick={() => onPick(card)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onPick(card)
                }
              }}
            >
              <div className="gallery__card">
                <CardFace card={card} flat />
              </div>
            </div>
            <figcaption className="gallery__meta">
              {card.num} · {card.nameZh}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
