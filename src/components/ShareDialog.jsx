import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { downloadBlob, renderShareCard } from '../utils/shareCard'

/**
 * 是不是从本地文件直接打开的（file://）。
 * 此时牌面素材虽是同目录文件，但在浏览器眼里属于「跨源图片」，
 * 画进 canvas 会污染画布，导出（toBlob）必被拒绝 —— SecurityError（2026-09-19 实测）。
 * 这不是 bug，是浏览器安全规则；给一条能自救的提示，别让人对着技术报错干瞪眼。
 */
const isFileProtocol = typeof location !== 'undefined' && location.protocol === 'file:'

/**
 * 分享卡片图弹窗
 * 打开即用 Canvas 生成 1080×1920 竖版长图，生成好之后：
 *   - 桌面端点「保存图片」直接下载
 *   - 移动端可以长按图片保存到相册
 * 生成失败时给出明确提示，不会白弹一个空窗。
 */
export default function ShareDialog({ card, onClose }) {
  const [status, setStatus] = useState('loading')
  const [url, setUrl] = useState(null)
  const [blob, setBlob] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl = null

    renderShareCard(card)
      .then((result) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(result)
        setUrl(objectUrl)
        setBlob(result)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[tarot] 分享图生成失败', err)
        setError(err?.message || '未知错误')
        setStatus('error')
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [card])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /** 直接用已经生成好的 Blob 下载，不再绕一次 fetch(objectURL) */
  const handleSave = () => {
    if (!blob) return
    const name = `塔罗日签-${card.nameZh}-${new Date().toISOString().slice(0, 10)}.jpg`
    downloadBlob(blob, name)
  }

  return (
    <motion.div
      className="share"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24 }}
      onClick={onClose}
    >
      <div className="share__dialog" onClick={(e) => e.stopPropagation()}>
        <div className="share__bar">
          <strong>分享卡片</strong>
          <span className="share__hint">1080 × 1920</span>
          <button type="button" onClick={onClose} aria-label="关闭">
            关闭
          </button>
        </div>

        <div className="share__preview">
          {status === 'loading' && <p className="share__state">正在绘制…</p>}
          {status === 'error' && (
            <p className="share__state share__state--error">
              生成失败：{error}
              <br />
              {isFileProtocol
                ? '离线打开（file://）时浏览器不允许导出画布图片，这是安全限制。改用本地服务器打开即可正常出图 —— 双击项目根目录的 start-user-preview.cmd。'
                : '牌面素材未就位时也会出现这个问题，可先确认素材是否可访问。'}
            </p>
          )}
          {status === 'ready' && <img src={url} alt={`${card.nameZh} 分享卡片`} />}
        </div>

        <div className="share__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSave}
            disabled={status !== 'ready'}
          >
            保存图片
          </button>
          <span className="share__tip">手机端也可以长按图片保存到相册</span>
        </div>
      </div>
    </motion.div>
  )
}
