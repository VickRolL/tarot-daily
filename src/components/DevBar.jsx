import { useCallback, useEffect, useRef, useState } from 'react'
import { DRAW_BEATS, DRAW_MODE, INITIAL_MODE, STORAGE_KEY } from '../config/skin'
import * as sfx from '../audio/sfx'

/**
 * 开发调试条：切换抽牌模式、重置今日记录、重播迎接动画、**逐个试听四个音**。
 *
 * ⚠️ 2026-09-20：「牌面总览」按钮**已移除**。图鉴这一轮放开给用户了（入口在顶栏
 * 「牌之图鉴」），两边打开的是同一个覆盖层，留着就是两个入口做同一件事。
 * 素材核对的活本来就该交给脚本（`contact_sheet.py`），不该占调试条一格。
 *
 * 只在 `DEV_TOOLS` 为真时渲染（本地开发 + 开发者版构建），正式产物里整块被摇掉。
 * 打开页面默认模式是 `INITIAL_MODE`：开发者版 = 不限次数，正式版 = 一天一次。
 *
 * ⚠️ 布局是**竖排定宽的窄条**（`.devbar` 里写了原因）：它和解读面板的动作行都贴底，
 * 横排时长条会**盖住「再抽一次」**，鼠标点不到。所以这里不要改回横排，
 * 也不要把长文案（存储键名之类）放回可见文本 —— 那会把宽度重新撑开。
 * 长信息走 `title` 悬停提示。
 *
 * ── 音效调试区（2026-09-20 增）─────────────────────────────────────────
 *   为什么要有：四个音在正式站点里**只能随抽牌仪式出现一次**，而且间隔 3.7s，
 *   想反复听某一拍就得反复走完整场抽牌 —— 检查音效这件事因此一直很贵。
 *   这里把它降成一次点击。
 *
 *   三个不可省的细节，缺一个就会**听到错误的结论**：
 *     · **必须等素材就绪再播**。`sfx.js` 的素材是逐音异步 fetch+decode 的，
 *       点下去就播会落回合成路 —— 于是「你以为在检查 AI 素材，其实在听合成音」。
 *       所以每次播放前先 await 该音进入 `loaded`。
 *     · **预热要抢在第一次播放之前**。监听页面上的第一次 `pointerdown` 就把引擎
 *       叫醒（`unlock()` 会在手势栈里派发 `tarot:audio-ready` → 预载开始），
 *       否则第一次点击要现等一整轮解码。
 *     · **A/B 必须在同一条链路上**。素材路与合成路共用同一个 ctx / 总线 / 混响，
 *       切一下只换音源 —— 分两个页面各听一遍不算对比，差异说不清是素材的还是链路的。
 *
 *   开关策略：点这里的任何一个音 = 用户要听，所以顺手把声音开关打开（音效标志位
 *   与总线取消静音），但**不启环境音** —— 底下垫一层 BGM 只会让判断更难做。
 *   左上角那个开关的状态由 `tarot:sound-changed` 事件同步，不会显示成「声音关」
 *   而实际在响。
 */
