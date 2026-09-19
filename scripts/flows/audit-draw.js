/**
 * 节拍审计 · 抽牌仪式（2026-09-19 由「稳态几何审计」升级而来）
 * ---------------------------------------------------------------------------
 * 只量稳态几何是抓不出「节奏错位」的 —— 上一版抽牌的几何完全正确
 * （牌不压面板、面板不压牌），但时间是错的：牌还在飞的时候就翻完了、
 * 面板上来之后空了 1.6 秒。所以这里改成**带断言的节拍审计**。
 *
 * 采样方式沿用 probe-draw-timeline.js：requestAnimationFrame 逐帧记录，
 * 关键帧用「第一次满足条件」判定。**不用 --wait 抓动画帧**
 * （见 NEXT_STEPS 第 13 条：--wait 的时钟基准会差出一整拍）。
 *
 * 跑法（桌面 / 移动 / reduced 各跑一次）：
 *   "$N" scripts/shot.mjs http://127.0.0.1:5199/ out.png \
 *     --w 1582 --h 804 --wait 4400 --eval-file scripts/flows/audit-draw.js
 *   "$N" scripts/shot.mjs http://127.0.0.1:5199/ out.png \
 *     --w 504 --h 784 --wait 4400 --eval-file scripts/flows/audit-draw.js
 *   "$N" scripts/shot.mjs http://127.0.0.1:5199/ out.png \
 *     --w 1582 --h 804 --wait 4400 --reduced --eval-file scripts/flows/audit-draw.js
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const px = (v) => Math.round(v * 10) / 10
const rect = (el) => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const orb = document.querySelector('.orb')
if (!orb) return { error: 'no orb' }

/** 从计算后的 transform 矩阵里解出 rotateY 角度（.card__flip 只转 rotateY） */
const angle = (el) => {
  if (!el) return null
  const t = getComputedStyle(el).transform
  if (!t || t === 'none') return null
  const m = new DOMMatrix(t)
  return px((Math.atan2(m.m31, m.m11) * 180) / Math.PI)
}

/* ------------------------------ 逐帧采样 ------------------------------ */
const samples = []
const t0 = performance.now()
orb.click()

