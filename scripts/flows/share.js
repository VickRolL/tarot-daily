/**
 * 回归流程：抽牌 → 解读面板 → 打开分享卡片弹窗（Canvas 出图）
 * 用法：node scripts/shot.mjs http://127.0.0.1:5173/ out.png --eval-file scripts/flows/share.js
 *
 * 分享图是 Canvas 画的，肉眼只能看结果，看不出哪一步算错。
 * 这里把弹窗里的预览图尺寸、状态文案、按钮可用性都打出来。
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = {}

await sleep(3400)

const orb = document.querySelector('.orb')
if (!orb) return { error: '找不到水晶球' }
orb.click()

/* 2026-09-19 抽牌仪式分拍后总长约 5.7s（原 3.4s），
   面板在 5.0s 挂载、最后一个子项（按钮组）再晚 0.4s —— 等 5.8s 才稳。 */
await sleep(5800)

const btns = [...document.querySelectorAll('.panel__actions .btn')]
report.panelButtons = btns.map((b) => b.textContent.trim())
report.adviceShown = !!document.querySelector('.panel__advice')

const shareBtn = btns.find((b) => b.textContent.includes('分享'))
if (!shareBtn) return { ...report, error: '找不到分享按钮' }
shareBtn.click()

await sleep(3500)

report.dialogOpen = !!document.querySelector('.share')
const state = document.querySelector('.share__state')
report.stateText = state ? state.textContent.trim().slice(0, 80) : null
const img = document.querySelector('.share__preview img')
report.previewImg = img ? [img.naturalWidth, img.naturalHeight] : null
report.previewSrcScheme = img ? img.currentSrc.slice(0, 5) : null
report.blobKB = img ? Math.round((await (await fetch(img.currentSrc)).blob()).size / 1024) : null
const save = [...document.querySelectorAll('.share__actions .btn')].find((b) =>
  b.textContent.includes('保存')
)
report.saveButton = save ? { text: save.textContent.trim(), disabled: save.disabled } : null

return report
