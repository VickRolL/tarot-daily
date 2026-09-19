/**
 * 迎接动画 · 按**动画状态**定格取帧
 * ---------------------------------------------------------------------------
 * 用法（hash 指定要定格的帧）：
 *   "$N" scripts/shot.mjs http://127.0.0.1:5173/#sealed out.png --eval-file scripts/flows/welcome-frame.js
 *   "$N" scripts/shot.mjs http://127.0.0.1:5173/#lift   out.png --eval-file scripts/flows/welcome-frame.js
 *   "$N" scripts/shot.mjs http://127.0.0.1:5173/#open   out.png --eval-file scripts/flows/welcome-frame.js
 *
 * 为什么不用 `--wait <ms>` 取帧：`--wait` 的时钟基准是 Page.loadEventFired，
 * 而 React 挂载通常早于它（load 还要等主视觉大图），实测偏出去近 1 秒；
 * 再加上「点击 → 取帧」之间还有几百毫秒的往返延迟，标称时间根本对不上，
 * 会取到完全不是你想要的那一帧（本项目就因此误判过一次「封印没画出来」）。
 *
 * 所以这里改成**轮询动画自身的状态**：直接读封印的 opacity、
 * 读翻盖的 rotateX（从 matrix3d 的 m22 = cosθ 反解），
 * 命中目标状态才返回，让 shot.mjs 紧接着截图。
 * 这样取到的帧与动画进度严格对应，跟机器快慢无关。
 *
 * 目标是点击「重播迎接」把动画时钟归零后再定格，所以不依赖首屏那一次的时序。
 */

const $ = (s) => document.querySelector(s)
const num = (v) => parseFloat(v || '0')

/** 等到条件成立；返回等待毫秒数，超时返回 -1 */
const waitFor = async (fn, ms = 6000) => {
  const t0 = performance.now()
  while (performance.now() - t0 < ms) {
    let ok = false
    try {
      ok = !!fn()
    } catch {
      ok = false /* 元素还没挂上，继续等 */
    }
    if (ok) return Math.round(performance.now() - t0)
    await new Promise((r) => requestAnimationFrame(r))
  }
  return -1
}

/** 翻盖绕 X 轴的角度。rotateX(θ) 的 matrix3d 里 m22 = cosθ（第 6 个数，下标 5） */
const flapM22 = () => {
  const el = $('.env__flap')
  if (!el) return 1
  const t = getComputedStyle(el).transform
  if (!t.startsWith('matrix3d')) return 1
  return parseFloat(t.slice(9, -1).split(',')[5])
}
const op = (sel) => {
  const el = $(sel)
  return el ? num(getComputedStyle(el).opacity) : 0
}

const target = (location.hash || '#sealed').slice(1)
const replay = [...document.querySelectorAll('.devbar button')].find(
  (b) => b.textContent.trim() === '重播迎接'
)
if (!replay) return { error: '没找到「重播迎接」按钮' }

replay.click()

let dt = -1
if (target === 'sealed') {
  /* 信封已经浮现完整（envIn 跑完）、封印还在、翻盖还没开始翻。
     不要拿「封印高亮」当条件 —— 那圈 glow 的峰值落在封印已经开始碎裂之后，
     会和「封印仍在」互斥，条件永远命中不了（踩过）。 */
  dt = await waitFor(
    () => op('.env-in') >= 0.98 && op('.env__seal') >= 0.98 && flapM22() > 0.99
  )
} else if (target === 'lift') {
  /* 翻盖转到约 85°（m22 ≈ 0.08）—— 能看清它立起来、正在往后倒。
     带上 `.env` 的 opacity 是为了排除**退场窗口**：信封开始淡出后会被
     后面的场景透上来，画面会整体发灰发紫，取到的帧就不是设计的样子了。 */
  dt = await waitFor(() => flapM22() <= 0.1 && op('.env') >= 0.995)
} else if (target === 'open') {
  /* 翻盖基本转到底 + 开口的暖光已经涌出来 + 还没开始退场 */
  dt = await waitFor(() => flapM22() <= -0.75 && op('.env__bloom') >= 0.5 && op('.env') >= 0.995)
} else {
  return { error: '未知的定格目标，可用：sealed / lift / open' }
}

return {
  target,
  dt,
  flapM22: Number(flapM22().toFixed(3)),
  flapAngleDeg: Math.round((Math.acos(Math.max(-1, Math.min(1, flapM22()))) * 180) / Math.PI),
  sealOpacity: op('.env__seal'),
  bloomOpacity: op('.env__bloom')
}
