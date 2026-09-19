/* 验证 file:// 下「生成分享卡片」是否受 canvas 跨源限制
   ==========================================================================
   背景：分享卡片要把牌面画进 canvas 再导出，而 file:// 的图片会污染 canvas，
   导出时会被安全策略拒绝。这条限制要不要写进 README，得先实测。
   ========================================================================== */
const log = []
const errs = []
addEventListener('error', (e) => errs.push(String(e.message || e)))
addEventListener('unhandledrejection', (e) => errs.push('rejection: ' + String(e.reason)))

/* 包住三个「读回画布像素」的入口，记录它们成功还是抛错 */
for (const name of ['toBlob', 'toDataURL', 'getImageData']) {
  const proto = name === 'getImageData' ? CanvasRenderingContext2D.prototype : HTMLCanvasElement.prototype
  const orig = proto[name]
  proto[name] = function (...args) {
    try {
      const r = orig.apply(this, args)
      log.push(`${name} ok`)
      return r
    } catch (e) {
      log.push(`${name} THROW ${e.name}`)
      throw e
    }
  }
}

/* 没牌就先抽一张 */
if (!document.querySelector('.card')) {
  document.querySelector('.orb')?.click()
  await new Promise((r) => setTimeout(r, 5200))
}

const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('分享'))
log.push('shareBtn: ' + (btn ? btn.textContent.trim() : 'NOT FOUND'))
btn?.click()
await new Promise((r) => setTimeout(r, 3000))

return {
  canvasOps: log,
  errors: errs,
  url: location.protocol,
  /* 弹窗里给用户的提示文案（离线时应该是「改用本地服务器打开」那条） */
  dialogText: document.querySelector('.share__state--error')?.textContent?.replace(/\s+/g, ' ').trim() ?? null
}
