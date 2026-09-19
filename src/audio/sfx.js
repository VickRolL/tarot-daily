/**
 * 音效（2026-09-20 第二十三轮 · 全部重新设计）
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
 * ── 四个音现在的配方 ────────────────────────────────────────────────
 *   ① charge 「屏息」  55 / 55.35Hz 双失谐 drone（**不扫频**）+ 两层气声缓慢拱起
 *                     靠**音量拱形**表达积蓄，不靠升调 —— 升调就是加速
 *   ② burst  「雾散」  高通气声 + 低频气层 + 一声极轻的低音底座
 *                     完全没有 200Hz 以下的瞬态；整段没有一个陡沿
 *   ③ flip   「丝绢」  两层带通噪声错开 28ms + 一层起绒高频；**零振荡器**
 *                     attack 从 3ms 放宽到 16ms —— 5ms 内到峰值一律被听成「敲」
 *   ④ reveal 「颂钵」  196Hz 基音 + 失谐副基音 + 钟形非谐泛音(2.76/5.40/8.93)
 *                     attack 放宽到 180ms，余韵 6s —— 是「嗡起来」不是「叮一下」
 */

import { air, audio, isSoundOn, tone } from './engine'

/* ⚠️ 转发导出必须显式写出每个名字，而且**只能走 `export ... from`**。
   踩过一次：先在 `import` 里漏了 `muteAll`、却在 `export { muteAll }` 里写了它，
   浏览器直接抛 `Export 'muteAll' is not defined in module` —— 而且是**求值期**抛，
   表现是整站白屏、控制台只有这一条，不看就完全猜不到。
   `export ... from` 不创建局部绑定，所以和上面那个 `import` 同名也不会冲突。 */
export { isSoundOn, muteAll, readSoundPref, setSoundOn, unlock, unmuteAll } from './engine'

/* ---------------------------------------------------------------- 四个音 */

/**
 * ① 蓄势「屏息」—— 对应「点击 → 牌还没出来」那一段（长度 = 节拍表的 chargeDone）。
 *
 * 用户说上一版「像汽车加速」。根因是两条**上行扫频**：96→148Hz 的主音、
 * 193→291Hz 的陪音，再叠一个低通 260→900Hz 的开口 —— 这一整套正好是
 * 引擎从怠速拉转速的声音画像。
 *
 * 现在改成**频率一个都不动**：
 *   · 两个只差 0.35Hz 的低音（55 / 55.35）叠出**缓慢拍频**（约 0.35 次/秒），
 *     听感是「隐隐地起伏」，这是「活着、在攒劲」的来源 —— 比扫频高级得多；
 *   · 两层气声（中频 480Hz / 高频 6.5kHz）从几乎听不见慢慢浮上来，
 *     像是**有人在远处吸气**；
 *   · 全程只有音量在动，没有音高在动。所以它不会再被读成任何机器。
 *
 * 长度直接取节拍表的 `chargeDone`：改动画时长，音效自动跟着对齐。
 */
export function charge(durMs = 1000) {
  if (!isSoundOn()) return false
  const c = audio()
  if (!c || durMs < 200) return false
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
