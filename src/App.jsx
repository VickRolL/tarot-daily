import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { DEV_TOOLS, EASE, INITIAL_MODE, TIMING, WELCOME, drawBeats, ritual } from './config/skin'
import { ALL_CARD_IDS, CARD_BY_ID, pickRandomCard } from './data/cards'
import { readTodayRecord, useDrawState } from './hooks/useDrawState'
import { markCardWarmed, prefetchCards } from './utils/prefetch'
import HeroStage from './components/HeroStage'
import MistLayer from './components/MistLayer'
import ParticleField from './components/ParticleField'
import WhisperTags from './components/WhisperTags'
import CardReveal from './components/CardReveal'
import ReadingPanel from './components/ReadingPanel'
import ShareDialog from './components/ShareDialog'
import DevBar from './components/DevBar'
import CardGallery from './components/CardGallery'
import CardDetail from './components/CardDetail'
import SoundToggle from './components/SoundToggle'
import EnvelopeWelcome from './components/EnvelopeWelcome'
import * as sfx from './audio/sfx'
import * as ambient from './audio/ambient'

const todayLabel = (() => {
  const d = new Date()
  return `${d.getFullYear()} · ${String(d.getMonth() + 1).padStart(2, '0')} · ${String(d.getDate()).padStart(2, '0')}`
})()

/**
 * 这次进页面要不要播迎接动画（信封开启）。
 *
 * 在**首次渲染前**就要定下来，所以直接同步读 localStorage（readTodayRecord），
 * 不能等 useDrawState 的 effect —— 否则会先闪一下场景再盖上信封。
 * 不播的三种情况：配置关掉 / 用户要求减少动效 / 今天已经抽过牌了。
 * 开发者版例外：**每次都播**（见下），调试这段动画时反复刷新是常态。
 */
function shouldGreet() {
  if (!WELCOME.enabled) return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  /* 开发者版无视「今天已抽过」——
     调试迎接动画时要反复刷新，不该每次都先去清 localStorage 或点「重播迎接」。
     页面内的「重播迎接」按钮照常可用（它换 key 重挂信封，不动抽牌状态）。 */
  if (DEV_TOOLS) return true
  if (WELCOME.skipWhenDrawn && readTodayRecord()) return false
  return true
}

/** 场景正在播出场动画（此时牌面还没落位，标题先不出） */
const isEntering = (phase) => phase === 'entrance' || phase === 'welcome'

/**
 * 「页面静止着、还没开始抽」的相位。
 *
 * 只在这几种相位里才允许把「今天已抽到的牌」直接呈现出来（见下面的回访 effect）。
 * 2026-09-19 抽牌仪式分拍时补的守卫：`handleDraw` 一开头就会 `save()` 写记录
 * （中途关页也不丢今天的牌），而记录一变就会触发那个 effect ——
 * 结果仪式刚起步就被它 `setPhase('revealed')` 一刀砍掉，整条曲线根本没机会跑。
 * charging / drawing / revealed 都必须排除在外。
 */
const RESTING_PHASES = new Set(['welcome', 'entrance', 'idle'])

