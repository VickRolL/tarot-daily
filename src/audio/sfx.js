/**
 * 音效（2026-09-20 第二十三轮全重设计 · 第二十五轮改为「素材优先、合成兜底」）
 * ==========================================================================
 * 第二十二轮的四个音被用户逐个否掉了，原话：
 *   「点击之后牌出来前的声音和汽车加速的音效很像」
 *   「牌出来的声音很像拍了一下鼓」「牌翻转也是鼓」「牌展示的叮一声也不符合体感」
 *
 * 复盘：这不是音量或音色没调好，是**配方选错了**。
 *   上一版四个音里有三个是「**有明确音高 + 快起音 + 低频能量集中**」：
 *       蓄势  96→148Hz 上行扫频 + 低通 260→900Hz  → 引擎 / 油门
 *       释放  128→54Hz 正弦，attack 4ms            → 底鼓
 *       翻牌  420→300Hz 正弦，attack 3ms           → 手鼓 / 木鱼
 *       揭晓  659Hz 基音，attack 12ms              → 电子风铃
 *   人耳对这三件事的归类是**又快又硬的机械/打击事件**，
 *   而塔罗这一幕要的是**气、雾、丝绸、水晶与厅堂**：慢起音、无音高、全频稀薄。
 *
 * 这一版给四个音重新定了配方，判据只有一条，写在这里供后来者守：
 *   **凡是在 50ms 内把能量堆到 200Hz 以下的写法，一律不许出现。**
 *   （那条 128→54Hz 的包络正是「鼓」的全部秘密。）
 *
 * 另一个共性问题：合成音「廉价」往往不是音色问题，是**没有空间**。
 * 干声贴着耳朵，像玩具。所以这一版所有音都经 `send(..., wet)` 送进
 * `engine.js` 里程序生成的厅堂混响，让声音有地方待着。
 *
 * ── 第二十五轮：AI 生成素材优先（与 ambient.js 同一套双路结构）──────
 *   合成配方再讲究也是**数学**，AI 素材是**录音**——后者天然更「真」。
 *   ① **素材路**：`src/assets/audio/sfx/<name>.mp3`，由 aisounds.cn 生成、
 *      `scripts/build-sfx.py` 修剪对齐归一（build 报告见 `scripts/out/_sfx_build.json`）。
 *   ② **合成路**：下面的四个配方**一个字没删**，它承担：
 *        · 素材还没到货的那几个音（限流分批生成，到一段处理一段）；
 *        · `file://` 打开时 fetch 被 CORS 挡掉 → 自动退回它；
 *        · 素材解码失败的兜底。
 *
 *   ⚠️ 三条铁律（前两条从 ambient 那边的事故里学来，第三条是自己踩的）：
 *     · **素材路失败是静默的** —— 页面照样有声音、控制台照样干净。
 *       所以有 `sfxSourceKind()` 与 `window.__tarotSfx`，探针靠它们断言
 *       「有素材的音必须走 asset、没素材的必须走 synth」，缺一不可。
 *     · **预载必须赶在第一声之前** —— 第一声是 charge，发生在抽牌点击里。
 *       靠 play 时才 fetch+decode 根本来不及。所以 `engine.unlock()` 会在
 *       手势栈里同步派发 `tarot:audio-ready`，这里监听后立刻开始预载。
 *     · **「走了素材路」不等于「素材本身是对的」** —— 上一条只能证明路通了，
 *       证明不了解码出来的响度/峰值/时长还是对齐的那一批
 *       （dist 里躺着上一版旧文件就是这么静默发生的）。
 *       所以 `__tarotSfx.stats` 在解码回调里**实测**每个音，供探针做端到端判据。
 *
 * ── 四个音的合成配方（兜底路，原第二十三轮）─────────────────────────
 *   ① charge 「屏息」  55 / 55.35Hz 双失谐 drone（**不扫频**）+ 两层气声缓慢拱起
 *                     靠**音量拱形**表达积蓄，不靠升调 —— 升调就是加速
 *   ② burst  「雾散」  高通气声 + 低频气层 + 一声极轻的低音底座
 *                     完全没有 200Hz 以下的瞬态；整段没有一个陡沿
 *   ③ flip   「丝绢」  两层带通噪声错开 28ms + 一层起绒高频；**零振荡器**
 *                     attack 从 3ms 放宽到 16ms —— 5ms 内到峰值一律被听成「敲」
 *   ④ reveal 「颂钵」  196Hz 基音 + 失谐副基音 + 钟形非谐泛音(2.76/5.40/8.93)
 *                     attack 放宽到 180ms，余韵 6s —— 是「嗡起来」不是「叮一下」
 */

