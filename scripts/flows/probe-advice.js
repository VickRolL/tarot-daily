/* 今日建议 · 口径与行为探针（2026-09-21 第三十二轮）
   ==========================================================================
   用户的要求：**每张牌抽到时给 3~5 种不同的今日建议，而且这些建议不能在
   牌之图鉴里查看。**

   这句话拆开来是五件互相独立、都可能单独坏掉的事：

   A. **数据**：每张牌真有 3~5 条，句子干净、不重复、不超长。
   B. **选取契约**：`pickAdviceIndex` / `adviceAt` 的边界（含越界与旧记录）。
   C. **图鉴零泄露**：22 张逐张点进详情，**整段文本里搜不到该牌的任何一条建议**。
   D. **回放**：记录里的 `adviceIndex` 是几，面板上就显示第几条 ——
      这条不成立，「今日建议」会退化成「每次刷新换一句」。
   E. **分享图同一条**：Canvas 出图用的必须是页面上那条，不是另挑一条。
   F. **同一张牌也不破例**：今天刚抽到的那张，从图鉴点回去**仍然是封着的** ——
      这条最容易被「比较牌对象」式的判据漏掉，而它正是用户能遇到的路径。

   ⚠️ 本探针**必须在 `vite dev` 下跑**，两个原因：
      · 要从源码模块拿数据（`import('/src/data/cards.js')`），dist 里拿不到；
      · 要按左下角调试条切模式来触发「重新读记录」。
     跑法：npm run dev 起着，然后
       node scripts/run-flows.mjs probe-advice --reduced
     （APP_URL 指向 dev 服务器；脚本默认 4188 是产物预览，记得覆盖）

   ⚠️ C 为什么不能用「块数 / 文本长度」来判：封着的那块本身也是一个 `.detail__block`、
     也有一段够长的说明文字，所以「块数 3、每块 ≥ 20 字」会**照样通过**。
     判据能过、含义已经变了 —— 这里改成「搜建议原文」＋「结构标记」。

   ⚠️ E 为什么值得写成探针：分享图的字是画在 canvas 上的，肉眼只能看、代码看不出
     有没有传对。所以这里换个角度量**产物**：同一条建议画两次，字节必须一致；
     换一条建议再画，字节必须不同。后者不成立就说明 renderShareCard 根本没理会
     传进去的 advice（比如又退回 `card.advice`）。 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const $ = (s) => document.querySelector(s)
const qa = (s) => [...document.querySelectorAll(s)]
const KEY = 'tarot-daily::draw-record'
const CAP = 28 /* data/cards.js 里写死的字数上限，见那个文件的约束① */

