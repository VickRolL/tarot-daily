/**
 * 环境音 / 背景音乐（2026-09-20 第二十三轮新增）
 * ==========================================================================
 * 用户要求：「背景音乐也要有，是那种**幽暗寂静**的感觉。」
 *
 * ── 为什么是合成而不是一个 mp3 ────────────────────────────────────────
 *   ① 本项目有一条硬线 —— **美术/音频素材零新增**（出图要花积分，音频素材要外链或入库）；
 *   ② 环境音的难点在**不重复**：loop 一段 3 分钟的 mp3，听到第三遍就开始烦。
 *      合成的话每一层都是活的（拍频、缓变滤波、随机点缀），可以永不重复；
 *   ③ 体积极小 —— 整个 BGM 是几十行代码，没有一个字节的音频文件。
 *
 * ── 「幽暗寂静」怎么用合成做出来 ──────────────────────────────────────
 *   幽暗 ≠ 闷。寂静 ≠ 安静。这一段的目标是**让人听见「空间」，而不是听见「音乐」**：
 *
 *   ① **极低频 drone**（55 / 55.4Hz，只差 0.4Hz）
 *      两条几乎同频的低音会缓慢打拍 —— 0.4 次/秒，约 2.5 秒一个起伏。
 *      这就是「幽暗」的来源：**有起伏，但没有旋律**。
 *      刻意不写任何和弦进行 —— 一旦有进行，它就变成「一首曲子」，会抢戏。
 *
 *   ② **风**（噪声 → 低通，截止被 0.035Hz 的 LFO 在 200~480Hz 之间推）
 *      0.035Hz = 28.6 秒一个周期。这是「寂静」的来源：声音本身在**呼吸**，
 *      比任何静态底噪都更像一个「开阔而无人」的地方。
 *
 *   ③ **稀疏的点缀**（每 14~30 秒一声，五声音阶内随机取音，起音 1.2 秒）
 *      密度是刻意的：平均 20 秒才一声。这是「远处有什么东西在响」，
 *      不是「伴奏」。间隔完全随机，所以永远等不到规律。
 *
 *   ④ **整个 BGM 走混响**（wet 0.5）—— 空间感的另一半。
 *      干声的 drone 是「耳机里的低音」，混响过的 drone 才是「一个大厅」。
 *
 * ── 音量与礼仪 ───────────────────────────────────────────────────────
 *   · `BASE_LEVEL = 0.18`，相对总线（0.34）约 -14dB。目标是**隐约可闻**：
 *     能感觉到「有东西在响」，但不影响说话、不让人想关掉。
 *   · **抽牌时自动让位**（`duckAmbient(true)` → 降到 35%）：那 5.6 秒是音效的主场。
 *     这是混音的基本礼节，不是可选项。
 *   · **页面切到后台自动静音**（`visibilitychange`）—— 用户看不见画面时
 *     还占着一路声音是很冒犯的，尤其戴着耳机切走开会的情况。
 *
 * ── 实现上的一条分界（踩过一次，写在这里免得重犯）────────────────────
 *   **drone 是常驻振荡器，不能用 `sfx.js` 里那种一次性包络节点去搭。**
 *   `tone()` 的价值是「起→峰→落→自己停」，而 drone 要一直响，
 *   两者生命周期相反。第一版想把 tone() 改造过来（建完再断开它内部的包络、
 *   把 stop 推到 86400 秒），又绕又脆弱 —— 正解是这里自己建
 *   `osc → 固定增益 → mix`，淡入淡出**只由 `bgm` 这一个节点负责**。
 */

import { audio, noiseBuffer, send, tone } from './engine'

/** 相对总线的音量。刻意压得很低 —— 它是「地方」，不是「音乐」 */
const BASE_LEVEL = 0.18

/** 点缀音高：E4 / G4 / A4 / C5 / D5（五声音阶，无半音冲突，随机取音永不刺耳） */
const SPARKS = [329.63, 392, 440, 523.25, 587.33]

/** 点缀间隔（毫秒）：平均 20 秒一声 */
const SPARK_MIN_MS = 14000
const SPARK_MAX_MS = 30000

let mix = null
let bgm = null
let sources = []
let sparkTimer = null
let started = false
let ducked = false
let hidden = false
let visBound = false

/* ---------------------------------------------------------------- 内务 */

/**
 * 目标音量。压低音量有**三个独立原因**（抽牌让位 / 页面隐藏 / 关闭），
 * 所以用「按原因算出来的目标值」，而不是在三个地方各自 `setTargetAtTime` ——
 * 后者会互相覆盖，长出「抽牌结束后 BGM 回不来了」这种只在特定操作顺序下复现的 bug。
 */
function targetLevel() {
  if (!started || hidden) return 0.0001
  return ducked ? BASE_LEVEL * 0.35 : BASE_LEVEL
}

