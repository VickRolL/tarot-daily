/**
 * 音效合成（2026-09-20 第二十二轮）
 * ==========================================================================
 * 为什么是「合成」而不是「音效文件」：
 *   ① 本项目有一条硬线 —— **美术/音频素材零新增**（出图要花积分，音频素材要外链或入库）；
 *   ② 这三个音都是**噪声与正弦的短包络**（嗡 / 咔 / 叮），Web Audio 现场合成完全够用，
 *      一段 `OscillatorNode` + `BiquadFilter` 比一个 mp3 更小、更可控、也不会有加载态；
 *   ③ 合成的声音可以**跟着节拍表参数化** —— 蓄势音的长度直接取 `chargeDone`，
 *      动画改时长音效自动跟着改，不会出现「画面 1.2s、音效 0.6s」的错位。
 *
 * ── 三条不可让步的规矩 ──────────────────────────────────────────────────
 *   ① **默认关闭**。不是「等用户点一次就永久开」——是初始 state 就是关，
 *      用户必须显式点一下开关。理由一半是礼貌（不打招呼就出声很冒犯），
 *      一半是浏览器策略（没有用户手势，AudioContext 建出来就是 suspended）。
 *   ② **AudioContext 只在用户手势里创建/恢复**。`unlock()` 必须在 click/keydown
 *      的调用栈里跑，否则 Chrome 会把它挂成 suspended，后面所有声音都是哑的
 *      —— 而且**不报错**，只是安静地不出声（这类 bug 最难查）。
 *   ③ **所有增益都用包络**，不许直接 `gain.value = x` 硬切。
 *      硬切会在波形中间产生台阶 → 听感上是「啪」的爆音。
 *
 * ── 怎么验（人耳之外）──────────────────────────────────────────────────
 *   Web Audio 在无头环境里没法「听」，但可以验**结构性事实**：
 *   开关状态是否持久化、`AudioContext` 是否真的被建出来且 `state === 'running'`、
 *   每次触发是否真的连上了节点。见 `scripts/flows/probe-sfx.js`。
 */

const STORE_KEY = 'tarot.sound'

/** 主音量。刻意压得很低 —— 这是氛围音，不是游戏音效 */
const MASTER_GAIN = 0.34

let ctx = null
let master = null
let noiseBuf = null
let enabled = false

/* ---------------------------------------------------------------- 状态 */

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

/* ---------------------------------------------------------------- 引擎 */

/**
 * 拿到（必要时创建）AudioContext。
 * ⚠️ 只能在用户手势的调用栈里调 —— 见文件头第 ② 条。
 */
function engine() {
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

/** 白噪声缓冲（只生成一次，1s 足够所有短音复用） */
function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate), c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

/**
 * 在用户手势里调一次：把 AudioContext 建出来并跑起来（不发声）。
 * ⚠️ **不要**在模块初始化 / 组件渲染里调它 —— Chrome 会打印
 * 「The AudioContext was not allowed to start」并把 ctx 挂在 suspended。
 * 真正的创建时机有两个，都在手势里：① 用户点音效开关；② 用户点水晶球抽牌。
 */
export function unlock() {
  const c = engine()
  return !!c && c.state === 'running'
}

/**
 * 切换开关。**只改标志位与持久化，不碰 AudioContext** ——
 * 这样「上次开着、这次直接点球抽牌」这条路径也是在水晶球的点击手势里建 ctx 的，
 * 控制台不会留下自动播放的告警。
 */
export function setSoundOn(on) {
  enabled = !!on
  writeSoundPref(enabled)
  return enabled
}

/* ---------------------------------------------------------------- 包络工具 */

/**
 * 一次「起 → 峰 → 落」的增益包络，写进给定的 GainNode。
 * ⚠️ 指数斜坡**不能**落到 0（数学上到不了，Web Audio 会直接拒绝或静默出问题），
 * 所以末尾用 0.0001 而不是 0。这是新手最常见的爆音来源。
 */
function env(g, t0, peak, attack, hold, release) {
  const p = Math.max(peak, 0.0001)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(p, t0 + attack)
  g.gain.setValueAtTime(p, t0 + attack + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release)
}

/** 正弦/三角振荡器 + 可选扫频，接到 master */
function tone(c, { type = 'sine', from, to, t0, dur, peak, attack = 0.02, hold = 0.1, release = 0.3, filter }) {
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, t0)
  if (to && to !== from) osc.frequency.linearRampToValueAtTime(to, t0 + dur)
  env(g, t0, peak, attack, hold, release)
  let head = osc
  if (filter) {
    const f = c.createBiquadFilter()
    f.type = filter.type
    f.frequency.setValueAtTime(filter.from, t0)
    if (filter.to && filter.to !== filter.from) f.frequency.linearRampToValueAtTime(filter.to, t0 + dur)
    f.Q.value = filter.q ?? 1
    osc.connect(f)
    head = f
  }
  head.connect(g)
  g.connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + attack + hold + release + 0.05)
  return osc
}

