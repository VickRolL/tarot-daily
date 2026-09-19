/**
 * 音频底座（2026-09-20 第二十三轮）
 * ==========================================================================
 * 为什么把 ctx / 总线 / 混响从 sfx.js 里拆出来：
 *   第二十三轮加了**环境音（BGM）**。BGM 与音效必须共用同一个 AudioContext
 *   与同一条总线 —— 否则两套音频图各自算音量，用户调「音效开关」时
 *   只关得掉一半；而且两个独立 ctx 在移动端会各占一路音频焦点，互相打断。
 *
 * ── 第二十三轮重做的**核心教训**（用户原话：「和汽车加速的音效很像」
 *    「牌出来的声音很像拍了一下鼓」「翻牌也是鼓」「叮一声也不符合体感」）──
 *   上一版的四个音里，有三个都用了「**频率滑动 + 快速低频瞬态**」：
 *     · 蓄势  96→148Hz 上行扫频 + 低通 260→900Hz   → 这是**引擎/油门**的全部配方
 *     · 释放  128→54Hz 正弦、attack 4ms             → 这是**底鼓**的全部配方
 *     · 翻牌  420→300Hz 正弦、attack 3ms            → 这是**手鼓/木鱼**
 *     · 揭晓  659Hz 基音、attack 12ms               → 这是**电子风铃**
 *   这不是「参数没调好」，而是**选错了合成配方**：鼓、引擎、风铃都是
 *   「有明确音高 + 快起音 + 低频能量集中」的乐器，而塔罗要的是
 *   「无音高 / 音高模糊 + 慢起音 + 全频能量稀薄」的气声与水晶体。
 *   所以这一版把四个音**重新设计**，判据只有一条：
 *     **凡是在 50ms 内把能量堆到 200Hz 以下的写法，一律不许出现。**
 *
 * ── 三条不可让步的规矩（沿用第二十二轮）────────────────────────────────
 *   ① **默认关闭**。理由一半是礼貌，一半是浏览器策略。
 *   ② **AudioContext 只在用户手势里创建/恢复**（`unlock()`）。
 *      非手势里建出来的 ctx 会被挂成 suspended，而且**不报错**，只是安静地哑掉。
 *   ③ **所有增益都走包络**，不许 `gain.value = x` 硬切 —— 硬切必有爆音。
 *
 * ── 空间感（第二十三轮新增）──────────────────────────────────────────
 *   合成音最容易「廉价」的地方不是音色，是**没有空间**：干声贴着耳朵，
 *   像玩具。这里用 `ConvolverNode` + **程序生成的脉冲响应**做出厅堂混响 ——
 *   零素材、零依赖，却能让每个音「有地方待着」。
 *   IR 的做法见 `makeIR()`：噪声 × 频率相关衰减 + 前段早期反射。
 */

const STORE_KEY = 'tarot.sound'

/** 主音量。刻意压得很低 —— 这是氛围音，不是游戏音效 */
const MASTER_GAIN = 0.34

let ctx = null
let master = null
let reverbNode = null
let noiseBuf = null
let enabled = false

/* ---------------------------------------------------------------- 开关状态 */

export const isSoundOn = () => enabled

export function readSoundPref() {
  try {
    return window.localStorage.getItem(STORE_KEY) === 'on'
  } catch {
    return false
  }
}

export function writeSoundPref(on) {
  try {
    window.localStorage.setItem(STORE_KEY, on ? 'on' : 'off')
  } catch {
    /* 隐私模式下写不进去也没关系，本次会话照常生效 */
  }
}

/**
 * 切换开关。**只改标志位与持久化，不碰 AudioContext** ——
 * 这样「上次开着、这次直接点球抽牌」这条路径也是在水晶球的点击手势里建 ctx 的，
 * 控制台不会留下自动播放的告警。
 *
 * 声音的启停（环境音淡入淡出 / 正在响的余韵掐掉）由调用方负责，
 * 见 `SoundToggle.jsx` 与 `App.jsx` 的 `handleDraw`。
 */
export function setSoundOn(on) {
  enabled = !!on
  writeSoundPref(enabled)
  return enabled
}

/* ---------------------------------------------------------------- 引擎 */