export default function App() {
  const [greet] = useState(shouldGreet)
  const [welcomeDone, setWelcomeDone] = useState(!greet)
  const [welcomeNonce, setWelcomeNonce] = useState(0)
  const [mode, setMode] = useState(INITIAL_MODE)
  const [phase, setPhase] = useState(greet ? 'welcome' : 'entrance')
  const [currentCard, setCurrentCard] = useState(null)
  const [entranceDone, setEntranceDone] = useState(false)
  /**
   * 图鉴与「完整解读」是**两层**，可以叠着。
   * 2026-09-20：图鉴从「仅开发环境」放开给用户（顶栏加了入口），
   * 所以再也不需要 DEV_TOOLS 守卫；卡牌详情独立成一层，从图鉴或解读面板都能进来，
   * 关掉详情就回到下面那层（图鉴还在），因此不需要「返回」按钮。
   */
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [detailCard, setDetailCard] = useState(null)
  const [shareCard, setShareCard] = useState(null)
  const timers = useRef([])

  const { record, canDraw, save, reset } = useDrawState(mode)
  const locked = mode === 'daily' && !canDraw
  /** 减少动效：入场只留淡入，去掉缩放/模糊/位移 */
  const reduced = useReducedMotion()
  /**
   * 抽牌仪式的绝对时刻表与分拍时长。
   * **所有与抽牌有关的时间只能从这里取** —— 组件各自算延迟正是「空面板挂 1.6 秒」的成因。
   * 传 reduced 进去，无障碍用户的计时器才会跟着压到近零（否则动画快、计时器慢，等于干等）。
   */
  const beats = useMemo(() => drawBeats(reduced), [reduced])
  const rite = useMemo(() => ritual(reduced), [reduced])

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  const pushTimer = (fn, ms) => {
    timers.current.push(setTimeout(fn, ms))
  }

  /**
   * 场景自身的入场与信封**并行**跑，不是串在它后面：
   * 信封是整块不透明的，场景在它背后照常把雾散开、把底板聚焦，
   * 等信封退场时场景已经就位。所以加了这个动画之后，
   * 抽牌变得可点击的时机和以前完全一样（TIMING.entrance）。
   */
  useEffect(() => {
    pushTimer(() => setPhase((p) => (isEntering(p) ? 'idle' : p)), TIMING.entrance)
    pushTimer(() => setEntranceDone(true), TIMING.entrance + 100)
    return clearTimers
  }, [clearTimers])

  /**
   * 首屏空闲预热：入场动画结束后才开始，随机预热几张牌面。
   * 22 张一共约 5 MB，不能在首页一次性下载，所以按「随机几件」而不是「前 N 张」。
   */
  useEffect(() => {
    if (!entranceDone) return
    prefetchCards(ALL_CARD_IDS)
  }, [entranceDone])

  /** 一天一次模式下，刷新页面后直接呈现今天已抽到的牌（等迎接动画收尾再呈现） */
  useEffect(() => {
    if (!welcomeDone) return
    if (mode !== 'daily' || !record) return
    /* ⚠️ 守卫：仪式进行中不许抢跑。抽牌一开始就 `save()` 落盘，记录一变这里就会触发，
       若不拦住就会在点击后第一帧直接跳到 revealed，把 7 拍仪式整个吃掉。 */
    if (!RESTING_PHASES.has(phase)) return
    const card = CARD_BY_ID[record.cardId]
    if (!card) return
    setCurrentCard(card)
    setPhase('revealed')
  }, [mode, record, welcomeDone, phase])

  const handleDraw = useCallback(() => {
    if (phase !== 'idle') return
    const b = beats
    const card = pickRandomCard()
    /* 立刻落盘：仪式再长也只有 5.6s，但用户完全可能在中途关页 ——
       先写记录，回来时这张牌就是今天的牌 */
    save(card.id)
    markCardWarmed(card.id)
    // 这一张已经渲染过了，顺手再补几张没下过的
    prefetchCards(ALL_CARD_IDS, 3)

    /* 声音（2026-09-20 第二十二轮接入，第二十三轮重做音效 + 加环境音）——
       ⚠️ 这一刻的调用栈**就是用户手指点水晶球的手势**，所以这里是唯一
       能让 AudioContext 合法启动的时机（浏览器不允许在非手势里起 ctx）。
       必须**无条件先 unlock**：reduced 路径下蓄势音与释放音都被跳过，
       只有揭示钵会响，而它是从 `panelAt` 的定时器里触发的 —— 那种调用栈
       早就脱离手势了，等那一刻才建 ctx 会被浏览器挂成 suspended（静默无声）。
       关掉声音的用户不建 ctx（`isSoundOn()` 为否），不浪费一个音频图。
       音效的时刻**全部取自同一张节拍表**，不额外写死毫秒数：
       蓄势音的长度 = chargeDone，翻牌音挂在 flipAt，揭示钵挂在 panelAt。

       ⚠️ 这里还要补一次 `startAmbient()`：用户可能上次开着声音、这次直接点球
       抽牌（全程没碰过开关），那条路径上环境音还没起来。
       BGM 同时**让位**（duck 到 35%）—— 接下来 5.6 秒是音效的主场，
       让两者一起响会互相糊住。牌落定后再慢慢把它托回来。 */
    if (sfx.isSoundOn()) {
      sfx.unlock()
      ambient.startAmbient()
      ambient.duckAmbient(true)
      pushTimer(() => ambient.duckAmbient(false), b.panelAt + 1400)
    }
    if (sfx.isSoundOn() && !reduced) sfx.charge(b.chargeDone)
    pushTimer(() => {
      if (!reduced) sfx.burst()
    }, b.chargeDone)
    pushTimer(() => {
      if (!reduced) sfx.flip()
    }, b.flipAt)

    /* ① 蓄势：球充能，**牌此时还不挂载** —— 这一段是期盼感的来源。
       所以 currentCard 的挂载推迟到 chargeDone，而不是和点击同一帧。 */
    setPhase('charging')
    pushTimer(() => {
      setCurrentCard(card)
      setPhase('drawing')
    }, b.chargeDone)
    pushTimer(() => {
      setPhase('revealed')
      /* 减少动效时整场仪式压到约 30ms，四个音会糊成一坨 ——
         只留揭晓那一声（它是信息性的，其余三个是氛围） */
      sfx.reveal()
    }, b.panelAt)
  }, [phase, save, beats, reduced])

  const handleAgain = useCallback(() => {
    clearTimers()
    setShareCard(null)
    if (mode === 'daily') reset()
    setCurrentCard(null)
    setPhase('idle')
  }, [mode, reset, clearTimers])

  const handleModeChange = useCallback(
    (next) => {
      clearTimers()
      setShareCard(null)
      setMode(next)
      setCurrentCard(null)
      setPhase('idle')
    },
    [clearTimers]
  )

  /**
   * 开发用：重播迎接动画。
   * 只把信封那一层重新挂载（换 key 强制重播），**不动 phase / 抽牌状态** ——
   * 这样可以在任意界面上反复调这段动画，而不用清掉今日记录。
   */
  const handleReplayWelcome = useCallback(() => {
    setWelcomeDone(false)
    setWelcomeNonce((n) => n + 1)
  }, [])

  const headlineSub = useMemo(() => {
    if (isEntering(phase)) return ''
    /* ①②③④⑤⑥⑦ 仪式期间副标题**退出** —— 一口气憋住才是期盼感，
       一边充能一边还在下面写着「静心片刻」只会把张力泄掉。
       （渲染处用 nbsp 占位，避免标题块高度变化导致标题往下跳。） */
    if (phase === 'charging' || phase === 'drawing') return ''
    /* ⚠️ 顺序很关键：`locked` 必须排在「已揭晓」之后判断。
       daily 模式下抽完牌 canDraw 即变 false → locked 恒为真，
       若把 locked 放最前面，刚抽出的那张牌永远配着「今日之牌已抽出」的副标题
       （实测过：副标题一直显示「明日再来」，而画面正展示着今天的牌）。 */
    if (phase === 'revealed') return '这张牌，是今天的答案'
    if (locked) return '今日之牌已抽出 · 明日再来'
    if (phase === 'idle') return '静心片刻，想着你此刻的疑问'
    return '静心片刻，想着你此刻的疑问'
  }, [locked, phase])

  return (
    <main
      className={`scene${phase === 'charging' ? ' scene--charging' : ''}${phase === 'drawing' ? ' scene--drawing' : ''}`}
      data-phase={phase}
    >
      <HeroStage
        entranceDone={entranceDone}
        onDraw={handleDraw}
        orbDisabled={phase !== 'idle' || locked}
        /* 蓄势时先让提示文字退场 —— 球自己在充能，这时候还在旁边喊「轻触水晶球」是干扰 */
        showOrbLabel={!locked && phase === 'idle'}
        charging={phase === 'charging'}
      />

      <div className="scene__vignette" aria-hidden="true" />
      {/* 蓄势用的压暗层：独立图层，不动已有的 .scene__vignette
          （它的 opacity 默认就是 1，没有加深的余地） */}
      <div className="scene__charge-dim" aria-hidden="true" />
      <div className="scene__grain" aria-hidden="true" />
      <MistLayer intense={phase === 'charging'} />
      <ParticleField converge={phase === 'charging' ? 1 : 0} />
      {/* 两侧低语：纯氛围层（aria-hidden），浓淡只看 phase —— 场景落定后浮现、
          碰球时压低、牌出来就退场。定位与文案都在 config/skin.js + data/whispers.js。 */}
      <WhisperTags phase={phase} />

      <header className="topbar">
        <span className="topbar__brand">TAROT · 日签</span>
        <span className="topbar__right">
          <button type="button" className="topbar__link" onClick={() => setGalleryOpen(true)}>
            牌之图鉴
          </button>
          <span className="topbar__date">{todayLabel}</span>
        </span>
      </header>

      {/* 音效开关：放右下角，**不进顶栏** —— 顶栏右侧每多一个字符，
          居中标题的可用横向空档就少一截（标题与顶栏同处一条 y 带）。 */}
      <SoundToggle />

      <motion.section
        className="headline"
        initial={{ opacity: 0, y: reduced ? 0 : -12 }}
        animate={{ opacity: isEntering(phase) ? 0 : 1, y: 0 }}
        transition={
          reduced
            ? { duration: 0.01, delay: 0 }
            : { duration: 1, delay: isEntering(phase) ? 0 : 0.2 }
        }
      >
        <h1 className="headline__title">今夜一签</h1>
        {/* 空副标题用 nbsp 占住那一行：.headline 是 bottom 锚定的，
            文字清空会让整块高度缩短、标题往下跳 ~23px（点击瞬间的抽搐） */}
        <p className="headline__sub">{headlineSub || '\u00a0'}</p>
        {/* 碑铭线（第二十三轮）：罗马碑刻的构成 —— 主铭文之下压一道短横线。
            做成**真实元素**而不是伪元素，理由是探针：伪元素没有
            `getBoundingClientRect()`，量不了位置，也就断言不了
            「它有没有越到卡牌上 / 有没有顶到顶栏」。而这条线正落在
            标题带与牌面之间那 38px 里，是必须能测的。 */}
        <span className="headline__rule" aria-hidden="true" />
      </motion.section>

      {phase === 'drawing' && (
        <>
          <motion.div
            className="flash"
            /* ② 释放：爆闪领跑，牌随后起飞。
               时机天然对齐 —— `drawing` 正好从 chargeDone 开始（牌挂载与爆闪同一帧），
               峰值落在 chargeDone + flash×0.18（约点击后 1094ms），成为牌起飞的助推。
               峰值位置从 0.26 收到 0.18：更短促、峰值更锐，读起来是「释放」不是「亮一下」。 */
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.95, 0] }}
            transition={{ duration: rite.flash / 1000, ease: 'easeOut', times: [0, 0.18, 1] }}
            aria-hidden="true"
          />
          {/* 冲击环：从球心荡开的一圈光，把「释放」的峰值做实（纯 CSS，无素材） */}
          <span className="draw-burst" aria-hidden="true" />
        </>
      )}

      {currentCard && <CardReveal card={currentCard} />}

      {phase === 'revealed' && currentCard && (
        <ReadingPanel
          card={currentCard}
          mode={mode}
          onAgain={handleAgain}
          onShare={() => setShareCard(currentCard)}
          onDetail={() => setDetailCard(currentCard)}
        />
      )}

      <AnimatePresence>
        {shareCard && <ShareDialog card={shareCard} onClose={() => setShareCard(null)} />}
      </AnimatePresence>

      {DEV_TOOLS && (
        <DevBar
          mode={mode}
          onModeChange={handleModeChange}
          onReset={handleAgain}
          hasRecord={!canDraw}
          onReplayWelcome={handleReplayWelcome}
          welcomeEnabled={WELCOME.enabled}
        />
      )}

      {/* 图鉴对所有用户开放（入口在顶栏）。它只负责「选」，阅读交给下面那层。 */}
      {galleryOpen && <CardGallery onClose={() => setGalleryOpen(false)} onPick={setDetailCard} />}

      {/* 完整解读：从图鉴点进来、或从解读面板的「完整解读」进来，都是这一层。
          叠在图鉴上面，关掉即回到图鉴，所以不需要返回按钮。 */}
      {detailCard && <CardDetail card={detailCard} onClose={() => setDetailCard(null)} />}

      {!entranceDone && (
        <motion.div
          className="veil"
          /* 编舞：雾**先**散（1.4s），场景在其后半程（0.55s 起）再推近落定。
             升级前 veil 与 plate 同时开跑、缓动同一条，观众只感到「画面亮了一下」；
             现在两条串行，才有「雾散开 → 场景显形」的因果。
             缩放幅度也从 1.25→1.02 收到 1.18→1.06：雾只是陪衬，主角落位交给 plate。 */
          initial={reduced ? { opacity: 1 } : { opacity: 1, scale: 1.18 }}
          animate={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.06 }}
          transition={{ duration: reduced ? 0.01 : TIMING.entranceVeil / 1000, ease: EASE.reveal }}
          aria-hidden="true"
        />
      )}

      {WELCOME.enabled && !welcomeDone && (
        <EnvelopeWelcome key={welcomeNonce} onDone={() => setWelcomeDone(true)} />
      )}
    </main>
  )
}
