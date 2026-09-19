/**
 * 分享卡片图（Canvas 出图）
 * ---------------------------------------------------------------
 * 用户抽完牌后生成一张 1080×1920 的竖版长图（牌面 + 牌名 + 牌意 + 站点水印），
 * 直接用于保存 / 发朋友圈。
 *
 * 牌面部分严格复刻站内的三层结构，所以分享图里看到的牌和屏幕上完全一致：
 *   ① 插画层：按「卡片本体」裁剪（对应 CSS 的 clip-path: inset(--body-*)）
 *   ② 卡框层：与插画同框 1:1 铺满，22 张共用同一张素材
 *   ③ 文字层：罗马数字与牌名由代码绘制，不依赖任何 AI 出图
 *
 * 所有几何量都从 src/config/skin.js 读取，卡框一改这里自动跟着走。
 * 图片同源（都在 /skins/ 下），不会污染 canvas。
 */
import {
  ASSETS,
  CARD_ASPECT_VALUE,
  CARD_BODY_CLIP_VALUE,
  FRAME_INSET_VALUE
} from '../config/skin'

export const SHARE_SIZE = { width: 1080, height: 1920 }

const COLOR = {
  ink: '#08050f',
  ink2: '#150c2b',
  glow: '#c9b4ff',
  gold: '#e8c98a',
  text: '#efe9ff',
  faint: 'rgba(239,233,255,0.34)',
  body: 'rgba(239,233,255,0.86)',
  line: 'rgba(201,180,255,0.18)'
}

const FONT_DISPLAY = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif'
const FONT_BODY = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'

/** 站点水印文案 */
const SITE = { brand: 'TAROT · 日签', title: '今夜一签', slogan: '静心片刻，抽一张今天的牌' }

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** 按顺序试候选地址，返回第一张能加载的图（和站内的多格式回退一致） */
async function loadFirst(sources) {
  for (const src of sources) {
    const img = await loadImage(src)
    if (img) return img
  }
  return null
}

