/* 「默认开」探针（2026-09-21 第三十一轮新增）
   ==========================================================================
   用户的要求是一句话：「给用户使用的版本默认要打开音乐」。
   它在代码里落成两件事，而这两件事**都会静默失败**，所以必须各有一条判据：

     ① `readSoundPref()` 的缺省是开（判据写成 `!== 'off'`）；
     ② 光把缺省改成开是**不够的** —— 浏览器不允许在非手势里启动 AudioContext，
        所以「真的响起来」必须由第一次用户操作兑现（`audio/autostart.js`）。

   失败形态长什么样：页面一切正常，控制台干净，截图看不出任何差别 ——
   只是从头到尾没有声音。跟「本来就没做这个功能」一模一样。
   所以下面的判据全部是**结构**的（ctx 实例数 / 源的数量 / 拉起的路由），
   没有一条依赖「听起来有没有声音」（无头环境听不到）。

   ── 判据清单 ──────────────────────────────────────────────────────────
   ① `PASS_defaultOn`    首次访问：`aria-pressed=true`、存储里没有 'off'、
                         按钮有 `aria-label="声音"` 与喇叭图标（两道路径=开）。
   ② `PASS_silentAtLoad` 页面加载时**没有** AudioContext ——
                         「默认开」不等于「一打开就出声」，这条把口径写死，
                         免得以后有人为了「默认开」去非手势里建 ctx。
                         （同时断言 autostart 仍然 armed：它在等第一次手势。）
   ③ `PASS_firstGesture` 第一次手势（点空白处）之后：ctx 恰好 1 个、`running`、
                         而且环境音**真的接上了**（不是只建了个空图）。
   ④ `PASS_gestureKeepsOn` 这次手势**不许把开关翻掉**（缺省开、一点就变关 = bug）。
   ⑤ `PASS_noDoubleStart` 第二次手势（点球抽牌）不会把环境音再起一遍
                         （`startAmbient` 幂等；重复建源会导致两首曲子叠着放）。
   ⑥ `PASS_toggleOff` / `PASS_toggleOn` 喇叭点一下关（pref=off、声波消失、
                         活着的源被停），再点一下开（pref=on、环境音重新起来）。
   ⑦ `PASS_noErrors` / `PASS_noAutoplayWarn` 页面零报错、零自动播放告警。
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

const out = { errors: [], warns: [] }
window.addEventListener('error', (e) => out.errors.push(String(e.message)))
window.addEventListener('unhandledrejection', (e) => out.errors.push(String(e.reason)))
const ow = console.warn
console.warn = (...a) => {
  out.warns.push(a.map(String).join(' '))
  ow.apply(console, a)
}

/* ── 入场 ─────────────────────────────────────────────────────────── */
out.welcomeAwayMs = await waitFor(() => !$('.welcome'), 14000)
await waitFor(() => $('.scene')?.dataset.phase === 'idle', 9000)

const btn = $('.sound')

/* ── ① 初始状态：缺省开着，但一声不响 ────────────────────────────── */
out.initial = btn
  ? {
      pressed: btn.getAttribute('aria-pressed'),
      ariaLabel: btn.getAttribute('aria-label'),
      hasSvgIcon: !!btn.querySelector('svg.sound__icon'),
      wavePaths: btn.querySelectorAll('.sound__wave').length,
      hasText: btn.textContent.trim(),
      pref: localStorage.getItem('tarot.sound'),
      state: window.__tarotSound ?? null
    }
  : { exists: false }

out.PASS_defaultOn =
  !!btn &&
  out.initial.pressed === 'true' &&
  out.initial.pref !== 'off' &&
  out.initial.ariaLabel === '声音' &&
  out.initial.hasSvgIcon &&
  out.initial.wavePaths === 2 &&
  /* 图标按钮不该再带文案 —— 带了说明还留着旧标签 */
  out.initial.hasText === ''

/* ② 加载时不许有 ctx（自动播放策略），而 autostart 必须在等手势。
   判据取自 `__tarotSound.ctxState` —— 它是**只读**的（`peekAudioContext()`），
   查一下不会顺手把 ctx 建出来。 */
out.PASS_silentAtLoad = out.initial.state?.ctxState === null && out.initial.state?.armed === true

/* ── 装钩子：必须在第一次手势之前 ────────────────────────────────── */
const Orig = window.AudioContext || window.webkitAudioContext
const made = []
if (!Orig) {
  out.ALL_PASS = false
  out.gotcha = '没有 AudioContext API'
  return out
}

function Wrapped(...a) {
  const c = new Orig(...a)
  made.push(c)
  return c
}
Wrapped.prototype = Orig.prototype
window.AudioContext = Wrapped

