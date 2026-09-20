/* DevBar 音效调试区探针（2026-09-20）
   ==========================================================================
   运行目标：**开发服务器**（`vite dev`）。正式产物里 DevBar 整块被摇掉
   （`__DEV_TOOLS__` 在 `vite build` 下为 false，Rollup 会静态折叠掉那一支），
   所以 `.devbar` 不存在时**这条 probe 就该失败** —— 那是「跑错了目标」，
   不是「功能没做」。用 APP_URL=http://127.0.0.1:4199/ 跑它必定红，这是对的。

   为什么值得有一条判据：
     这个调试区存在的唯一理由是「听到真实的那一份」。而它最容易坏的方式
     **恰恰是静默的** —— 素材还没解码完就播，于是悄悄落回合成路，
     页面上照样有声音、控制台照样干净，"你以为在检查 AI 素材，其实在听合成音"。
     靠人耳分辨做不到，所以判据必须落在「点了这个按钮，那个音**实际**走了哪条路」。

   判据：
     ① 调试条在，音效区四个音 + 连播 + 循环 + A/B 齐全
     ② 点一个音 → 该音走 **asset**（证明预载真的赶在播放之前完成）
     ③ 切「合成」再点 → 该音走 **synth**（证明 A/B 钩子真的接通，不是摆设）
     ④ 连播四拍 → 四个音都响了、且都走素材路
     ⑤ 顺手开声音：`.sound` 开关同步成「开」（两个控件不许说两套话）
     ⑥ 调试条没盖住水晶球，也没盖住解读面板的「再抽一次」
        （这条是这个项目踩过的真事故：横排调试条曾把「再抽一次」压到点不到）
     ⑦ 调试条自己不超出视口
     ⑧ 控制台无报错
   ========================================================================== */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const $ = (s) => document.querySelector(s)

const out = { errors: [] }
window.addEventListener('error', (e) => out.errors.push(String(e.message)))
window.addEventListener('unhandledrejection', (e) => out.errors.push(String(e.reason)))

/** 轮询等待条件成立，返回耗时（毫秒）；超时返回 null —— 比固定 sleep 可靠 */
const waitFor = async (fn, ms = 8000, step = 100) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    let ok = false
    try {
      ok = !!fn()
    } catch {
      ok = false
    }
    if (ok) return Date.now() - t0
    await sleep(step)
  }
  return null
}

/** 等元素「不再动」—— 连个两次采样 rect 一致才算停稳（面板是上滑入场的） */
const settle = async (el, ms = 5000, step = 120) => {
  if (!el) return null
  const t0 = Date.now()
  let prev = null
  while (Date.now() - t0 < ms) {
    const r = el.getBoundingClientRect()
    const cur = [r.x, r.y, r.width, r.height].map(Math.round).join(',')
    if (cur === prev) return Date.now() - t0
    prev = cur
    await sleep(step)
  }
  return null
}

const names = ['charge', 'burst', 'flip', 'reveal']
const label = { charge: '屏息', burst: '雾散', flip: '丝绢', reveal: '颂钵' }
const box = (el) => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    x: Math.round(r.x),
    y: Math.round(r.y),
    w: Math.round(r.width),
    h: Math.round(r.height),
    right: Math.round(r.right),
    bottom: Math.round(r.bottom)
  }
}
/** 打在元素中心：返回真正吃到这一点的元素。可见 ≠ 可点 */
const hitAt = (el) => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
  return h ? `${h.tagName}.${typeof h.className === 'string' ? h.className : ''}` : null
}
const kinds = () => (window.__tarotSfx ? window.__tarotSfx.kinds : null)

/* ── 入场 ──────────────────────────────────────────────────────────── */
/* 信封那一层没卸载之前，点哪儿都可能被它吃掉 */
out.welcomeAwayMs = await waitFor(() => !$('.welcome'), 14000)

const bar = $('.devbar')
const barBtn = (t) => [...(bar ? bar.querySelectorAll('button') : [])].find((b) => b.textContent.trim() === t)

/* ── ① 调试区该有的都在 ───────────────────────────────────────────── */
out.devbar = !!bar
out.sfxButtons = names.map((n) => `${n}:${barBtn(label[n]) ? '有' : '缺'}`)
out.seqButton = !!barBtn('连播四拍')
out.loopButton = !!barBtn('循环')
out.abButtons = ['素材', '合成'].map((t) => `${t}:${barBtn(t) ? '有' : '缺'}`)
out.PASS_controls =
  out.devbar &&
  out.sfxButtons.every((s) => s.endsWith('有')) &&
  out.seqButton &&
  out.loopButton &&
  out.abButtons.every((s) => s.endsWith('有'))

/* ── ② 点「屏息」→ 必须走素材路 ───────────────────────────────────── */
/* 这一次点击同时是三件事：叫醒引擎（unlock）+ 等素材就绪 + 播放。
   `loaded` 从空到 4/4 就是在这中间完成的 —— 判据要的是**结果**而不是过程。 */
