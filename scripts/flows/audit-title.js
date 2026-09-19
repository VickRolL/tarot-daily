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

/* 先抽一张牌，把「标题 vs 卡牌」的冲突暴露出来。
   ⚠️ 必须等到 **revealed**：副标题在 charging / drawing 两拍是被**刻意清空**的
   （渲染成 nbsp 占位，见 App.jsx 的 headlineSub），那时量到的 `.headline__sub`
   宽度只有 6.7px、文案是空串 —— 拿它去算「副标题与牌面的净空」全是假的。 */
const orb = document.querySelector('.orb')
if (orb) orb.click()
const tWait = Date.now()
while (Date.now() - tWait < 12000) {
  if (document.querySelector('.scene')?.dataset.phase === 'revealed') break
  await sleep(120)
}
await sleep(500)

const headline = document.querySelector('.headline')
const title = document.querySelector('.headline__title')
const sub = document.querySelector('.headline__sub')
const rule = document.querySelector('.headline__rule')
const card = document.querySelector('.card')
const topbar = document.querySelector('.topbar')

const R = {
  topbar: rect(topbar),
  headline: rect(headline),
  title: rect(title),
  sub: rect(sub),
  rule: rect(rule),
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

/* 副标题底边 → 牌面顶边的净空。这正是 2026-09-20 用户说「卡牌有点靠上、
   与副标题有点重叠」的那个距离，也是**唯一由 TITLE_GAP 决定**的量
   （挪卡牌、改卡高都只是让它两一起平移，间距恒等于 gap）。 */
out.gaps = {
  subToCard: R.sub && R.card ? px(R.card.y - R.sub.bottom) : null,
  headlineTop: R.headline ? px(R.headline.y) : null,
  cardTopPct: R.card ? px((R.card.y / innerHeight) * 100) : null,
  cardBottomPct: R.card ? px((R.card.bottom / innerHeight) * 100) : null
}
/* 门槛 30：TITLE_GAP 是 38，留 8px 容差（文字墨迹会比行盒再高一点） */
out.PASS_subCardGap = out.gaps.subToCard !== null && out.gaps.subToCard >= 30
/* 标题带整块不许被顶出屏幕上边缘（它是往上锚定的，字越大越危险） */
out.PASS_titleOnScreen = out.gaps.headlineTop !== null && out.gaps.headlineTop >= 4
/* 标题 / 副标题的**墨迹**不许与顶栏那几段文字二维相交。
   2026-09-20 抓到的实例：窄屏把上限提到 42px 后，「今」的左边缘 141.5
   撞上「TAROT · 日签」的右边缘 143.9（相交 2.4px）—— 只看「有没有伸进顶栏那条带」
   是抓不到的，必须按二维算。 */
out.PASS_noTopbarHit = out.band.titleHitsTopbar.length === 0 && out.band.subHitsTopbar.length === 0

/* 碑铭线：既要在副标题下方（不能压字），又不能落到牌面顶边上。
   它落在 TITLE_GAP 那 38px 里，是全站唯一「在标题带与牌面之间」的东西，
   所以两条都要查。 */
out.rule = R.rule
  ? {
      ...R.rule,
      gapBelowSub: R.sub ? px(R.rule.y - R.sub.bottom) : null,
      gapToCard: R.card ? px(R.card.y - R.rule.bottom) : null
    }
  : null
out.PASS_rulePlaced =
  !!out.rule &&
  out.rule.gapBelowSub !== null &&
  out.rule.gapBelowSub >= 2 &&
  out.rule.gapToCard !== null &&
  out.rule.gapToCard >= 8

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