const count = { osc: 0, buf: 0, stopped: 0 }
/** 每个 BufferSource 在 start() 那一刻的快照（用 buffer 时长区分素材路/合成路） */
const srcs = []
{
  const p = Orig.prototype
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
    const st = n.start.bind(n)
    n.start = function (...b) {
      const buf = n.buffer
      srcs.push({ dur: buf ? buf.duration : null, loop: n.loop })
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

/* ── ③ 第一次手势：点空白处（不是点开关）─────────────────────────── */
const beforeGesture = { osc: count.osc, buf: count.buf }
const t0 = Date.now()
document.body.click()

/* 环境音素材是异步 fetch + decode 的，等它接上；走合成兜底则几个振荡器会立刻出现 */
out.attachMs = await waitFor(() => {
  const hasLoop60 = srcs.some((s) => (s.dur || 0) > 10)
  const hasSynth = count.osc - beforeGesture.osc >= 4
  return hasLoop60 || hasSynth
}, 9000)
out.firstGestureMs = Date.now() - t0
await sleep(400)

out.afterGesture = {
  made: made.length,
  ctxState: made[0]?.state ?? null,
  oscDelta: count.osc - beforeGesture.osc,
  bufDelta: count.buf - beforeGesture.buf,
  assetLoops: srcs
    .filter((s) => (s.dur || 0) > 10)
    .map((s) => ({ dur: Number((s.dur || 0).toFixed(3)), loop: s.loop })),
  state: window.__tarotSound ?? null
}
/* 走的是素材路（osc 增量为 0 且有一个 >10s 的循环源）还是合成兜底（≥4 个振荡器） */
out.ambientRoute = out.afterGesture.assetLoops.length
  ? 'asset'
  : out.afterGesture.oscDelta >= 4
    ? 'synth'
    : 'none'
out.PASS_firstGesture =
  made.length === 1 && made[0].state === 'running' && out.ambientRoute !== 'none'
/* ④ 这一下不许把开关翻掉，也不许把 intent 写坏 */
out.PASS_gestureKeepsOn =
  btn.getAttribute('aria-pressed') === 'true' && localStorage.getItem('tarot.sound') !== 'off'

/* ── ⑤ 第二次手势（抽牌）：不该把环境音再起一遍 ──────────────────── */
const loopsBefore = srcs.filter((s) => (s.dur || 0) > 10).length
$('.orb').click()
out.revealedMs = await waitFor(() => $('.scene')?.dataset.phase === 'revealed', 12000)
await sleep(500)
out.loopsAfterDraw = srcs.filter((s) => (s.dur || 0) > 10).length
out.PASS_noDoubleStart = made.length === 1 && out.loopsAfterDraw <= Math.max(1, loopsBefore)

/* ── ⑥ 喇叭点一下关、再点一下开 ──────────────────────────────────── */
/* 「该被停掉几个源」只能算**环境音自己建的那几个**：
   音效（charge/burst/flip/reveal）是一次性 BufferSource，播完就自己结束，
   `sfx.playAsset()` 从头到尾没调过 `stop()` —— 把它们算进「活着的源」，
   这条判据就变成恒假（第一版就是这么写的，实测 `stops=1 < liveSources=5`）。
   判据用第一次手势那一刻量到的**增量**（与 probe-ambient 的 onDelta 同一口径），不写死数字：
   素材路 = 0 个振荡器 + 1 个循环 BufferSource；合成路 = 4 个振荡器 + 1 个风噪 BufferSource。 */
const ambientSources = out.afterGesture.oscDelta + out.afterGesture.bufDelta
const stoppedBefore = count.stopped
btn.click()
await sleep(2600) /* 环境音淡出 1800 + 250ms 之后才停源，必须等够 */
out.off = {
  pressed: btn.getAttribute('aria-pressed'),
  pref: localStorage.getItem('tarot.sound'),
  wavePaths: btn.querySelectorAll('.sound__wave').length,
  hasSvgIcon: !!btn.querySelector('svg.sound__icon'),
  stops: count.stopped - stoppedBefore,
  ambientSources
}
out.PASS_toggleOff =
  out.off.pressed === 'false' &&
  out.off.pref === 'off' &&
  out.off.wavePaths === 0 &&
  out.off.hasSvgIcon &&
  out.off.stops >= ambientSources

const bufBeforeReopen = count.buf
btn.click()
out.reopenMs = await waitFor(() => count.buf > bufBeforeReopen, 8000)
out.on = {
  pressed: btn.getAttribute('aria-pressed'),
  pref: localStorage.getItem('tarot.sound'),
  wavePaths: btn.querySelectorAll('.sound__wave').length,
  newSources: count.buf - bufBeforeReopen
}
out.PASS_toggleOn =
  out.on.pressed === 'true' && out.on.pref === 'on' && out.on.wavePaths === 2 && out.on.newSources >= 1

/* ── ⑦ 报错与告警 ────────────────────────────────────────────────── */
out.autoplayWarns = out.warns.filter((w) => /AudioContext|autoplay|not allowed/i.test(w))
out.PASS_noAutoplayWarn = out.autoplayWarns.length === 0
out.PASS_noErrors = out.errors.length === 0

out.PASS = {
  toggleExists: !!btn,
  defaultOn: out.PASS_defaultOn,
  silentAtLoad: out.PASS_silentAtLoad,
  firstGesture: out.PASS_firstGesture,
  gestureKeepsOn: out.PASS_gestureKeepsOn,
  noDoubleStart: out.PASS_noDoubleStart,
  toggleOff: out.PASS_toggleOff,
  toggleOn: out.PASS_toggleOn,
  noAutoplayWarn: out.PASS_noAutoplayWarn,
  noErrors: out.PASS_noErrors
}
out.ALL_PASS = Object.values(out.PASS).every(Boolean)

return out