/**
 * 拿到（必要时创建）AudioContext。
 * ⚠️ 只能在用户手势的调用栈里调 —— 见文件头第 ② 条。
 */
export function audio() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!AC) return null
  if (!ctx) {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = MASTER_GAIN
    master.connect(ctx.destination)
  }
  /* iOS / Chrome 会在后台标签页把 ctx 挂起，回到前台不自动恢复 —— 每次触发都探一下 */
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

/**
 * 在用户手势里调一次：把 AudioContext 建出来并跑起来（不发声）。
 * 真正的创建时机有两个，都在手势里：① 用户点音效开关；② 用户点水晶球抽牌。
 */
export function unlock() {
  const c = audio()
  return !!c && c.state === 'running'
}

/** 总线。BGM 与音效都挂在它下面，这样「整体音量」只有一个地方可调 */
export const masterBus = () => master

/** 白噪声缓冲（只生成一次，2s 足够所有循环与短音复用） */
export function noiseBuffer(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 2), c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    let prev = 0
    for (let i = 0; i < d.length; i += 1) {
      /* 轻低通一次 → 从「嘶嘶白噪」变成更接近**粉噪**的暖噪声。
         白噪的高频比例过高，直接拿来做「风」会刺、做「气」会像漏气。 */
      prev = prev * 0.32 + (Math.random() * 2 - 1) * 0.68
      d[i] = prev
    }
  }
  return noiseBuf
}

/* ---------------------------------------------------------------- 混响 */

/**
 * 程序生成的脉冲响应。
 *
 * 三点是听感的关键：
 *   ① **频率相关衰减** —— 真实厅堂里高频衰得比低频快。做法是对噪声逐样本
 *      一级低通，并且让「低通的阻尼」随进度增大：前段亮、后段闷。
 *      不做这一步，混响尾巴会像一坨白噪，听感是「沙」而不是「空间」。
 *   ② **早期反射** —— 前 55ms 用稀疏脉冲（混响的「房间尺寸」信息全在这里）。
 *      只有晚期噪声的话，听不出房间，只像加了个延时。
 *   ③ **立体声去相关** —— 左右两声道用独立随机数。两声道相同 = 单声道，
 *      贴在正中间，会跟干声打架。
 */
function makeIR(c, seconds = 3.4) {
  const sr = c.sampleRate
  const len = Math.max(1, Math.floor(sr * seconds))
  const buf = c.createBuffer(2, len, sr)
  for (let ch = 0; ch < 2; ch += 1) {
    const d = buf.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i += 1) {
      const t = i / len
      /* 晚期：指数衰减的能量包络 */
      const tail = Math.pow(1 - t, 2.6)
      /* 高频随进度衰减（阻尼随时间收紧） */
      const damp = 1 - 0.82 * t
      lp += (Math.random() * 2 - 1 - lp) * Math.max(0.04, damp * 0.5)
      d[i] = lp * tail
    }
    /* 早期反射：前 55ms 叠上稀疏脉冲，给出「房间尺寸」 */
    const earlyN = 14
    for (let k = 0; k < earlyN; k += 1) {
      const pos = Math.floor(((k + 1) / (earlyN + 1)) * 0.055 * sr * (1 + Math.random() * 0.4))
      if (pos < len) d[pos] += (Math.random() * 2 - 1) * 0.42 * (1 - k / earlyN)
    }
  }
  return buf
}

/** 厅堂混响（懒加载 —— IR 要算 30 万样本，不该在页面初始化时就付这个成本） */
export function reverb(c) {
  if (!reverbNode) {
    const cv = c.createConvolver()
    cv.buffer = makeIR(c)
    const g = c.createGain()
    g.gain.value = 0.85
    cv.connect(g)
    g.connect(master)
    reverbNode = cv
  }
  return reverbNode
}

/**
 * 把一个「已经带包络的节点」送进输出：干声与混响各一路。
 * `wet` 是混响占比 —— 深度气声（0.3~0.6）比干声（0）更能待在场景里。
 */
export function send(c, node, wet = 0, dry = 1) {
  if (dry > 0) {
    const d = c.createGain()
    d.gain.value = dry
    node.connect(d)
    d.connect(master)
  }
  if (wet > 0) {
    const w = c.createGain()
    w.gain.value = wet
    node.connect(w)
    w.connect(reverb(c))
  }
}

