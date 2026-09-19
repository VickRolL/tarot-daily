/* 离线（file://）自检：双击 index.html 到底能不能真的跑起来
   ==========================================================================
   判据（任一不成立就说明离线打开是坏的）：
     · #root 有内容        → 脚本真的执行了（不是被 CORS 拦掉的白屏）
     · 首屏图 naturalWidth > 0 → 相对素材路径在 file:// 下解析正确
     · 点击水晶球后出牌、卡面图加载成功
     · 控制台无报错
   localStorage 单独报：它决定「一天只抽一次」能不能生效。
   ========================================================================== */
const errors = []
addEventListener('error', (e) => errors.push(String(e.message || e)))
addEventListener('unhandledrejection', (e) => errors.push('rejection: ' + String(e.reason)))

const root = document.getElementById('root')
const shot = (el) =>
  el ? [...el.querySelectorAll('img')].map((i) => `${i.currentSrc.split('/').pop()}:${i.naturalWidth}`) : null

const bootstrap = {
  rootLen: root ? root.innerHTML.length : -1,
  preloadHref: document.querySelector('link[rel="preload"]')?.getAttribute('href') ?? null,
  imgs: shot(document) || [],
  styleSheets: document.styleSheets.length,
  cssApplied: getComputedStyle(document.body).backgroundColor
}

/* 素材实际请求了哪些地址 */
const skinReqs = performance
  .getEntriesByType('resource')
  .map((r) => r.name)
  .filter((n) => n.includes('/skins/'))
const badReqs = skinReqs.filter((n) => !/^file:\/\/\/C:\//i.test(n)).slice(0, 5)

/* localStorage 可用性 */
let ls = 'ok'
try {
  localStorage.setItem('__probe', '1')
  localStorage.removeItem('__probe')
} catch (e) {
  ls = `${e.name}: ${e.message}`
}

/* 抽牌 */
const orb = document.querySelector('.orb')
orb?.click()
await new Promise((r) => setTimeout(r, 5200))

const card = document.querySelector('.card')

return {
  bootstrap,
  skinReqCount: skinReqs.length,
  badReqs,
  localStorage: ls,
  drawn: !!card,
  cardImgs: shot(card) || [],
  panel: !!document.querySelector('.panel'),
  sub: document.querySelector('.headline__sub')?.textContent ?? null,
  errors
}
