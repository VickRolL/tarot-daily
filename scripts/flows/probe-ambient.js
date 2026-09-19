/* 环境音（BGM）探针（2026-09-20 第二十三轮）
   ==========================================================================
   无头环境**听不到声音**，所以这里不验「幽暗不幽暗」，只验四件会真出问题的事：

   ① **BGM 真的建起来了，而且是「常驻」的。**
      上一版我差点用 `sfx.tone()` 去搭 drone（那是一次性包络节点），
      它在 0.15 秒后就会自己 stop —— 而现象是「开关点了、什么也没发生」。
      所以断言不能只看「节点被创建」：要分别数 `createOscillator` 的**增量**
      （预期 4 = 3 条 drone + 1 个 LFO）与 `createBufferSource` 的增量（预期 1 = 风）。

   ② **抽牌时 BGM 让位（duck 到 35%）。**
      这条只能从 AudioParam 上验：给每个 GainNode 的 `gain` 装记录器，
      把每一次 `setValueAtTime / linearRamp / exponentialRamp` 的目标值收进数组。
      duck 发生时，那条 BGM 总线上会先后出现 ≈0.18 与 ≈0.063 两个档位
      （0.18 是 BASE_LEVEL，0.063 = 0.18 × 0.35）。
      判据写成「同一条轨上既有 ≥0.15 的值、也有 0.04~0.10 的值」，
      这样它不依赖具体的 BASE_LEVEL 数字，只依赖「确实压下去过」。

   ③ **牌落定后 BGM 回来。** 同一套记录滞后 9 秒再取样，要求它**重新**出现 ≥0.15。
      没有这一条的话，「压下去之后再也回不来」会一直潜伏 ——
      那正是 `glide()` 里为什么不用「三处各自 setTargetAtTime」的原因。

   ④ **关掉开关 BGM 真的停。** 数 `stop()` 调用：关掉后 2.5 秒内应 ≥5 次
      （4 个振荡器 + 1 个噪声源）。`stopAmbient` 是先淡出、再延时 250ms 才停源，
      所以这里必须等够时间，不能立刻断言。
   ========================================================================== */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const $ = (s) => document.querySelector(s)

const waitFor = async (fn, ms, step = 120) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try {
      if (fn()) return Date.now() - t0
    } catch {
      /* 还没挂上 */
    }
    await sleep(step)
  }
  return null
}

const out = { errors: [] }
window.addEventListener('error', (e) => out.errors.push(String(e.message)))
window.addEventListener('unhandledrejection', (e) => out.errors.push(String(e.reason)))

out.welcomeAwayMs = await waitFor(() => !$('.welcome'), 14000)
await waitFor(() => $('.scene')?.dataset.phase === 'idle', 9000)

const btn = $('.sound')
out.toggleExists = !!btn
if (!btn) {
  out.ALL_PASS = false
  return out
}

/* ── 装钩子：必须在第一次点击之前 ────────────────────────────────── */
const Orig = window.AudioContext || window.webkitAudioContext
const made = []
const count = { osc: 0, buf: 0, stopped: 0 }
/** 每条轨 = 一个 GainNode 的 gain，记录它收到过的所有目标值 */
const tracks = []

if (Orig) {
  function Wrapped(...a) {
    const c = new Orig(...a)
    made.push(c)
    return c
  }
  Wrapped.prototype = Orig.prototype
  window.AudioContext = Wrapped

  const p = Orig.prototype
  const origGain = p.createGain
  p.createGain = function (...a) {
    const n = origGain.apply(this, a)
    const param = n.gain
    const track = { values: [] }
    tracks.push(track)
    const push = (v) => {
      if (typeof v === 'number' && Number.isFinite(v)) track.values.push(v)
    }
    const wrapParam = (name) => {
      const fn = param[name].bind(param)
      param[name] = function (v, ...rest) {
        push(v)
        return fn(v, ...rest)
      }
    }
    wrapParam('setValueAtTime')
    wrapParam('linearRampToValueAtTime')
    wrapParam('exponentialRampToValueAtTime')
    return n
  }

  const origOsc = p.createOscillator
  p.createOscillator = function (...a) {
    count.osc += 1
    const n = origOsc.apply(this, a)
    const st = n.stop.bind(n)
    n.stop = function (...b) {
      count.stopped += 1
      return st(...b)
    }
    return n
  }
  const origBuf = p.createBufferSource
  p.createBufferSource = function (...a) {
    count.buf += 1
    const n = origBuf.apply(this, a)
    const st = n.stop.bind(n)
    n.stop = function (...b) {
      count.stopped += 1
      return st(...b)
    }
    return n
  }
}

/* ── ① 点开关：BGM 应该起来 ───────────────────────────────────────── */
const beforeOn = { ...count }
btn.click()
await sleep(600)
out.onDelta = { osc: count.osc - beforeOn.osc, buf: count.buf - beforeOn.buf }
out.PASS_ambientStarted = out.onDelta.osc >= 4 && out.onDelta.buf >= 1

/* 常驻性：等 1.2 秒（远超一次性包络的 0.15s），要求没有源自己停掉。
   ⚠️ 这里只数「开关刚点完到 1.2 秒之间」新增的 stop —— 音效还没开始，应为 0。 */
const stoppedAtOn = count.stopped
await sleep(1200)
out.spuriousStops = count.stopped - stoppedAtOn
out.PASS_staysAlive = out.spuriousStops === 0

/* ── ② 抽牌：BGM 让位 ─────────────────────────────────────────────── */
const tracksBefore = tracks.map((t) => t.values.length)
const orb = $('.orb')
orb.click()
out.revealedMs = await waitFor(() => $('.scene')?.dataset.phase === 'revealed', 12000)
await sleep(700) /* duck 的过渡是 500ms */

const duckedTracks = tracks.filter((t) => {
  const hi = t.values.some((v) => v >= 0.15)
  const lo = t.values.some((v) => v >= 0.04 && v <= 0.1)
  return hi && lo
})
out.duckTracks = duckedTracks.map((t) => t.values.slice(-8))
out.PASS_ducked = duckedTracks.length >= 1

/* ── ③ 牌落定后应当自己回来 ───────────────────────────────────────── */
const tAfterDuck = tracks.map((t) => t.values.length)
await sleep(9000)
const recovered = tracks.some((t, i) => {
  const tail = t.values.slice(tAfterDuck[i])
  return tail.some((v) => v >= 0.15)
})
out.PASS_recovered = recovered
out.tailOfDuckTrack = duckedTracks[0] ? duckedTracks[0].values.slice(-8) : null

/* ── ④ 关掉开关：BGM 必须真的停 ───────────────────────────────────── */
const stoppedBefore = count.stopped
btn.click()
await sleep(2600) /* 淡出 1800 + 250ms 后才停源，必须等够 */
out.stopsOnOff = count.stopped - stoppedBefore
out.PASS_stopped = out.stopsOnOff >= 5
out.PASS_toggleOff = btn.getAttribute('aria-pressed') === 'false' && localStorage.getItem('tarot.sound') === 'off'
out.PASS_noErrors = out.errors.length === 0

out.PASS = {
  toggleExists: out.toggleExists,
  ambientStarted: out.PASS_ambientStarted,
  staysAlive: out.PASS_staysAlive,
  ducked: out.PASS_ducked,
  recovered: out.PASS_recovered,
  stopped: out.PASS_stopped,
  toggleOff: out.PASS_toggleOff,
  noErrors: out.PASS_noErrors
}
out.ALL_PASS = Object.values(out.PASS).every(Boolean)

return out
