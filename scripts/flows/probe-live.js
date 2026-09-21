/**
 * 线上部署验收探针（2026-09-22 新建，R36 Netlify 上线用）
 * ---------------------------------------------------------------------------
 * 静态核对（scripts/verify_live_assets.py）只能证明「文件在服务器上」，
 * 证明不了「页面跑得起来」。这套判据要真浏览器跑一遍。
 *
 * 用法：
 *   node scripts/shot.mjs https://tarotdaily.netlify.app/ scripts/out/live.png \
 *     --eval-file scripts/flows/probe-live.js --w 1600 --h 1000 --wait 5000
 *
 * 为什么末尾要打印聚合行：shot.mjs 不管探针结论，退出码永远是 0，
 * 「数组里有 fail」这件事必须显式打出来，否则容易被当成通过。
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const checks = []
const T = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: String(detail) })

const resources = () => performance.getEntriesByType('resource')
const badRes = () =>
  resources()
    .filter((e) => e.responseStatus && e.responseStatus >= 400)
    .map((e) => `${e.responseStatus} ${e.name.replace(location.origin, '')}`)

/* ---------------- 1. 挂载 ---------------- */
const root = document.querySelector('#root')
T('root 已挂载', root && root.childElementCount > 0, `childElementCount=${root ? root.childElementCount : 'n/a'}`)
T('标题正确', document.title.includes('塔罗日签'), document.title)

const orb = document.querySelector('.orb')
T('水晶球可见', !!orb && orb.offsetWidth > 0, orb ? `${Math.round(orb.offsetWidth)}×${Math.round(orb.offsetHeight)}` : '（未找到 .orb）')

/* ---------------- 2. 调试条零泄漏 ---------------- */
const devbar = document.querySelector('.devbar')
const bodyText = document.body.innerText || ''
T('无 .devbar 元素', !devbar, devbar ? '存在！' : '不存在')
T('正文无「抽牌模式」', !bodyText.includes('抽牌模式'), bodyText.includes('抽牌模式') ? '含调试文案！' : '干净')

/* ---------------- 3. 门禁（Netlify Edge Access / SSO）----------------
   R36 踩过：新建站点默认 sso_login=true，所有请求 401 + Login Redirect。
   真浏览器的判据是「文档确实是我们那份」，而不是「HTTP 200」——
   401 页面也是 200 可达的 HTML。 */
const isLoginRedirect = /Login Redirect|edge-access/i.test(document.documentElement.outerHTML)
T('未被 SSO 门禁拦到登录页', !isLoginRedirect, isLoginRedirect ? '命中了 Login Redirect 页！' : '正常放行')

/* ---------------- 4. 关键运行时资源 ---------------- */
/* 已知豁免：`hero-figure` 是 skin.js 里的**可选槽位**（主视觉之上的巫师人物透明层），
   slot() 会按 .webp → .png 顺序探测，本皮肤没放这两个文件 → 每次加载固定 2 个 404。
   这是「缺图自动降级」设计的固有代价，不是故障；但它会淹没真正的 404，
   所以显式豁免掉，让这条判据继续对**其它** 4xx 敏感。 */
const OPTIONAL_SLOT_MISSES = [/\/skins\/[^/]+\/hero-figure\.(webp|png)$/]
const res = resources().map((e) => e.name.replace(location.origin, ''))
const realBad = badRes().filter((line) => !OPTIONAL_SLOT_MISSES.some((re) => re.test(line)))
T('已加载资源无 4xx/5xx（豁免可选槽位 hero-figure）', realBad.length === 0, realBad.join(', ') || '无')
T('CSS 已加载', res.some((n) => n.endsWith('.css')), res.filter((n) => n.endsWith('.css')).join(',') || '无')
T('three chunk 已加载', res.filter((n) => /three\.module.*\.js$/.test(n)).length === 1,
  res.filter((n) => /three\.module/.test(n)).join(',') || '无')
T('字体已加载', res.some((n) => n.includes('.woff2')), res.filter((n) => n.includes('.woff2')).join(',') || '无')

/* ---------------- 5. og / twitter 卡片元信息 ----------------
   抓取端只认绝对地址；相对路径在微信/微博抓取时一律失效。
   注意：这是**部署配置**问题（等下要改 index.html），不是渲染问题。 */
const meta = (sel) => document.querySelector(sel)?.getAttribute('content') ?? null
const ogImage = meta('meta[property="og:image"]')
const ogUrl = meta('meta[property="og:url"]')
const twImage = meta('meta[name="twitter:image"]')
const absOk = (v) => typeof v === 'string' && /^https:\/\//.test(v)
T('og:image 是绝对地址', absOk(ogImage), ogImage)
T('og:url 是绝对地址', absOk(ogUrl), ogUrl)
T('twitter:image 是绝对地址', absOk(twImage), twImage)

