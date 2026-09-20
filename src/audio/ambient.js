/**
 * 环境音 / 背景音乐（第二十三轮新增 · 第二十四轮改为「素材优先、合成兜底」）
 * ==========================================================================
 * 用户两次表态：
 *   第二十三轮「背景音乐也要有，是那种**幽暗寂静**的感觉」→ 先用纯合成做了一版；
 *   第二十四轮「你用芒果灵创生成的 bgm 效果不错」→ **AI 生成的素材胜出**。
 *
 * ── 所以现在是两条路，素材优先 ─────────────────────────────────────────
 *   ① **素材路**：`src/assets/audio/ambient-loop.mp3`
 *      AI（芒果灵创 / Mureka-9.5）生成的长氛围曲，由 `scripts/build-ambient.py`
 *      裁成 60 秒无缝循环（等功率交叉淡化，接缝在数学上不存在）、归一化、单声道 48kbps。
 *      产物体积见 `scripts/out/_amb_build.json`。
 *   ② **合成路**：下面那一大段 drone / 风 / 稀疏点缀。
 *      它**没有删掉**，因为它承担三件事：
 *        · `file://` 直接打开时 fetch 会被 CORS 挡掉 → 素材加载失败 → 自动退回它；
 *        · 素材缺失 / 解码失败时它是唯一还有声音的路径；
 *        · 它**永不重复**（拍频 + 缓变滤波 + 随机间隔），是「素材循环听腻了」时的备选。
 *
 *   ⚠️ 判据：探针必须断言当前走的是 **asset** 而不是 synth。
 *     否则「素材没加载成功」会被静默吞掉 —— 页面照样有声音（合成的），
 *     验收全绿，只有细听才发现放的根本不是那首。`ambientSourceKind()` 就是为这个加的。
 *
 * ── MP3 循环的一个隐蔽陷阱（第二十四轮踩到，必须写在这里）──────────────
 *   MP3 编码会在**头部写入约 576~1152 个采样点的延时**、在**尾部补零**对齐帧。
 *   这些字节在解码后是**真的静音**，而 `decodeAudioData()` 按规范**不剥掉它们**
 *   （LAME 写在 Xing/LAME 头里的 gapless 信息，Chrome 不解）。
 *   结果：每循环一圈就多出 20~30ms 的静音 —— 在连续的 drone 上就是一个可闻的「噗」。
 *
 *   修法不是重新编码，是用 **`loopStart` / `loopEnd`** 把这段静音排除在循环之外：
 *   播放时落在 `[loopStart, loopEnd)` 里循环，头尾那点静音永远走不到。
 *   见 `audibleRange()` —— 它带**上限保护**（最多各剥 3000 点），
 *   免得把素材本身很轻的头尾误判成静音而切掉真内容。
 *
 * ── 音量与礼仪（沿用第二十三轮）─────────────────────────────────────────
 *   · `BASE_LEVEL = 0.18`，相对总线（0.34）约 -14dB。目标是**隐约可闻**。
 *   · **抽牌时自动让位**（`duckAmbient(true)` → 降到 35%）：那 5.6 秒是音效的主场。
 *   · **页面切到后台自动静音**（`visibilitychange`）。
 *   · 压低音量有**三个独立原因**（抽牌 / 隐藏 / 关闭），所以统一由
 *     `targetLevel()` 算目标值 —— 三处各自 `setTargetAtTime` 会互相覆盖，
 *     长出「抽牌结束后 BGM 回不来」这种只在特定操作顺序下复现的 bug。
 */

import loopUrl from '../assets/audio/ambient-loop.mp3'
import { audio, noiseBuffer, send, tone } from './engine'

/** 相对总线的音量。刻意压得很低 —— 它是「地方」，不是「音乐」 */
const BASE_LEVEL = 0.18

/**
 * 素材的增益配平。
 *
 * 依据是**可测的那一项**：素材 RMS = -17.1 dBFS（见 build 报告），
 * 而合成 drone 进 `mix` 之后的 RMS 约 0.20（-14 dB）。
 * 两者差约 3 dB → 配平系数 1.4；这里取 **1.3** 留一点保守量，
 * 因为 55Hz 的纯正弦在等响曲线上比宽频素材「显得小声」，
 * 真按 RMS 划等号会让素材听起来偏响。
 *
 * ⚠️ 这是全模块唯一「靠推算而非听感」定下的参数。嫌吵就往下调，嫌轻就往上调 ——
 *    改这一个数即可，不要动 BASE_LEVEL（那会连带影响合成路与 duck 比例）。
 */
const ASSET_TRIM = 1.3

/** 判定「静音」的阈值（≈ -80 dBFS）与最多剥掉的采样点数（编码器延时远小于此） */
const SILENCE_TH = 1e-4
const TRIM_CAP = 3000

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

