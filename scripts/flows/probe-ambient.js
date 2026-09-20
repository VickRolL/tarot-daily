/* 环境音（BGM）探针（2026-09-20 第二十三轮建，第二十四轮改为「素材优先」后重写）
   ==========================================================================
   无头环境**听不到声音**，所以这里不验「幽暗不幽暗」，只验会真出问题的事。

   ⚠️ 第二十四轮的核心变化：BGM 从「纯合成」变成「素材优先、合成兜底」。
      于是多出一类**全新且静默**的故障：**素材没加载成功 → 悄悄退回合成**。
      现象是页面照样有声音、控制台照样干净、截图照样看不出 —— 只有细听才知道
      放的不是那首 AI 生成的曲子。所以这一版探针的第一判据就是
      「**当前走的是不是素材路**」，而且要用**结构**判，不能用「有没有声音」判。

   ── 怎么用结构区分两条路（不需要模块内部变量）─────────────────────────
      素材路：`createOscillator` 增量 = 0，`createBufferSource` 增量 = 1，
              且那个 BufferSource 的 `buffer.duration ≈ 60s`。
      合成路：增量 = 4 个振荡器（3 drone + 1 LFO）+ 1 个 BufferSource（风），
              且 `buffer.duration = 2s`（`noiseBuffer` 是 2 秒）。
      `60s vs 2s` 这个差是数量级的，不依赖任何魔法数字。

   ── 判据清单 ──────────────────────────────────────────────────────────
   ① `PASS_download`     页面真的 `fetch` 了那个 mp3，且 HTTP 200。
                         （路径写错 / Vite 没产出 → 404 → 静默退合成）
   ② `PASS_assetPath`    走的是素材路（osc=0 且 buffer 时长 > 10s）。
   ③ `PASS_loopTrim`     MP3 的**编码器延时与尾部补零被排除在循环之外**。
                         做法：读 BufferSource 的 `loopStart/loopEnd`，
                         断言「循环区之外全是静音、循环区之内确有内容」。
                         （MP3 头尾各有几十毫秒真静音，`decodeAudioData` 不剥；
                           不排掉的话每圈多一个可闻的「噗」。）
                         ⚠️ 换算秒数要用 `buffer.sampleRate` —— `decodeAudioData`
                            会重采样到 **AudioContext 的采样率**（本机 48000，不是文件的 44100）。
                            写死 44100 会让这条判据恒假，而代码是对的。
                         本机实测：头剥 345 点、尾剥 107 点（共 ≈9.4ms），循环区 60.039s。
   ④ `PASS_staysAlive`   常驻性：1.2 秒内没有源自己停掉。
                         （用一次性包络节点搭 drone 的典型故障是 0.15s 就停）
   ⑤ `PASS_ducked`       抽牌时 BGM 压到 35%。
   ⑥ `PASS_recovered`    牌落定后自己回到原位。
   ⑦ `PASS_stopped`      开关关掉后 **所有**活着的源都被 stop。
                         （期望值按上面数出来的源数量算，不写死 5）
   ⑧ `PASS_noErrors`     页面零报错。
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

/** 记录每一次 fetch 的 url 与状态码（判「素材到底下没下到」） */
const fetches = []
const origFetch = window.fetch
window.fetch = function (input, init) {
  const url = typeof input === 'string' ? input : (input && input.url) || ''
  const rec = { url, status: null }
  fetches.push(rec)
  return origFetch.call(this, input, init).then(
    (res) => {
      rec.status = res.status
      return res
    },
    (err) => {
      rec.status = 'REJECTED'
      rec.err = String(err && err.message)
      throw err
    }
  )
}

const Orig = window.AudioContext || window.webkitAudioContext
const made = []
const count = { osc: 0, buf: 0, stopped: 0 }
/** 每个 BufferSource 在 start() 那一刻的快照（loop 参数那时已经设好了） */
const srcs = []
const oscFreqs = []
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
    oscFreqs.push(() => n.frequency.value)
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
    const st = n.start.bind(n)
    n.start = function (...b) {
      const buf = n.buffer
      const sr = buf ? buf.sampleRate : 0
      const rec = {
        loop: n.loop,
        loopStart: n.loopStart,
        loopEnd: n.loopEnd,
        dur: buf ? buf.duration : null,
        sr: sr || null,
        channels: buf ? buf.numberOfChannels : null,
        offset: typeof b[1] === 'number' ? b[1] : null
      }
      /* 直接看样本：循环区之外是不是静音、之内是不是有内容。
         这一条是「MP3 尾零被排掉了」的唯一直接证据。 */
      if (buf && sr) {
        const d = buf.getChannelData(0)
        const a0 = Math.max(0, Math.round(rec.loopStart * sr))
        const b0 = Math.min(d.length, Math.round(rec.loopEnd * sr))
        const peak = (from, to) => {
          let m = 0
          for (let i = from; i < to; i += 1) {
            const v = Math.abs(d[i])
            if (v > m) m = v
          }
          return m
        }
        rec.trim = {
          samples: d.length,
          loopFrom: a0,
          loopTo: b0,
          headPeak: a0 > 0 ? peak(0, a0) : 0,
          tailPeak: b0 < d.length ? peak(b0, d.length) : 0,
          insidePeak: peak(a0, Math.min(b0, a0 + sr))
        }
      }
      srcs.push(rec)
      return st(...b)
    }
    const sp = n.stop.bind(n)
    n.stop = function (...b) {
      count.stopped += 1
      return sp(...b)
    }
    return n
  }
}

