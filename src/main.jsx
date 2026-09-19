import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { ASSETS, applySkinVars } from './config/skin'
import './index.css'

// 皮肤几何参数（卡牌比例、卡框开口、卡体裁剪、主视觉底板、球心锚点）
// 统一灌进 CSS 变量，换皮肤只改 src/config/skin.js，样式表和组件都不用动。
applySkinVars()

/**
 * 主视觉是首屏最关键、也最大的素材（约 200 KB），
 * 用 preload 让它和 JS 并行下载，而不是等 React 挂载后才发起请求。
 * 地址取自 skin.js，换皮肤/改文件名都会自动跟着走，不需要手改 index.html。
 */
const heroBgUrl = ASSETS.heroBg[0]
const preloadLink = document.createElement('link')
preloadLink.rel = 'preload'
preloadLink.as = 'image'
preloadLink.href = heroBgUrl
preloadLink.type = heroBgUrl.endsWith('.webp') ? 'image/webp' : 'image/png'
document.head.appendChild(preloadLink)

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