const chargeBtn = barBtn('屏息')
chargeBtn?.click()
out.assetClickMs = await waitFor(() => kinds()?.charge === 'asset', 12000)
out.sfxState = (() => {
  const s = window.__tarotSfx
  return s ? { assets: s.assets, loaded: s.loaded, failed: s.failed, kinds: s.kinds } : null
})()
out.kindCharge = kinds()?.charge ?? null
out.PASS_assetPath = out.kindCharge === 'asset'
/* 预载必须真的到齐 —— 否则上面那条即使绿了也是「碰巧第一次就解码完」 */
out.PASS_preloaded = (out.sfxState?.loaded?.length ?? 0) === 4

/* ── ⑤ 顺手开声音：左上角开关必须同步 ────────────────────────────── */
out.soundToggle = (() => {
  const b = $('.sound')
  return b ? { pressed: b.getAttribute('aria-pressed'), label: b.textContent.trim() } : null
})()
out.soundPref = (() => {
  try {
    return localStorage.getItem('tarot.sound')
  } catch (e) {
    return `${e.name}: ${e.message}`
  }
})()
out.PASS_soundSynced = out.soundToggle?.pressed === 'true' && out.soundPref === 'on'

/* ── ③ A/B：切到合成，同一个音必须换路 ───────────────────────────── */
barBtn('合成')?.click()
await sleep(150)
out.forceSynthFlag = window.__tarotSfx ? window.__tarotSfx.forceSynth : null
chargeBtn?.click()
out.synthClickMs = await waitFor(() => kinds()?.charge === 'synth', 6000)
out.kindChargeSynth = kinds()?.charge ?? null
out.PASS_synthPath = out.kindChargeSynth === 'synth' && out.forceSynthFlag === true
/* 切回素材，免得影响后面的连播 */
barBtn('素材')?.click()
await sleep(150)

/* ── ④ 连播四拍：四个音都得响、且都走素材路 ──────────────────────── */
barBtn('连播四拍')?.click()
/* 连播按抽牌仪式排期，最后一拍在 panelAt≈5.01s —— 留足余量 */
out.seqDoneMs = await waitFor(
  () => {
    const k = kinds()
    return k && names.every((n) => k[n] === 'asset')
  },
  12000,
  150
)
out.kindsAfterSeq = kinds()
out.PASS_seq = names.every((n) => kinds()?.[n] === 'asset')

/* ④.5 A/B 的高亮必须与真实模式一致 —— 两个控件各说一套，比不显示还糟。
   量的是**切回「素材」之后**：素材亮、合成不亮。 */
out.abState = ['素材', '合成'].map((t) => `${t}:${barBtn(t)?.dataset.active === 'true' ? '高亮' : '-'}`)
out.PASS_abIndicator =
  barBtn('素材')?.dataset.active === 'true' && barBtn('合成')?.dataset.active !== 'true'

/* ── ⑥ 不遮挡 ──────────────────────────────────────────────────────── */
await settle($('.orb'), 3000)
out.viewport = { w: innerWidth, h: innerHeight }
out.devbarBox = box(bar)
out.hitOrb = hitAt($('.orb'))
out.hitOwnButton = hitAt(chargeBtn)
out.PASS_devbarClickable = (out.hitOwnButton || '').startsWith('BUTTON')
/* 调试条 x 只占左边缘 92px；球居中。命中球心必须还是球自己 */
out.PASS_orbClickable = (out.hitOrb || '').startsWith('SPAN.orb') || (out.hitOrb || '').includes('orb')

/* 抽一次牌，量解读面板的动作行 —— 那是调试条历史上真挡住过的地方 */
$('.orb')?.click()
await waitFor(() => $('.panel') && ($('.panel__text')?.textContent ?? '').length > 0, 14000)
await settle($('.panel'), 4000)
out.hitAgain = hitAt([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '再抽一次'))
out.PASS_againClickable = (out.hitAgain || '').startsWith('BUTTON')
out.devbarBoxWithPanel = box($('.devbar'))

/* ── ⑦ 不许超出视口 ───────────────────────────────────────────────── */
out.PASS_inViewport =
  !!out.devbarBox && out.devbarBox.y >= 0 && out.devbarBox.bottom <= innerHeight && out.devbarBox.x >= 0

out.PASS = {
  controls: out.PASS_controls,
  preloaded: out.PASS_preloaded,
  assetPath: out.PASS_assetPath,
  soundSynced: out.PASS_soundSynced,
  synthPath: out.PASS_synthPath,
  abIndicator: out.PASS_abIndicator,
  seq: out.PASS_seq,
  devbarClickable: out.PASS_devbarClickable,
  orbClickable: out.PASS_orbClickable,
  againClickable: out.PASS_againClickable,
  inViewport: out.PASS_inViewport
}
out.ALL_PASS = Object.values(out.PASS).every(Boolean) && out.errors.length === 0

return out
