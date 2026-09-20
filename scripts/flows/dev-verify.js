/* 开发模式自检：调试条 —— 不限次数连抽 / 重播迎接 / 音效试听
   ==========================================================================
   运行目标：**开发服务器**（`vite dev`，带调试条）。
   2026-09-19 前跑的是构建出来的开发者版 `dist-dev/`，那份产物已随离线通道一并移除。
   这几项功能在正式产物里必须不存在 —— 现在产物只有 `vite build` 一种，取值为「关」。

   判据：
     · 调试条存在，且默认落在「不限次数」（不是点过才切过去的）
     · 抽一次能出牌，且面板上有「再抽一次」—— 该按钮只在 unlimited 模式渲染
     · 点「再抽一次」能连抽第二次（证明真的不限次数，而不是靠刷新页面）
     · 抽牌不落盘（unlimited 不写 localStorage，所以刷新后也不会被锁住）
     · 「重播迎接」能把信封重新播一遍，且**不清掉**已抽到的牌
     · 调试条不遮挡面板按钮（命中测试，见 ④.5）
     · 控制台无报错

   ⚠️ 「牌面总览 / 图鉴」那一段**已移出本 flow**（2026-09-20）。
   理由和调试条那个按钮被删掉是同源的：图鉴这一轮对用户开放了（入口在顶栏），
   它不再是「开发模式专属」的功能，验证归属 `probe-gallery`。
   留在这里的代价是实测过的 —— 这段代码找的是调试条里**已经不存在的**
   「牌面总览」按钮，`btnByText` 返回 undefined、`?.click()` 是空操作，
   于是 `gallery.items` 永远是 0、`openedMs` 永远是 null；
   而报告里没有任何字段会因此变红：**一条永远为空、又永远不报警的判据，
   比没有判据更糟** —— 它会让人以为这件事「验过了」。

   音效调试区（逐个试听 / 连播 / 循环 / 素材↔合成）的细判据在 `probe-devbar-sfx`，不在这里重复。

   ⚠️ 等待一律用轮询（waitFor）而不是固定 sleep：
   无头软件光栅化下，首屏迎接动画的挂载开销比墙钟时长更飘，
   固定 sleep 会写出「时快时慢」的假阴性（第一版就踩了：3.4s 时信封还挂着）。

   ⚠️ 量命中之前必须 `settle()` 等位移动画停稳：
   面板是「贴底 + 上滑」入场的，文字先到、位移后到。文字一到就量，
   按钮此刻还在视口下方（实测 y782 而 innerHeight 只有 708），
   `elementFromPoint` 只能返回 null —— 会被误读成「被挡住了」。
   这是第二版踩的坑，和第一版的固定 sleep 是同一类错误。
   ========================================================================== */
const errors = []
addEventListener('error', (e) => errors.push(String(e.message || e)))
addEventListener('unhandledrejection', (e) => errors.push('rejection: ' + String(e.reason)))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const $ = (s) => document.querySelector(s)
const RITE = 9000 // 抽牌仪式约 5.6s，留足余量
const STORAGE_KEY = 'tarot-daily::draw-record'

/** 轮询等待条件成立，返回耗时（毫秒）；超时返回 null —— 比固定 sleep 可靠 */
const waitFor = async (fn, ms = RITE, step = 100) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    let ok = false
    try {
      ok = fn()
    } catch {
      ok = false
    }
    if (ok) return Date.now() - t0
    await sleep(step)
  }
  return null
}

/** 等元素「不再动」—— 连续两次采样 rect 完全一致才算停稳。
    用于上滑入场这类位移结束后，才敢量命中；超时返回 null（照样往下走，不卡死）。 */
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

const barBtns = () => [...document.querySelectorAll('.devbar button')]
/** 按文案找按钮 —— **全文档**找，不能只在 .devbar 里找：
    「再抽一次」在解读面板里，不在调试条里。第一版就栽在这里。 */
const btnByText = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t)
const panelActions = () => [...document.querySelectorAll('.panel__actions button')].map((b) => b.textContent.trim())

/* 调试条会不会**挡住**按钮 —— 可见性 ≠ 可点性。
   用 elementFromPoint 打在元素中心：若返回的不是它（或它的后代），说明被别的东西盖住了。
   程序化 .click() 照样能触发，所以光靠功能断言全绿也发现不了这个。

   ⚠️ `coveredByDevbar` 只对**不在调试条里**的目标有意义：
      调试条自己的按钮（如「重播迎接」）命中调试条是正常的，不该报警。
   ⚠️ 只在元素「该被点」的状态下量 —— 抽完牌后面板本就盖住水晶球，
      那时 orb 不可点是对的，拿它当遮挡证据会误报。 */
