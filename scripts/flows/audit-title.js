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
/** 二维相交：严格的「是 / 否」（面积判据在细长条上不可靠） */
const hit2 = (a, b) =>
  !!a && !!b && !(a.right <= b.x || a.x >= b.right || a.bottom <= b.y || a.y >= b.bottom)

const out = { viewport: [innerWidth, innerHeight] }

/* 先抽一张牌，把「标题 vs 卡牌」的冲突暴露出来 */
const orb = document.querySelector('.orb')
if (orb) orb.click()
await sleep(2800)

const headline = document.querySelector('.headline')
const title = document.querySelector('.headline__title')
const sub = document.querySelector('.headline__sub')
const card = document.querySelector('.card')
const topbar = document.querySelector('.topbar')

const R = {
  topbar: rect(topbar),
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

/* h1 是块级、占满整行，`getBoundingClientRect()` 量不到文字本身的宽度。
   要判断「加粗加大之后会不会横向撞上顶栏的文字」，必须量**文字的墨迹范围** → 用 Range。 */
const textRect = (el) => {
  if (!el || !el.firstChild) return null
  const r = document.createRange()
  r.selectNodeContents(el)
  const b = r.getBoundingClientRect()
  return { x: px(b.x), right: px(b.right), w: px(b.width), h: px(b.height), y: px(b.y), bottom: px(b.bottom) }
}

/* 标题带**从卡牌顶边往上锚定**，所以加大字号是往上长 —— 真正的天花板是
   ① 视口顶（顶到 0 就被裁）② .topbar 的内容（它是整行 flex，左右各有东西）。
   这两条原来没有探针在量，「标题被卡牌盖住」修好之后就一直没人回头看上限。
   这里量的是「还剩多少 px 可长」，负数 = 已经越界。 */
out.band = {
  viewportH: innerHeight,
  topbarBottom: R.topbar ? R.topbar.bottom : null,
  headlineTop: R.headline ? R.headline.y : null,
  /* 距视口顶的余量（标题往上还能长多少才被裁） */
  roomToViewportTop: R.headline ? px(R.headline.y) : null,
  /* 标题带整块高度（= 当前字号下的实际占用） */
  headlineHeight: R.headline ? R.headline.h : null,
  /* 标题带顶边与顶栏内容底边的关系：正数 = 已经伸进顶栏那条带里 */
  intrudesTopbarBy: R.headline && R.topbar ? px(Math.max(0, R.topbar.bottom - R.headline.y)) : null,
  /* 文字的墨迹范围（判断横向会不会撞上顶栏两侧的内容） */
  titleText: textRect(title),
  subText: textRect(sub),
  /* 顶栏里**每一段文字**的实际矩形。标题带是「从卡牌顶边往上锚定」的，
     视口一矮就必然长进顶栏那条 y 带里（688 高的视口下，顶栏底 67、卡牌顶 106，
     中间只有 39px，装不下标题+副标题）。所以真正要判的不是「有没有伸进去」，
     而是**伸进去之后有没有撞上顶栏的文字** —— 那是一个二维相交问题 */
  topbarItems: [...document.querySelectorAll('.topbar > *')]
    .flatMap((wrap) => (wrap.children.length ? [...wrap.children] : [wrap]))
    .map((el) => ({ text: el.textContent.trim().slice(0, 12), ...rect(el) }))
    .filter((r) => r.w > 0 && r.text)
}

/* 标题 / 副标题的文字墨迹 vs 顶栏各段文字 —— 二维相交才算撞上 */
const hitsWith = (t) => (t ? out.band.topbarItems.filter((it) => hit2(t, it)).map((it) => it.text) : [])
out.band.titleHitsTopbar = hitsWith(out.band.titleText)
out.band.subHitsTopbar = hitsWith(out.band.subText)
/* 横向还能长多少：居中文字在各段顶栏文字之间剩下的最大可用宽度 */
out.band.titleRoomPx = (() => {
  const t = out.band.titleText
  if (!t) return null
  const rows = out.band.topbarItems.filter((it) => hit2({ ...t, x: 0, right: innerWidth }, it))
  if (!rows.length) return { px: innerWidth, note: '标题竖直方向与顶栏文字不重叠，整行可用' }
  const leftLimit = Math.max(...rows.filter((it) => it.x < innerWidth / 2).map((it) => it.right), 0)
  const rightLimit = Math.min(...rows.filter((it) => it.x >= innerWidth / 2).map((it) => it.x), innerWidth)
  return {
    px: px(rightLimit - leftLimit),
    leftLimit: px(leftLimit),
    rightLimit: px(rightLimit),
    note: '标题竖直方向会与顶栏文字重叠，只能用这条横向空档'
  }
})()

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
