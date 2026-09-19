import { useState } from 'react'
import { readSoundPref, setSoundOn, unlock } from '../audio/sfx'

/**
 * 音效开关（2026-09-20 第二十二轮）
 * ==========================================================================
 * 放在**右下角**而不是顶栏，理由是几何：顶栏右侧已经挤了「牌之图鉴 + 日期」，
 * 再塞一个按钮会把右侧那组的左边缘继续往中间推，而标题居中、又和顶栏同处一条
 * y 带（视口一矮必然重叠）—— 那条横向空档就是标题字号的上限。
 * 换句话说，**顶栏里每多一个字符，标题就得小一点**。这个按钮不配。
 *
 * 无障碍：
 *   · 真 `<button>`，键盘 Enter/Space 原生可用；
 *   · `aria-pressed` 报开关状态（不靠文案里的「开/关」让读屏去猜）；
 *   · 点击的调用栈里立刻 `unlock()` —— 浏览器只允许在用户手势里启动 AudioContext。
 */
export default function SoundToggle() {
  /* 只读「意图」，不建 AudioContext：初始 state 里建 ctx 不在手势栈里，
     Chrome 会告警并把它挂成 suspended。引擎留给第一次真实点击去建。 */
  const [on, setOn] = useState(readSoundPref)

  const toggle = () => {
    const next = !on
    /* 顺序要紧：先在这个点击手势里把引擎叫醒，再改状态 */
    if (next) unlock()
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
      title={on ? '音效已开 —— 点一下关闭' : '音效默认关闭（不打招呼就出声不礼貌）—— 点一下打开'}
    >
      <span className="sound__dot" aria-hidden="true" />
      <span className="sound__label">音效{on ? '开' : '关'}</span>
    </button>
  )
}
