/* 音效「从没开过」的反向探针（2026-09-20 第二十二轮）
   ==========================================================================
   `probe-sfx.js` 验的是「开了之后能不能响」；这一条验它的**反向**：

     **从没点过音效开关的用户，抽牌时不应该被建出 AudioContext。**

   为什么值得单独跑一趟：`handleDraw` 里那句 `sfx.unlock()` 很容易被写成无条件的
   （我第一版就是）。代价是一个白建的音频图 + 一次多余的 `resume()` —— 没人会因此
   报错，也没人会看见，只有把 `window.AudioContext` 包起来数实例才查得出来。
   这和「判据要双向验」是同一条规矩：只测「开了会响」的话，无条件 unlock 永远通过。
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
out.madeBeforeDraw = made.length

/* 完整抽一张牌，跑完整场仪式（四种音都有机会被触发） */
$('.orb').click()
out.revealedMs = await waitFor(() => $('.scene')?.dataset.phase === 'revealed', 12000)

out.madeAfterDraw = made.length
out.ctxStates = made.map((c) => c.state)
out.audioWarns = out.warns.filter((w) => /AudioContext|autoplay|not allowed/i.test(w))
out.PASS_noCtxWhenOff = made.length === 0
out.PASS_stillDrew = out.revealedMs !== null && !!$('.panel')
out.PASS_noWarns = out.audioWarns.length === 0
out.PASS_noErrors = out.errors.length === 0

out.PASS = {
  stayedOff: out.soundPref !== 'on' && out.togglePressed === 'false',
  noCtxWhenOff: out.PASS_noCtxWhenOff,
  ritualStillWorks: out.PASS_stillDrew,
  noWarns: out.PASS_noWarns,
  noErrors: out.PASS_noErrors
}
out.ALL_PASS = Object.values(out.PASS).every(Boolean)

return out