const waitFor = async (fn, ms, step = 60) => {
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

const errors = []
window.addEventListener('error', (e) => errors.push(String(e.message)))
window.addEventListener('unhandledrejection', (e) => errors.push('rejection: ' + String(e.reason)))

/* ── 取源码数据与两个纯函数 ─────────────────────────────────────────── */
let cardsMod
try {
  cardsMod = await import('/src/data/cards.js')
} catch (err) {
  return { error: '拿不到 /src/data/cards.js：本探针只能在 vite dev 下跑（' + err.message + '）' }
}
const DATA = cardsMod.MAJOR_ARCANA
const { pickAdviceIndex, adviceAt } = cardsMod

const out = {}

/* ══════════════ A. 数据口径 ══════════════ */
const all = []
DATA.forEach((card) => (card.advices || []).forEach((a) => all.push({ id: card.id, text: a })))

const dupGlobal = (() => {
  const seen = new Map()
  const dup = []
  all.forEach(({ id, text }) => {
    if (seen.has(text)) dup.push({ text, a: seen.get(text), b: id })
    else seen.set(text, id)
  })
  return dup
})()
const dupWithin = DATA.filter((c) => new Set(c.advices || []).size !== (c.advices || []).length).map((c) => c.id)
const tooLong = all.filter((a) => a.text.length > CAP).map((a) => ({ id: a.id, len: a.text.length, text: a.text }))
const tooFew = DATA.filter((c) => !c.advices || c.advices.length < 3 || c.advices.length > 5).map((c) => ({
  id: c.id,
  n: (c.advices || []).length
}))
const dirty = all.filter((a) => !a.text || a.text !== a.text.trim()).map((a) => a.text)
/* 首条 = 改造前那句原文：数据里保留着，这里只报长度，不做内容比对
   （内容比对在改写脚本里做过一次，属于一次性迁移的断言） */

out.data = {
  cards: DATA.length,
  total: all.length,
  perCard: DATA.map((c) => (c.advices || []).length),
  maxLen: all.length ? Math.max(...all.map((a) => a.text.length)) : null,
  cap: CAP,
  dupGlobal: dupGlobal.slice(0, 5),
  dupWithin,
  tooLong: tooLong.slice(0, 5),
  tooFew,
  dirty: dirty.slice(0, 5)
}

/* ══════════════ B. 选取契约 ══════════════ */
const c0 = DATA[0]
const n0 = c0.advices.length
out.contract = {
  /* rand 边界：0 → 第一条；逼近 1 → 最后一条（不许越界成 undefined） */
  randLow: pickAdviceIndex(c0, () => 0),
  randHigh: pickAdviceIndex(c0, () => 0.999999),
  randMid: pickAdviceIndex(c0, () => 0.5),
  /* 没有 advices 的牌也不许给出 NaN */
  randNoAdvices: pickAdviceIndex({}, () => 0.5),
  /* 越界 / 非整数 / null 一律兜底到第一条，绝不能返回 undefined 或 '' */
  atFirst: adviceAt(c0, 0),
  atLast: adviceAt(c0, n0 - 1),
  atOver: adviceAt(c0, 999),
  atNegative: adviceAt(c0, -1),
  atNull: adviceAt(c0, null),
  atFraction: adviceAt(c0, 1.5),
  atNoCard: adviceAt(null, 0),
  firstLine: c0.advices[0],
  lastLine: c0.advices[n0 - 1]
}
out.PASS_contract = {
  randLow: out.contract.randLow === 0,
  randHigh: out.contract.randHigh === n0 - 1,
  randMid: out.contract.randMid === Math.floor(n0 / 2),
  randNoAdvices: out.contract.randNoAdvices === 0,
  atFirst: out.contract.atFirst === out.contract.firstLine,
  atLast: out.contract.atLast === out.contract.lastLine,
  atOver: out.contract.atOver === out.contract.firstLine,
  atNegative: out.contract.atNegative === out.contract.firstLine,
  atNull: out.contract.atNull === out.contract.firstLine,
  atFraction: out.contract.atFraction === out.contract.firstLine,
  atNoCard: out.contract.atNoCard === ''
}

/* ══════════════ 需要调试条的几条：先确认它在 ══════════════ */
const devBtn = (label) => qa('.devbar button').find((b) => b.textContent.trim() === label)
if (!devBtn('一天一次')) return { error: '调试条不存在（本探针只能在 vite dev 下跑）', data: out.data }

await waitFor(() => $('.scene')?.dataset.phase === 'idle', 12000)
/* 信封还没走就点顶栏，虽然程序化 click 绕过命中测试，但图层压着总归更容易出怪事 */
out.welcomeAwayMs = await waitFor(() => !$('.welcome'), 14000)

/* ══════════════ C. 图鉴零泄露 ══════════════ */
const link = $('.topbar__link')
if (!link) return { ...out, error: '顶栏没有图鉴入口' }
link.click()
await waitFor(() => $('.gallery'), 4000)

const leaks = []
const sealedMiss = []
const hits = () => qa('.gallery__hit')
for (let i = 0; i < DATA.length; i += 1) {
  const hit = hits()[i]
  if (!hit) {
    leaks.push({ i, id: DATA[i].id, why: '格子不存在' })
    continue
  }
  hit.click()
  const opened = await waitFor(() => $('.detail'), 4000)
  if (!opened) {
    leaks.push({ i, id: DATA[i].id, why: '详情没打开' })
    continue
  }
  const detail = $('.detail')
  const text = detail.textContent
  /* 文本级：该牌的任何一条建议原文都不许出现 */
  const hitLines = DATA[i].advices.filter((a) => text.includes(a))
  if (hitLines.length) leaks.push({ i, id: DATA[i].id, lines: hitLines })
  /* 结构级：必须是 sealed 分支，而且没有真建议正文那个 class */
  const sealed = detail.querySelector('[data-advice="sealed"]')
  const revealed = detail.querySelector('[data-advice="revealed"]')
  const bodyCount = detail.querySelectorAll('.detail__text-body--advice').length
  if (!sealed || revealed || bodyCount !== 0) {
    sealedMiss.push({ i, id: DATA[i].id, sealed: !!sealed, revealed: !!revealed, bodyCount })
  }
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await waitFor(() => !$('.detail'), 3000)
}
/* 关掉图鉴，回到场景 */
$('.gallery__bar button')?.click()
await waitFor(() => !$('.gallery'), 3000)

out.gallery = {
  checked: DATA.length,
  leaks,
  sealedMiss,
  backToScene: !$('.gallery') && !$('.detail')
}

/* ══════════════ D. 回放（含旧记录兜底） ══════════════ */
const today = (() => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
})()

