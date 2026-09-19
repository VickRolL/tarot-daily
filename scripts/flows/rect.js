/**
 * 量出抽牌后「牌面」元素的精确位置，用于在截图上做像素级裁剪放大。
 * 配套用法：
 *   node scripts/shot.mjs http://127.0.0.1:5173/ shot.png --w 1600 --h 900 --wait 5200 \
 *        --eval-file scripts/flows/rect.js
 */
document.querySelector('.orb').click()
await new Promise((r) => setTimeout(r, 2800))

const card = document.querySelector('.card__face--framed')
if (!card) return { error: '没找到 .card__face--framed，可能牌已经收回或未渲染' }

const r = card.getBoundingClientRect()
const art = card.querySelector('.card__art')
const frame = card.querySelector('.card__frame-img')

return {
  card: {
    left: +r.left.toFixed(1),
    top: +r.top.toFixed(1),
    width: +r.width.toFixed(1),
    height: +r.height.toFixed(1)
  },
  art: art
    ? {
        src: art.getAttribute('src'),
        naturalWidth: art.naturalWidth,
        objectFit: getComputedStyle(art).objectFit,
        clipPath: getComputedStyle(art).clipPath
      }
    : null,
  frame: frame
    ? { src: frame.getAttribute('src'), naturalWidth: frame.naturalWidth }
    : null,
  faceBg: getComputedStyle(card).backgroundColor,
  viewport: [innerWidth, innerHeight]
}