await new Promise((resolve) => {
  const tick = () => {
    const t = performance.now() - t0
    const card = document.querySelector('.card')
    const panel = document.querySelector('.panel')
    const kicker = document.querySelector('.panel__kicker')
    const cardRect = card ? card.getBoundingClientRect() : null
    const panelRect = panel ? panel.getBoundingClientRect() : null
    samples.push({
      t: px(t),
      phase: document.querySelector('main')?.dataset.phase ?? null,
      card: !!card,
      cardOp: card ? Number(getComputedStyle(card).opacity) : null,
      cardTop: cardRect ? px(cardRect.top) : null,
      cardH: cardRect ? px(cardRect.height) : null,
      flip: angle(document.querySelector('.card__flip')),
      panel: !!panel,
      panelOp: panel ? Number(getComputedStyle(panel).opacity) : null,
      panelTop: panelRect ? px(panelRect.top) : null,
      kickerOp: kicker ? Number(getComputedStyle(kicker).opacity) : null
    })
    if (t > 7600) return resolve()
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})

const first = (pred) => samples.find(pred)?.t ?? null

/** 位置 + 尺寸同时到位才算「停稳」（跳过 scale 过冲造成的位置假回落，见探针注释） */
const settleAt2 = (f1, f2, tol) => {
  const median = (f) => {
    const tail = samples.slice(-5).map((s) => s[f]).filter((v) => v !== null)
    if (!tail.length) return null
    return tail.sort((a, b) => a - b)[Math.floor(tail.length / 2)]
  }
  const t1 = median(f1)
  const t2 = median(f2)
  if (t1 === null || t2 === null) return null
  return (
    first(
      (s) => s[f1] !== null && s[f2] !== null && Math.abs(s[f1] - t1) <= tol && Math.abs(s[f2] - t2) <= tol
    ) ?? null
  )
}
const settleAt1 = (field, tol) => {
  const tail = samples.slice(-5).map((s) => s[field]).filter((v) => v !== null)
  if (!tail.length) return null
  const target = tail.sort((a, b) => a - b)[Math.floor(tail.length / 2)]
  return first((s) => s[field] !== null && Math.abs(s[field] - target) <= tol) ?? null
}

const marks = {
  click: 0,
  /* ① 蓄势：牌必须**晚**出现（点击后一秒内不该有牌） */
  cardMount: first((s) => s.card),
  cardVisible: first((s) => s.card && s.cardOp >= 0.5),
  /* ③ 升起 → ④ 悬停 */
  riseSettled: settleAt2('cardTop', 'cardH', 1.2),
  /* ⑥ 翻牌 */
  flipStart: first((s) => s.flip !== null && s.flip > 0.5),
  flip90: first((s) => s.flip >= 90),
  flip168: first((s) => s.flip >= 168),
  flipDone: first((s) => s.flip >= 179.5),
  /* ⑧ 面板 */
  panelMount: first((s) => s.panel),
  panelSettled: settleAt1('panelTop', 1),
  contentVisible: first((s) => s.kickerOp !== null && s.kickerOp >= 0.5)
}

/* 声明式的期望值（组件写在 DOM 上，避免脚本自己推算） */
const declared = {
  flipAt: Number(document.querySelector('.card')?.dataset.flipAt ?? NaN),
  mountedAt: Number(document.querySelector('.card')?.dataset.mountedAt ?? NaN)
}

const gap = (a, b) => (marks[a] === null || marks[b] === null ? null : px(marks[a] - marks[b]))

/* ------------------------------ 断言 ------------------------------ */
const checks = []
const check = (name, value, ok, detail) => checks.push({ name, value, ok: !!ok, detail })

/* ⚠️ 「蓄势 / 悬停 / 留白 / 总时长」这几条只在正常动效下才有意义：
   reduced 的整条仪式被压到 20ms 级（那正是它该有的样子），拿节拍门槛去卡它
   等于把无障碍兜底判成失败。所以按媒体查询分两套断言。 */
if (!reduced) {
  check(
    '蓄势存在：cardVisible − click ≥ 950ms',
    marks.cardVisible,
    marks.cardVisible !== null && marks.cardVisible >= 950,
    '牌必须等球充能完才出现；点击即见牌 = 没有铺垫'
  )
  check(
    '悬停存在：flipStart − 牌停稳 ≥ 550ms',
    gap('flipStart', 'riseSettled'),
    gap('flipStart', 'riseSettled') !== null && gap('flipStart', 'riseSettled') >= 550,
    '牌要先停住再翻'
  )
  check(
    '★ 答案不得在牌停稳前显形：flip90 − 牌停稳 ≥ 1500ms',
    gap('flip90', 'riseSettled'),
    gap('flip90', 'riseSettled') !== null && gap('flip90', 'riseSettled') >= 1500,
    '上一版这里是 −483ms（翻转早于到位），最严重的那个问题'
  )
  check(
    '留白存在：panelMount − flipDone ≥ 200ms',
    gap('panelMount', 'flipDone'),
    gap('panelMount', 'flipDone') !== null && gap('panelMount', 'flipDone') >= 200,
    '翻完要让牌面被看清再上面板'
  )
  check(
    '总时长在 4800–6000ms 区间',
    marks.panelSettled,
    marks.panelSettled !== null && marks.panelSettled >= 4800 && marks.panelSettled <= 6000,
    '目标 5.2–5.4s，可接受 4.5–6.0s'
  )
  /* 这条守的是「延迟基准」：组件在 chargeDone 才挂载，而 Framer 的 delay 是从
     动画触发那一刻算的 —— 一旦有人把绝对时刻直接写进 delay，翻转就会整体晚一拍。 */
  if (Number.isFinite(declared.flipAt) && Number.isFinite(declared.mountedAt) && marks.flip168 !== null) {
    const expected = declared.flipAt + 140 /* flipWarm */ + 860 /* flipMain 到 168° */
    const drift = Math.abs(marks.flip168 - expected)
    check('翻牌落在声明时刻上（偏差 < 250ms）', px(marks.flip168 - expected), drift < 250, `期望 ≈ ${expected}ms`)
  }
} else {
  check(
    'reduced 总时长 ≤ 600ms',
    marks.panelSettled,
    marks.panelSettled !== null && marks.panelSettled <= 600,
    '无障碍用户不能等 5 秒'
  )
}

/* 这条两种模式都要成立：面板挂上来就得有字 */
check(
  '★ 不许再出现空面板：contentVisible − panelMount ≤ 300ms',
  gap('contentVisible', 'panelMount'),
  gap('contentVisible', 'panelMount') !== null && gap('contentVisible', 'panelMount') <= 300,
  '上一版这里是 1606ms —— 双重计时导致外框先上来、里面空着'
)

/* ------------------------------ 稳态几何 ------------------------------ */
await sleep(Math.max(0, 6200 - (performance.now() - t0)))
const card = document.querySelector('.card')
const anchor = document.querySelector('.stage__anchor')
const panel = document.querySelector('.panel')
const cardRect = card ? card.getBoundingClientRect() : null
const panelRect = panel ? panel.getBoundingClientRect() : null

const out = {
  viewport: [innerWidth, innerHeight],
  reduced,
  marked: declared,
  frames: samples.length,
  marks,
  gaps: {
    charge: marks.cardVisible,
    hold: gap('flipStart', 'riseSettled'),
    revealAfterSettled: gap('flip90', 'riseSettled'),
    tail: gap('panelMount', 'flipDone'),
    panelContentGap: gap('contentVisible', 'panelMount')
  },
  totalMs: marks.panelSettled,
  card: {
    rect: rect(card),
    heightPctVh: cardRect ? px((cardRect.height / innerHeight) * 100) : null,
    topPctVh: cardRect ? px((cardRect.y / innerHeight) * 100) : null,
    bottomPctVh: cardRect ? px((cardRect.bottom / innerHeight) * 100) : null,
    anchorRect: rect(anchor),
    flipTransform: document.querySelector('.card__flip')
      ? getComputedStyle(document.querySelector('.card__flip')).transform
      : null
  },
  panel: {
    rect: rect(panel),
    heightPctVh: panelRect ? px((panelRect.height / innerHeight) * 100) : null,
    topPctVh: panelRect ? px((panelRect.y / innerHeight) * 100) : null,
    opacity: panel ? getComputedStyle(panel).opacity : null,
    backdrop: panel ? getComputedStyle(panel).backdropFilter : null
  },
  /** 牌 vs 面板的重叠（几何契约要求 0） */
  overlapPx: cardRect && panelRect ? px(Math.max(0, cardRect.bottom - panelRect.top)) : null,
  /** 面板顶边与卡牌底边之间的**净空**（正数 = 分得开）。只看 overlapPx 会漏掉
      「只剩 3px 就撞上」这种侥幸状态 —— 2026-09-19 实测桌面就是 3.2px。 */
  clearancePx: cardRect && panelRect ? px(panelRect.top - cardRect.bottom) : null,
  textSample: [...document.querySelectorAll('.panel__kicker,.panel__text,.panel__advice')].map((e) =>
    e.textContent.trim().slice(0, 24)
  )
}

/* 牌 vs 面板：面板是**内容撑高**的（bottom 锚定），所以面板高度取决于抽到的牌
   文案有多长。2026-09-19 实测（文案最长的「魔术师 / 恶魔」，各 98 字）：
     1564×708 桌面 → 面板 269.4px（38.1%），净空仅 3.2px
      504×688 竖屏 → 面板 284.3px（41.3%），**超 19.3px**
   处置：`index.css` 里对 `max-height: 780px` 的矮视口收紧面板纵向留白约 32px
   （不是限高滚动 —— 那会把「生成分享卡片」挤出可视区）。
   现在桌面净空 ~35px、竖屏 ~13px。这条断言连净空一起报出来，
   免得下次又退化成「刚好压线」。 */
check(
  '牌与面板不重叠（几何契约）',
  out.overlapPx,
  out.overlapPx !== null && out.overlapPx <= 0,
  `面板 ${out.panel.heightPctVh}%（内容撑高，随牌文案变化）· 牌底边 ${out.card.bottomPctVh}%` +
    ` · 净空 ${out.clearancePx}px`
)

out.checks = checks
out.pass = checks.every((c) => c.ok)

if (!out.pass) {
  /* 失败时把逐帧轨迹一并带出来，省得再跑一次找原因 */
  out.track = samples.filter((_, i) => i % 10 === 0).map((s) => ({
    t: s.t,
    ph: s.phase,
    op: s.cardOp,
    top: s.cardTop,
    flip: s.flip,
    pOp: s.panelOp
  }))
}

return out