/* 挑一张建议条数最多的牌，这样下标能走得最长 */
const probeCard = DATA.slice().sort((a, b) => b.advices.length - a.advices.length)[0]
const shownAdvice = () => {
  const el = $('.panel__advice')
  return el ? el.textContent.replace(/^\s*今日建议\s*·\s*/, '').trim() : null
}
const replayOne = async (payload) => {
  localStorage.setItem(KEY, JSON.stringify(payload))
  devBtn('不限次数')?.click()
  await sleep(50)
  devBtn('一天一次')?.click()
  const ok = await waitFor(
    () => $('.scene')?.dataset.phase === 'revealed' && $('.panel__advice'),
    4000
  )
  await sleep(60)
  return { reached: ok !== null, text: shownAdvice() }
}

const replay = []
for (let i = 0; i < probeCard.advices.length; i += 1) {
  const r = await replayOne({ date: today, cardId: probeCard.id, adviceIndex: i })
  replay.push({
    i,
    expect: probeCard.advices[i],
    got: r.text,
    reached: r.reached,
    ok: r.reached && r.text === probeCard.advices[i]
  })
}

/* 旧记录：第三十二轮之前落盘的记录里**没有** adviceIndex 这个字段。
   要求是「不崩、且稳定回退到第 0 条」，不许现随机一条 ——
   现随机会让同一天刷新出不同的句子。 */
const legacy = await replayOne({ date: today, cardId: probeCard.id })

/* 复位，别把一张牌留给后面的流程 */
localStorage.removeItem(KEY)

out.replay = {
  cardId: probeCard.id,
  n: probeCard.advices.length,
  rows: replay,
  legacy: {
    reached: legacy.reached,
    got: legacy.text,
    expect: probeCard.advices[0],
    ok: legacy.reached && legacy.text === probeCard.advices[0]
  }
}
out.PASS_replay =
  replay.length === probeCard.advices.length &&
  replay.every((r) => r.ok) &&
  out.replay.legacy.ok === true

/* ══════════════ F. 从图鉴点回「今天抽到的那张」，仍然必须封着 ══════════════
   这是最容易漏的一条：只要把判据写成「这张牌是不是今天抽到的」（比较牌对象），
   用户从图鉴点回同一张就会看到建议 —— 而要求是「**图鉴里查不到**」。
   实现里判的是「从哪扇门进来」，这里把它钉死：先把记录种成 probeCard 并让它
   显示在面板上，再从图鉴点同一张。
   （C 段是在「今天还没抽牌」的状态下测的，覆盖不到「对象相同」这条岔路。） */
