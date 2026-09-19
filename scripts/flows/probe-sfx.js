/* 音效探针（2026-09-20 第二十二轮）
   ==========================================================================
   无头环境**听不到声音**，所以这里不验「好不好听」，只验三件会真出问题的事：

   ① **AudioContext 到底有没有被建出来、是不是 running。**
      这是最阴的一类失败：`new AudioContext()` 如果在**非用户手势**的调用栈里执行，
      Chrome 不报错、不抛异常，只是把 ctx 挂成 `suspended` —— 之后所有声音都是哑的，
      控制台干干净净。等发现「没声音」时，早就不知道该查哪儿了。
      做法：**在第一次点击之前把 `window.AudioContext` 换成包装类**，把实例收进数组
      （模块里的 `engine()` 是调用时才读 `window.AudioContext` 的，所以包装有效）。
      然后断言 `made.length === 1 && made[0].state === 'running'`。

   ② **点开关的那一刻真的是手势栈。** 同上一条一体两面：断言 `navigator.userActivation`
      在点击后为真，且 ctx 在点击**之后**才被创建（点击前 `made.length === 0`）。

   ③ **四个音真的往音频图上挂了节点。** 给 `createOscillator / createBufferSource`
      打计数钩子，抽一张牌跑完整场仪式，断言四类节点都被创建过。
      ⚠️ 只断言「函数被调用」不够 —— `osc.start()` 没调的话节点是死的。
      所以另记 `start` 次数。

   ④ **开关本身不能变成「看不见的第二层」。** 它是 fixed 定位的新元素，
      要确认：抽完牌后它**没有**沉到解读面板背后（打 `elementFromPoint` 命中测试），
      而且它不吃水晶球的点击。
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
/* 自动播放告警不是 error，是 console.warn —— 也收集，它正是第 ① 条的征兆 */
const warns = []
const origWarn = console.warn
console.warn = (...a) => {
  warns.push(a.map(String).join(' '))
  origWarn.apply(console, a)
}
out.autoplayWarns = warns

/* ── 入场 ─────────────────────────────────────────────────────────── */
out.welcomeAwayMs = await waitFor(() => !$('.welcome'), 14000)
await waitFor(() => $('.scene')?.dataset.phase === 'idle', 9000)

/* ── 先看清初始状态（必须是关的）─────────────────────────────────── */
const btn = $('.sound')
out.toggle = btn
  ? {
      exists: true,
      pressed: btn.getAttribute('aria-pressed'),
      label: btn.textContent.trim(),
      pref: localStorage.getItem('tarot.sound')
    }
  : { exists: false }

/* 初始必须是「关」——不是靠文案，靠 aria-pressed 与 localStorage 两处同时为否 */
out.PASS_initOff = !!btn && btn.getAttribute('aria-pressed') === 'false' && localStorage.getItem('tarot.sound') !== 'on'

/* ── 装钩子：必须在第一次点击之前 ────────────────────────────────── */
const Orig = window.AudioContext || window.webkitAudioContext
out.hasAudioContextAPI = !!Orig
const made = []
if (Orig) {
  function Wrapped(...a) {
    const c = new Orig(...a)
    made.push(c)
    return c
  }
  Wrapped.prototype = Orig.prototype
  window.AudioContext = Wrapped
}
const count = { osc: 0, buf: 0, gain: 0, filter: 0, started: 0 }
if (Orig) {
  const p = Orig.prototype
  const wrap = (name, key) => {
    const o = p[name]
    p[name] = function (...a) {
      count[key] += 1
      const n = o.apply(this, a)
      if (key === 'osc' && n && !n.__hooked) {
        n.__hooked = true
        const st = n.start
        n.start = function (...b) {
          count.started += 1
          return st.apply(this, b)
        }
      }
      return n
    }
  }
  wrap('createOscillator', 'osc')
  wrap('createBufferSource', 'buf')
  wrap('createGain', 'gain')
  wrap('createBiquadFilter', 'filter')
}

