/* 蓄势拍视觉探针：把画面停在「球正在充能」的那一刻
   ==========================================================================
   为什么要单独停在这一拍：简报（DRAW_RITUAL_BRIEF.md §7-B）要求
   `charging` 透到球上，但「透到了」和「看得出来」是两件事 ——
   uCharge 只是个 uniform，它到底有没有把球变亮，只能看像素。

   做法：轮询等到 3D 接管 → 点球 → **让出 700ms** 再返回。
   shot.mjs 是在 --eval 返回之后才截图的，所以返回那一刻正好停在蓄势中段。
   为什么是 700ms：蓄势拍长 1000ms，js 侧 uCharge 按 0.09/帧平滑跟随
   （≈40 帧、0.67s 到 95%），700ms 时充能已接近满值，且还没进释放拍。

   ⚠️ 不用 --wait 去卡动画帧（简报硬约束 7）：等的是「3D 已接管」这个状态。
   但这里 700ms 那一下是**故意**的定时 —— 目的是把截图停在某一拍中段，
   不是在「抓关键帧」，两者性质不同。要点是别用它去判断节拍。 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const $ = (s) => document.querySelector(s)

const waitFor = async (fn, ms, step = 100) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    let ok = false
    try {
      ok = fn()
    } catch {
      ok = false
    }
    if (ok) return Date.now() - t0
    await sleep(step)
  }
  return null
}

const welcomeAwayMs = await waitFor(() => !$('.welcome'), 12000)
const has3dMs = await waitFor(() => $('.orb--has3d'), 12000)

const scene = $('.scene')
const orb = $('.orb')
const before = {
  sceneClass: scene ? scene.className : null,
  orbClass: orb ? orb.className : null
}

const t0 = performance.now()
orb?.click()
/* 让出 700ms：截图停在蓄势中段 */
await sleep(700)
const t1 = performance.now()

const chargeEl = $('.orb__charge')
const glowEl = $('.orb__glow')
const cs = (el) => (el ? getComputedStyle(el) : null)

return {
  welcomeAwayMs,
  has3dMs,
  sinceClickMs: Math.round(t1 - t0),
  dataPhase: scene ? scene.getAttribute('data-phase') : null,
  sceneClass: scene ? scene.className : null,
  orbClass: orb ? orb.className : null,
  before,
  ariaBusy: orb ? orb.getAttribute('aria-busy') : null,
  charge: {
    present: !!chargeEl,
    opacity: cs(chargeEl)?.opacity ?? null,
    transform: cs(chargeEl)?.transform ?? null,
    animationName: cs(chargeEl)?.animationName ?? null
  },
  glow: { opacity: cs(glowEl)?.opacity ?? null, filter: cs(glowEl)?.filter ?? null },
  /* 球本体的 CSS 缩放（.orb--charging 会微涨）—— 与着色器里的提亮是两套机制 */
  orbTransform: cs(orb)?.transform ?? null,
  chargeDim: (() => {
    const d = $('.scene__charge-dim')
    if (!d) return null
    const s = getComputedStyle(d)
    return { opacity: s.opacity, present: true }
  })(),
  /* 枚举 `.orb` 下每一层的几何与计算样式 —— 用来定位「球外围那圈硬边圆盘」是谁画的。
     为什么不在 CSS 里 grep：注释里有花括号，正则会被带偏（已经试过，空结果）。
     而且真正生效的是**计算后**的值（继承、简写、媒体查询都可能改写），
     读计算值是唯一不会骗人的来源。 */
  layers: (() => {
    const root = $('.orb')
    if (!root) return null
    const rr = root.getBoundingClientRect()
    const c = rr.width / 2
    const R = c // .orb 半径，用来把各层半径换算成 R 的倍数
    return [...root.querySelectorAll('*')].map((el) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      const rad = Math.max(r.width, r.height) / 2
      return {
        cls: el.className || el.tagName,
        /* 相对 .orb 中心的半径，单位 = .orb 半径。硬边圆盘的半径就藏在这个数里 */
        rOverR: +(rad / R).toFixed(3),
        size: [Math.round(r.width), Math.round(r.height)],
        bg: s.backgroundImage === 'none' ? s.backgroundColor : 'gradient',
        shadow: s.boxShadow === 'none' ? null : s.boxShadow,
        border: s.borderTopWidth === '0px' ? null : `${s.borderTopWidth} ${s.borderTopColor}`,
        filter: s.filter,
        opacity: s.opacity,
        display: s.display,
        anim: s.animationName
      }
    })
  })()
}
