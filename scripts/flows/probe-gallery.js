/* 图鉴 + 完整解读 探针（2026-09-20 第二十一轮 / 2026-09-21 第三十二轮）
   ==========================================================================
   要验的四件事，都是「读代码看不出来」的：

   ① **入口真的通**。这一轮把图鉴从 `DEV_TOOLS` 里放出来了，
      而「产物里有没有那个按钮」和「按钮点了有没有用」是两件事
      （见 web-visual-qa 第 14 条：判据能过、功能恒不生效，是踩过的坑）。
      所以这里真的点。
   ② **两层是叠着的、不是互斥的**。从图鉴点进详情，关掉详情要能回到图鉴 ——
      这是「不需要返回按钮」这个设计的前提。断言 `.gallery` 仍在。
   ③ **字段真的渲染了**。`.detail` 存在不等于文案到了，
      逐项取 textContent 长度来证。
   ④ **今日建议在图鉴里必须是「封着」的**（第三十二轮新增）。
      ⚠️ 这条**不能**用「块数」来判 —— 封着的那块本身也是一个 `.detail__block`，
         里面也有一段够长的说明文字，所以上一版那种
         `blocks.length === 3 && every(len >= 20)` 会**照样通过**：
         断言绿着，含义已经变了。这正是「判据能过、含义已变」的典型陷阱。
         所以改成两条更硬的：
           · 块的**标签序列**必须逐个相等（象征 / 正位含义 / 今日建议）
           · 建议块的 `data-advice` 必须是 `sealed`，且页面上**没有**
             `.detail__text-body--advice`（那条 class 只属于真建议正文）
         至于「文本里搜不到任何一条建议原文」，交给 `probe-advice.js` ——
         它才拿得到源码里的 advices（本探针要保持「不依赖源码模块」，
         这样在 dist 上也能跑）。 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const $ = (s) => document.querySelector(s)
const qa = (s) => [...document.querySelectorAll(s)]

const waitFor = async (fn, ms, step = 150) => {
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

const out = {}
const vw = innerWidth

/* ── 入场 ─────────────────────────────────────────────────────────── */
out.welcomeAwayMs = await waitFor(() => !$('.welcome'), 14000)
await waitFor(() => $('.scene')?.dataset.phase === 'idle', 9000)

/* ── ① 入口 ───────────────────────────────────────────────────────── */
const link = $('.topbar__link')
out.topbarLink = link ? link.textContent.trim() : null
if (!link) {
  out.error = '顶栏没有图鉴入口'
  return out
}

/* 顶栏入口不能被别的层盖住 —— 用命中测试，不用 offsetParent
   （程序化 .click() 会绕过命中测试，被盖住的按钮照样能触发） */
const lr = link.getBoundingClientRect()
const hitEl = document.elementFromPoint(lr.left + lr.width / 2, lr.top + lr.height / 2)
out.linkClickable = !!hitEl && (hitEl === link || link.contains(hitEl))

link.click()
out.galleryOpenedMs = await waitFor(() => $('.gallery'), 4000)
out.galleryHitCount = qa('.gallery__hit').length
out.galleryTitle = $('.gallery__bar strong')?.textContent.trim() ?? null

/* 格子里至少要有一张牌真的把插画加载出来了 —— naturalWidth 才作数。
   ⚠️ 选择器别写成 `.gallery__hit .card__art img`：SmartImage 渲染出来的
   就是 `<img class="card__art">`，img **自己**带那个类，不是它的子元素。 */
const firstArt = $('.gallery__hit img.card__art')
out.galleryArtLoaded = firstArt ? firstArt.complete && firstArt.naturalWidth > 0 : null
out.galleryArtNatural = firstArt ? firstArt.naturalWidth : null

/* ── ② 点进完整解读 ───────────────────────────────────────────────── */
/* 挑一张有代表性的：第 17 张（major-16 塔），避免总用第一张 */
const hits = qa('.gallery__hit')
const target = hits[16] || hits[0]
target.click()
out.detailOpenedMs = await waitFor(() => $('.detail'), 4000)

