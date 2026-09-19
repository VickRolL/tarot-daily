/**
 * 迎接动画（信封）回归自检
 * ---------------------------------------------------------------------------
 * 用法：
 *   node scripts/shot.mjs http://127.0.0.1:5173/ assets/_debug/x.png \
 *     --wait 3800 --eval-file scripts/flows/welcome.js
 *
 * 思路：等首页自己的入场跑完，然后点调试条的「重播迎接」把**动画时钟归零**，
 * 再按毫秒取点断言。不这么做的话时间基准是 Page.loadEventFired，
 * 而 React 挂载通常早于它（load 还要等主视觉图片），实测能差出近 1 秒，
 * 取到的帧根本对不上标称时间。
 *
 * 断言的都是**读代码看不出来的东西**：
 *   - 相机透视有没有挂对层级（perspective 只作用于直接子元素）
 *   - 相机那层有没有被 grouping property 压平（opacity/filter/clip-path）
 *   - 内腔与翻盖是不是真的同形
 *   - 信封是不是真的「四边溢出视口」（构图要求是覆盖整个页面）
 *   - 暗场是不是真的不透光
 *   - 动画结束后有没有残留
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const q = (s) => document.querySelector(s)
const qa = (s) => [...document.querySelectorAll(s)]
const cs = (el) => (el ? getComputedStyle(el) : null)
const out = {}

const replay = qa('.devbar button').find((b) => b.textContent.trim() === '重播迎接')
if (!replay) {
  return { error: '调试条里没找到「重播迎接」按钮' }
}

/* ---------- ① 重播后立即检查各层是否齐全 ---------- */
replay.click()
await sleep(80)

out.overlayUp = !!q('.welcome')

const env = q('.env')
const vw = window.innerWidth
const vh = window.innerHeight

/* 构图要求：信封必须**四边都溢出视口**（涵盖整个页面）。
   getBoundingClientRect 给的是变换后的轴对齐外框，正好用来判覆盖。 */
out.envRect = env
  ? [
      Math.round(env.getBoundingClientRect().left),
      Math.round(env.getBoundingClientRect().top),
      Math.round(env.getBoundingClientRect().right),
      Math.round(env.getBoundingClientRect().bottom)
    ]
  : null
out.viewport = [vw, vh]
out.coversViewport = env
  ? (() => {
      const r = env.getBoundingClientRect()
      return r.left <= 0 && r.top <= 0 && r.right >= vw && r.bottom >= vh
    })()
  : null

out.layers = {
  veil: !!q('.welcome__veil'),
  stage: !!q('.welcome__stage'),
  cam: !!q('.env-cam'),
  body: !!q('.env__body'),
  panels: qa('.env__panel').length,
  cavity: !!q('.env__cavity'),
  cavityGlow: !!q('.env__cavity-glow'),
  cavityEdge: !!q('.env__cavity-edge'),
  bloom: !!q('.env__bloom'),
  flap: !!q('.env__flap'),
  specks: qa('.env__speck').length,
  corners: qa('.env__corner').length,
  moon: !!q('.env__moon'),
  seal: !!q('.env__seal-svg')
}

/* 相机那层**不能**带 grouping property —— 带上了 3D 会被压平 */
out.camGrouped = (() => {
  const s = cs(q('.env-cam'))
  if (!s) return ['缺少 .env-cam']
  const hits = []
  if (s.opacity !== '1') hits.push('opacity=' + s.opacity)
  if (s.filter !== 'none') hits.push('filter=' + s.filter)
  if (s.clipPath !== 'none') hits.push('clip-path=' + s.clipPath)
  return hits
})()

/* 相机的 3D 变换真的生成出来了没有（rotateZ + rotateX → matrix3d） */
out.camTransform = cs(q('.env-cam'))?.transform

/* 透视必须在 .welcome__stage 上，而且 .env-cam 必须是它的**直接子元素** */
out.stagePerspective = cs(q('.welcome__stage'))?.perspective
out.camIsStageChild = q('.env-cam')?.parentElement === q('.welcome__stage')

/* 3D 透视必须就近挂在翻盖的一级父元素上。
   真正会毁掉透视的是**挂在 perspective 那个元素自己身上的 grouping property**
   （opacity / filter / clip-path 会把它的子树压平成 2D），所以下面先断言这一点；
   再把上层哪些祖先带 grouping property 列出来仅供参考 —— `.env-in` 为了淡入
   必然带着 opacity，它只压平「自己那一层的结果」，不会影响 flap-slot 内部的
   透视，所以那一项不算失败，别被它误导（第一版就是因为把 perspective 挂错层，
   翻盖只剩「位置对但没透视」的平板翻转）。 */
