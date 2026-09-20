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

/** 记录每一次 fetch（第二十五轮新增：断言 sfx 素材真的下到了、下的是 200） */
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
const count = { osc: 0, buf: 0, gain: 0, filter: 0, started: 0, bufStarted: 0 }
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
      /* 素材路全靠 BufferSource 发声 —— 也必须数它的 start，
         否则「音频图上有节点但一个都没播」会静默通过 */
      if (key === 'buf' && n && !n.__hooked) {
        n.__hooked = true
        const st = n.start
        n.start = function (...b) {
          count.bufStarted += 1
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

/* ── ②·五 素材预载（第二十五轮新增）──────────────────────────────────
   点开关的那一刻 unlock() 会派发 tarot:audio-ready → sfx 开始 fetch+decode。
   必须等它完成再抽牌：否则第一声 charge 播的时候缓冲还没好，
   会悄悄走合成路 —— 探针若不在这里等齐，「素材优先」就成了永假的绿灯。
   终止条件：loaded + failed === assets（每一个都见到结果，成功或失败都算）。 */
out.sfxPreloadMs = await waitFor(() => {
  const s = window.__tarotSfx
  if (!s) return false
  return s.loaded.length + Object.keys(s.failed).length >= s.assets.length
}, 5000)
out.sfxStateAfterPreload = window.__tarotSfx
  ? {
      assets: window.__tarotSfx.assets,
      loaded: window.__tarotSfx.loaded,
      failed: window.__tarotSfx.failed
    }
  : null

/* sfx 素材到底下没下到。
   ⚠️ 判据按**文件名**匹配，不按路径段。第一版写的是「URL 里有 `/sfx/`」——
      那是 **dev 的 URL 形状**（`/src/assets/audio/sfx/charge.mp3`）。生产构建里
      Vite 会把资源**拍平**成 `/assets/charge-BkITS-5R.mp3`，于是这条判据在生产上
      一次 fetch 都匹配不到 → 永远红；而它在 dev 上绿得毫无理由，
      只是因为 dev 的目录恰好叫 `sfx`。
      ★ 「只在某一条实现路径上成立的门槛不能套到另一条路径」——同一个坑，
        这次踩的是 **URL 形状**（前两次是「振荡器 vs 缓冲区」「素材 vs 合成」）。
      按文件名匹配则 dev / prod 通用：dev 是 `charge.mp3`、prod 是 `charge-<hash>.mp3`，
      都 startsWith('charge')。（ambient 的 `ambient-loop-*.mp3` 不会误入，
      因为它不以四个合同名开头。） */
const assetNames = window.__tarotSfx ? window.__tarotSfx.assets : []
const nAssets = assetNames.length
const baseName = (u) => (u.split('?')[0].split('/').pop() || '')
const sfxHits = fetches.filter(
  (f) => /\.mp3$/i.test(baseName(f.url)) && assetNames.some((n) => baseName(f.url).startsWith(n))
)
out.sfxFetches = sfxHits.map((f) => ({ url: baseName(f.url), status: f.status }))
out.PASS_sfxDownload =
  nAssets > 0 && sfxHits.length >= nAssets && sfxHits.every((f) => f.status === 200)

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
  bufStarted: count.bufStarted - nBefore.bufStarted
}
/* ⚠️ 这条判据在第二十五轮**改过一次写法**，原因值得记住：
   原来断言的是「振荡器节点有增量 + osc.start() 被调过」—— 那是**合成路**的判据。
   四个音都换成素材后，`createOscillator` 天然是 0（素材是一个 BufferSource），
   于是这条断言把「完全正常、而且正是我们想要的」状态判成了失败。
   ★ 「只在某一条实现路径上成立的门槛，不能无差别套到另一条路径上」。
   现在的写法与路径无关：**只要在仪式期间真的启动了音源**就算通 ——
   素材路数 BufferSource.start()，合成路数 osc.start()，两条都认。 */
const dOscStarted = count.started - nBefore.started
const dBufStarted = count.bufStarted - nBefore.bufStarted
out.PASS_nodes = dBufStarted >= 1 || dOscStarted >= 1

/* ── ②·六 每个音走的哪条路（第二十五轮新增）──────────────────────────
   四个音在整场仪式里都会响（charge→burst→flip→reveal）。
   断言是**双向**的（判据写错一面就永远是绿的）：
     · 有素材的音必须 kind === 'asset'（素材路没生效 = 静默回归，最阴）；
     · 没素材的音必须 kind === 'synth'（说明兜底路也还活着，
       且 kinds 确实在按音记录——防止这张表本身坏了还全绿）。 */
await sleep(600)
const sfxKinds = window.__tarotSfx ? window.__tarotSfx.kinds : null
out.sfxKinds = sfxKinds
/* assetNames / nAssets 已在 ②·五 段声明（按文件名匹配那次改动里提前了），此处不再重复 */
out.PASS_sfxAssetPath =
  nAssets > 0 &&
  !!sfxKinds &&
  assetNames.every((n) => sfxKinds[n] === 'asset')
out.PASS_sfxSynthFallback =
  !!sfxKinds &&
  ['charge', 'burst', 'flip', 'reveal']
    .filter((n) => !assetNames.includes(n))
    .every((n) => sfxKinds[n] === 'synth')

/* ── ②·七 出厂素材的响度 / 峰值 / 时长（第二十五轮新增）──────────────────
   上面那两条只能证明「路走对了」，证明不了「路上运的那批货是对的」。
   四个音来自**四次独立生成**，响度差开了就是「有的音听不见、有的音吓人」
   （README 里那条契约）。它的端到端判据只能落在这里 ——
   量的对象是**浏览器解码后的样本**：生成 → build-sfx.py → dist 哈希产物 →
   HTTP → decodeAudioData，整条链路在这个点上才合拢。

   三面的阈值都是**先量、后定**（实测值见 `scripts/out/_sfx_build.json` 的 rt_* 列），
   不是拍出来的：
     · 响度极差 ≤ 3dB —— 实测 1.1dB（charge -14.7 / burst -13.6 / flip -14.5 / reveal -14.7）
     · 解码峰值 ≤ 0dBFS —— mp3 的样本间过冲会在这里显形，超了播放端就硬削
     · 时长 ±0.12s 内对得上合同表 —— 专抓「dist 里是上一版旧文件」这类静默错配 */
const CONTRACT_DUR = { charge: 1.0, burst: 1.0, flip: 0.82, reveal: 4.0 }
const sfxStats = window.__tarotSfx ? window.__tarotSfx.stats : null
out.sfxStats = sfxStats
const sNames = Object.keys(sfxStats || {})
const rmsVals = sNames.map((n) => sfxStats[n].rmsDb)
out.sfxRmsSpreadDb = rmsVals.length
  ? Math.round((Math.max(...rmsVals) - Math.min(...rmsVals)) * 10) / 10
  : null
/* 四件套必须一件不少：任何一件没解出来（failed）都是失败，缺件不能算"对齐" */
out.PASS_sfxLoudness =
  sNames.length === nAssets && out.sfxRmsSpreadDb !== null && out.sfxRmsSpreadDb <= 3.0
out.sfxPeakOver = sNames.filter((n) => sfxStats[n].peakDb > 0.0)
out.PASS_sfxNoOver = sNames.length > 0 && out.sfxPeakOver.length === 0
out.sfxDurDrift = sNames
  .filter((n) => Math.abs(sfxStats[n].dur - CONTRACT_DUR[n]) > 0.12)
  .map((n) => `${n} ${sfxStats[n].dur}s vs 合同 ${CONTRACT_DUR[n]}s`)
out.PASS_sfxDuration = sNames.length === nAssets && out.sfxDurDrift.length === 0

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
  sfxDownload: out.PASS_sfxDownload,
  sfxAssetPath: out.PASS_sfxAssetPath,
  sfxSynthFallback: out.PASS_sfxSynthFallback,
  sfxLoudness: out.PASS_sfxLoudness,
  sfxNoClip: out.PASS_sfxNoOver,
  sfxDuration: out.PASS_sfxDuration,
  nodesConnected: out.PASS_nodes,
  toggleAlwaysClickable: out.toggleHitIsSelf && out.toggleHitAfterPanel,
  orbStillHittable: out.orbHittable === 'orb',
  offAgain: out.PASS_offAgain,
  noAutoplayWarn: out.PASS_noAutoplayWarn,
  noErrors: out.PASS_noErrors
}
out.ALL_PASS = Object.values(out.PASS).every(Boolean)

return out
