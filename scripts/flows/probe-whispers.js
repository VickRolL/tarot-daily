/* 两侧低语标签探针（2026-09-20 第二十一轮）
   ==========================================================================
   为什么不能只截图看：低语是**绝对定位 + 百分比锚点**，它压不压到标题/牌面
   取决于「文本实际宽度 + 锚点位置」两个变量的乘积，肉眼在截图上看不出
   「还差多少 px」。而这里的几何契约很紧 —— 中间那条带只有视口宽的 42.8%~57.2%
   是牌面，左边留白也没多宽，一旦某条文案变长就可能越界，而越界的表现只是
   「文字和标题叠在一起」，截图里很容易被当成「设计如此」。

   三层判据：
     ① 数量与容器样式：10 条都在，容器 pointer-events:none（否则吞掉水晶球的点击）、
        z-index 必须 > 3（否则被 .hero-hand 盖住）
     ② 几何：每一条都落在**本侧留白**里，且与 .headline / .card / .panel 零相交
     ③ 轮切：非 reduced 时 data-on 会翻；reduced 时**必须不翻**且全部常亮
        （双向断言 —— 只测一侧的话，判据写反了会永远通过） */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const $ = (s) => document.querySelector(s)

const waitFor = async (fn, ms, step = 150) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try {
      if (fn()) return Date.now() - t0
    } catch {
      /* 元素还没挂上，继续等 */
    }
    await sleep(step)
  }
  return null
}

const welcomeAwayMs = await waitFor(() => !$('.welcome'), 14000)
/* 入场走完、场景进入 idle 之后低语才会浮现 */
await waitFor(() => $('.scene')?.dataset.phase === 'idle', 9000)
const whispersUpMs = await waitFor(() => document.querySelectorAll('.whisper').length > 0, 6000)

const scene = $('.scene')
const host = $('.whispers')
const items = [...document.querySelectorAll('.whisper')]
const reducedActive = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

const box = (el) => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    left: +r.left.toFixed(1),
    top: +r.top.toFixed(1),
    right: +r.right.toFixed(1),
    bottom: +r.bottom.toFixed(1),
    w: +r.width.toFixed(1),
    h: +r.height.toFixed(1)
  }
}

const vw = innerWidth
const vh = innerHeight

/* 参照物：任何一条低语都不许碰到它们 */
const obstacles = {
  topbar: box($('.topbar')),
  headline: box($('.headline')),
  card: box($('.card')),
  orb: box($('.orb')),
  panel: box($('.panel'))
}

const hit = (a, b) =>
  !!a && !!b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)

const hostStyle = host ? getComputedStyle(host) : null

/* 窄屏整层 `display: none`（没有两侧留白）—— 此时 getBoundingClientRect 全是 0，
   几何判据会**假失败**（右侧的「内边缘 ≥ 66%」拿到 0 直接翻负），所以要先认清
   「这一轮根本没有几何可量」。这是判据本身要处理的情况，不是页面有问题。 */
const hostHidden = hostStyle?.display === 'none'
const measurable = items.length > 0 && !hostHidden

/* 窄屏那条 `display:none` 分支要**双向**断言：窄屏必须藏、宽屏必须露。
   只写「藏了就算过」的话，哪天把媒体查询写错成永远隐藏，宽屏也照样通过。 */
const NARROW = 900
const narrowBranchOk = vw >= NARROW ? !hostHidden : hostHidden

const rows = items.map((el, i) => {
  const r = box(el)
  const side = el.dataset.side
  const touching = Object.entries(obstacles)
    .filter(([, ob]) => hit(r, ob))
    .map(([name]) => name)
  /* 内边缘：左侧看右边缘、右侧看左边缘 —— 那才是会往中间顶过去的那条边 */
  const innerPct = side === 'left' ? +(r.right / vw * 100).toFixed(1) : +(r.left / vw * 100).toFixed(1)
  return {
    i,
    side,
    text: el.textContent.trim(),
    on: el.dataset.on === 'true',
    rect: [r.left, r.top, r.right, r.bottom],
    innerPct,
    touching
  }
})

/* ② 几何：内边缘不能越过中线侧的 66% / 34% —— 那之外就是牌面与光晕的地盘 */
const bandOk = !measurable || rows.every((r) => (r.side === 'left' ? r.innerPct <= 34 : r.innerPct >= 66))
const clearOk = !measurable || rows.every((r) => r.touching.length === 0)

/* ③ 轮切：多采样几次，看两件事 ——
   ① 有没有在换（非 reduced 必须换、reduced 必须不换，双向判据）
   ② **同屏条数是不是稳在中间值**。这条是专门为踩过的坑写的：
      第一版相位没用满周期，页面在「10 条全亮」和「只剩 1 条」之间来回摆，
      而只看「变没变」永远测不出来 —— 它确实在变，只是变成了齐涨齐落。 */
function sig() {
  const els = [...document.querySelectorAll('.whisper')]
  return {
    onCount: els.filter((e) => e.dataset.on === 'true').length,
    text: els.map((e) => e.textContent.trim()).join('|')
  }
}

const series = []
for (let k = 0; k < 6; k += 1) {
  series.push(sig())
  if (k < 5) await sleep(2200)
}
const counts = series.map((s) => s.onCount)
const texts = new Set(series.map((s) => s.text))
const minOn = Math.min(...counts)
const maxOn = Math.max(...counts)
const textChanged = texts.size > 1

/* reduced：全部常亮且文字固定；非 reduced：文字必须换过，且同屏条数落在中间带 */
const rotateOk = reducedActive
  ? !textChanged && minOn === items.length && maxOn === items.length
  : textChanged && minOn >= 3 && maxOn <= 9

const countsSeries = counts.join('/')

const out = {
  welcomeAwayMs,
  whispersUpMs,
  viewport: [vw, vh],
  phase: scene ? scene.dataset.phase : null,
  reducedActive,
  count: items.length,
  hostStyle: hostStyle
    ? {
        zIndex: hostStyle.zIndex,
        pointerEvents: hostStyle.pointerEvents,
        opacity: hostStyle.opacity,
        display: hostStyle.display
      }
    : null,
  obstacles,
  rows,
  measurable,
  hostHidden,
  narrowBranchOk,
  bandOk,
  clearOk,
  rotate: { countsSeries, minOn, maxOn, distinctTexts: texts.size, textChanged },
  PASS: {
    count10: items.length === 10,
    /* 不吃点击是硬要求：这层铺满整个视口，吃事件水晶球就点不到了 */
    clickThrough: hostStyle ? hostStyle.pointerEvents === 'none' : false,
    /* z-index 必须显式且 > 3（.hero-hand 是 3），否则整层沉到主视觉后面 */
    aboveHero: hostStyle ? Number(hostStyle.zIndex) > 3 : false,
    bandOk,
    clearOk,
    rotateHonorsReduced: rotateOk,
    /* 窄屏藏 / 宽屏露 —— <900px 没有两侧留白，这层必须整体撤掉 */
    narrowBranch: narrowBranchOk,
    /* 同屏条数稳在中间带：既不是空场也不是糊成一片（窄屏没得量，直接算过）
       ⚠️ 只对**轮切态**成立。reduced 下「10 条全亮」是设计（静态子集），
       拿 minOn≥3 && maxOn≤9 去卡它必然假失败 —— 那测的是轮切节奏，
       不是一个固定画面。这条踩过：宽屏正常、reduced 一跑就红。 */
    spreadSane: !measurable || reducedActive ? true : minOn >= 3 && maxOn <= 9
  }
}
out.ALL_PASS = Object.values(out.PASS).every(Boolean)

return out
