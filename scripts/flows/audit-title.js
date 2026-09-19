/**
 * 标题遮挡探针：量出「今夜一签」标题 / 副标题 与 卡牌 的重叠关系。
 * 跑法：
 *   "$N" scripts/shot.mjs http://127.0.0.1:5173/ out.png --eval-file scripts/flows/audit-title.js --seed "localStorage.clear()"
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const px = (v) => Math.round(v * 10) / 10
const rect = (el) => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height), bottom: px(r.bottom), right: px(r.right) }
}
const overlap = (a, b) => {
  if (!a || !b) return null
  const w = Math.min(a.right, b.right) - Math.max(a.x, b.x)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)
  return { w: px(Math.max(0, w)), h: px(Math.max(0, h)) }
}

const out = { viewport: [innerWidth, innerHeight] }

/* 先抽一张牌，把「标题 vs 卡牌」的冲突暴露出来 */
const orb = document.querySelector('.orb')
if (orb) orb.click()
await sleep(2800)

const headline = document.querySelector('.headline')
const title = document.querySelector('.headline__title')
const sub = document.querySelector('.headline__sub')
const card = document.querySelector('.card')

const R = {
  headline: rect(headline),
  title: rect(title),
  sub: rect(sub),
  card: rect(card)
}
out.rects = R
out.pctOfViewport = {
  headlineTop: R.headline ? px((R.headline.y / innerHeight) * 100) : null,
  headlineBottom: R.headline ? px((R.headline.bottom / innerHeight) * 100) : null,
  titleTop: R.title ? px((R.title.y / innerHeight) * 100) : null,
  titleBottom: R.title ? px((R.title.bottom / innerHeight) * 100) : null,
  subBottom: R.sub ? px((R.sub.bottom / innerHeight) * 100) : null,
  cardTop: R.card ? px((R.card.y / innerHeight) * 100) : null
}

out.overlapTitleCard = overlap(R.title, R.card)
out.overlapSubCard = overlap(R.sub, R.card)
out.overlapHeadlineCard = overlap(R.headline, R.card)

/* 层级：谁压在谁上面 */
const z = (sel) => {
  const el = document.querySelector(sel)
  if (!el) return null
  // 沿祖先链找最近的非 auto z-index
  let cur = el
  while (cur && cur !== document.documentElement) {
    const v = getComputedStyle(cur).zIndex
    if (v && v !== 'auto') return { sel, nearestZ: v, on: cur.className || cur.tagName }
    cur = cur.parentElement
  }
  return { sel, nearestZ: 'auto', on: null }
}
out.zIndex = { headline: z('.headline'), card: z('.card'), stage: z('.stage') }

/* 牌的位置锚点与卡高（判断该往哪让） */
out.layout = {
  anchorY: document.querySelector('.stage__anchor')?.style.top ?? null,
  cardHeightVh: R.card ? px((R.card.h / innerHeight) * 100) : null
}

/* 标题文案 */
out.text = {
  title: title?.textContent?.trim(),
  sub: sub?.textContent?.trim()
}

return out
