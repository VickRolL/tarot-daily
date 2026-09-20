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
  build: {
    /**
     * ⚠️ 音频**一律不内联**（2026-09-21 第二十八轮踩到）。
     *
     * Vite 默认的 `assetsInlineLimit` 是 **4096 字节** —— 小于它的资源会被编码成
     * base64 data URI 塞进 JS 包里。四个音效原来都大于这个尺寸所以一直是独立文件；
     * 这轮把 `flip` 换短之后它变成 **4010 字节**，于是：
     *   · 构建产物里**没有** `flip-<hash>.mp3` 了（其余三个还在）；
     *   · `probe-sfx` 那条「四个 mp3 都被下载」的判据按 `*.mp3` 文件名匹配请求，
     *     而 data URI 的 basename 不是 `.mp3` → **生产上直接判红**；
     *   · 「三个是文件、一个是内联」这种形状不一致最容易误导后来人查半天。
     *
     * 音频本来就该走独立文件：可单独缓存、可 Range、不进 JS 包。
     * 只对音视频关掉内联，其他小资源（图标等）保持 Vite 默认行为。
     */
    assetsInlineLimit: (filePath) =>
      /\.(mp3|m4a|aac|ogg|oga|wav|flac|mp4|webm)$/i.test(filePath) ? false : undefined
  },
  server: {
    port: 5173,
    host: '127.0.0.1'
  }
}))
