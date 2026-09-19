/**
 * 回归流程：抽牌 → 停在翻牌完成那一刻
 * 用法：node scripts/shot.mjs http://127.0.0.1:5173/ out.png --eval-file scripts/flows/reveal.js
 *
 * 打印的是**实际渲染出来的几何与素材加载状态**，比人眼目测可靠：
 * 球有没有落在锚点上、牌背用的是素材还是 CSS 兜底、插画是否加载成功、文字是否正确。
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = {}

await sleep(3400) // 入场动画 2.6s + 余量

const orb = document.querySelector('.orb')
report.orbFound = !!orb
if (!orb) return report

const r = orb.getBoundingClientRect()
report.orbRect = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]
report.orbCenterPct = [
  +(((r.x + r.width / 2) / innerWidth) * 100).toFixed(2),
  +(((r.y + r.height / 2) / innerHeight) * 100).toFixed(2)
]

const orbArt = document.querySelector('.orb__art')
report.orbArt = orbArt ? [orbArt.currentSrc.split('/').pop(), orbArt.naturalWidth] : '（无美术层）'

orb.click()
await sleep(1500) // 爆闪 620ms + 翻牌 1000ms

report.cardVisible = !!document.querySelector('.card')
report.backIsArt = !!document.querySelector('.card__back--art')
const back = document.querySelector('.card__back-img')
report.backImg = back ? [back.currentSrc.split('/').pop(), back.naturalWidth] : '（CSS 兜底）'
const art = document.querySelector('.card__art')
report.artImg = art ? [art.currentSrc.split('/').pop(), art.naturalWidth] : '（程序化兜底）'
const frame = document.querySelector('.card__frame-img')
report.frameImg = frame ? [frame.currentSrc.split('/').pop(), frame.naturalWidth] : '（CSS 描边兜底）'
report.text = [
  document.querySelector('.card__num')?.textContent ?? null,
  document.querySelector('.card__name')?.textContent ?? null,
  document.querySelector('.card__name-en')?.textContent ?? null
]

return report
