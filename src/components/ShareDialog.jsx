import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { downloadBlob, renderShareCard } from '../utils/shareCard'

/**
 * 分享卡片图弹窗
 * 打开即用 Canvas 生成 1080×1920 竖版长图，生成好之后：
 *   - 桌面端点「保存图片」直接下载
 *   - 移动端可以长按图片保存到相册
 * 生成失败时给出明确提示，不会白弹一个空窗。
 */
export default function ShareDialog({ card, advice, onClose }) {
  const [status, setStatus] = useState('loading')
  const [url, setUrl] = useState(null)
  const [blob, setBlob] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl = null

    renderShareCard(card, advice)
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
    /* advice 进依赖：它是抽牌时定下的那条，理论上和 card 同生共死；
       真出现「同牌不同建议」时（比如调试时手改了记录），这张图要重画。 */
  }, [card, advice])

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
              牌面素材未就位或跨源受限时会出现这个问题，可先确认素材是否可访问。
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