function glide(ms = 1200) {
  if (!bgm) return
  const c = audio()
  if (!c) return
  const t = c.currentTime
  bgm.gain.cancelScheduledValues(t)
  bgm.gain.setValueAtTime(Math.max(bgm.gain.value, 0.0001), t)
  bgm.gain.exponentialRampToValueAtTime(targetLevel(), t + ms / 1000)
}

/** 常驻正弦（drone 专用：没有包络、没有终点，只有一条固定电平） */
function steady(c, freq, level, dest) {
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = freq
  const g = c.createGain()
  g.gain.value = level
  osc.connect(g)
  g.connect(dest)
  osc.start()
  sources.push(osc)
  return osc
}

/** 排下一次点缀（递归 setTimeout —— 间隔每次都重新随机，所以不会有周期感） */
function scheduleSpark() {
  const wait = SPARK_MIN_MS + Math.random() * (SPARK_MAX_MS - SPARK_MIN_MS)
  sparkTimer = setTimeout(() => {
    if (!started) return
    const c = audio()
    if (!c) return
    const f = SPARKS[Math.floor(Math.random() * SPARKS.length)]
    /* 起音 1.2s、余韵 4.5s：慢到不会被听成「事件」，只是一点亮光飘过去 */
    tone(c, {
      type: 'sine',
      from: f,
      t0: c.currentTime + 0.05,
      dur: 4.5,
      peak: 0.032 + Math.random() * 0.016,
      attack: 1.2,
      hold: 0.4,
      release: 4.5,
      wet: 0.85,
      dry: 0.25
    })
    scheduleSpark()
  }, wait)
}

/* ---------------------------------------------------------------- 生命周期 */

/**
 * 起播（**必须在用户手势的调用栈里调**，它内部会 `audio()` 建 ctx）。
 * 淡入 3.5s —— 环境音最忌「啪」地出现，那一下会把氛围全打散。
 */
export function startAmbient() {
  if (started) return false
  const c = audio()
  if (!c) return false
  const t0 = c.currentTime + 0.05

  mix = c.createGain()
  mix.gain.value = 1
  bgm = c.createGain()
  bgm.gain.value = 0.0001 /* 从静音起，靠 glide 淡入 */
  mix.connect(bgm)
  send(c, bgm, 0.5, 1)

  sources = []

  /* ① 双失谐低音：0.4Hz 拍频 = 缓慢的「呼吸」，没有旋律 */
  steady(c, 55, 0.3, mix)
  steady(c, 55.4, 0.26, mix)
  /* 五度上的一条细线：给一点厚度，又不构成任何和弦倾向 */
  steady(c, 82.5, 0.09, mix)

  /* ② 风：噪声 → 低通（截止被 0.035Hz 的 LFO 推着走） */
  const wind = c.createBufferSource()
  wind.buffer = noiseBuffer(c)
  wind.loop = true
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 340
  lp.Q.value = 0.6
  const windGain = c.createGain()
  windGain.gain.value = 0.16
  wind.connect(lp)
  lp.connect(windGain)
  windGain.connect(mix)
  wind.start(t0)
  sources.push(wind)

  const lfo = c.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 0.035 /* 28.6 秒一个周期 */
  const lfoDepth = c.createGain()
  lfoDepth.gain.value = 140
  lfo.connect(lfoDepth)
  lfoDepth.connect(lp.frequency)
  lfo.start(t0)
  sources.push(lfo)

  started = true
  glide(3500)

  /* 页面切到后台就静音（只绑一次） */
  if (!visBound && typeof document !== 'undefined') {
    visBound = true
    document.addEventListener('visibilitychange', () => {
      hidden = !!document.hidden
      /* 隐藏时用很短的过渡（用户已经切走了），回来时慢慢起 */
      glide(hidden ? 400 : 2600)
    })
  }

  scheduleSpark()
  return true
}

/** 停播：淡出后拆图（用户关开关时走这里） */
export function stopAmbient(fadeMs = 1800) {
  if (!started) return false
  started = false
  hidden = false
  ducked = false
  if (sparkTimer) {
    clearTimeout(sparkTimer)
    sparkTimer = null
  }
  glide(fadeMs)

  /* 先把引用摘出来再置空 —— 否则下面那个延时回调会清到「下一次 start 建的」源 */
  const dying = sources
  sources = []
  const m = mix
  const b = bgm
  mix = null
  bgm = null

  setTimeout(() => {
    dying.forEach((s) => {
      try {
        s.stop()
      } catch {
        /* 已经停过的忽略 */
      }
      try {
        s.disconnect()
      } catch {
        /* 已断开 */
      }
    })
    try {
      m?.disconnect()
      b?.disconnect()
    } catch {
      /* 已断开 */
    }
  }, fadeMs + 250)
  return true
}

/**
 * 抽牌时让位（把 BGM 压到 35%）。
 * 那 5.6 秒是音效的主场，BGM 跟它抢会两边都听不清 —— 混音礼节，不是可选项。
 */
export function duckAmbient(on) {
  ducked = !!on
  glide(ducked ? 500 : 1600)
}

/** 当前是否在播放（供探针读） */
export const isAmbientOn = () => started
