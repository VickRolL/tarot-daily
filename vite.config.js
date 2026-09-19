import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * 开发工具（左下角调试条 DevBar / 牌面总览 CardGallery）的**构建期开关**。
 *
 * 为什么不用 `import.meta.env.DEV` 判断了
 * ---------------------------------------------------------------------------
 * `DEV` 只在 `vite dev` 下为真，构建产物里恒为 false ——
 * 也就是说「开发者版」这个产物形态**根本没法用 DEV 表达**。
 * 而这里注入的是一个自己可控的字面量，三种场景都能算清楚：
 *
 *   vite dev                      → true   本地开发，调试条照常
 *   vite build                    → false  正式产物必须干净，调试条被摇掉
 *   VITE_DEV_TOOLS=1 vite build   → true   产出「开发者版」（scripts/build_dev_preview.mjs）
 *
 * 用 `define` 而不是读 `import.meta.env.VITE_*`，是为了保证注入的是**真字面量**：
 * Rollup 能据此静态折叠掉 `DEV_TOOLS && <DevBar/>` 整支分支，
 * 正式包里的 DevBar / CardGallery 连代码都不会残留（自检见 build_user_preview.mjs 的第 (d) 项）。
 */
export default defineConfig(({ command }) => ({
  define: {
    __DEV_TOOLS__: JSON.stringify(command === 'serve' || process.env.VITE_DEV_TOOLS === '1')
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: '127.0.0.1'
  }
}))