/** 逐字测宽换行（中英混排都能用） */
function wrapText(ctx, text, maxWidth) {
  const lines = []
  let line = ''
  for (const char of text) {
    const next = line + char
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = char
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 居中绘制一行带字距的文本，可选同色描边（提升浅色插画上的可读性） */
function drawCentered(ctx, text, cx, baseline, { spacing = '0', size = 0, stroke = 0, strokeColor = 'rgba(14,9,24,0.92)' } = {}) {
  const prevSpacing = ctx.letterSpacing
  const prevAlign = ctx.textAlign
  try {
    ctx.letterSpacing = spacing
  } catch {
    /* 老浏览器不支持字距，忽略即可 */
  }
  ctx.textAlign = 'center'
  if (stroke > 0) {
    // 先描边后填充：对应站内 CSS 的 paint-order: stroke fill
    ctx.lineWidth = stroke
    ctx.strokeStyle = strokeColor
    ctx.strokeText(text, cx, baseline)
  }
  ctx.fillText(text, cx, baseline)
  ctx.textAlign = prevAlign
  try {
    ctx.letterSpacing = prevSpacing
  } catch {
    /* 同上 */
  }
}

/** 背景：暗夜紫渐变 + 顶部光晕 + 星屑 */
function paintBackground(ctx, w, h) {
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, COLOR.ink2)
  bg.addColorStop(0.42, '#1b1038')
  bg.addColorStop(1, COLOR.ink)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const halo = ctx.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h * 0.3, w * 0.95)
  halo.addColorStop(0, 'rgba(124,92,214,0.42)')
  halo.addColorStop(0.5, 'rgba(124,92,214,0.12)')
  halo.addColorStop(1, 'rgba(124,92,214,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < 220; i += 1) {
    const x = (i * 7919) % w
    const y = (i * 104729) % Math.round(h * 0.62)
    ctx.globalAlpha = 0.08 + (i % 5) * 0.035
    ctx.fillStyle = i % 7 === 0 ? COLOR.gold : COLOR.glow
    ctx.beginPath()
    ctx.arc(x, y, (i % 3) * 0.4 + 0.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/**
 * 画牌面（三层），返回牌面高度。
 * 顺序与站内 CardFace 一致：插画（按卡体裁剪）→ 卡框 → 罗马数字 / 牌名。
 */
function paintCard(ctx, card, x, y, width, art, frame) {
  const height = width / CARD_ASPECT_VALUE

  // 投影底板
  ctx.save()
  ctx.shadowColor = 'rgba(124,92,214,0.55)'
  ctx.shadowBlur = 60
  ctx.fillStyle = 'rgba(8,5,15,0.9)'
  ctx.fillRect(x, y, width, height)
  ctx.restore()

  // ① 插画层：先按整个卡牌框铺满，再按卡片本体裁掉（吊牌那一带卡框是透明的）
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, width, height)
  ctx.clip()
  if (art) {
    ctx.drawImage(art, x, y, width, height)
  } else {
    const g = ctx.createLinearGradient(x, y, x + width, y + height)
    g.addColorStop(0, '#2b1a52')
    g.addColorStop(1, '#0d0720')
    ctx.fillStyle = g
    ctx.fillRect(x, y, width, height)
  }
  const cl = CARD_BODY_CLIP_VALUE
  ctx.globalCompositeOperation = 'destination-in'
  ctx.beginPath()
  ctx.rect(x + width * cl.left, y + height * cl.top, width * (1 - cl.left - cl.right), height * (1 - cl.top - cl.bottom))
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  ctx.restore()

  // ② 卡框层
  if (frame) ctx.drawImage(frame, x, y, width, height)

  // ③ 文字层
  const inset = FRAME_INSET_VALUE
  const faceLeft = x + width * inset.left
  const faceWidth = width * (1 - inset.left - inset.right)

  // 罗马数字：落进上框带的净空区
  ctx.save()
  ctx.font = `400 ${Math.round(height * 0.031)}px ${FONT_DISPLAY}`
  ctx.fillStyle = frame ? '#8a682e' : COLOR.gold
  drawCentered(ctx, card.num, x + width / 2, y + height * inset.top * 0.72, { spacing: '0.28em' })
  ctx.restore()

  /**
   * 牌名：落在插画窗口内下缘，并垫一层由透明渐深的暗底衬。
   * 与站内 .card__caption 的盒模型一致 —— 盒子下沿在 frame-bottom 处、高 15%，
   * 内部再留 1.5cqh 下内边距、1.1cqh 行间距。浅色插画上靠底衬 + 描边保证可读。
   */
  const scrimH = height * 0.15
  const scrimBottom = y + height * (1 - inset.bottom)
  const scrimTop = scrimBottom - scrimH
  const scrim = ctx.createLinearGradient(0, scrimTop, 0, scrimBottom)
  scrim.addColorStop(0, 'rgba(8,5,16,0)')
  scrim.addColorStop(0.4, 'rgba(8,5,16,0.45)')
  scrim.addColorStop(1, 'rgba(8,5,16,0.88)')
  ctx.fillStyle = scrim
  ctx.fillRect(faceLeft, scrimTop, faceWidth, scrimH)

  const nameSize = Math.round(height * 0.037)
  const nameEnSize = Math.round(height * 0.021)
  const contentBottom = scrimBottom - height * 0.015

  ctx.save()
  ctx.font = `400 ${nameSize}px ${FONT_DISPLAY}`
  ctx.fillStyle = '#fcf8ee'
  drawCentered(ctx, card.nameZh, x + width / 2, contentBottom, {
    spacing: '0.22em',
    stroke: nameSize * 0.055
  })
  ctx.font = `400 ${nameEnSize}px ${FONT_BODY}`
  ctx.fillStyle = '#eed69e'
  drawCentered(ctx, card.nameEn, x + width / 2, contentBottom - nameEnSize * 1.6, {
    spacing: '0.3em',
    stroke: nameEnSize * 0.045
  })
  ctx.restore()

  return height
}

/**
 * 把卡片内容画进一个从 y=0 开始的坐标系，返回内容底部的 y。
 *
 * 之所以要拆出来：22 张牌的牌意长短差得不少（90~115 字），
 * 行数会在 3~5 行之间浮动。固定坐标直接往 1920 高的画布上画，
 * 长文案就会压到页脚水印上。所以先在离屏画布上量出真实高度，
 * 再决定要不要整体缩放（见 renderShareCard）。
 */
function drawContent(ctx, card, art, frame, W) {
  const M = 84
  const maxW = W - M * 2
  const cx = W / 2
  let y = 60

  ctx.save()
  ctx.font = `400 30px ${FONT_BODY}`
  ctx.fillStyle = COLOR.faint
  drawCentered(ctx, SITE.brand, cx, y, { spacing: '0.34em' })
  ctx.restore()

  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  y += 46
  ctx.save()
  ctx.font = `400 24px ${FONT_BODY}`
  ctx.fillStyle = COLOR.faint
  drawCentered(ctx, `${d.getFullYear()} · ${pad(d.getMonth() + 1)} · ${pad(d.getDate())}`, cx, y, {
    spacing: '0.22em'
  })
  ctx.restore()

  // 牌面
  const cardW = 500
  y += 60
  y += paintCard(ctx, card, cx - cardW / 2, y, cardW, art, frame)

  // 罗马数字 · 英文名
  y += 74
  ctx.save()
  ctx.font = `400 26px ${FONT_BODY}`
  ctx.fillStyle = COLOR.faint
  drawCentered(ctx, `${card.num} · ${card.nameEn.toUpperCase()}`, cx, y, { spacing: '0.3em' })
  ctx.restore()

  // 中文牌名
  y += 74
  ctx.save()
  ctx.font = `400 72px ${FONT_DISPLAY}`
  ctx.fillStyle = COLOR.text
  ctx.shadowColor = 'rgba(124,92,214,0.75)'
  ctx.shadowBlur = 26
  drawCentered(ctx, card.nameZh, cx, y, { spacing: '0.16em' })
  ctx.restore()

  // 关键词
  y += 52
  ctx.save()
  ctx.textBaseline = 'middle'
  ctx.font = `400 24px ${FONT_BODY}`
  const gap = 14
  const padX = 26
  const pillH = 52
  const widths = card.keywords.map((k) => ctx.measureText(k).width + padX * 2)
  const total = widths.reduce((a, b) => a + b, 0) + gap * (card.keywords.length - 1)
  let px = cx - total / 2
  card.keywords.forEach((word, i) => {
    roundRect(ctx, px, y, widths[i], pillH, pillH / 2)
    ctx.strokeStyle = COLOR.line
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = COLOR.glow
    ctx.textAlign = 'center'
    ctx.fillText(word, px + widths[i] / 2, y + pillH / 2)
    px += widths[i] + gap
  })
  ctx.restore()

  // 牌意
  y += pillH + 62
  ctx.save()
  ctx.font = `400 31px ${FONT_BODY}`
  ctx.fillStyle = COLOR.body
  ctx.textAlign = 'center'
  const lines = wrapText(ctx, card.meaning, maxW)
  const lineH = 56
  lines.forEach((line, i) => ctx.fillText(line, cx, y + i * lineH))
  y += (lines.length - 1) * lineH + 76
  ctx.restore()

  // 分隔线
  ctx.save()
  ctx.strokeStyle = COLOR.line
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cx - 190, y)
  ctx.lineTo(cx + 190, y)
  ctx.stroke()
  ctx.restore()

  // 今日建议
  y += 60
  ctx.save()
  ctx.font = `400 30px ${FONT_DISPLAY}`
  ctx.fillStyle = COLOR.gold
  ctx.textAlign = 'center'
  const adviceLines = wrapText(ctx, `今日建议 · ${card.advice}`, maxW - 40)
  adviceLines.forEach((line, i) => ctx.fillText(line, cx, y + i * 50))
  ctx.restore()

  return y + 30
}

/**
 * 生成分享卡片图，返回一个图片 Blob（JPEG）。
 * @param {object} card src/data/cards.js 里的一张牌
 * @returns {Promise<Blob>}
 */
export async function renderShareCard(card) {
  const { width: W, height: H } = SHARE_SIZE
  const [art, frame] = await Promise.all([
    loadFirst(ASSETS.cardFace(card.id)),
    loadFirst(ASSETS.cardFrame)
  ])

  // 先在离屏画布上把内容画一遍，量出真实高度
  const probe = document.createElement('canvas')
  probe.width = W
  probe.height = 2400
  const pctx = probe.getContext('2d')
  if (!pctx) throw new Error('当前浏览器不支持 Canvas 2D')
  const contentBottom = drawContent(pctx, card, art, frame, W)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 Canvas 2D')

  paintBackground(ctx, W, H)

  // 内容区：上留 84，下留 156 给页脚水印。放不下就整体等比缩小，
  // 这样 22 张牌不管文案多长都不会压到页脚。
  const top = 84
  const avail = H - 156 - top
  const scale = contentBottom > avail ? avail / contentBottom : 1
  const drawn = contentBottom * scale
  ctx.save()
  ctx.translate(0, top + Math.max(0, (avail - drawn) / 2))
  ctx.scale(scale, scale)
  ctx.drawImage(probe, 0, 0)
  ctx.restore()

  // 页脚水印
  ctx.save()
  ctx.font = `400 26px ${FONT_DISPLAY}`
  ctx.fillStyle = COLOR.faint
  drawCentered(ctx, `${SITE.title} · ${SITE.slogan}`, W / 2, H - 92, { spacing: '0.2em' })
  ctx.font = `400 20px ${FONT_BODY}`
  drawCentered(ctx, 'TAROT DAILY · 每天一张', W / 2, H - 52, { spacing: '0.28em' })
  ctx.restore()

  return new Promise((resolve, reject) => {
    // 用 JPEG 而不是 PNG：这张是渐变 + 插画的照片质感图，
    // PNG 要 2.3 MB，JPEG(q92) 只要几百 KB，而分享场景本来也不要求无损。
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('导出图片失败'))
      },
      'image/jpeg',
      0.92
    )
  })
}

/** 触发浏览器下载 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