import { air, audio, isSoundOn, send, tone } from './engine'

/* ⚠️ 转发导出必须显式写出每个名字，而且**只能走 `export ... from`**。
   踩过一次：先在 `import` 里漏了 `muteAll`、却在 `export { muteAll }` 里写了它，
   浏览器直接抛 `Export 'muteAll' is not defined in module` —— 而且是**求值期**抛，
   表现是整站白屏、控制台只有这一条，不看就完全猜不到。
   `export ... from` 不创建局部绑定，所以和上面那个 `import` 同名也不会冲突。 */
export { isSoundOn, muteAll, readSoundPref, setSoundOn, unlock, unmuteAll } from './engine'

/* ---------------------------------------------------------------- 素材层 */

/**
 * Vite 会把 glob 命中的文件全部打进构建，**目录为空/缺某个文件都不报错** ——
 * 正好匹配「素材分批到货」的现状：到货一个，glob 多一个键，无需改代码。
 */
const assetUrls = import.meta.glob('../assets/audio/sfx/*.mp3', {
  query: '?url',
  import: 'default',
  eager: true
})

/**
 * 素材增益配平（必须与 build-sfx.py 的 SPECS[*].trim 一致，那边 main() 有对拍检查）。
 *
 * 默认全 1.0：流水线已经按 RMS 把四个音在**文件里**归到各自目标档，播放端再乘一个数
 * 就是二次补偿，反而破坏响度对齐。历史上 charge 是 1.4（注释说「补回高通削掉的电平」），
 * 但那部分已经被 normalize() 补过一次 —— 结果是 charge 悄悄比其它三个响 2.9dB。已修正。
 */
const TRIMS = { charge: 1.0, burst: 1.0, flip: 1.0, reveal: 1.0 }

