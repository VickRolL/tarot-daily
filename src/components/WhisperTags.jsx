import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { WHISPERS as WISP } from '../config/skin'
import { WHISPER_LINES, WHISPER_STATIC_STEP } from '../data/whispers'

/**
 * 主页两侧的低语标签（2026-09-20 第二十一轮）
 *
 * ── 它要解决什么 ────────────────────────────────────────────────────
 * 主页两侧原本是空的，「巫师在对你说话」这层含义只由水晶球下面那行 label 承担。
 * 这里铺一组缓慢轮切的短语，说话人始终是女巫、对象始终是你（文案池见 data/whispers.js）。
 *
 * ── 关键设计：`.whisper` 与 `.whisper__text` 分两层，不要合并 ──────────
 * 和 `.hero-frame` / `.hero-plate` 分开的理由一模一样：**同一元素上的 transform
 * 会互相覆盖**。指针视差写的是 `.whisper` 的 transform，漂浮是 `.whisper__text`
 * 的关键帧动画。合成一层的话后写的那个会静默吃掉前一个。
 *
 * ── 状态语言（全部由 `.scene[data-phase]` 驱动，不需要额外传状态）────────
 *   entrance / welcome  0       场景还没落定，先不出声
 *   idle                .72     常态
 *   charging            .18     你伸手碰球，低语压低（0.4s 快速收，见 index.css）
 *   drawing / revealed  0       牌出来了，把画面让给牌
 * 蓄势那一拍还会把文案**整体换成 `ritual` 池**（「别眨眼」「它在听」）——
 * 此时整层已经很淡，换字读起来就是「低语变了」，不会像闪烁。
 *
 * ── 无障碍 ──────────────────────────────────────────────────────────
 * 整层 `aria-hidden`（纯氛围，不进读屏）。减少动效时：不轮切、不漂浮、不视差，
 * 只留几条固定的话（`WHISPER_STATIC_STEP` 从池里等距抽），且容器不参与过渡。
 */

/** 淡入淡出时长，必须与 index.css 里 `.whisper` 的 `transition: opacity` 一致 ——
 *  换字就卡在「已经淡完」这个时刻上，所以这个数值是逻辑的一部分，不是纯样式。 */
const FADE_MS = 1500

function Whisper({ item, index, rank, groupSize, phase, reduced }) {
  const idle = WHISPER_LINES.idle
  const ritual = WHISPER_LINES.ritual
  const charging = phase === 'charging'
  const pool = charging ? ritual : idle

  const [step, setStep] = useState(0)
  const [on, setOn] = useState(false)
  /** 每条从池子里的不同位置出发，否则 10 条会同时念同一句话 */
  const start = (index * 5) % idle.length

  useEffect(() => {
    if (reduced) {
      setOn(true)
      return undefined
    }
    let alive = true
    const timers = new Set()
    const wait = (ms) =>
      new Promise((resolve) => {
        const id = setTimeout(() => {
          timers.delete(id)
          resolve()
        }, ms)
        timers.add(id)
      })

    const cycle = WISP.holdMs + WISP.gapMs
    /* ── 相位：把一整个周期在同侧的 groupSize 条之间**均分** ──────────────
       为什么不是「第 r 条延后 r × 固定值」：固定值小了（1.7s×4=6.8s < 周期 9.4s）
       所有「亮起」窗口都会挤在周期开头 → 页面在「全亮」与「只剩一条」之间摆（实测 10/6/2）。
       均分之后任意时刻稳定在 3~4 条同时在场，而且开页时 4/5 已经亮着。

       `local` = 这一条「接上时钟」时，它自己已经走到周期的哪个位置。
       按它决定第一段是「还能亮多久」还是「还要暗多久」，之后就走标准循环 ——
       于是**第一次亮相就已经处在稳态相位上**，不存在「等 8 秒才铺满」。 */
    const offset = (rank * cycle) / groupSize
    const local = (cycle - (offset % cycle)) % cycle

    const run = async () => {
      if (local < WISP.holdMs) {
        setOn(true)
        await wait(WISP.holdMs - local)
      } else {
        await wait(cycle - local)
        if (!alive) return
        setOn(true)
        await wait(WISP.holdMs)
      }
      while (alive) {
        setOn(false)
        /* 等淡完了再换字，否则会看到文字在亮着的时候跳 */
        await wait(FADE_MS)
        if (!alive) return
        setStep((n) => n + 1)
        await wait(Math.max(0, WISP.gapMs - FADE_MS))
        if (!alive) return
        setOn(true)
        await wait(WISP.holdMs)
        if (!alive) return
      }
    }
    run()

    return () => {
      alive = false
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [reduced, rank, groupSize])

  const text = reduced
    ? idle[(index * WHISPER_STATIC_STEP) % idle.length]
    : pool[(start + step) % pool.length]

  /* 深度 0.55~1.2：让两侧的位移有远近差，比整齐划一地平移像「空间」而不是「贴纸」。
     用 index 做确定性伪随机，不用 Math.random —— 否则 StrictMode 二次挂载会换一组值。 */
  const depth = 0.55 + (((index * 37) % 100) / 100) * 0.65
  const anchor = item.side === 'left' ? { left: `${item.x}%` } : { right: `${item.x}%` }

  return (
    <span
      className="whisper"
      data-side={item.side}
      data-on={on}
      style={{
        ...anchor,
        top: `${item.y}%`,
        '--depth': depth.toFixed(2),
        /* 每条有自己的亮度，读起来才像远处近处都有声音 */
        '--o': (0.42 + (((index * 53) % 100) / 100) * 0.4).toFixed(2),
        '--drift': `${10 + (((index * 29) % 60) / 10)}s`,
        '--drift-delay': `${(-((index * 17) % 90) / 10).toFixed(1)}s`
      }}
    >
      <span className="whisper__text">{text}</span>
    </span>
  )
}

export default function WhisperTags({ phase }) {
  const reduced = useReducedMotion()
  const hostRef = useRef(null)

  /* 指针视差：整层只挂一个监听，写两个 CSS 变量，由 CSS 按各条的 --depth 分摊。
     用 rAF 节流 —— 不节流的话每次 pointermove 都要让 10 个元素重算样式。
     触摸设备直接跳过（没有 hover，视差只会变成卡顿）。 */
  useEffect(() => {
    if (reduced) return undefined
    const el = hostRef.current
    if (!el) return undefined
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return undefined

    let raf = 0
    let nx = 0
    let ny = 0
    const onMove = (e) => {
      nx = (e.clientX / window.innerWidth) * 2 - 1
      ny = (e.clientY / window.innerHeight) * 2 - 1
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        el.style.setProperty('--wx', nx.toFixed(3))
        el.style.setProperty('--wy', ny.toFixed(3))
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [reduced])

  if (!WISP.enabled) return null

  return (
    <div className="whispers" ref={hostRef} aria-hidden="true" style={{ '--wpar': `${WISP.parallax}px` }}>
      {WISP.layout.map((item, i) => {
        /* 同侧名次与同侧总数：相位是把一整个周期在**同侧**均分，
           左右两侧各自成组、同步推进（用全局下标会让右侧整体晚一大截）。 */
        const sameSide = WISP.layout.filter((x) => x.side === item.side)
        const rank = WISP.layout.slice(0, i).filter((x) => x.side === item.side).length
        return (
          <Whisper
            key={`${item.side}-${i}`}
            item={item}
            index={i}
            rank={rank}
            groupSize={sameSide.length}
            phase={phase}
            reduced={reduced}
          />
        )
      })}
    </div>
  )
}
