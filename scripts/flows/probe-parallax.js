/* 指针视差探针（用户第七轮拍板：「只有球动，2D 层完全不动」）
   ==========================================================================
   为什么要用 location.hash 传参而不是两个文件：
   `shot.mjs` 的 --eval-file 会**覆盖** --eval（两者不能叠加），
   所以「同一段逻辑、两个指针位置」没法用命令行参数表达。
   改成从 hash 读：`.../#px=0.10` / `.../#px=0.92`，一个文件跑两次。
   （用 hash 不用 query 是省事：Vite dev 对 query 照样返回 index.html，
     但 hash 完全不进请求，没有多余的可能出错的地方。）

   判据不在这里做 —— 这里只负责「把指针推到指定位置、等平滑收敛」，
   真正的判定是**离线比对两张截图里高光的质心**：
   光方向随指针偏移（LIGHT_SHIFT），高光必须跟着走。
   为什么不在这里读像素：canvas 是 `preserveDrawingBuffer: false`，
   渲染循环之外 toDataURL 拿到的常常是空帧 —— 会写出假阴性。
   （自转 SPIN 与呼吸 uTime 也会让两帧有差，所以判据只取
     「最亮像素质心的水平位移」，那个量级（几十 px）远大于自转带来的差。） */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const $ = (s) => document.querySelector(s)

const waitFor = async (fn, ms, step = 120) => {
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

const params = new URLSearchParams(location.hash.replace(/^#/, ''))
const px = params.has('px') ? Number(params.get('px')) : null
const py = params.has('py') ? Number(params.get('py')) : 0.5

await waitFor(() => !$('.welcome'), 12000)
await waitFor(() => $('.orb--has3d'), 12000)

let dispatched = 0
if (px !== null) {
  const cx = px * innerWidth
  const cy = py * innerHeight
  /* 连续推几帧：JS 侧是 `s.px += (tpx - s.px) * 0.07` 的指数跟随，
     单发一次也能收敛，但多发几次可以顺手覆盖「事件重复投递」的路径。 */
  for (let i = 0; i < 8; i += 1) {
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: cx, clientY: cy, bubbles: true, pointerType: 'mouse'
    }))
    dispatched += 1
    await sleep(60)
  }
  /* 指数收敛：0.07/帧 → 约 40 帧（≈0.67s）到 95%。留足 2s。 */
  await sleep(2000)
}

const orb = $('.orb')
const canvas = $('.orb__canvas')
const box = orb ? orb.getBoundingClientRect() : null

return {
  px,
  py,
  dispatched,
  viewport: [innerWidth, innerHeight],
  orbRect: box ? [+box.left.toFixed(1), +box.top.toFixed(1), +box.width.toFixed(1), +box.height.toFixed(1)] : null,
  has3d: !!$('.orb--has3d'),
  canvasPx: canvas ? [canvas.width, canvas.height] : null
}