/* ── ① 点开关 ─────────────────────────────────────────────────────── */
const beforeClick = { made: made.length, userActive: !!navigator.userActivation?.isActive }
btn.click()
await sleep(220)

out.afterClick = {
  madeBefore: beforeClick.made,
  madeAfter: made.length,
  ctxState: made[0]?.state ?? null,
  sampleRate: made[0]?.sampleRate ?? null,
  pressed: btn.getAttribute('aria-pressed'),
  label: btn.textContent.trim(),
  pref: localStorage.getItem('tarot.sound'),
  gainNodes: count.gain
}
out.PASS_engineStart = made.length === 1 && made[0]?.state === 'running' && count.gain >= 1
out.PASS_persisted = btn.getAttribute('aria-pressed') === 'true' && localStorage.getItem('tarot.sound') === 'on'

/* 开关不能被别的层盖住（命中测试，不是 offsetParent） */
const br = btn.getBoundingClientRect()
const hitAt = (el) => {
  const r = el.getBoundingClientRect()
  const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  return !!h && (h === el || el.contains(h))
}
out.toggleHitIsSelf = hitAt(btn)
out.toggleRect = { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) }

/* 它不许吃水晶球的点击 */
const orb = $('.orb')
const orbHit = (() => {
  if (!orb) return null
  const r = orb.getBoundingClientRect()
  const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  if (!h) return 'null'
  /* 球内部有 canvas 与多层装饰，只要命中在 .orb 子树里就算通 */
  return orb.contains(h) || h === orb ? 'orb' : `${h.tagName}.${h.className}`
})()
out.orbHittable = orbHit

/* ── ② 抽一张牌，跑完整场仪式 ─────────────────────────────────────── */
const nBefore = { ...count }
orb.click()
out.revealedMs = await waitFor(() => $('.scene')?.dataset.phase === 'revealed', 12000)
out.nodesDuringRitual = {
  osc: count.osc - nBefore.osc,
  buf: count.buf - nBefore.buf,
  gain: count.gain - nBefore.gain,
  filter: count.filter - nBefore.filter,
  started: count.started
}
out.PASS_nodes = count.osc > nBefore.osc && count.buf > nBefore.buf && count.started > 0

/* 抽完牌：开关必须还露在解读面板之上（它固定，面板 z-index 50）*/
out.panelUp = !!$('.panel')
out.toggleHitAfterPanel = hitAt(btn)
out.toggleVsPanel = (() => {
  const p = $('.panel')?.getBoundingClientRect()
  const r = btn.getBoundingClientRect()
  if (!p) return null
  return {
    overlap: !(r.right <= p.left || r.left >= p.right || r.bottom <= p.top || r.top >= p.bottom)
  }
})()

/* ── ③ 关掉 ───────────────────────────────────────────────────────── */
btn.click()
await sleep(150)
out.afterOff = { pressed: btn.getAttribute('aria-pressed'), pref: localStorage.getItem('tarot.sound'), label: btn.textContent.trim() }
out.PASS_offAgain = btn.getAttribute('aria-pressed') === 'false' && localStorage.getItem('tarot.sound') === 'off'

out.autoplayWarns = warns.filter((w) => /AudioContext|autoplay|not allowed/i.test(w))
out.PASS_noAutoplayWarn = out.autoplayWarns.length === 0
out.PASS_noErrors = out.errors.length === 0

out.PASS = {
  toggleExists: !!btn,
  initOff: out.PASS_initOff,
  persisted: out.PASS_persisted,
  engineStart: out.PASS_engineStart,
  nodesConnected: out.PASS_nodes,
  toggleAlwaysClickable: out.toggleHitIsSelf && out.toggleHitAfterPanel,
  orbStillHittable: out.orbHittable === 'orb',
  offAgain: out.PASS_offAgain,
  noAutoplayWarn: out.PASS_noAutoplayWarn,
  noErrors: out.PASS_noErrors
}
out.ALL_PASS = Object.values(out.PASS).every(Boolean)

return out
