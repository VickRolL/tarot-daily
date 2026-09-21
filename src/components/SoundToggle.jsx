import { useEffect, useState } from 'react'
import { muteAll, readSoundPref, setSoundOn, unlock, unmuteAll } from '../audio/sfx'
import { startAmbient, stopAmbient } from '../audio/ambient'

/**
 * 声音开关（2026-09-20 第二十二轮新增，第二十三轮起**同时管音效与环境音**，
 * 第三十一轮改成喇叭图标 + 默认开）
 * ==========================================================================
 * 位置在左上角「TAROT · 日签」下方，**不进顶栏** —— 顶栏右侧每多一个元素，
 * 居中标题的可用横向空档就少一截（标题与顶栏同处一条 y 带），
 * 而那条空档直接决定窄屏标题能开多大。这个按钮不配占那份预算。
 * （也不放右下角：解读面板是贴底 + z-index 50，会被盖住，实测命中测试为假。）
 *
 * ── 一个开关管全部，还是拆两个？──────────────────────────────────────
 *   拆两个（音效 / 背景音）在 UI 上更精细，但会多出「只开 BGM 不开音效」
 *   这种没人想要的组合。这一轮继续用**一个开关管全部**：
 *   开 = 环境音淡入 + 四个音效就位；关 = 环境音淡出 + 正在响的余韵掐掉。
 *   如果以后想拆，`ambient.js` 与 `sfx.js` 已经是两个独立模块，接口是分开的。
 *
 * ── 为什么是喇叭图标，不再是「声音开 / 声音关」（第三十一轮）──────────
 *   ① 这是个**状态控件**，不是一个句子。喇叭 + 声波 / 喇叭 + 叉是跨语言的符号；
 *      「声音开」三个字在 11px 下要读一遍才知道当前处于哪个状态。
 *   ② 去掉文字后按钮收成 32px 的圆，横向占用少一半 —— 它和品牌同一条竖线，
 *      宽度变化不会去挤标题带。
 *   ③ 代价：**必须补一个无障碍名字**。所以 `aria-label="声音"` 报「这个东西是什么」，
 *      `aria-pressed` 报「现在是开还是关」（图标本身 `aria-hidden`，不给读屏念两遍）。
 *
 * ── 默认开，但声音一定晚于第一次操作（第三十一轮）──────────────────
 *   意图的缺省值在 `engine.readSoundPref()`（缺键 = 开）；真正起播在
 *   `audio/autostart.js` 里等用户的第一次手势。所以「页面打开就有音乐」不是
 *   这里负责的事 —— 这个按钮只管**显式**的开与关。
 *
 * ── 无障碍 ───────────────────────────────────────────────────────────
 *   · 真 `<button>`，键盘 Enter/Space 原生可用；
 *   · `aria-pressed` 报开关状态（不靠图标让读屏去猜）；
 *   · 点击的调用栈里立刻 `unlock()` —— 浏览器只允许在用户手势里启动 AudioContext。
 */

/**
 * 喇叭本体：方箱 + 号角围成一个形状（`M11 5 6 9H2.6v6H6l5 4z`）。
 * 描边而非填充 —— 页面里其它图形元素（碑铭线、低语框）都是细线，
 * 一个实心黑喇叭在这个配色里会显得沉。
 */
const BODY = 'M11 5 6 9H2.6v6H6l5 4z'

function SpeakerIcon({ on }) {
  return (
    <svg
      className="sound__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={BODY} />
      {on ? (
        <>
          {/* 两道声波：内圈短、外圈长，节奏错开一点，看起来才是「扩散」 */}
          <path className="sound__wave" d="M15.4 8.6a4.9 4.9 0 0 1 0 6.8" />
          <path className="sound__wave sound__wave--outer" d="M18.6 5.4a9.4 9.4 0 0 1 0 13.2" />
        </>
      ) : (
        <>
          {/* 叉：完全让开号角（号角尖端在 x=11），两笔都是 45° */}
          <path d="M16.4 9.5 21.5 14.6" />
          <path d="M21.5 9.5 16.4 14.6" />
        </>
      )}
    </svg>
  )
}

export default function SoundToggle() {
  /* 只读「意图」，不建 AudioContext：初始 state 里建 ctx 不在手势栈里，
     Chrome 会告警并把它挂成 suspended。引擎留给第一次真实点击去建。 */
  const [on, setOn] = useState(readSoundPref)

  /**
   * 跟着 localStorage 的真实值走。
   *
   * 为什么需要：开发者版的调试条（`DevBar`）里点任意一个音会顺手把声音打开
   * （点音效 = 要听）。如果这里不跟着同步，就会出现**左上角显示「关」
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
      aria-label="声音"
      onClick={toggle}
      title={
        on
          ? '声音已开（环境音 + 抽牌音效）—— 点一下静音'
          : '声音已关 —— 点一下打开环境音与抽牌音效'
      }
    >
      <SpeakerIcon on={on} />
    </button>
  )
}
