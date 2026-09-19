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
 */
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
    let frame = 0
    let particles = []

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const { clientWidth: w, clientHeight: h } = canvas
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      particles = Array.from({ length: density }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.7 + 0.4,
        vy: -(Math.random() * 0.32 + 0.08),
        vx: (Math.random() - 0.5) * 0.16,
        alpha: Math.random() * 0.5 + 0.14,
        phase: Math.random() * Math.PI * 2
      }))
      ctx.clearRect(0, 0, w, h)
    }

    /** 球心（视口坐标，canvas 满屏所以就是画布坐标）；取不到时返回 null，收束自动跳过 */
    const orbCenter = () => {
      const orb = document.querySelector('.orb')
      if (!orb) return null
      const r = orb.getBoundingClientRect()
      if (!r.width) return null
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    }

    const draw = () => {
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

      frame = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [density])

  return <canvas ref={canvasRef} className="particles" aria-hidden="true" />
}