/** 只认四个合同内的名字——目录里混进别的文件不生效 */
const ASSETS = {}
for (const [path, url] of Object.entries(assetUrls)) {
  const name = path.replace(/^.*\//, '').replace(/\.mp3$/, '')
  if (name in TRIMS) ASSETS[name] = url
}

const buffers = {}
const failed = {}
const stats = {}
let loadStarted = false
/** 每个音最近一次实际走的路（'asset' | 'synth'），供探针断言 */
const lastKind = {}

/**
 * 调试开关：强制走合成路。**只在开发版（DevBar）里用**。
 *
 * 为什么值得留一个口子：素材路与合成路是两套完全不同的实现（AI 录音 vs 数字合成），
 * 要回答「素材到底比合成好在哪」必须能**在同一条链路上 A/B 切换** ——
 * 分两个页面各听一遍不算对比，中间隔着不同的 ctx / 总线 / 混响，
 * 听出来的差异说不清是素材的还是链路的。
 *
 * 正式构建里 DevBar 整块被摇掉，没有调用方，这个分支跟着消失。
 */
let forceSynth = false
export const setForceSynth = (on) => {
  forceSynth = !!on
}
export const isForceSynth = () => forceSynth

const toDb = (x) => (x > 0 ? 20 * Math.log10(x) : -999)
const round1 = (x) => Math.round(x * 10) / 10

/**
 * 量**页面真正解码出来的那一份**（不是仓库里的源文件，也不是构建报告里的 PCM）。
 *
 * 为什么值得在客户端算一遍：这条链路上游每一环都有自己的校验（生成契约、
 * `build-sfx.py` 的自检、vite 的哈希产物），但它们都答不了同一个问题 ——
 * 「**出厂后被浏览器解出来的这一份，到底还是不是对齐的那批**」。
 * 生成 → 修剪归一 → 构建 → HTTP → `decodeAudioData`，整条链路只在这里合拢，
 * 也只有在这里能抓到「dist 里躺着上一版的旧文件」这类静默错配。
 *
 * 结果缓存：`window.__tarotSfx` 是个 getter，探针的 waitFor 会轮询读它，
 * 放进去现算会让同一段 4 秒音频被反复扫几十遍。
 *
 * ★ 2026-09-21 修正：RMS 要在**剪掉首尾近静音**之后再算，与 `build-sfx.py`
 *   的 `trim_silence(-55dB)` 同一口径。原来这里是把整段（含编码器补的静音尾巴、
 *   以及素材自己那截 -60dB 的余韵）一起算进 RMS —— 对密集的音（charge / burst /
 *   reveal，整段都在响）几乎没差别，所以一直没暴露；换成稀疏的 flip 之后立刻显形：
 *   同一条文件**流水线报 -18.3dB、浏览器报 -19.1dB，差 0.8dB**，直接打红
 *   `probe-sfx` 的漂移判据，而代码、产物都没问题。
 *   两个数都不是错的，**它们是两个不同的量**。判据要能用，两边必须是同一个量：
 *   把听不见的静音算进「响度」本身就没有意义，所以对齐到剪过的那个。
 *   （峰值不受影响：最大值剪不剪都一样。）
 */
const TRIM_REL_DB = -55 /* 与 build-sfx.py 的 trim_silence 同值 */
const TRIM_PAD_S = 0.02

function measure(buf) {
  const ch = buf.getChannelData(0) /* 四个素材都是单声道（build-sfx.py 保证） */
  if (!ch.length) return { dur: 0, rmsDb: -999, peakDb: -999 }
  let peak = 0
  for (let i = 0; i < ch.length; i += 1) {
    const a = ch[i] < 0 ? -ch[i] : ch[i]
    if (a > peak) peak = a
  }
  /* 首尾近静音修剪：阈值相对峰值（原因见 build-sfx.py 的 trim_silence） */
  const th = peak * 10 ** (TRIM_REL_DB / 20)
  const pad = Math.round(buf.sampleRate * TRIM_PAD_S)
  let lo = 0
  let hi = ch.length
  for (let i = 0; i < ch.length; i += 1) {
    const a = ch[i] < 0 ? -ch[i] : ch[i]
    if (a > th) {
      lo = Math.max(0, i - pad)
      break
    }
  }
  for (let i = ch.length - 1; i >= 0; i -= 1) {
    const a = ch[i] < 0 ? -ch[i] : ch[i]
    if (a > th) {
      hi = Math.min(ch.length, i + 1 + pad)
      break
    }
  }
  let sum = 0
  const n = Math.max(1, hi - lo)
  for (let i = lo; i < hi; i += 1) sum += ch[i] * ch[i]
  return {
    dur: Math.round(buf.duration * 1000) / 1000,
    rmsDb: round1(toDb(Math.sqrt(sum / n))),
    peakDb: round1(toDb(peak))
  }
}

/** 预载全部素材。幂等；单项失败只标记那一个，不拖累其它 */
function loadAssets(c) {
  if (loadStarted) return
  loadStarted = true
  for (const [name, url] of Object.entries(ASSETS)) {
    ;(async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = await c.decodeAudioData(await res.arrayBuffer())
        buffers[name] = buf
        stats[name] = measure(buf)
      } catch {
        failed[name] = true
      }
    })()
  }
}

/** 播素材。没有解码好的缓冲就返回 false（调用方退回合成） */
function playAsset(c, name) {
  if (forceSynth) return false /* 调试用：DevBar 的 A/B 开关 */
  const buf = buffers[name]
  if (!buf) return false
  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  g.gain.value = TRIMS[name] ?? 1
  src.connect(g)
  /* 素材自带空间感，混响只给一点点（0.12），主要作用是把它「焊」进同一间厅堂 */
  send(c, g, 0.12, 1)
  src.start()
  lastKind[name] = 'asset'
  return true
}

/** 探针用：哪些音有素材 */
export const availableSfxAssets = () => Object.keys(ASSETS)
/** 探针用：每个音最近一次走的路 */
export const sfxSourceKind = () => ({ ...lastKind })

/* 无头探针进不了模块内部，把状态挂到 window 上（只读，探针专用） */
if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__tarotSfx', {
    configurable: true,
    get: () => ({
      assets: Object.keys(ASSETS),
      loaded: Object.keys(buffers),
      failed: { ...failed },
      kinds: { ...lastKind },
      stats: { ...stats },
      forceSynth
    })
  })
  /* engine.unlock() 在手势栈里派发（见 engine.js），这里开始预载 */
  window.addEventListener('tarot:audio-ready', () => {
    const c = audio()
    if (c) loadAssets(c)
  })
}

/* ---------------------------------------------------------------- 四个音 */

/**
 * ① 蓄势「屏息」—— 对应「点击 → 牌还没出来」那一段（长度 = 节拍表的 chargeDone）。
 *
 * 素材（aisounds 生成 + build-sfx.py 高通 240Hz 去泥）定长 1.0s；
 * `durMs` 只在合成路里生效 —— 素材路以素材长度为准，
 * 蓄势比动画略长半拍是可接受的（它本来就是「余息」）。
 */
