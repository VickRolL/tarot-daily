/* 3D 水晶球 + 手部前景层 联合探针
   ==========================================================================
   为什么不能只看「有没有 canvas」：
   2026-09-19 踩到的坑 —— React.StrictMode 下 effect 会「挂载→卸载→再挂载」，
   而 React **复用同一个宿主 DOM 节点**。当时 canvas 是 React 渲染出来的，
   第一个实例在上面建好 WebGL context、卸载时 forceContextLoss 掉，
   第二个实例拿到的还是那个死节点 → 建不出 context → 静默退回 2D。
   表现是：canvas 元素在、CSS 也对，但球是 2D 的。

   所以这里的判据分三层，缺一层都可能误判：
     ① DOM：`.orb--has3d` 有没有挂上（父级对「接管」的确认）
     ② GL ：那张 canvas 上**真的有活着的 WebGL context**（`isContextLost()` 为假）
     ③ 数量：`.orb__canvas` 只能有 **1** 张 —— 多于 1 说明卸载时没摘干净，
            旧的那张被 forceContextLoss 冻住，会和新球叠在一起

   另有手部前景层的几何断言：整层必须铺满画布（它靠「只有手部像素不透明」生效），
   且 z-index 必须高于 `.orb` —— 否则球又一次压在手上面。 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const $ = (s) => document.querySelector(s)

const waitFor = async (fn, ms, step = 120) => {
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

const box = (el) => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return [+r.left.toFixed(1), +r.top.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]
}

/* ① 迎接信封退场 */
const welcomeAwayMs = await waitFor(() => !$('.welcome'), 12000)
/* ② 入场定格（手部前景层只在 entranceDone 之后才挂） */
const heroIdleMs = await waitFor(() => $('.hero-plate--idle'), 8000)
/* ③ 等 3D 接管标记 —— three 是动态 import，要给网络与编译留时间 */
const has3dMs = await waitFor(() => $('.orb--has3d'), 12000)

const canvases = [...document.querySelectorAll('.orb__canvas')]
const canvas = canvases[0] || null

/* 直接问 GL：这是唯一骗不了人的判据。
   getContext 会返回**已存在**的那个上下文，所以这里不会新建一个。 */
let glInfo = null
if (canvas) {
  try {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    glInfo = gl
      ? {
          ok: true,
          lost: gl.isContextLost(),
          version: gl.getParameter(gl.VERSION),
          drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight]
        }
      : { ok: false, lost: null, version: null, drawingBuffer: null }
  } catch (e) {
    glInfo = { ok: false, error: String(e) }
  }
}

const orb = $('.orb')
const hand = $('.hero-hand')
const handImg = hand ? hand.querySelector('img') : null
const stage = $('.orb__stage')

/* 手必须是**前景**：z-index 高于球。两者都不在同一 stacking context 里比较没意义，
   这里只断言数值关系 —— 它们同属 .hero-frame 下的兄弟层。 */
const handZ = hand ? Number(getComputedStyle(hand).zIndex) : null
const orbZ = orb ? Number(getComputedStyle(orb).zIndex) : null

const out = {
  welcomeAwayMs,
  heroIdleMs,
  has3dMs,
  viewport: [innerWidth, innerHeight],
  orbClassName: orb ? orb.className : null,
  orbHas3d: orb ? orb.className.includes('orb--has3d') : null,
  canvasCount: canvases.length,
  canvasClass: canvas ? canvas.className : null,
  canvasBufferPx: canvas ? [canvas.width, canvas.height] : null,
  gl: glInfo,
  stageRect: box(stage),
  orbRect: box(orb),
  hand: {
    present: !!hand,
    rect: box(hand),
    zIndex: handZ,
    display: hand ? getComputedStyle(hand).display : null,
    opacity: hand ? getComputedStyle(hand).opacity : null,
    pointerEvents: hand ? getComputedStyle(hand).pointerEvents : null,
    animationName: hand ? getComputedStyle(hand).animationName : null,
    imgSrc: handImg ? handImg.getAttribute('src') : null,
    imgLoaded: handImg ? handImg.complete && handImg.naturalWidth > 0 : null,
    imgNatural: handImg ? [handImg.naturalWidth, handImg.naturalHeight] : null,
    imgRect: box(handImg)
  },
  zOrderOk: handZ !== null && orbZ !== null ? handZ > orbZ : null,
  /* 3D 接管后 2D 球内层应被关掉，否则两层会互相干扰 */
  swirlDisplay: (() => {
    const s = $('.orb__swirl')
    return s ? getComputedStyle(s).display : null
  })()
}

/* 星屑层的运动检查 —— 判据是**双向**的：
   非 reduced 时必须「动」、reduced 时必须「不动」。
   只测一侧的话，判据本身没被验证过（写错了会永远通过或永远失败）。

   为什么要取**三**次快照而不是两次（2026-09-19 实际踩到）：
   第一版只取两次、间隔 1s，结果 reduced 下也报「变了」。查下来是一次
   **一次性的 resize** —— headless Chrome 的窗口尺寸在首屏之后才稳定，
   会补发一次 resize 事件 → `resize()` 重撒星屑 → 画布变了一次。
   那是「重排」，不是「动效」。三次快照把这段稳定期排除掉：
   先等 1.2s 让一次性事件走完，再看**后两帧**是否一致 —— 那才是稳态。

   为什么这里能直接测而 3D 球不能：这是 2D canvas，`getImageData` 任何时候都有效；
   WebGL 的 canvas 是 `preserveDrawingBuffer: false`，离开渲染帧读到的常是空帧。 */
const reducedActive = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
const particlesEl = $('.particles')
let particlesMotion = null
if (particlesEl) {
  const pctx = particlesEl.getContext('2d')
  if (pctx) {
    /* 抽样 1/61 的字节算 FNV —— 全量 5MB 数组哈希没必要，抽样对「有没有变」完全够 */
    const snap = () => {
      const d = pctx.getImageData(0, 0, particlesEl.width, particlesEl.height).data
      let h = 2166136261
      for (let i = 0; i < d.length; i += 61) {
        h ^= d[i]
        h = Math.imul(h, 16777619)
      }
      return h >>> 0
    }
    await sleep(1200) // 让「窗口稳定」那次一次性 resize 先发生掉
    const h1 = snap()
    await sleep(1000)
    const h2 = snap()
    await sleep(1000)
    const h3 = snap()
    particlesMotion = {
      h1,
      h2,
      h3,
      /* 稳态：后两帧是否一致 —— 这个才是「有没有动画」的判据 */
      settledChanged: h2 !== h3,
      /* 参考：整个观测窗口内变过没有（一次性重排会让它为 true，不作为判据） */
      everChanged: h1 !== h2 || h2 !== h3
    }
  }
}

/* 合成判据：四项全绿才算 3D 真的跑起来了 */
out.reducedActive = reducedActive
out.particles = particlesMotion
out.PASS = {
  has3dFlag: out.canvasCount === 1 && out.orbHas3d === true,
  glAlive: !!(glInfo && glInfo.ok && glInfo.lost === false),
  handInFront: out.zOrderOk === true && !!out.hand.present && out.hand.imgLoaded === true,
  /* 星屑必须跟着 reduced 走：非 reduced 稳态也在变、reduced 稳态不变 */
  particlesHonorReduced: !!particlesMotion && particlesMotion.settledChanged === !reducedActive
}
out.ALL_PASS = Object.values(out.PASS).every(Boolean)

return out