out.detailGalleryStillMounted = !!$('.gallery')
out.detailName = $('.detail__name')?.textContent.trim() ?? null
out.detailKicker = $('.detail__bar-kicker')?.textContent.trim() ?? null
out.detailMeta = $('.detail__meta')?.textContent.trim() ?? null
out.detailTagCount = qa('.detail__tag').length

/* 加深的四块：逐块量长度，长度 0 就是没渲染。
   第三十二轮起「今日建议」在图鉴这条路径上是封着的 —— 它仍是一个 `.detail__block`，
   所以**必须连标签一起断言**，只数块数会在含义变了以后照样绿。 */
const blocks = [...qa('.detail__block')].map((b) => ({
  label: b.querySelector('.detail__label')?.textContent.trim() ?? null,
  sealed: b.dataset.advice ?? null,
  len: (b.querySelector('.detail__text-body')?.textContent ?? '').trim().length
}))
out.detailBlocks = blocks
out.detailBlockLabels = blocks.map((b) => b.label)
out.detailAdviceSealed = blocks.some((b) => b.sealed === 'sealed')
out.detailAdviceRevealed = blocks.some((b) => b.sealed === 'revealed')
/* 真建议正文的专属 class：图鉴里必须一个都没有 */
out.detailAdviceTextCount = qa('.detail .detail__text-body--advice').length
out.detailOath = qa('.detail__oath-col').map((c) => ({
  label: c.querySelector('.detail__label')?.textContent.trim() ?? null,
  items: [...c.querySelectorAll('li')].map((li) => li.textContent.trim())
}))

/* 详情里的牌面插画也必须真加载（同样注意 img 自己就是 .card__art） */
const detailArt = $('.detail__art img.card__art')
out.detailArtLoaded = detailArt ? detailArt.complete && detailArt.naturalWidth > 0 : null

/* 牌面没有把文字挤出去：面板里两栏的宽度都得是正数 */
const art = $('.detail__art')?.getBoundingClientRect()
const text = $('.detail__text')?.getBoundingClientRect()
out.detailColumns = art && text
  ? { art: [Math.round(art.left), Math.round(art.width)], text: [Math.round(text.left), Math.round(text.width)], overlap: Math.round(art.right - text.left) }
  : null
out.detailOverflowX = document.documentElement.scrollWidth - vw

/* ── ③ 关闭行为 ───────────────────────────────────────────────────── */
document.dispatchEvent(new KeyboardEvent('keydown'))
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
out.detailClosedByEscMs = await waitFor(() => !$('.detail'), 3000)
out.backToGallery = !!$('.gallery')

$('.gallery__bar button')?.click()
out.galleryClosedMs = await waitFor(() => !$('.gallery'), 3000)
out.backToScene = !!$('.scene') && !$('.gallery') && !$('.detail')

out.PASS = {
  linkClickable: out.linkClickable === true,
  galleryOpens: out.galleryOpenedMs !== null && out.galleryHitCount === 22,
  galleryArtLoaded: out.galleryArtLoaded === true,
  detailOpens: out.detailOpenedMs !== null,
  /* 三块内容都在、标签逐个对得上，且象征/含义都够长（不是被清空的占位） */
  detailContentFilled:
    out.detailBlockLabels.join('|') === '象征|正位含义|今日建议' &&
    blocks.filter((b) => b.sealed !== 'sealed').every((b) => b.len >= 20) &&
    out.detailOath.length === 2 &&
    out.detailOath.every((c) => c.items.length === 2),
  /* ★ 图鉴里今日建议是封着的：有 sealed 说明、没有 revealed 分支、没有真建议正文 */
  adviceSealedInGallery:
    out.detailAdviceSealed === true &&
    out.detailAdviceRevealed === false &&
    out.detailAdviceTextCount === 0,
  detailArtLoaded: out.detailArtLoaded === true,
  detailFitsViewport: out.detailOverflowX <= 0,
  escBackToGallery: out.detailClosedByEscMs !== null && out.backToGallery === true,
  galleryCloses: out.galleryClosedMs !== null && out.backToScene === true
}

out.ALL_PASS = Object.values(out.PASS).every(Boolean)

return out
