/* 解读面板「最坏情况」净空探针（2026-09-20 第二十一轮 / 2026-09-21 第三十二轮）
   ==========================================================================
   为什么需要它：`audit-draw.js` 是**点球随机抽**的，所以它报出来的 clearancePx
   是「这一把抽到的那张牌」的值，不是最坏情况。面板高度由 meaning + advices 的
   换行行数决定 —— 抽到文案短的牌就宽松，抽到长的就紧。用一张随机牌去判
   「面板会不会压到卡牌」，等于没测。

   这里的做法是从根上消除随机性：**把 22 张牌逐一套进去量一遍**。
   手法是「写 localStorage 记录 → 切模式让 useDrawState 重新读记录」，
   切模式是必需的：`handleModeChange` 才会把 phase 复位、让回访 effect 重新挑牌。
   所以每张牌点两下（不限次数 → 一天一次），靠 mode 变化触发重读。

   ⚠️ 第三十二轮的两个改动（今日建议从 1 条变成 3~5 条随机取一条）：
   ① **随机性多了一维**。以前一张牌只有一条建议，套进去就穷尽了；现在同一张牌
      抽到哪条建议看运气，而长句子会把面板顶得更高。所以这里改成**每张牌只量它
      最长的那一条**（并列时取靠前的）—— 那才是真正的最坏情况。
      数据直接 `import('/src/data/cards.js')` 从 Vite 源码模块拿：本探针本来就只能
      在 `vite dev` 下跑（要按 devbar 切模式），顺手就拿到了源码里的 advices。
   ② 顺手多断言一条 **adviceShown 是否等于种进去的那条** —— 记录里的 `adviceIndex`
      能不能原样回放，这里免费覆盖一次。

   配合 `--reduced` 跑：所有动画时长压到近零，22 轮不必每轮等 1 秒。
   面板的**高度**与动画无关（动画只改 opacity / y），所以 reduced 下的测量值可用。

   ⚠️ 判据是**净空**（panel.top − card.bottom），不是 overlapPx。
      overlapPx = 0 只说明「这一张没压上」，净空才告诉你「还剩多少余量」。 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const $ = (s) => document.querySelector(s)
const KEY = 'tarot-daily::draw-record'

/* 源码数据。拿不到就直接报错退出 —— 静默跳过等于把这条探针废掉还看不出来。 */
let DATA
try {
  DATA = (await import('/src/data/cards.js')).MAJOR_ARCANA
} catch (err) {
  return { error: '拿不到 /src/data/cards.js：本探针只能在 vite dev 下跑（' + err.message + '）' }
}

const waitFor = async (fn, ms, step = 50) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try {
      if (fn()) return Date.now() - t0
    } catch {
      /* 还没到 */
    }
    await sleep(step)
  }
  return null
}

const d = new Date()
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const devBtn = (label) =>
  [...document.querySelectorAll('.devbar button')].find((b) => b.textContent.trim() === label)

if (!devBtn('一天一次')) {
  return { error: '调试条不存在（本探针只能在开发模式下跑）' }
}

await waitFor(() => $('.scene')?.dataset.phase === 'idle', 9000)

/* 每张牌「最长的那条建议」的下标 —— 面板高度先由 meaning 的换行数决定，
   再叠加 advices 的换行数；长度取最长就覆盖了这一维的最坏情况。
   （用字数当行数的代理量：同一宽度下中文的字数就是换行的主导因素，
     而所有建议都在同一字号、同一容器宽度里换行。） */
const longestIdx = (card) => {
  let best = 0
  card.advices.forEach((a, i) => {
    if (a.length > card.advices[best].length) best = i
  })
  return best
}

const rows = []