/* ---------------- 6. 抽牌能跑通（真的点一下）---------------- */
if (orb) {
  orb.click()
  await sleep(2200)
}
const card = document.querySelector('.card')
T('抽牌后出现卡牌', !!card, card ? '有 .card' : '（无 .card）')
const art = document.querySelector('.card__art')
T('牌面插画解码成功', !!art && art.naturalWidth > 0, art ? `${art.currentSrc.split('/').pop()} ${art.naturalWidth}px` : '（无 .card__art）')
const back = document.querySelector('.card__back-img')
T('牌背素材解码成功', !!back && back.naturalWidth > 0, back ? `${back.currentSrc.split('/').pop()} ${back.naturalWidth}px` : '（CSS 兜底）')
const cardText = document.querySelector('.card__name')?.textContent ?? ''
T('牌名已渲染', cardText.trim().length > 0, cardText || '（空）')

/* 音频：默认开音乐，抽牌应当有 mp3 请求 */
const mp3 = resources().filter((e) => /\.mp3(\?|$)/.test(e.name))
T('音频有请求且全 200', mp3.length > 0 && mp3.every((e) => !e.responseStatus || e.responseStatus < 400),
  mp3.length ? mp3.map((e) => `${e.name.split('/').pop()}:${e.responseStatus}`).join(' ') : '一次都没请求')

/* ---------------- 7. 图鉴：22 张卡面真的在服务器上 ---------------- */
const galleryBtn = [...document.querySelectorAll('.topbar__link')].find((b) => b.textContent.includes('图鉴'))
T('顶栏有图鉴入口', !!galleryBtn, galleryBtn ? galleryBtn.textContent.trim() : '（没找到）')

let items = 0
let uniq = []
let statuses = []
if (galleryBtn) {
  galleryBtn.click()
  await sleep(900)
  const figs = [...document.querySelectorAll('.gallery__item')]
  items = figs.length
  /* 只取**牌面**图：一个 .gallery__item 里除了牌面，还有牌背/装饰层，
     不过滤的话唯一 URL 会多出 1 条（R36 实测 23），把「22」这条判据误判成失败。 */
  const urls = [...document.querySelectorAll('.gallery__item img')]
    .map((i) => i.currentSrc || i.src)
    .filter((u) => /\/cards\//.test(u))
  uniq = [...new Set(urls)]
  /* 懒加载：不依赖「图上屏了没」，直接按 URL 去服务器取一遍，判据更硬 */
  statuses = await Promise.all(
    uniq.map((u) =>
      fetch(u, { cache: 'no-store' })
        .then((r) => r.status)
        .catch(() => -1)
    )
  )
}
T('图鉴 22 张', items === 22, `找到 ${items} 张`)
T('22 张卡面 URL 唯一', uniq.length === 22, `唯一 ${uniq.length} 条`)
T('22 张卡面线上全可取', statuses.length === 22 && statuses.every((s) => s === 200), statuses.join(',') || '（未取到）')

/* ---------------- 8. 图鉴不泄露今日建议（R32 的硬要求）---------------- */
let sealedOk = false
let sealedDetail = '（未打开详情）'
const hit = document.querySelector('.gallery__hit')
if (hit) {
  hit.click()
  await sleep(1200)
  const sealed = document.querySelector('.detail__block[data-advice="sealed"]')
  const advice = document.querySelector('.detail__text-body--advice')
  sealedOk = !!sealed && !advice
  sealedDetail = sealed ? `sealed 块在，未渲染 advice 正文（${advice ? '但出现了 advice！' : 'OK'}）` : '没有 sealed 块'
}
T('图鉴进详情只给 sealed、不给建议', sealedOk, sealedDetail)

/* ---------------- 汇总 ---------------- */
const failed = checks.filter((c) => !c.ok)
const verdict = failed.length === 0 ? 'LIVE_PASS' : 'LIVE_FAIL'
const out = {
  verdict,
  tally: `${checks.length - failed.length}/${checks.length}`,
  url: location.href,
  viewport: [innerWidth, innerHeight],
  failedNames: failed.map((f) => f.name),
  checks
}
/* 聚合行单独拼一个键：写成 'LIVE_' + verdict 那种表达式在对象字面量里
   会直接 SyntaxError（R36 踩过，shot.mjs 报「Unexpected token '+'」）。 */
out['LIVE_' + (failed.length === 0 ? 'PASS' : 'FAIL')] = out.tally
return out
