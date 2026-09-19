import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * 开发工具（左下角调试条 DevBar / 牌面总览 CardGallery）的**构建期开关**。
 *
 * 为什么不用 `import.meta.env.DEV` 判断了
 * ---------------------------------------------------------------------------
 * `DEV` 只在 `vite dev` 下为真，构建产物里恒为 false ——
 * 它只能表达「是不是开发服务器」这一件事，没有第二个取值。
 * 这里注入的是一个自己可控的字面量，两种场景算得清清楚楚：
 *
 *   vite dev     → true   本地开发，调试条照常
 *   vite build   → false  正式产物必须干净，调试条被摇掉
 *
 * 用 `define` 而不是读 `import.meta.env.VITE_*`，是为了保证注入的是**真字面量**：
 * Rollup 能据此静态折叠掉 `DEV_TOOLS && <DevBar/>` 整支分支，
 * 正式包里的 DevBar / CardGallery 连代码都不会残留。
 *
 * 2026-09-19：原先还有第三种取值 `VITE_DEV_TOOLS=1 vite build`（用来产出一份
 * 带调试条的「开发者版」构建产物）。产物只走 http 之后这一支已随离线通道一并移除
 * —— 调试条现在**专属于 `vite dev`**，不需要在产物里表达。
 */
export default defineConfig(({ command }) => ({
  define: {
    __DEV_TOOLS__: JSON.stringify(command === 'serve')
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: '127.0.0.1'
  }
}))