/** 解码后的循环素材（跨 start/stop 复用，不重复 fetch） */
let loopBuffer = null
/** 素材路已判定失败 → 本会话不再重试，直接走合成 */
let loopFailed = false
/** 加载代次：stop 或重新 start 会让上一代的 fetch 结果作废 */
let gen = 0
/** 当前实际在用哪一条路（'none' | 'asset' | 'synth'），供探针断言 */
let kind = 'none'

/* ---------------------------------------------------------------- 内务 */

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

/**
 * 找出「真正有声音」的区间，用于绕开 MP3 的编码器延时与尾部补零。
 *
 * 两层保护缺一不可：
 *   ① 阈值 1e-4（-80dB）—— 补零是**精确的 0**，而素材经过 -3dBFS 归一化，
 *      头尾都在 -3dB 附近，两者相差一个数量级，不会误判；
 *   ② 上限 `TRIM_CAP` —— 万一素材真的以静音开头（比如带了 2 秒的淡入），
 *      没有上限就会一路剥掉真内容。只剥「像编码器延时那么短」的一段。
 */
function audibleRange(buf) {
  const n = buf.length
  const cap = Math.min(TRIM_CAP, n >> 2)
  const chans = []
  for (let i = 0; i < buf.numberOfChannels; i += 1) chans.push(buf.getChannelData(i))
  const quiet = (i) => chans.every((d) => Math.abs(d[i]) < SILENCE_TH)

  let head = 0
  while (head < cap && quiet(head)) head += 1
  let tail = n
  while (tail > n - cap && quiet(tail - 1)) tail -= 1
  return { start: head, end: Math.max(tail, head + 1) }
}

/** 把解码好的循环素材接上输出链 */
function attachLoop(c) {
  const src = c.createBufferSource()
  src.buffer = loopBuffer
  src.loop = true
  const r = audibleRange(loopBuffer)
  const sr = loopBuffer.sampleRate
  src.loopStart = r.start / sr
  src.loopEnd = r.end / sr
  const g = c.createGain()
  g.gain.value = ASSET_TRIM
  src.connect(g)
  g.connect(mix)
  src.start(c.currentTime + 0.03, r.start / sr)
  sources.push(src)
  kind = 'asset'
}

/** 合成路：drone + 风 + 稀疏点缀（第二十三轮的实现，原样保留） */
function buildSynth(c) {
  const t0 = c.currentTime + 0.05

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

  kind = 'synth'
  scheduleSpark()
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

/** 取循环素材。失败（file:// 的 CORS、文件缺失、解码失败）一律 resolve 到 null，不抛 */
async function loadLoop(c) {
  if (loopBuffer) return loopBuffer
  if (loopFailed) return null
  try {
    const res = await fetch(loopUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const raw = await res.arrayBuffer()
    loopBuffer = await c.decodeAudioData(raw)
    return loopBuffer
  } catch {
    loopFailed = true
    return null
  }
}

/**
 * 起播（**必须在用户手势的调用栈里调**，它内部会 `audio()` 建 ctx）。
 * 淡入 3.5s —— 环境音最忌「啪」地出现，那一下会把氛围全打散。
 *
 * 注意 ctx 是**同步**建好的（在手势里），素材是**异步**载入的。
 * 所以「手指抬起时还没有声音」是正常的：素材到位前 `bgm` 已经在慢慢淡入，
 * 等它接上时是「渐渐听见」而不是「突然开始」。
 */
export function startAmbient() {
  if (started) return false
  const c = audio()
  if (!c) return false

  mix = c.createGain()
  mix.gain.value = 1
  bgm = c.createGain()
  bgm.gain.value = 0.0001 /* 从静音起，靠 glide 淡入 */
  mix.connect(bgm)
  send(c, bgm, 0.5, 1)

  sources = []
  started = true
  glide(3500)

  if (!visBound && typeof document !== 'undefined') {
    visBound = true
    document.addEventListener('visibilitychange', () => {
      hidden = !!document.hidden
      /* 隐藏时用很短的过渡（用户已经切走了），回来时慢慢起 */
      glide(hidden ? 400 : 2600)
    })
  }

  if (loopBuffer) {
    attachLoop(c)
  } else {
    const mine = ++gen
    loadLoop(c).then((buf) => {
      /* 期间用户可能已经关掉、或者又开了一次 —— 结果作废 */
      if (mine !== gen || !started) return
      if (buf) attachLoop(c)
      else buildSynth(c)
    })
  }
  return true
}

/** 停播：淡出后拆图（用户关开关时走这里） */
export function stopAmbient(fadeMs = 1800) {
  if (!started) return false
  started = false
  hidden = false
  ducked = false
  kind = 'none'
  gen += 1 /* 作废进行中的加载 */
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

/**
 * 当前用的是素材还是合成（`'none'` 表示没在放）。
 *
 * ⚠️ 这个方法存在的唯一理由：**「素材没加载成功」是静默的**。
 *    走合成兜底时页面照样有声音、控制台照样干净、截图照样没事 ——
 *    只有这个断言能把它揪出来。任何一次动过素材路径的改动都必须重跑它。
 */
export const ambientSourceKind = () => kind
