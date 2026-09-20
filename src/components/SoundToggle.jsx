import { useEffect, useState } from 'react'
import { muteAll, readSoundPref, setSoundOn, unlock, unmuteAll } from '../audio/sfx'
import { startAmbient, stopAmbient } from '../audio/ambient'

/**
 * 声音开关（2026-09-20 第二十二轮新增，第二十三轮起**同时管音效与环境音**）
 * ==========================================================================
 * 位置在左上角「TAROT · 日签」下方，**不进顶栏** —— 顶栏右侧每多一个元素，
 * 居中标题的可用横向空档就少一截（标题与顶栏同处一条 y 带），
 * 而那条空档直接决定窄屏标题能开多大。这个按钮不配占那份预算。
 * （也不放右下角：解读面板是贴底 + z-index 50，会被盖住，实测命中测试为假。）
 *
 * ── 一个开关管全部，还是拆两个？──────────────────────────────────────
 *   拆两个（音效 / 背景音）在 UI 上更精细，但会多出「只开 BGM 不开音效」
 *   这种没人想要的组合。这一轮先用**一个开关管全部**：
 *   开 = 环境音淡入 + 四个音效就位；关 = 环境音淡出 + 正在响的余韵掐掉。
 *   如果以后想拆，`ambient.js` 与 `sfx.js` 已经是两个独立模块，接口是分开的。
 *
 * ── 无障碍 ───────────────────────────────────────────────────────────
 *   · 真 `<button>`，键盘 Enter/Space 原生可用；
 *   · `aria-pressed` 报开关状态（不靠文案里的「开/关」让读屏去猜）；
 *   · 点击的调用栈里立刻 `unlock()` —— 浏览器只允许在用户手势里启动 AudioContext。
 */
export default function SoundToggle() {
  /* 只读「意图」，不建 AudioContext：初始 state 里建 ctx 不在手势栈里，
     Chrome 会告警并把它挂成 suspended。引擎留给第一次真实点击去建。 */
  const [on, setOn] = useState(readSoundPref)

  /**
   * 跟着 localStorage 的真实值走。
   *
   * 为什么需要：开发者版的调试条（`DevBar`）里点任意一个音会顺手把声音打开
   * （点音效 = 要听）。如果这里不跟着同步，就会出现**左上角显示「声音关」
   * 而音效确实在响** —— 两个控件各说一套，比不显示还糟。
   * 正式产物里 DevBar 整块被摇掉，这个监听是个空转的订阅，没有代价。
   */
  useEffect(() => {
    const sync = () => setOn(readSoundPref())
    window.addEventListener('tarot:sound-changed', sync)
    return () => window.removeEventListener('tarot:sound-changed', sync)
  }, [])

  const toggle = () => {
    const next = !on
    if (next) {
      /* 顺序要紧：先在这个点击手势里把引擎叫醒、把环境音起起来，再改状态 */
      unlock()
      unmuteAll()
      startAmbient()
    } else {
      /* 环境音淡出（1.8s），总线同时收掉 —— 后者是给「正在响的余韵」的：
         揭示钵的尾巴有 6 秒，用户按下开关时它多半还在响。 */
      stopAmbient()
      muteAll(240)
    }
    setSoundOn(next)
    setOn(next)
  }

  return (
    <button
      type="button"
      className="sound"
      data-on={on ? 'true' : 'false'}
      aria-pressed={on}
      onClick={toggle}
      title={
        on
          ? '声音已开（环境音 + 抽牌音效）—— 点一下关闭'
          : '默认静音（不打招呼就出声不礼貌）—— 点一下打开环境音与抽牌音效'
      }
    >
      <span className="sound__dot" aria-hidden="true" />
      <span className="sound__label">声音{on ? '开' : '关'}</span>
    </button>
  )
}