/* ---------------------------------------------------------------- 包络与发声 */

/**
 * 一次「起 → 峰 → 落」的增益包络，写进给定的 GainNode。
 * ⚠️ 指数斜坡**不能**落到 0（数学上到不了，Web Audio 会拒绝），
 * 所以末尾用 0.0001。这是新手最常见的爆音来源。
 */
export function env(g, t0, peak, attack, hold, release) {
  const p = Math.max(peak, 0.0001)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(p, t0 + Math.max(0.001, attack))
  if (hold > 0) g.gain.setValueAtTime(p, t0 + attack + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + Math.max(0.01, release))
}

/**
 * 正弦/三角等振荡器 + 可选滤波 + 包络 + 干湿送出。
 *
 * ⚠️ **`to` 这个扫频参数请慎用**。第二十二轮的「汽车加速」就是扫频惹的祸：
 * 人耳对「音高持续上升」的解读是**机械加速**，而不是「力量积蓄」。
 * 塔罗要的积蓄感靠**音量拱形 + 气声渐起**，不靠升调。
 * 目前只有环境音的极缓 LFO 用它，音效里一处都不用。
 */
export function tone(
  c,
  { type = 'sine', from, to, t0, dur, peak, attack = 0.02, hold = 0, release = 0.3, filter, wet = 0, dry = 1 }
) {
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, t0)
  if (to && to !== from) osc.frequency.linearRampToValueAtTime(to, t0 + Math.max(0.01, dur))
  env(g, t0, peak, attack, hold, release)
  let head = osc
  if (filter) {
    const f = c.createBiquadFilter()
    f.type = filter.type
    f.frequency.setValueAtTime(filter.from, t0)
    if (filter.to && filter.to !== filter.from) {
      f.frequency.linearRampToValueAtTime(filter.to, t0 + Math.max(0.01, dur))
    }
    f.Q.value = filter.q ?? 1
    osc.connect(f)
    head = f
  }
  head.connect(g)
  send(c, g, wet, dry)
  osc.start(t0)
  osc.stop(t0 + attack + hold + release + 0.12)
  return osc
}

/**
 * 噪声脉冲（气声 / 摩擦 / 风）。塔罗的主力音色就是它。
 *
 * 关键：**噪声没有音高**，所以它天然不会被听成「鼓」或「引擎」；
 * 但瞬态太快（attack < 5ms）一样会被读成「击打」——
 * 因为人耳把「5ms 内从静音到峰值」统一归类为**敲击事件**。
 * 所以要「气」而不是「击」，attack 就别低于 25ms。
 */
export function air(c, { t0, dur, peak, attack = 0.04, hold = 0, release = 0.6, filter, wet = 0, dry = 1 }) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c)
  /* 每次从噪声缓冲里随机取一段，避免所有气声都用同一段波形（听感上会「复读」） */
  const off = Math.random() * Math.max(0, noiseBuffer(c).duration - (attack + hold + release + 0.3) - 0.05)
  const f = c.createBiquadFilter()
  f.type = filter?.type ?? 'bandpass'
  f.frequency.setValueAtTime(filter?.from ?? 1200, t0)
  if (filter?.to && filter.to !== filter.from) {
    f.frequency.linearRampToValueAtTime(filter.to, t0 + Math.max(0.01, dur))
  }
  f.Q.value = filter?.q ?? 0.8
  const g = c.createGain()
  env(g, t0, peak, attack, hold, release)
  src.connect(f)
  f.connect(g)
  send(c, g, wet, dry)
  src.start(t0, off)
  src.stop(t0 + attack + hold + release + 0.12)
  return src
}

/** 整体快速静音（关开关时掐掉正在响的余韵）/ 恢复 */
export function muteAll(fadeMs = 260) {
  if (!ctx || !master) return
  const t = ctx.currentTime
  master.gain.cancelScheduledValues(t)
  master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t)
  master.gain.exponentialRampToValueAtTime(0.0001, t + fadeMs / 1000)
}

export function unmuteAll(fadeMs = 900) {
  if (!ctx || !master) return
  const t = ctx.currentTime
  master.gain.cancelScheduledValues(t)
  master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t)
  master.gain.exponentialRampToValueAtTime(MASTER_GAIN, t + fadeMs / 1000)
}