const identity = { error: null }
try {
  await replayOne({ date: today, cardId: probeCard.id, adviceIndex: 0 })
  const panelText = shownAdvice()
  const idx = DATA.findIndex((c) => c.id === probeCard.id)
  $('.topbar__link').click()
  await waitFor(() => $('.gallery'), 4000)
  hits()[idx].click()
  const opened = await waitFor(() => $('.detail'), 4000)
  const detail = $('.detail')
  identity.panelAdvice = panelText
  identity.opened = opened !== null
  identity.sameCard = detail ? detail.textContent.includes(probeCard.nameZh) : null
  identity.sealed = !!detail?.querySelector('[data-advice="sealed"]')
  identity.revealed = !!detail?.querySelector('[data-advice="revealed"]')
  identity.adviceBodyCount = detail ? detail.querySelectorAll('.detail__text-body--advice').length : null
  identity.leaked = !!(detail && panelText && detail.textContent.includes(panelText))
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await waitFor(() => !$('.detail'), 3000)
  $('.gallery__bar button')?.click()
  await waitFor(() => !$('.gallery'), 3000)
  localStorage.removeItem(KEY)
} catch (err) {
  identity.error = String(err && err.message ? err.message : err)
}
out.identity = identity

/* ══════════════ E. 分享图与面板同一条 ══════════════ */
const hashBytes = (u8) => {
  let h = 2166136261
  for (let i = 0; i < u8.length; i += 1) {
    h ^= u8[i]
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}
let share = { error: null }
try {
  const { renderShareCard } = await import('/src/utils/shareCard.js')
  const shot = async (advice) => {
    const blob = await renderShareCard(probeCard, advice)
    const u8 = new Uint8Array(await blob.arrayBuffer())
    return { bytes: u8.length, hash: hashBytes(u8) }
  }
  const s1 = await shot(probeCard.advices[0])
  const s2 = await shot(probeCard.advices[1])
  const s3 = await shot(probeCard.advices[1])
  share = {
    cardId: probeCard.id,
    a0: s1,
    a1: s2,
    a1Again: s3,
    /* 换一条建议 → 产物必须变（不然就是 advice 根本没进画布） */
    differsByAdvice: s1.hash !== s2.hash || s1.bytes !== s2.bytes,
    /* 同一条建议画两次 → 必须逐字节一致（画布里不许有隐藏的随机量） */
    deterministic: s2.hash === s3.hash && s2.bytes === s3.bytes
  }
} catch (err) {
  share = { error: String(err && err.message ? err.message : err) }
}
out.share = share

/* ══════════════ 汇总 ══════════════ */
out.errors = errors.slice(0, 5)

out.PASS = {
  dataClean:
    tooFew.length === 0 &&
    tooLong.length === 0 &&
    dupGlobal.length === 0 &&
    dupWithin.length === 0 &&
    dirty.length === 0 &&
    out.data.total >= DATA.length * 3,
  contract: Object.values(out.PASS_contract).every(Boolean),
  gallerySealed: leaks.length === 0 && sealedMiss.length === 0 && out.gallery.backToScene === true,
  /* ★ 同一张牌从图鉴点回来也是封着的（判「门」而不是判「牌」） */
  sameCardStaysSealed:
    identity.error === null &&
    identity.opened === true &&
    identity.sameCard === true &&
    identity.sealed === true &&
    identity.revealed === false &&
    identity.adviceBodyCount === 0 &&
    identity.leaked === false,
  replay: out.PASS_replay,
  shareSameAsPanel: share.differsByAdvice === true && share.deterministic === true,
  noErrors: errors.length === 0
}
out.ALL_PASS = Object.values(out.PASS).every(Boolean)

return out
