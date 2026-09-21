/**
 * 「默认开」的落地方式：在第一次用户手势里把音乐带起来
 * ==========================================================================
 * 2026-09-21 第三十一轮。用户的要求：「给用户使用的版本默认要打开音乐」。
 *
 * ── 为什么不能真的「自动播放」──────────────────────────────────────────
 *   浏览器的自动播放策略：`AudioContext` 若在**非用户手势**的调用栈里创建/恢复，
 *   会被挂成 `suspended` —— 不报错、不抛异常、控制台干干净净，只是永远哑着。
 *   所以「页面一打开就出声」在 Web 上做不到。能做到、也确实该做的是：
 *   **用户的第一次操作就当作「打开音乐」的那一次** —— 他不需要先找到那个喇叭。
 *   于是这里的判据不是「页面加载时有没有声音」（那个做不到），
 *   而是「**第一次手势之后有没有声音**」。
 *
 * ── 与开关的关系 ────────────────────────────────────────────────────────
 *   · 意图为开（键缺省，或用户开过）→ 第一次手势 unlock + 起 BGM + 解除静音；
 *   · 用户**明确关过**（存了 'off'）→ 就地收摊、不再监听。
 *     「关」是一个显式决定，自动播放不能自作主张把它顶掉；
 *   · 手势落在喇叭按钮自己身上 → 跳过，交给开关去 toggle。
 *     不然「默认开 + 用户第一次点的就是开关想关掉」会先起一遍再关：
 *     听是听不见（BGM 淡入要 3.5s），但白建一个音频图。
 *
 * ── 为什么三种事件都听 ──────────────────────────────────────────────────
 *   `pointerdown` —— 鼠标 / 触摸 / 笔的按下，最常见的那一种；
 *   `keydown`     —— 键盘用户（Tab 能到按钮，但打不开声音，得先有一次按键）；
 *   `click`       —— **读屏软件「激活」按钮时只派发 click，没有 pointerdown**；
 *                    移动端某些输入法与辅助设备同理。
 *   三种会互相重叠（一次鼠标点击会先 pointerdown 再 click），所以处理函数必须幂等 ——
 *   `unlock()` 与 `startAmbient()` 都是幂等的，重复调用没有代价。
 *
 * ── 什么时候才肯「收工」─────────────────────────────────────────────────
 *   只有 `unlock()` 返回真（ctx 确实 running）才停掉监听。
 *   认不出这次激活（个别 WebView / 浏览器策略）时留着监听等下一条手势 ——
 *   比「以为开好了、其实一直哑着」诚实。
 */

import { isSoundOn, peekAudioContext, readSoundPref, setSoundOn, unmuteAll, unlock } from './engine'
import { startAmbient } from './ambient'

const EVENTS = ['pointerdown', 'keydown', 'click']

let armed = false
let settled = false
let detach = null

/** 手势是不是落在喇叭按钮上（含它内部的图标） */
function insideToggle(target) {
  return !!(target && typeof target.closest === 'function' && target.closest('.sound'))
}

/**
 * 装上「首次手势起播」。返回卸载函数（组件卸载 / HMR 用得上）。
 * 幂等：重复调用只有第一次生效。
 */
export function armSoundAutostart() {
  if (armed || typeof window === 'undefined') return () => {}
  armed = true

  const stopListening = () => {
    if (!detach) return
    detach()
    detach = null
  }

  const onGesture = (ev) => {
    if (settled) return stopListening()
    /* 开关自己那一击有它自己的开/关语义，别抢 */
    if (insideToggle(ev.target)) return

    if (!readSoundPref()) {
      /* 用户明确关过：收工，此后任何手势都不该把声音顶开 */
      settled = true
      return stopListening()
    }

    /* 意图是开。顺序与 SoundToggle 一致：先在这个手势里叫醒引擎，再起环境音。
       先解静音是因为「上次开着、这次直接点球」的路径上，总线可能还挂在 mute 之后的样子。 */
    const ok = unlock()
    if (!isSoundOn()) setSoundOn(true)
    unmuteAll()
    startAmbient()

    if (ok) {
      settled = true
      stopListening()
    }
  }

  /* 捕获阶段：抢在页面自己的处理器（React 挂在根容器上）之前，
     这样同一手势里后续的 handleDraw 读到的 `isSoundOn()` 已经是真。 */
  EVENTS.forEach((t) => window.addEventListener(t, onGesture, true))
  detach = () => EVENTS.forEach((t) => window.removeEventListener(t, onGesture, true))

  return () => {
    settled = true
    stopListening()
  }
}

/** 探针用：是否还在等第一次手势（已收工 = false） */
export const isAutostartArmed = () => armed && !settled

/* 无头探针进不了模块内部，把状态挂到 window 上（只读，与 `__tarotSfx` 同一套路）。
   ⚠️ `ctxState` 走的是 `peekAudioContext()` —— **只读、不会建 ctx**。
      用 `audio()` 的话，「查一下状态」这个动作本身就会在非手势里建出一个
      suspended 的 ctx，把「默认开但尚未出声」这个可测的事实破坏掉。 */
if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__tarotSound', {
    configurable: true,
    get: () => ({
      armed: armed && !settled,
      pref: readSoundPref(),
      engineOn: isSoundOn(),
      ctxState: peekAudioContext()?.state ?? null
    })
  })
}