for (const card of DATA) {
  const id = card.id
  const ai = longestIdx(card)
  localStorage.setItem(KEY, JSON.stringify({ date: today, cardId: id, adviceIndex: ai }))
  devBtn('不限次数')?.click()
  await sleep(40)
  devBtn('一天一次')?.click()
  const ok = await waitFor(() => $('.scene')?.dataset.phase === 'revealed' && $('.panel'), 4000)
  await sleep(60)

  const cardRect = $('.card')?.getBoundingClientRect()
  const panel = $('.panel')?.getBoundingClientRect()
  const panelInner = $('.panel__inner')?.getBoundingClientRect()
  const kicker = $('.panel__kicker')
  const adviceEl = $('.panel__advice')
  /* 面板上那句「今日建议 · XXX」，去掉前缀与记录里种进去的那条比对 */
  const shownAdvice = adviceEl ? adviceEl.textContent.replace(/^\s*今日建议\s*·\s*/, '').trim() : null
  if (!cardRect || !panel) {
    rows.push({ id, error: '面板或卡牌没挂上', reachedMs: ok })
    continue
  }
  rows.push({
    id,
    adviceIndex: ai,
    adviceLen: card.advices[ai].length,
    /* 种进去哪条、面板上就是哪条 —— 顺手验了 adviceIndex 的回放 */
    adviceHonored: shownAdvice === card.advices[ai],
    kicker: kicker ? kicker.textContent.trim() : null,
    /* 踢脚行有没有换成两行 —— 元素/星象是这一轮新拼上去的，窄视口可能被挤换行 */
    kickerLines: kicker ? Math.round(kicker.getBoundingClientRect().height / parseFloat(getComputedStyle(kicker).lineHeight)) : null,
    cardBottom: +cardRect.bottom.toFixed(1),
    panelTop: +panel.top.toFixed(1),
    panelH: +panel.height.toFixed(1),
    /* 净空：正数才有余量。判据看它，不看 overlap */
    clearance: +(panel.top - cardRect.bottom).toFixed(1),
    overlap: +Math.max(0, cardRect.bottom - panel.top).toFixed(1),
    /* 动作行有没有换行（这一轮多了一个「完整解读」按钮） */
    actionRows: (() => {
      const acts = $('.panel__actions')
      if (!acts) return null
      const kids = [...acts.children]
      if (!kids.length) return null
      const tops = new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top)))
      return tops.size
    })(),
    oathShown: (() => {
      const el = $('.panel__oath')
      return el ? getComputedStyle(el).display !== 'none' : null
    })(),
    innerH: panelInner ? +panelInner.height.toFixed(1) : null
  })
}

/* 复位，别把随机的一张牌留给后面的流程 */
localStorage.removeItem(KEY)

const valid = rows.filter((r) => typeof r.clearance === 'number')
const worst = valid.slice().sort((a, b) => a.clearance - b.clearance).slice(0, 3)

const out = {
  viewport: [innerWidth, innerHeight],
  reducedActive: !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
  count: rows.length,
  /* 每张牌量的是哪条建议、多少字（第三十二轮：确认真的取了最长那条） */
  advicePlan: DATA.map((c) => ({ id: c.id, n: c.advices.length, idx: longestIdx(c), len: c.advices[longestIdx(c)].length })),
  worst,
  kickerWrapped: rows.filter((r) => r.kickerLines > 1).map((r) => r.id),
  actionWrapped: rows.filter((r) => r.actionRows > 1).map((r) => r.id),
  adviceNotHonored: rows.filter((r) => r.adviceHonored === false).map((r) => r.id),
  oathShown: rows[0]?.oathShown ?? null,
  rows
}

/* 判据：22 张全量测到、最坏净空为正、踢脚行与动作行都没被挤换行，
   且种进去的那条建议真的回放到了面板上。
   ⚠️ 阈值取 8px 而不是 0：净空 0 是「刚好压线」，任何字体度量差异都会翻负
     （见 web-visual-qa 第 11 条：overlap == 0 可能只是侥幸）。 */
out.PASS = {
  all22: valid.length === 22,
  worstClearance: valid.length > 0 && Math.min(...valid.map((r) => r.clearance)) >= 8,
  noKickerWrap: out.kickerWrapped.length === 0,
  noActionWrap: out.actionWrapped.length === 0,
  adviceHonored: out.adviceNotHonored.length === 0 && valid.length === 22
}

out.ALL_PASS = Object.values(out.PASS).every(Boolean)

return out