/* ---------------------------------------------------------------- 三个音 */

/**
 * ① 蓄势「嗡」—— 低频慢起，音量随充能一起拱上去，末尾被爆闪切断。
 * `durMs` 直接取节拍表的 chargeDone，所以改了蓄势拍长度，音效自动对齐。
 */
export function charge(durMs = 1000) {
  if (!enabled) return false
  const c = engine()
  if (!c || durMs < 120) return false
  const t0 = c.currentTime + 0.01
  const dur = durMs / 1000

  /* 两个略微失谐的低音叠出「厚度」，扫频让它有「往上攒」的动势 */
  tone(c, {
    type: 'triangle',
    from: 96,
    to: 148,
    t0,
    dur,
    peak: 0.5,
    attack: dur * 0.72,
    hold: 0,
    release: 0.1,
    filter: { type: 'lowpass', from: 260, to: 900, q: 4 }
  })
  tone(c, {
    type: 'sine',
    from: 193,
    to: 291,
    t0,
    dur,
    peak: 0.22,
    attack: dur * 0.8,
    hold: 0,
    release: 0.08
  })
  return true
}

/**
 * ② 释放「啪 / 唰」—— 噪声脉冲 + 一记低频闷响。
 * 对应爆闪那一拍：要短、要有冲击，但不能刺耳（带通卡在 1.1k）。
 */
export function burst() {
  if (!enabled) return false
  const c = engine()
  if (!c) return false
  const t0 = c.currentTime + 0.005

  const src = c.createBufferSource()
  src.buffer = noise(c)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(1100, t0)
  bp.frequency.exponentialRampToValueAtTime(420, t0 + 0.34)
  bp.Q.value = 0.9
  const g = c.createGain()
  env(g, t0, 0.5, 0.006, 0.02, 0.3)
  src.connect(bp)
  bp.connect(g)
  g.connect(master)
  src.start(t0)
  src.stop(t0 + 0.4)

  /* 闷响：把「释放」落到身体上，不是只有耳朵 */
  tone(c, { type: 'sine', from: 128, to: 54, t0, dur: 0.34, peak: 0.42, attack: 0.004, hold: 0.01, release: 0.34 })
  return true
}

/**
 * ③ 翻牌「唰」—— 很短的带通噪声 + 一点点击感。
 * 关键在**短**：超过 200ms 就不再像「一张纸翻过去」，而像风。
 */
export function flip() {
  if (!enabled) return false
  const c = engine()
  if (!c) return false
  const t0 = c.currentTime + 0.005

  const src = c.createBufferSource()
  src.buffer = noise(c)
  const hp = c.createBiquadFilter()
  hp.type = 'bandpass'
  hp.frequency.setValueAtTime(2600, t0)
  hp.frequency.exponentialRampToValueAtTime(1500, t0 + 0.16)
  hp.Q.value = 0.7
  const g = c.createGain()
  env(g, t0, 0.34, 0.004, 0.012, 0.17)
  src.connect(hp)
  hp.connect(g)
  g.connect(master)
  src.start(t0)
  src.stop(t0 + 0.26)

  /* 一点点木质「嗒」—— 只有噪声的话读起来是「沙」，加上这个才像牌 */
  tone(c, { type: 'sine', from: 420, to: 300, t0, dur: 0.09, peak: 0.16, attack: 0.003, hold: 0.008, release: 0.09 })
  return true
}

/**
 * ④ 揭晓「叮」—— 一枚玻璃铃：四个非整数倍分音 + 长衰减。
 * 倍率刻意用 2.01 / 2.99 / 4.21 而不是 2 / 3 / 4：
 * **整数倍会听成风琴/方波**（谐波锁在一起），非整数倍才有玻璃或金属的拍频感。
 */
export function reveal() {
  if (!enabled) return false
  const c = engine()
  if (!c) return false
  const t0 = c.currentTime + 0.01
  const base = 659.25 /* E5，和暗色调配起来不刺 */
  const parts = [
    { mult: 1, peak: 0.3, rel: 1.5 },
    { mult: 2.01, peak: 0.16, rel: 1.1 },
    { mult: 2.99, peak: 0.09, rel: 0.8 },
    { mult: 4.21, peak: 0.05, rel: 0.5 }
  ]
  parts.forEach((p) => {
    tone(c, {
      type: 'sine',
      from: base * p.mult,
      t0,
      dur: p.rel,
      peak: p.peak,
      attack: 0.012,
      hold: 0,
      release: p.rel
    })
  })
  /* 一层很轻的气声，把「牌面亮出来」这件事衬软 */
  const src = c.createBufferSource()
  src.buffer = noise(c)
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 3800
  const g = c.createGain()
  env(g, t0, 0.055, 0.05, 0.05, 0.7)
  src.connect(hp)
  hp.connect(g)
  g.connect(master)
  src.start(t0)
  src.stop(t0 + 0.95)
  return true
}
