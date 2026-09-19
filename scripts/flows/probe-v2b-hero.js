/**
 * v2 主视觉换图 + 球径 31→40 之后的落点探针。
 *
 * 判据（全部要能和 src/config/skin.js 的常量直接对上）：
 *   orbImgPct    球心换算到「主视觉画布坐标」→ 必须仍是 (50, 61.5)
 *   orbSizeCqh   球直径占画布高 → 必须是 40
 *   orbGateVsCard 球顶到卡牌底边的净空（px，正数=分得开）
 *   heroNatural  主视觉素材的真实宽度 → 必须是 1536（否则在吃 CSS 兜底）
 *   visibleBand  从 .hero-frame 的实测 rect 反推「屏幕上实际看得见画布哪一段」
 *   inViewport   球与手那一段有没有落在可见带里
 *
 * 用法（配合 skill 的 shot.mjs）：
 *   "$N" <skill>/assets/shot.mjs http://127.0.0.1:4188/ out.png \
 *     --w 1582 --h 804 --wait 7000 --eval-file scripts/flows/probe-v2b-hero.js
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const px = (v) => Math.round(v * 10) / 10

/* 等入场动画彻底结束：.welcome 卸载 + 主视觉就位 */
const waitFor = async (fn, timeout = 12000) => {
  const t0 = performance.now()
  while (performance.now() - t0 < timeout) {
    if (fn()) return true
    await sleep(100)
  }
  return false
}
const welcomeGone = await waitFor(() => !document.querySelector('.welcome'))
await sleep(600)

const frame = document.querySelector('.hero-frame')
const orb = document.querySelector('.orb')
const plate = document.querySelector('.hero-plate img, .hero-plate')
if (!frame || !orb) return { error: 'no frame/orb', frame: !!frame, orb: !!orb }

const fr = frame.getBoundingClientRect()
const or = orb.getBoundingClientRect()
const card = document.querySelector('.card')
const panel = document.querySelector('.panel')

/* DOM 坐标 → 主视觉画布百分比（画布会被 max(104vw,104vh*1.5) 外扩，rect 就是画布本身） */
const toCanvas = (x, y) => [
  px(((x - fr.left) / fr.width) * 100),
  px(((y - fr.top) / fr.height) * 100)
]

const orbCenter = toCanvas(or.x + or.width / 2, or.y + or.height / 2)
const orbTop = toCanvas(or.x + or.width / 2, or.y)
const orbBottom = toCanvas(or.x + or.width / 2, or.y + or.height)

/* 屏幕上实际看得见画布哪一段：视口被画布覆盖到的比例 */
const visTop = px(((0 - fr.top) / fr.height) * 100)
const visBottom = px(((innerHeight - fr.top) / fr.height) * 100)
const visLeft = px(((0 - fr.left) / fr.width) * 100)
const visRight = px(((innerWidth - fr.left) / fr.width) * 100)

const img = document.querySelector('.hero-plate img')

const out = {
  viewport: [innerWidth, innerHeight],
  welcomeGone,
  frame: { rect: { x: px(fr.x), y: px(fr.y), w: px(fr.width), h: px(fr.height) } },
  visibleBand: { x: [visLeft, visRight], y: [visTop, visBottom] },
  orb: {
    rect: { x: px(or.x), y: px(or.y), w: px(or.width), h: px(or.height) },
    centerPctViewport: [px(((or.x + or.width / 2) / innerWidth) * 100), px(((or.y + or.height / 2) / innerHeight) * 100)],
    centerPctCanvas: orbCenter,
    topPctCanvas: orbTop[1],
    bottomPctCanvas: orbBottom[1],
    sizePctCanvasH: px((or.height / fr.height) * 100),
    fullyVisible: or.top >= 0 && or.bottom <= innerHeight
  },
  card: card
    ? {
        bottom: px(card.getBoundingClientRect().bottom),
        bottomPctViewport: px((card.getBoundingClientRect().bottom / innerHeight) * 100)
      }
    : null,
  clearanceOrbToCard: card ? px(or.top - card.getBoundingClientRect().bottom) : null,
  panelTopPctViewport: panel ? px((panel.getBoundingClientRect().top / innerHeight) * 100) : null,
  heroImg: img ? { src: img.getAttribute('src'), naturalWidth: img.naturalWidth } : 'no .hero-plate img',
  lqipBg: plate ? getComputedStyle(plate).backgroundImage.slice(0, 60) : null
}

/* 断言：和常量对照 */
out.checks = [
  { name: '球心 canvas x ≈ 50', got: orbCenter[0], ok: Math.abs(orbCenter[0] - 50) <= 1 },
  { name: '球心 canvas y ≈ 61.5', got: orbCenter[1], ok: Math.abs(orbCenter[1] - 61.5) <= 1.5 },
  { name: '球径 ≈ 画布高 40%', got: out.orb.sizePctCanvasH, ok: Math.abs(out.orb.sizePctCanvasH - 40) <= 1.5 },
  { name: '球与卡牌不重叠（净空>0）', got: out.clearanceOrbToCard, ok: out.clearanceOrbToCard !== null && out.clearanceOrbToCard > 0 },
  { name: '主视觉素材真实宽度 = 1536', got: out.heroImg.naturalWidth, ok: out.heroImg.naturalWidth === 1536 }
]
out.pass = out.checks.every((c) => c.ok)
return out
