/* 声音「明确关掉」时的反向探针
   （2026-09-20 第二十二轮建；2026-09-21 第三十一轮改口径）
   ==========================================================================
   `probe-sfx.js` 验的是「声音开着时能不能响」；这一条验它的**反向**：

     **用户明确关掉之后，任何手势都不许把声音顶开，也不该建 AudioContext。**

   为什么第三十一轮要改这一条：以前「缺省」就是关，所以这条探针的初版前提是
   「从没点过开关的用户」——而缺省改成开之后，那个前提消失了，
   原来的断言（`pressed === 'false'`）必然假红。新口径下它守的是**另一件更要紧的事**：

     ① **显式决定优先于默认值。** 缺省开是产品的选择，但用户按过那个喇叭之后，
        事情就归用户 —— 自动播放策略、autostart、以及 `handleDraw` 里那句
        `if (isSoundOn())`，任何一处漏了判断都会让声音在用户关掉后回来。
        这种故障用户会立刻发现（他刚关掉），但**代码里没有一处会报错**。
     ② **关着的时候不许建 AudioContext。** `handleDraw` 里那句 `sfx.unlock()`
        很容易被写成无条件的（我第一版就是）。代价是一个白建的音频图 +
        一次多余的 `resume()` —— 没人会因此报错，也没人会看见，
        只有把 `window.AudioContext` 包起来数实例才查得出来。

   ── 怎么造出「用户已经关过」这个前提 ────────────────────────────────
      必须**在页面加载之前**把 `localStorage['tarot.sound']` 写成 `'off'`。
      加载之后再写没用 —— `engine.js` 的 `enabled` 是模块初始化时读一次定下的
      （这是有意的：它保证「第一次手势」和「点球抽牌」两条路径看到同一份意图）。
      所以整条流程要用 `--seed` 跑：

        node scripts/run-flows.mjs probe-sfx-off --seed "localStorage.setItem('tarot.sound','off')"

      顺带这也更真：用户关掉声音之后，下次**重新打开页面**就是这条路径。
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
const ow = console.warn
console.warn = (...a) => {
  out.warns.push(a.map(String).join(' '))
  ow.apply(console, a)
}

await waitFor(() => $('.scene')?.dataset.phase === 'idle', 16000)

/* 包装构造器，数实例 —— 必须在任何点击之前装好 */
const Orig = window.AudioContext || window.webkitAudioContext
const made = []
function Wrapped(...a) {
  const c = new Orig(...a)
  made.push(c)
  return c
}
Wrapped.prototype = Orig.prototype
window.AudioContext = Wrapped

out.soundPref = localStorage.getItem('tarot.sound')
out.togglePressed = $('.sound')?.getAttribute('aria-pressed') ?? null
out.toggleAriaLabel = $('.sound')?.getAttribute('aria-label') ?? null
out.autostartArmed = window.__tarotSound ? window.__tarotSound.armed : null
out.ctxBefore = window.__tarotSound ? window.__tarotSound.ctxState : null
out.madeBeforeGesture = made.length

/* 第一下点空白处：这是「第一次手势」，autostart 在这里会读到 'off' 并收摊。
   如果它不是真的收摊（比如把 intent 判断漏了），下面两条会立刻红。 */
document.body.click()
await sleep(220)
out.afterGesture = { made: made.length, armed: window.__tarotSound?.armed ?? null }

/* 完整抽一张牌，跑完整场仪式（四种音都有机会被触发） */
$('.orb').click()
out.revealedMs = await waitFor(() => $('.scene')?.dataset.phase === 'revealed', 12000)

out.madeAfterDraw = made.length
out.ctxStates = made.map((c) => c.state)
out.audioWarns = out.warns.filter((w) => /AudioContext|autoplay|not allowed/i.test(w))
out.PASS_noCtxWhenOff = made.length === 0
out.PASS_gestureDidNotOverride = out.togglePressed === 'false' && out.afterGesture.armed === false
out.PASS_stillDrew = out.revealedMs !== null && !!$('.panel')
out.PASS_noWarns = out.audioWarns.length === 0
out.PASS_noErrors = out.errors.length === 0

out.PASS = {
  stayedOff: out.soundPref === 'off' && out.togglePressed === 'false' && out.toggleAriaLabel === '声音',
  noCtxWhenOff: out.PASS_noCtxWhenOff,
  gestureDidNotOverride: out.PASS_gestureDidNotOverride,
  ritualStillWorks: out.PASS_stillDrew,
  noWarns: out.PASS_noWarns,
  noErrors: out.PASS_noErrors
}
out.ALL_PASS = Object.values(out.PASS).every(Boolean)

return out
