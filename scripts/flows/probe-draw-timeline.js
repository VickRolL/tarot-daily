/**
 * 抽牌时间轴实测探针（基线测量，只读不改）
 * ---------------------------------------------------------------------------
 * 目的：把「从点击水晶球到解读面板就位」的每个关键帧用真实时间量出来，
 * 而不是从 TIMING 常量推算 —— 因为 phase 计时器与组件内 delay 有可能重复计一次
 * （推算会得出错误基线）。
 *
 * 采样方式：requestAnimationFrame 逐帧记录，事件用「第一次满足条件」判定。
 * 不用 --wait 抓动画帧（见 NEXT_STEPS 第 13 条：--wait 的时钟基准会差出一拍）。
 *
 * 跑法：
 *   "$N" scripts/shot.mjs http://127.0.0.1:5199/ out.png \
 *     --w 1582 --h 804 --wait 4200 --eval-file scripts/flows/probe-draw-timeline.js
 */
const px = (v) => Math.round(v * 10) / 10

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

const samples = []
const t0 = performance.now()
orb.click()

await new Promise((resolve) => {
  const tick = () => {
    const t = performance.now() - t0
    const card = document.querySelector('.card')
    const panel = document.querySelector('.panel')
    const kicker = document.querySelector('.panel__kicker')
    const text = document.querySelector('.panel__text')
    const cardRect = card ? card.getBoundingClientRect() : null
    const panelRect = panel ? panel.getBoundingClientRect() : null
    samples.push({
      t: px(t),
      flash: !!document.querySelector('.flash'),
      card: !!card,
      cardOp: card ? Number(getComputedStyle(card).opacity) : null,
      cardTop: cardRect ? px(cardRect.top) : null,
      cardH: cardRect ? px(cardRect.height) : null,
      /** 牌心（top + h/2）：不受 scale 影响，测「停稳」比 top 可靠 */
      cardMid: cardRect ? px(cardRect.top + cardRect.height / 2) : null,
      flip: angle(document.querySelector('.card__flip')),
      panel: !!panel,
      panelOp: panel ? Number(getComputedStyle(panel).opacity) : null,
      panelTop: panelRect ? px(panelRect.top) : null,
      /* 面板「内容」是否跟得上外框：kicker 是第一个子项，正文是第三个 */
      kickerOp: kicker ? Number(getComputedStyle(kicker).opacity) : null,
      textOp: text ? Number(getComputedStyle(text).opacity) : null
    })
    /* 2026-09-19 分拍后总时长约 5.7s（原 3.4s），采样窗口相应加长 */
    if (t > 7600) return resolve()
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})

/* ------------------------------ 关键帧判定 ------------------------------ */
const first = (pred) => samples.find(pred)?.t ?? null
const last = samples[samples.length - 1]

/** 找到某字段的稳定值（取最后 5 帧的中位数），再回查「第一次到达该值」的时刻 */
const settleAt = (field) => {
  const tail = samples.slice(-5).map((s) => s[field]).filter((v) => v !== null)
  if (!tail.length) return null
  const target = tail.sort((a, b) => a - b)[Math.floor(tail.length / 2)]
  return first((s) => s[field] !== null && Math.abs(s[field] - target) <= 1) ?? null
}

/**
 * 「停稳」判据：**位置与尺寸同时**落到终值附近。
 *
 * 为什么不能只看位置：升起的 `scale` 带一点过冲（0.42 → 1.025 → 1，读作「被托住」），
 * 牌会先向上顶约 1.3px 再落回来 —— 只看 `cardTop` 会把「过冲回来的那一刻」当成停稳，
 * 于是 riseSettled 时早时晚，±400ms 的噪声会直接污染下面每条节拍断言。
 * 加上「高度也到位」这一条就能干净地跳过整个过冲段。
 */
const settleAt2 = (f1, f2, tol = 1.2) => {
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
      (s) =>
        s[f1] !== null &&
        s[f2] !== null &&
        Math.abs(s[f1] - t1) <= tol &&
        Math.abs(s[f2] - t2) <= tol
    ) ?? null
  )
}

const marks = {
  click: 0,
  flashMount: first((s) => s.flash),
  cardMount: first((s) => s.card),
  cardVisible: first((s) => s.card && s.cardOp >= 0.5),
  cardFullOpacity: first((s) => s.card && s.cardOp >= 0.99),
  riseSettled: settleAt2('cardTop', 'cardH'),
  flipStart: first((s) => s.flip !== null && s.flip > 0.5),
  flip90: first((s) => s.flip >= 90),
  flip168: first((s) => s.flip >= 168),
  flip180: first((s) => s.flip >= 179.5),
  panelMount: first((s) => s.panel),
  panelVisible: first((s) => s.panel && s.panelOp >= 0.5),
  panelSettled: settleAt('panelTop'),
  /** 面板内容（stagger 子项）：外框到位后它们才出现吗？ */
  kickerVisible: first((s) => s.kickerOp !== null && s.kickerOp >= 0.5),
  textVisible: first((s) => s.textOp !== null && s.textOp >= 0.5),
  textFull: first((s) => s.textOp !== null && s.textOp >= 0.99),
  /** 外框与首个子项之间的空档：> 200ms 就是「先出来一个空面板」 */
  panelToContentGap: null
}

if (marks.panelMount !== null && marks.kickerVisible !== null) {
  marks.panelToContentGap = px(marks.kickerVisible - marks.panelMount)
}

/* 每 8 帧抽一条，看时间轴的「形状」（哪一段在动、哪一段静着） */
const track = samples
  .filter((_, i) => i % 8 === 0)
  .map((s) => ({
    t: s.t,
    op: s.cardOp,
    top: s.cardTop,
    flip: s.flip,
    pOp: s.panelOp
  }))

return {
  viewport: [innerWidth, innerHeight],
  frames: samples.length,
  marks,
  /* 从点击到面板完全就位 */
  totalMs: marks.panelSettled,
  cardRect: last.cardTop === null ? null : { top: last.cardTop, h: last.cardH },
  track
}
