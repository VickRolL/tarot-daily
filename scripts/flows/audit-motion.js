/**
 * 手感审计探针：把当前「入场 / 抽牌 / 翻牌 / 面板」四处动效的真实参数与几何量出来。
 * 只读，不改页面状态。跑法：
 *   "$N" scripts/shot.mjs http://127.0.0.1:5173/ out.png --eval-file scripts/flows/audit-motion.js
 *
 * 说明：shot.mjs 的 --wait 时钟基准不可靠，所以这里不依赖时间，
 * 只量「稳态几何」与「样式表里声明的时序」，避免测出一堆假数。
 */
const out = {}
{
  const px = (v) => Math.round(v * 10) / 10

  /** 递归收集所有样式规则的选择器（含 @media / @supports 内部）——
      只扫顶层会漏掉媒体查询里的规则，从而误报「没有反馈样式」。 */
  const allSelectors = () => {
    const acc = []
    const walk = (rules) => {
      for (const r of rules) {
        try {
          if (r.selectorText) acc.push(r.selectorText)
          if (r.cssRules) walk(r.cssRules)
        } catch {}
      }
    }
    for (const s of document.styleSheets) {
      try { walk(s.cssRules) } catch {}
    }
    return acc
  }

  /** 取所有「选择器满足 pred」的规则的声明文本，用于核对具体数值有没有写对 */
  const ruleBodies = (pred) => {
    const acc = []
    const walk = (rules) => {
      for (const r of rules) {
        try {
          if (r.selectorText && pred(r.selectorText)) acc.push(`${r.selectorText} { ${r.style.cssText} }`)
          if (r.cssRules) walk(r.cssRules)
        } catch {}
      }
    }
    for (const s of document.styleSheets) {
      try { walk(s.cssRules) } catch {}
    }
    return acc
  }

  const rect = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) }
  }
  const cs = (el, props) => {
    if (!el) return null
    const s = getComputedStyle(el)
    const o = {}
    props.forEach((p) => (o[p] = s.getPropertyValue(p)))
    return o
  }

  out.viewport = [innerWidth, innerHeight]

  /* ---------- 1. 入场：.veil 与 .hero-plate ---------- */
  const veil = document.querySelector('.veil')
  const plate = document.querySelector('.hero-plate')
  out.entrance = {
    veilPresent: !!veil,
    platePresent: !!plate,
    plateIdle: plate?.classList.contains('hero-plate--idle') ?? null,
    plateRect: rect(plate),
    plateAnim: cs(plate, ['animation-name', 'animation-duration', 'transform']),
    // 底板是否还在跑呼吸（定格后应该是 bgBreath）
    frameRect: rect(document.querySelector('.hero-frame'))
  }

  /* ---------- 2. 水晶球：位置 / 可点击性 / 邀请 ---------- */
  const orb = document.querySelector('.orb')
  out.orb = {
    found: !!orb,
    rect: rect(orb),
    disabled: orb?.disabled ?? null,
    label: document.querySelector('.orb__label')?.textContent?.trim() ?? null,
    // 有没有 hover / active / focus-visible 的反馈样式（邀请感）
    // ⚠️ 两个坑：① 规则写在 `@media (hover:hover)` 里，只扫顶层会漏；
    //          ② 选择器是 `.orb:not(:disabled):hover`，用 `.orb:hover` 做子串匹配会漏。
    // 所以改成「选择器里同时出现 .orb 与该伪类」的结构判断。
    hasHoverRule: allSelectors().some((s) => s.includes('.orb') && s.includes(':hover')),
    hasActiveRule: allSelectors().some((s) => s.includes('.orb') && s.includes(':active')),
    hasFocusRule: allSelectors().some((s) => s.includes('.orb') && s.includes(':focus')),
    /** :active 那条规则的实际声明（用来确认「按下立刻缩」真的写上了） */
    activeRuleBody: ruleBodies((s) => s.includes('.orb') && s.includes(':active')),
    /** 媒体查询里的那段到底命中了没（用真实匹配判断，比翻规则更可信） */
    matchesHoverMQ: matchMedia('(hover: hover) and (pointer: fine)').matches,
    // 球心占视口百分比（与 sketch 里的锚点换算对齐）
    centerPct: orb
      ? [px((orb.getBoundingClientRect().x + orb.getBoundingClientRect().width / 2) / innerWidth * 100),
         px((orb.getBoundingClientRect().y + orb.getBoundingClientRect().height / 2) / innerHeight * 100)]
      : null
  }

  /* ---------- 3. 牌：落点 / 尺寸 / 视口占比 ---------- */
  const stageAnchor = document.querySelector('.stage__anchor')
  const card = document.querySelector('.card')
  out.card = {
    stageAnchorRect: rect(stageAnchor),
    rect: rect(card),
    // 卡牌高度占视口百分比（决定它是不是「主角」）
    heightPctVh: card ? px(card.getBoundingClientRect().height / innerHeight * 100) : null,
    cssHeight: cs(card, ['height']),
    // 牌面是否已揭开（rotateY 稳态）
    flipTransform: cs(document.querySelector('.card__flip'), ['transform'])
  }

  /* ---------- 4. 面板：上滑后的稳态几何 ---------- */
  const panel = document.querySelector('.panel')
  out.panel = {
    present: !!panel,
    rect: rect(panel),
    heightPctVh: panel ? px(panel.getBoundingClientRect().height / innerHeight * 100) : null,
    style: cs(panel, ['transform', 'opacity', 'padding', 'backdrop-filter'])
  }

  /* ---------- 5. 样式表里声明的时序（真值，不受测量时机影响） ---------- */
  const decl = {}
  const grab = (sel, props) => {
    for (const s of document.styleSheets) {
      try {
        for (const r of s.cssRules) {
          if (r.selectorText === sel && r.style) {
            props.forEach((p) => { if (r.style.getPropertyValue(p)) decl[sel + '|' + p] = r.style.getPropertyValue(p) })
          }
          // 媒体查询里的也抓
          if (r.cssRules) {
            for (const rr of r.cssRules) {
              if (rr.selectorText === sel && rr.style) {
                props.forEach((p) => { if (rr.style.getPropertyValue(p)) decl[sel + '|' + p] = '[mq] ' + rr.style.getPropertyValue(p) })
              }
            }
          }
        }
      } catch {}
    }
  }
  grab('.orb__glow', ['animation'])
  grab('.orb__ring', ['animation'])
  grab('.orb__label', ['animation'])
  grab('.hero-plate--idle', ['animation'])
  grab('.panel', ['padding', 'backdrop-filter'])
  out.declaredAnimations = decl

  /* ---------- 6. 关键帧清单（有没有用 transform-only、有没有开 filter） ---------- */
  out.keyframes = [...document.styleSheets].flatMap((s) => {
    try {
      return [...s.cssRules].filter((r) => r.type === CSSRule.KEYFRAMES_RULE).map((r) => r.name)
    } catch { return [] }
  })

  /* ---------- 7. 节流后的动效总开关 ---------- */
  out.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

  /* ---------- 8. 3D 透视链：翻牌必需（P0）----------
     没有 perspective 的 rotateY 是正交投影，180° 会读成「横向压扁再张开」。
     .stage 只在抽牌/揭晓阶段挂载，所以直接从样式表里读声明更稳。 */
  {
    const stagePerspectiveRules = ruleBodies((sel) => sel.trim() === '.stage')
    const stage = document.querySelector('.stage')
    const chain = []
    if (stage) {
      let el = document.querySelector('.card')
      while (el && el !== document.documentElement) {
        const p = getComputedStyle(el).perspective
        if (p && p !== 'none') chain.push({ sel: el.className || el.tagName, perspective: p })
        el = el.parentElement
      }
    }
    out.perspective = {
      /** 样式表里是否有 .stage perspective 声明 */
      declared: stagePerspectiveRules.length > 0,
      declaredValues: stagePerspectiveRules,
      /** 实际运行中 .card 祖先链上非 none 的 perspective */
      ancestors: chain,
      ok: stagePerspectiveRules.length > 0
    }
  }

  /* ---------- 9. 新增 keyframes 有没有动布局属性（性能红线）----------
     动画只能动 transform / opacity；出现 top/left/width/height 就是掉帧源。 */
  {
    const bad = []
    const walkKF = (rules) => {
      for (const r of rules) {
        try {
          if (r.type === CSSRule.KEYFRAMES_RULE) {
            for (const k of r.cssRules) {
              ;['top', 'left', 'right', 'bottom', 'width', 'height', 'margin', 'padding'].forEach((p) => {
                if (k.style?.getPropertyValue(p)) bad.push(`${r.name}@${k.keyText}:${p}`)
              })
            }
          }
          if (r.cssRules) walkKF(r.cssRules)
        } catch {}
      }
    }
    for (const s of document.styleSheets) {
      try { walkKF(s.cssRules) } catch {}
    }
    out.layoutAnimatingKeyframes = bad
  }
}

return out
