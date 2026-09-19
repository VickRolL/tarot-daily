/**
 * 抽牌仪式定格取帧（按**动画自身状态**等待，不用 --wait 猜时刻）
 * ---------------------------------------------------------------------------
 * 与 welcome-frame.js 同一套思路：`--wait` 的时钟基准是 Page.loadEventFired，
 * 而 React 挂载通常早于它，再加上 CDP 往返，标称时刻能差出整整一拍。
 * 所以这里轮询真正要看的那个状态，命中才返回让 shot.mjs 截图。
 *
 * 帧用 URL hash 选（四张对应验收清单第 8 条）：
 *   #charge → ① 蓄势期（球在充能，牌尚未挂载，副标题已退场、暗角压下来）
 *   #hold   → ④ 悬停期（牌停稳、只显牌背，辉光在呼吸）★ 最该看的一张
 *   #flip   → ⑥ 翻牌中段（约跨过 90°）
 *   #final  → ⑧ 终态（面板内容全部到位）
 *
 * 跑法（--wait 只用来等迎接动画与入场跑完，之后交给状态轮询）：
 *   "$N" scripts/shot.mjs "http://127.0.0.1:5199/#hold" assets/_debug/r-hold.png \
 *     --w 1582 --h 804 --wait 4400 --eval-file scripts/flows/ritual-frame.js
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const frame = (location.hash || '#hold').slice(1)

/* 调试条会压住面板底部，截图时先藏掉 */
const devbar = document.querySelector('.devbar')
if (devbar) devbar.style.display = 'none'

const orb = document.querySelector('.orb')
if (!orb) return { error: 'no orb' }

/** 等到 pred 成立（最长 timeout），返回实际等待到的状态描述 */
const until = async (pred, timeout = 9000, label = '') => {
  const t0 = performance.now()
  while (performance.now() - t0 < timeout) {
    const hit = pred()
    if (hit) return { ok: true, waited: Math.round(performance.now() - t0), label }
    await sleep(16)
  }
  return { ok: false, waited: Math.round(performance.now() - t0), label }
}

const flipAngle = () => {
  const el = document.querySelector('.card__flip')
  if (!el) return null
  const t = getComputedStyle(el).transform
  if (!t || t === 'none') return 0
  const m = new DOMMatrix(t)
  return (Math.atan2(m.m31, m.m11) * 180) / Math.PI
}

/**
 * 牌是否已经「停住」：位置与高度连续 220ms 没有可见变化。
 *
 * 为什么不比对「终值」：卡牌的 y（slam）与 scale（settle 带过冲）是两条曲线，
 * 终值要等动画收尾才知道，而取帧必须在动画进行中 —— 所以用「静下来」这个状态判据。
 * 阈值 0.35px/帧 足够紧：升起的后段仍有 1px 级变化，而悬停期的 rotateZ 微摆
 * 每帧只动约 0.03px，不会把计时器打回零。
 */
let last = null
let stillSince = 0
const cardStill = () => {
  const el = document.querySelector('.card')
  if (!el) return false
  const r = el.getBoundingClientRect()
  if (!last || Math.abs(r.top - last.top) > 0.35 || Math.abs(r.height - last.height) > 0.35) {
    last = { top: r.top, height: r.height }
    stillSince = performance.now()
    return false
  }
  last = { top: r.top, height: r.height }
  return performance.now() - stillSince > 220
}

const waiters = {
  charge: async () => {
    orb.click()
    /* 蓄势的判定用 DOM 上的相位（App 写在 <main data-phase> 上），
       等它进入 charging 后再停留 560ms —— 取充能中段，光环已经收进来一半 */
    const r = await until(() => document.querySelector('main')?.dataset.phase === 'charging', 3000, 'phase=charging')
    await sleep(560)
    return { ...r, phase: document.querySelector('main')?.dataset.phase, cardMounted: !!document.querySelector('.card') }
  },
  hold: async () => {
    orb.click()
    /* ④ 悬停：牌已经停住、且还没开始转（flip 仍为 0）→ 再停 380ms 取辉光呼吸的中段 */
    const r = await until(() => cardStill() && Math.abs(flipAngle() ?? 99) < 0.05, 9000, 'card still, flip=0')
    await sleep(380)
    return { ...r, flip: Math.round(flipAngle() ?? -1), phase: document.querySelector('main')?.dataset.phase }
  },
  flip: async () => {
    orb.click()
    const r = await until(() => {
      const a = flipAngle()
      return a !== null && a > 92 && a < 130
    }, 9000, '80° < flip < 130°')
    return { ...r, flip: Math.round(flipAngle() ?? -1) }
  },
  final: async () => {
    orb.click()
    /* ⑧ 终态：面板就位 + 最后一个子项（按钮组）已亮起 */
    const r = await until(() => {
      const acts = document.querySelector('.panel__actions')
      return !!acts && Number(getComputedStyle(acts).opacity) > 0.99
    }, 12000, 'panel content fully visible')
    await sleep(260)
    return { ...r, phase: document.querySelector('main')?.dataset.phase }
  }
}

if (!waiters[frame]) return { error: 'unknown frame: ' + frame, frames: Object.keys(waiters) }
const result = await waiters[frame]()

return {
  frame,
  ...result,
  phase: document.querySelector('main')?.dataset.phase ?? null,
  cardTop: document.querySelector('.card')
    ? Math.round(document.querySelector('.card').getBoundingClientRect().top)
    : null,
  panelTop: document.querySelector('.panel')
    ? Math.round(document.querySelector('.panel').getBoundingClientRect().top)
    : null
}