const grouping = (el) => {
  const s = cs(el)
  if (!s) return ['元素不存在']
  const hits = []
  if (s.opacity !== '1') hits.push('opacity=' + s.opacity)
  if (s.filter !== 'none') hits.push('filter=' + s.filter)
  if (s.clipPath !== 'none') hits.push('clip-path=' + s.clipPath)
  return hits
}
out.slotGrouped = grouping(q('.env__flap-slot')) /* 必须为空 */
out.perspectiveOnSlot = cs(q('.env__flap-slot'))?.perspective
out.groupedAncestorsInfo = (() => {
  let el = q('.env__flap-slot')?.parentElement
  const hits = []
  while (el && el !== document.documentElement) {
    const g = grouping(el)
    if (g.length) hits.push(el.className || el.tagName)
    el = el.parentElement
  }
  return hits
})()

/* 内腔与翻盖必须**同形** —— 只有同形，盖着时才会被翻盖完整遮住，
   翻盖一转开又自己露出来，不需要任何额外的显隐动画。
   注意不能直接比 clip-path 字符串：翻盖元素的尺寸只有信封的 58%，
   两边百分比的分母不同，字符串必然不等，但换算到信封坐标系后是同一个三角形。
   所以这里把顶点解析出来、换算成「信封宽高的百分比」再比。

   量之前必须**临时把相机摆正**：.env-cam 上挂着 rotateZ + rotateX，
   getBoundingClientRect 返回的是变换后的轴对齐外框，两个外框形状不同，
   直接换算出来的顶点会全部错位。摆正后剩下的只有 .env-in / .env 上的
   等比缩放，等比缩放不影响百分比的相对关系。 */
const envCam = q('.env-cam')
const camSaved = envCam ? envCam.style.transform : null
if (envCam) {
  envCam.style.transform = 'none'
  void envCam.offsetWidth /* 强制回流，否则量到的还是旧值 */
}

const triangleIn = (el, baseEl) => {
  if (!el || !baseEl) return null
  const r = el.getBoundingClientRect()
  const b = baseEl.getBoundingClientRect()
  const nums = (cs(el).clipPath.match(/-?[\d.]+/g) || []).map(Number)
  const pts = []
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push([
      Math.round((((r.left + (nums[i] / 100) * r.width) - b.left) / b.width) * 1000) / 10,
      Math.round((((r.top + (nums[i + 1] / 100) * r.height) - b.top) / b.height) * 1000) / 10
    ])
  }
  return pts
}
out.flapTriangle = triangleIn(q('.env__flap-face'), env)
out.cavityTriangle = triangleIn(q('.env__cavity'), env)
out.sameShape = JSON.stringify(out.flapTriangle) === JSON.stringify(out.cavityTriangle)

/* 封印必须真的在画面里 —— 它是大特写的焦点，跑出视口就白搭 */
const sealRect = q('.env__seal-slot')?.getBoundingClientRect()
out.sealRect = sealRect
  ? [Math.round(sealRect.left), Math.round(sealRect.top), Math.round(sealRect.right), Math.round(sealRect.bottom)]
  : null
out.sealOnScreen = sealRect
  ? sealRect.right > 0 && sealRect.bottom > 0 && sealRect.left < vw && sealRect.top < vh
  : null

if (envCam) {
  envCam.style.transform = camSaved || ''
  void envCam.offsetWidth
}

/* 暗场必须完全不透光（backgroundColor 不能带透明通道），
   否则背后的场景会透上来把信封弄脏 */
out.veilBg = cs(q('.welcome__veil'))?.backgroundColor

/* ---------- ② 开封：封印先消失，翻盖随后翻开 ---------- */
await sleep(1500) // 累计 ≈1.58s
out.sealOpacity = cs(q('.env__seal'))?.opacity
out.flapTransformMid = cs(q('.env__flap'))?.transform

/* ---------- ③ 动画结束后必须彻底卸载，不留残骸 ---------- */
await sleep(1500) // 累计 ≈3.08s（TIMING.welcome = 2700）
out.overlayGone = !q('.welcome')
out.strayNodes = qa('.env, .welcome__veil, .env__speck').length
out.orb = !!q('.orb')
out.orbDisabled = q('.orb')?.disabled ?? null
out.headlineSub = q('.headline__sub')?.textContent ?? null

return out
