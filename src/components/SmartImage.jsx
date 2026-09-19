import { useState } from 'react'

/**
 * 多格式回退图片：按顺序尝试 sources 里的地址，全部失败时通知调用方降级。
 *
 * 用途：美术素材常来自不同工具，格式未必统一（.webp 是我们自己的压缩产物，
 * .png 是外部导入的原始图）。组件按顺序探测，找到能用的就用，全都找不到才降级。
 */
export default function SmartImage({ sources, onAllFailed, ...rest }) {
  const list = (Array.isArray(sources) ? sources : [sources]).filter(Boolean)
  const [index, setIndex] = useState(0)

  if (index >= list.length) return null

  return (
    <img
      {...rest}
      src={list[index]}
      onError={() => {
        const next = index + 1
        setIndex(next)
        if (next >= list.length) onAllFailed?.()
      }}
    />
  )
}