export function charge(durMs = 1000) {
  if (!isSoundOn()) return false
  const c = audio()
  if (!c) return false
  loadAssets(c)
  if (playAsset(c, 'charge')) return true
  lastKind.charge = 'synth'
  if (durMs < 200) return false
  const t0 = c.currentTime + 0.02
  const dur = durMs / 1000

  /* 双失谐低音：只差 0.35Hz → 0.35 次/秒的拍频，是「呼吸」不是「加速」 */
  tone(c, { type: 'sine', from: 55, t0, dur, peak: 0.3, attack: dur * 0.86, hold: 0, release: 0.18, wet: 0.32 })
  tone(c, { type: 'sine', from: 55.35, t0, dur, peak: 0.26, attack: dur * 0.9, hold: 0, release: 0.18, wet: 0.32 })

  /* 八度上的一条细线：让笔记本小喇叭也能听到「底」，不然 55Hz 直接消失了 */
  tone(c, { type: 'sine', from: 110, t0, dur, peak: 0.11, attack: dur * 0.8, hold: 0, release: 0.16, wet: 0.3 })

  /* 吸气：中频气声。带通不是低通 —— 低通会把气声压成一团闷响（又回到鼓） */
  air(c, {
    t0,
    dur,
    peak: 0.13,
    attack: dur * 0.9,
    hold: 0,
    release: 0.22,
    filter: { type: 'bandpass', from: 480, q: 0.55 },
    wet: 0.42
  })

  /* 极轻的高频空气层：给「雾」一点颗粒，也让整体不至于发闷 */
  air(c, {
    t0,
    dur,
    peak: 0.024,
    attack: dur * 0.85,
    hold: 0,
    release: 0.3,
    filter: { type: 'highpass', from: 6500, q: 0.5 },
    wet: 0.5
  })
  return true
}

/**
 * ② 释放「雾散」—— 对应爆闪那一拍。
 *
 * 用户说上一版「像拍了一下鼓」。根因是那条 128→54Hz、attack 4ms 的正弦：
 * 快速下滑的低频正弦 = 底鼓的标准做法，一个不差。
 *
 * 现在把 **200Hz 以下的所有瞬态全部删掉**，只留气：
 *   · 高通气声（800Hz 起）—— 「呼」的一声散开，没有低频就没有「捶」的感觉；
 *   · 一层低频**气**（带通 260Hz，慢起 100ms）补厚度 —— 注意是气不是正弦，
 *     气声没有明确音高，所以只添体积、不添「鼓皮」；
 *   · 一声极轻的低音底座（165Hz，起音 200ms、拖 2.5s）把这一拍「托住」，
 *     它慢到不像敲击，更像房间里的一口回响。
 */
export function burst() {
  if (!isSoundOn()) return false
  const c = audio()
  if (!c) return false
  loadAssets(c)
  if (playAsset(c, 'burst')) return true
  lastKind.burst = 'synth'
  const t0 = c.currentTime + 0.005

  /* 主气声：散开。attack 45ms —— 低于 5ms 就会被听成「击」 */
  air(c, {
    t0,
    dur: 0.8,
    peak: 0.24,
    attack: 0.045,
    hold: 0.02,
    release: 0.75,
    filter: { type: 'highpass', from: 800, q: 0.7 },
    wet: 0.5
  })

  /* 低频气层：只添体积，不带音高（所以不会变成鼓） */
  air(c, {
    t0,
    dur: 1.2,
    peak: 0.13,
    attack: 0.1,
    hold: 0.03,
    release: 1.15,
    filter: { type: 'bandpass', from: 260, q: 0.5 },
    wet: 0.5
  })

  /* 起绒：极短的高频，给「散开」一个可辨的起点，免得整段糊成一团 */
  air(c, {
    t0,
    dur: 0.16,
    peak: 0.06,
    attack: 0.03,
    hold: 0,
    release: 0.14,
    filter: { type: 'highpass', from: 3800, q: 0.6 },
    wet: 0.4
  })

  /* 底座：慢起的低音，把这一拍落在房间的尺度上（不是落在胸口上） */
  tone(c, { type: 'sine', from: 165, t0, dur: 2.6, peak: 0.1, attack: 0.2, hold: 0.1, release: 2.5, wet: 0.55 })
  return true
}