/* ── ① 点开关：BGM 应该起来 ───────────────────────────────────────── */
const beforeOn = { ...count }
btn.click()

/* 素材是异步 fetch + decode 的，等它接上（合成路则几个振荡器会立刻出现） */
out.attachMs = await waitFor(
  () => {
    const hasLoop60 = srcs.some((s) => (s.dur || 0) > 10)
    const hasSynth = count.osc - beforeOn.osc >= 4
    return hasLoop60 || hasSynth
  },
  8000
)
await sleep(500)

out.onDelta = { osc: count.osc - beforeOn.osc, buf: count.buf - beforeOn.buf }
out.assetBuffers = srcs.filter((s) => (s.dur || 0) > 10).map((s) => ({
  loop: s.loop,
  dur: Number((s.dur || 0).toFixed(3)),
  sr: s.sr,
  channels: s.channels,
  loopStart: Number(s.loopStart.toFixed(4)),
  loopEnd: Number(s.loopEnd.toFixed(4)),
  trim: s.trim
}))

/* ── 判据 ①：素材到底下没下到 ─────────────────────────────────────── */
const mp3Hits = fetches.filter((f) => /\.mp3(\?|$)/i.test(f.url))
out.mp3Fetches = mp3Hits.map((f) => ({ url: f.url.split('/').pop(), status: f.status }))
out.PASS_download = mp3Hits.length >= 1 && mp3Hits.every((f) => f.status === 200)

/* ── 判据 ②：走的是素材路，不是悄悄退回合成 ──────────────────────── */
const loopSrc = srcs.find((s) => (s.dur || 0) > 10)
out.sourceKind = loopSrc ? 'asset' : count.osc - beforeOn.osc >= 4 ? 'synth' : 'none'
out.PASS_assetPath = !!loopSrc && loopSrc.loop === true && out.onDelta.osc === 0

/* ── 判据 ③：MP3 的编码器延时 / 尾零被排除在循环之外 ─────────────── */
/* ⚠️ 秒数必须用 **buffer 自己的采样率** 换算，不能写死 44100 ——
   `decodeAudioData` 会把音频重采样到 **AudioContext 的采样率**（本机实测 48000），
   缓冲区长度因此是 60.048 × 48000 而不是 × 44100。
   第一版写死 44100 时这条判据恒为假，而代码其实是对的：
   「判据本身写错」比「代码错」更难发现，因为输出看起来像是被测对象有问题。 */
const t = loopSrc && loopSrc.trim
const loopSec = t && loopSrc.sr ? Math.abs(t.loopTo - t.loopFrom) / loopSrc.sr : 0
out.loopSeconds = Number(loopSec.toFixed(3))
out.PASS_loopTrim =
  !!t &&
  t.headPeak < 1e-3 &&
  t.tailPeak < 1e-3 &&
  t.insidePeak > 0.01 &&
  loopSec > 59.5 &&
  loopSec < 60.5

/* ── 判据 ④：常驻性 ───────────────────────────────────────────────── */
const stoppedAtOn = count.stopped
await sleep(1200)
out.spuriousStops = count.stopped - stoppedAtOn
out.PASS_staysAlive = out.spuriousStops === 0

/* ── 判据 ⑤ ⑥：抽牌时让位、牌落定后回来 ─────────────────────────── */
const orb = $('.orb')
orb.click()
out.revealedMs = await waitFor(() => $('.scene')?.dataset.phase === 'revealed', 12000)
await sleep(700) /* duck 的过渡是 500ms */

const duckedTracks = tracks.filter((tr) => {
  const hi = tr.values.some((v) => v >= 0.15)
  const lo = tr.values.some((v) => v >= 0.04 && v <= 0.1)
  return hi && lo
})
out.duckTracks = duckedTracks.map((tr) => tr.values.slice(-8))
out.PASS_ducked = duckedTracks.length >= 1

const tAfterDuck = tracks.map((tr) => tr.values.length)
await sleep(9000)
out.PASS_recovered = tracks.some((tr, i) =>
  tr.values.slice(tAfterDuck[i]).some((v) => v >= 0.15)
)
out.tailOfDuckTrack = duckedTracks[0] ? duckedTracks[0].values.slice(-8) : null

/* ── 判据 ⑦：关掉开关，活着的源必须全被停 ────────────────────────── */
const liveSources = out.onDelta.osc + out.onDelta.buf
const stoppedBefore = count.stopped
btn.click()
await sleep(2600) /* 淡出 1800 + 250ms 后才停源，必须等够 */
out.liveSources = liveSources
out.stopsOnOff = count.stopped - stoppedBefore
out.PASS_stopped = out.stopsOnOff >= liveSources
out.PASS_toggleOff =
  btn.getAttribute('aria-pressed') === 'false' && localStorage.getItem('tarot.sound') === 'off'
out.PASS_noErrors = out.errors.length === 0

out.PASS = {
  toggleExists: out.toggleExists,
  download: out.PASS_download,
  assetPath: out.PASS_assetPath,
  loopTrim: out.PASS_loopTrim,
  staysAlive: out.PASS_staysAlive,
  ducked: out.PASS_ducked,
  recovered: out.PASS_recovered,
  stopped: out.PASS_stopped,
  toggleOff: out.PASS_toggleOff,
  noErrors: out.PASS_noErrors
}
out.ALL_PASS = Object.values(out.PASS).every(Boolean)

return out