const hitTest = (el) => {
  if (!el) return null
  const b = el.getBoundingClientRect()
  const cx = b.x + b.width / 2
  const cy = b.y + b.height / 2
  const hit = document.elementFromPoint(cx, cy)
  const box = (n) => {
    if (!n) return null
    const r = n.getBoundingClientRect()
    return [Math.round(r.x), Math.round(r.y), Math.round(r.right), Math.round(r.bottom)]
  }
  const elInBar = el.closest('.devbar') !== null
  return {
    target: el.textContent.trim() || el.className,
    rect: box(el),
    centerInViewport: cx >= 0 && cx <= innerWidth && cy >= 0 && cy <= innerHeight,
    hitElement: hit ? `${hit.tagName}.${hit.className}` : null,
    clickable: hit === el || el.contains(hit) || hit.contains(el),
    /* 被调试条盖住：目标是**调试条以外**的元素，却命中了调试条里的东西 */
    coveredByDevbar: !!hit && !elInBar && hit.closest('.devbar') !== null,
    devbarRect: box($('.devbar'))
  }
}

/* ① 先等首屏迎接动画退场（信封那层卸载后 .welcome 就没了） */
const welcomeAwayMs = await waitFor(() => !$('.welcome'), 9000)

/* 待抽状态下水晶球必须真的能点（此刻没有面板遮它）—— 这是玩家进入页面的第一动作。
   先 settle 再量，否则球可能还在入场位移里。 */
const orbSettleMs = await settle($('.orb'), 3000)
const orbHitIdle = hitTest($('.orb'))

const report = {
  welcomeAwayMs,
  devbar: !!$('.devbar'),
  barButtons: barBtns().map((b) => `${b.textContent.trim()}${b.disabled ? '(禁用)' : ''}`),
  activeMode: barBtns()
    .filter((b) => b.dataset.active === 'true')
    .map((b) => b.textContent.trim()),
  barFooter: $('.devbar span:last-child')?.textContent?.trim() ?? null,
  orbSettleMs,
  orbHitIdle
}

/* ② 第一次抽牌（直接点水晶球） */
$('.orb')?.click()
await waitFor(() => $('.card') && ($('.panel__text')?.textContent ?? '').length > 0)
report.round1 = {
  card: $('.card__name')?.textContent ?? null,
  panel: !!$('.panel'),
  panelActions: panelActions(),
  sub: $('.headline__sub')?.textContent ?? null,
  panelTextLen: ($('.panel__text')?.textContent ?? '').length
}

/* ③ 连抽第二次：「再抽一次」只把人送回待抽状态（牌与面板都收掉），
      真正的第二抽还得再点一次水晶球 —— 这一步第一版漏了，白白等满了超时。 */
btnByText('再抽一次')?.click()
report.afterAgain = { backToIdleMs: await waitFor(() => !$('.panel'), 3000) }
$('.orb')?.click()
await waitFor(() => $('.card') && ($('.panel__text')?.textContent ?? '').length > 0)
report.round2 = {
  card: $('.card__name')?.textContent ?? null,
  panel: !!$('.panel'),
  panelActions: panelActions(),
  panelTextLen: ($('.panel__text')?.textContent ?? '').length
}
report.twoRoundsOk = !!(report.round1.card && report.round2.card && report.round2.panel)
report.differentCards = !!(report.round1.card && report.round2.card && report.round1.card !== report.round2.card)

/* ④ unlimited 不该落盘 —— 刷新后不会被锁住 */
try {
  report.recordAfterDraws = localStorage.getItem(STORAGE_KEY)
} catch (e) {
  report.recordAfterDraws = `${e.name}: ${e.message}`
}

/* ④.5 抽完牌后：面板动作行 + 调试条按钮能不能点（hitTest 定义见顶部注释）
   ⚠️ 必须先 settle：面板「贴底 + 上滑」入场，文字先出现、位移后结束，
        此刻量命中只会拿到 null（点在视口外），是假阴性不是真遮挡 —— 第二版就栽在这里。 */
report.settle = { panel: await settle($('.panel')) }
report.hitTests = [
  hitTest(btnByText('再抽一次')),
  hitTest(btnByText('生成分享卡片')),
  hitTest(btnByText('重播迎接'))
]

/* ⑤ 重播迎接：只重挂信封层，不该动已抽到的牌 */
btnByText('重播迎接')?.click()
report.replay = {
  welcomeBackMs: await waitFor(() => $('.welcome'), 2000),
  cardKept: !!$('.card'),
  panelKept: !!$('.panel')
}
report.replayDone = {
  welcomeGoneMs: await waitFor(() => !$('.welcome'), 9000),
  cardKeptAfter: !!$('.card'),
  panelKeptAfter: !!$('.panel')
}

/* ⑥ 图鉴：**已移出**（见文件头）。这里只确认调试条活到最后 ——
      它在 `DEV_TOOLS` 为真时才渲染，中途消失说明有东西把根节点重挂了。 */
report.devbarAliveAtEnd = !!$('.devbar')
report.sfxControls = barBtns()
  .map((b) => b.textContent.trim())
  .filter((t) => ['屏息', '雾散', '丝绢', '颂钵', '连播四拍', '循环', '素材', '合成'].includes(t))

report.errors = errors
return report
