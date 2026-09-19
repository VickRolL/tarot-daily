import { useEffect, useRef } from 'react'

/**
 * 前景星屑粒子：实时绘制，比贴图更轻、更灵动，也不占素材体积。
 *
 * `converge`（2026-09-19）：0 → 1 表示「向水晶球收束」。
 * 抽牌蓄势期用它把满屏飘散的星屑往球心吸、同时提亮 —— 环境第一次对事件做出反应，
 * 事件才不像「贴在画面上的贴纸」（这是原先抽牌读起来假的原因之一）。
 *
 * ⚠️ 硬要求：`converge === 0` 时的行为必须与加这个 prop 之前**逐帧等价**。
 * 所以收束项不是「乘以 0」而是整段 `if` 跳过 —— 浮点乘 0 虽然也是 0，
 * 但把常量写死在另一条分支里，以后有人改系数就不会污染静止态。
 *
 * 球心用**实测**取（`getBoundingClientRect`），不要从常量推算：
 * 球在 `.hero-frame` 里用百分比 + cqh 定位，视口坐标随视口比例变化，算不出来。
 *
 * `prefers-reduced-motion`（2026-09-19 补）：原来这里**没有**这个分支，
 * 是全站动效里唯一漏掉的一处 —— 全屏星屑会一直在飘、一直在闪，
 * 而这恰恰是前庭敏感用户最难受的那类动效。现在 reduced 时只画**一帧**静态星屑，
 * 不起 rAF 循环；`resize` 时补画一帧（否则重排后星屑会整层消失，
 * 因为 resize 里 clearRect 了却没人再画）。
 */
/** 只在浏览器里读，且 matchMedia 可能不存在（老内核）—— 读不到就当作「不减少」 */
const prefersReduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

export default function ParticleField({ density = 70, converge = 0 }) {
  const canvasRef = useRef(null)
  /** 目标收束值（props 来的，突变） */
  const targetRef = useRef(converge)
  /** 当前实际收束值（帧内缓动，避免点击瞬间星屑整体弹一下） */
  const curRef = useRef(converge)

  useEffect(() => {
    targetRef.current = converge
  }, [converge])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    /** 减少动效：只画一帧静态星屑，不起 rAF 循环（见文件头注释） */
    const still = prefersReduced()
    let frame = 0
    let particles = []

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const { clientWidth: w, clientHeight: h } = canvas
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      /* 减少动效时**不重新撒点** —— 那会让静态星屑在每次重排后跳一次位置，
         而「跳一下」正是 reduced 想避免的东西。
         点坐标存的是 CSS px，画布尺寸变了也不影响它们仍落在可视区内。 */
      if (!still || particles.length === 0) {
        particles = Array.from({ length: density }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.7 + 0.4,
          vy: -(Math.random() * 0.32 + 0.08),
          vx: (Math.random() - 0.5) * 0.16,
          alpha: Math.random() * 0.5 + 0.14,
          phase: Math.random() * Math.PI * 2
        }))
      }
      ctx.clearRect(0, 0, w, h)
      /* 减少动效时没有「下一帧」可等，这里必须当场补画 ——
         否则重排后星屑会整层消失（clearRect 了却没人再画）。 */
      if (still) step(false)
    }

    /** 球心（视口坐标，canvas 满屏所以就是画布坐标）；取不到时返回 null，收束自动跳过 */
    const orbCenter = () => {
      const orb = document.querySelector('.orb')
      if (!orb) return null
      const r = orb.getBoundingClientRect()
      if (!r.width) return null
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    }

    /** 画一帧。`loop=false` 时不排下一帧 —— 减少动效与 resize 补画都走这条路。 */
    const step = (loop) => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight

      /* 收束值缓入：0.08 的步长约 0.5s 走完，和蓄势拍（1s）的起手对上 */
      const t = targetRef.current
      const c = curRef.current
      const conv = Math.abs(t - c) < 0.002 ? t : c + (t - c) * 0.08
      curRef.current = conv

      const center = conv > 0.001 ? orbCenter() : null
      const pull = center ? 0.016 * conv : 0
      const bright = 1 + conv * 0.85

      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'

      particles.forEach((p) => {
        p.y += p.vy
        p.x += p.vx + Math.sin(p.phase) * 0.12
        p.phase += 0.012

        /* ⚠️ 这一整段只在收束时才执行 —— converge 为 0 时逐帧等价于加本 prop 之前 */
        if (pull && center) {
          p.x += (center.x - p.x) * pull
          p.y += (center.y - p.y) * pull
        }

        if (p.y < -8) {
          p.y = h + 8
          p.x = Math.random() * w
        }
        if (p.x < -8) p.x = w + 8
        if (p.x > w + 8) p.x = -8

        const twinkle = 0.62 + Math.sin(p.phase * 1.6) * 0.38
        ctx.beginPath()
        ctx.fillStyle = `rgba(214, 198, 255, ${Math.min(1, p.alpha * twinkle * bright)})`
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      })

      frame = loop ? requestAnimationFrame(() => step(true)) : 0
    }

    resize()
    /* resize() 在 still 时已经补画过一帧，这里就不要再画一次 */
    if (!still) step(true)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [density])

  return <canvas ref={canvasRef} className="particles" aria-hidden="true" />
}