/**
 * ③ 翻牌「丝绢」—— 一张纸/一匹绸翻过去。
 *
 * 用户说这个也是「鼓」。根因同样是那个 420→300Hz 的正弦，加上 4ms 的起音：
 * 「有音高的短促击打」= 手鼓。上一版的注释里我还写着「加一点木质嗒才像牌」，
 * 方向正好反了 —— 纸和绸**没有音高**，有音高的那个「嗒」才是不像的原因。
 *
 * 现在：**一个振荡器都不留**，全是噪声，靠**两条不同中心频率的带通错开 28ms**
 * 拉开时间轴，模拟「边缘先起、整张再跟」的丝绸摩擦。
 */
export function flip() {
  if (!isSoundOn()) return false
  const c = audio()
  if (!c) return false
  loadAssets(c)
  if (playAsset(c, 'flip')) return true
  lastKind.flip = 'synth'
  const t0 = c.currentTime + 0.005

  air(c, {
    t0,
    dur: 0.2,
    peak: 0.15,
    attack: 0.016,
    hold: 0.01,
    release: 0.18,
    filter: { type: 'bandpass', from: 1700, q: 1.1 },
    wet: 0.28
  })
  /* 错开 28ms 的第二层：摩擦声的「拖尾」，中心频率更高、更细 */
  air(c, {
    t0: t0 + 0.028,
    dur: 0.26,
    peak: 0.09,
    attack: 0.012,
    hold: 0.01,
    release: 0.23,
    filter: { type: 'bandpass', from: 4800, q: 0.9 },
    wet: 0.35
  })
  /* 起绒：真正让听感「软」的是这一层极高频，它对应纤维的细碎摩擦 */
  air(c, {
    t0,
    dur: 0.1,
    peak: 0.035,
    attack: 0.008,
    hold: 0,
    release: 0.09,
    filter: { type: 'highpass', from: 8000, q: 0.5 },
    wet: 0.3
  })
  return true
}

/**
 * ④ 揭晓「颂钵」—— 牌面亮出来。
 *
 * 用户说上一版那声「叮」不符合体感。那是个玻璃风铃：659Hz、起音 12ms、
 * 泛音按 1 / 2.01 / 2.99 / 4.21 排。它「亮」得很快，所以像提示音，
 * 不像一场占卜的落点。
 *
 * 现在换成**颂钵**：低基音（196Hz = G3）、起音放宽到 180ms（是「嗡」起来，
 * 不是「敲」下去）、余韵 6 秒；泛音改用**钟的模态比** 2.76 / 5.40 / 8.93
 * （这几个数不是随便挑的，是钟与钵的弯曲振动模态，所以听起来才「像钵」）。
 * 再叠一个只差 1.6Hz 的副基音，让两条基音缓慢打拍 —— 钵「活」起来的关键。
 */
export function reveal() {
  if (!isSoundOn()) return false
  const c = audio()
  if (!c) return false
  loadAssets(c)
  if (playAsset(c, 'reveal')) return true
  lastKind.reveal = 'synth'
  const t0 = c.currentTime + 0.015

  /* 基音 + 微微失谐的副基音（拍频约 0.8 次/秒） */
  tone(c, { type: 'sine', from: 196, t0, dur: 6.2, peak: 0.28, attack: 0.18, hold: 0.15, release: 6.0, wet: 0.55 })
  tone(c, { type: 'sine', from: 197.6, t0, dur: 5.9, peak: 0.11, attack: 0.22, hold: 0.15, release: 5.7, wet: 0.55 })

  /* 钟形非谐泛音：越高的分音衰减越快（真实金属体的能量也是这样走的） */
  const parts = [
    { mult: 2.76, peak: 0.095, atk: 0.22, rel: 3.2 },
    { mult: 5.4, peak: 0.05, atk: 0.26, rel: 1.7 },
    { mult: 8.93, peak: 0.022, atk: 0.3, rel: 0.9 }
  ]
  parts.forEach((p) => {
    tone(c, {
      type: 'sine',
      from: 196 * p.mult,
      t0,
      dur: p.rel,
      peak: p.peak,
      attack: p.atk,
      hold: 0,
      release: p.rel,
      wet: 0.6
    })
  })

  /* 一层很轻的气声铺底：把「牌面亮出来」这件事衬软，不要让它像一声提示音 */
  air(c, {
    t0,
    dur: 3.4,
    peak: 0.05,
    attack: 0.6,
    hold: 0.4,
    release: 3.2,
    filter: { type: 'bandpass', from: 900, q: 0.45 },
    wet: 0.7
  })
  return true
}
