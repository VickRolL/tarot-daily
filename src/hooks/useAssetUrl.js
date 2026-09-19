import { useEffect, useState } from 'react'

/**
 * 按顺序探测一组候选素材地址，返回第一个能加载成功的那张。
 *   undefined -> 探测中
 *   string    -> 可用地址
 *   null      -> 全部失败，调用方应降级为代码绘制
 */
export default function useAssetUrl(sources) {
  const list = (Array.isArray(sources) ? sources : [sources]).filter(Boolean)
  const key = list.join('|')
  const [url, setUrl] = useState(undefined)

  useEffect(() => {
    const candidates = key ? key.split('|') : []
    let cancelled = false
    let i = 0

    const tryNext = () => {
      if (cancelled) return
      if (i >= candidates.length) {
        setUrl(null)
        return
      }
      const src = candidates[i++]
      const probe = new Image()
      probe.onload = () => {
        if (!cancelled) setUrl(src)
      }
      probe.onerror = tryNext
      probe.src = src
    }

    tryNext()
    return () => {
      cancelled = true
    }
  }, [key])

  return url
}