export default function DevBar({
  mode,
  onModeChange,
  onReset,
  hasRecord,
  onReplayWelcome,
  welcomeEnabled
}) {
  /* ── 音效调试区 ────────────────────────────────────────────── */

  /** 四个音的合同名，顺序与 `audio-src/README.md`、抽牌四拍一致 */
  const NAMES = ['charge', 'burst', 'flip', 'reveal']
  const SHORT = { charge: '屏息', burst: '雾散', flip: '丝绢', reveal: '颂钵' }
  const KIND = { asset: '素材', synth: '合成' }

  /** 预载进度。sfx 是**逐音**解码的，没有「全部就绪」事件，只能轮询 */
  const [assets, setAssets] = useState({ loaded: 0, total: 0 })
  /** 最近一次播放的音与它实际走的路 */
  const [note, setNote] = useState('')
  const [looping, setLooping] = useState(false)
  const [forceSynth, setForceSynth] = useState(false)

  const timers = useRef([])
  /* 循环标志放 ref：连播的排期回调是闭包，读 state 会读到排期那一刻的旧值 */
  const loopRef = useRef(false)
  loopRef.current = looping

  /* 预热：页面上的第一次手势把引擎叫醒 → sfx 监听 audio-ready 开始预载。
     `capture` 是为了抢在 React 的 onClick 之前跑，让下面那次 await 尽量短。 */
  useEffect(() => {
    const warm = () => sfx.unlock()
    window.addEventListener('pointerdown', warm, { once: true, capture: true })
    return () => window.removeEventListener('pointerdown', warm, { capture: true })
  }, [])

  /* 轮询预载进度。只在数字真的变了才 setState，否则每 400ms 白渲染一次 */
  useEffect(() => {
    const id = setInterval(() => {
      const s = window.__tarotSfx
      if (!s) return
      const loaded = s.loaded.length
      const total = s.assets.length
      setAssets((p) => (p.loaded === loaded && p.total === total ? p : { loaded, total }))
      if (total > 0 && loaded >= total) clearInterval(id)
    }, 400)
    return () => clearInterval(id)
  }, [])

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])
  useEffect(() => clearTimers, [clearTimers])

  /** 手势里叫醒引擎。开关关着就顺手打开 —— 点这里就是「要听」 */
  const ensureAudio = () => {
    sfx.unlock()
    if (!sfx.isSoundOn()) {
      sfx.setSoundOn(true)
      sfx.unmuteAll()
      /* 不启环境音（见文件头）。但必须通知左上角那个开关，
         否则它显示「声音关」而音效实际在响 —— 两个控件说两套话。 */
      window.dispatchEvent(new CustomEvent('tarot:sound-changed', { detail: { on: true } }))
    }
  }

  /** 等这批音解码完成。超时也放行（走合成）—— 宁可响一个合成音，也不要点了没反应 */
  const waitReady = (names, timeoutMs = 2500) =>
    new Promise((resolve) => {
      const t0 = performance.now()
      const tick = () => {
        const s = window.__tarotSfx
        if (s && names.every((n) => s.loaded.includes(n))) return resolve(true)
        if (performance.now() - t0 > timeoutMs) return resolve(false)
        setTimeout(tick, 60)
      }
      tick()
    })

  const markKind = (name) => setNote(`${SHORT[name]} · ${KIND[sfx.sfxSourceKind()[name]] || '未响'}`)

  const playOne = async (name) => {
    ensureAudio()
    setNote('载入…')
    await waitReady([name])
    sfx[name]?.()
    markKind(name)
  }

  /** 连播四拍：时刻直接取 `DRAW_BEATS`（与抽牌仪式同一张表，不手写数字） */
  const playSeq = async () => {
    clearTimers()
    ensureAudio()
    setNote('载入…')
    await waitReady(NAMES)
    const beats = [
      [0, 'charge'],
      [DRAW_BEATS.chargeDone, 'burst'],
      [DRAW_BEATS.flipAt, 'flip'],
      [DRAW_BEATS.panelAt, 'reveal']
    ]
    beats.forEach(([at, n]) => {
      timers.current.push(
        setTimeout(() => {
          sfx[n]?.()
          markKind(n)
        }, at)
      )
    })
    /* 一轮 = 最后一拍 + reveal 的余韵，再隔 1s 重来 */
    timers.current.push(
      setTimeout(() => {
        if (loopRef.current) playSeq()
        else setNote('')
      }, DRAW_BEATS.panelAt + 4200 + 1000)
    )
  }

  const setMode = (on) => {
    sfx.setForceSynth(on)
    setForceSynth(on)
    setNote('')
  }

  /* 悬停看每个音的实测值（解码后，即页面真正拿到的那一份）—— 塞不进 92px 的条里 */
  const statsTitle = (() => {
    const s = typeof window !== 'undefined' ? window.__tarotSfx : null
    if (!s) return ''
    return NAMES.map((n) => {
      const m = s.stats[n]
      return m ? `${n} ${m.dur}s / RMS ${m.rmsDb}dB / 峰 ${m.peakDb}dB` : `${n} 未就绪`
    }).join('\n')
  })()

  return (
    <div className="devbar" title={`初始模式 ${INITIAL_MODE} · 正式版默认 ${DRAW_MODE} · 存储键 ${STORAGE_KEY}`}>
      <span className="devbar__cap">抽牌模式</span>
      <button type="button" data-active={mode === 'unlimited'} onClick={() => onModeChange('unlimited')}>
        不限次数
      </button>
      <button type="button" data-active={mode === 'daily'} onClick={() => onModeChange('daily')}>
        一天一次
      </button>
      <button type="button" onClick={onReset} disabled={!hasRecord}>
        重置今日
      </button>
      <button type="button" onClick={onReplayWelcome} disabled={!welcomeEnabled}>
        重播迎接
      </button>
      <span className="devbar__cap">初始 {INITIAL_MODE}</span>

      <span className="devbar__cap devbar__cap--sep">音效</span>
      <span className="devbar__cap" title={statsTitle}>
        {assets.total ? `素材 ${assets.loaded}/${assets.total}` : '素材 —'}
      </span>
      <div className="devbar__grid">
        {NAMES.map((n) => (
          <button key={n} type="button" onClick={() => playOne(n)} title={`单独试听 ${n}`}>
            {SHORT[n]}
          </button>
        ))}
      </div>
      <button type="button" onClick={playSeq} title="按抽牌仪式的真实间隔连播四拍">
        连播四拍
      </button>
      <button
        type="button"
        data-active={looping}
        onClick={() => setLooping((v) => !v)}
        title="连播完后自动重来，反复检查用"
      >
        循环
      </button>
      <div className="devbar__grid" title="A/B：素材路与合成路共用同一条总线，切换只换音源">
        <button type="button" data-active={!forceSynth} onClick={() => setMode(false)}>
          素材
        </button>
        <button type="button" data-active={forceSynth} onClick={() => setMode(true)}>
          合成
        </button>
      </div>
      <span className="devbar__cap" title={note}>
        {note || '点一个音试听'}
      </span>
    </div>
  )
}
