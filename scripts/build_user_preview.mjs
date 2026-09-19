/**
 * 生成「用户视角」离线副本（dist-user/）—— 双击 index.html 即开
 * ==========================================================================
 * 这份副本**没有**调试条，看到的就是他人访问网站时的样子。
 * 要带调试条（不限次数抽卡 / 重播迎接 / 牌面总览）的版本请用
 * `node scripts/build_dev_preview.mjs` 产出 dist-dev/。
 *
 * 双击打不开的两个真正拦路石（2026-09-19 实测定位）
 * --------------------------------------------------------------------------
 *   ① `import.meta.env.BASE_URL` 默认是 `/`，运行时素材路径被拼成
 *      `/skins/mist-night/xxx.webp`。file:// 下这是**磁盘根目录**
 *      （`file:///skins/...`）→ 图全挂。
 *   ② Vite 产出的是 `<script type="module" crossorigin>`：
 *      ES module 在 file:// 下受 CORS 约束、`crossorigin` 又强制走 CORS 请求，
 *      浏览器直接拒绝加载 → `#root` 永远为空、整屏白。
 *
 * 两条改法（含实现细节）收在 scripts/lib/offline.mjs，dist-dev/ 共用同一套。
 *
 * 已知限制（file:// 下）
 * --------------------------------------------------------------------------
 * 「生成分享卡片」用 Canvas 读回像素，file:// 的图片会污染 canvas，读回会被拒。
 * 需要完整功能（含分享卡片 / 更贴近线上的 MIME 与缓存行为）请走 http：
 *   · 根目录双击  start-user-preview.cmd
 *   · 或 node scripts/serve_user_preview.mjs
 *
 * 用法：
 *   node scripts/build_user_preview.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ROOT,
  rel,
  kb,
  mb,
  dirSize,
  buildVite,
  viteAssetLines,
  postProcessOffline,
  checkOffline
} from './lib/offline.mjs'

const OUT = join(ROOT, 'dist-user')

let failures = 0
const ok = (msg) => console.log(`   ${msg} ✓`)
const bad = (msg) => {
  console.error(`   ✗ ${msg}`)
  failures += 1
}

async function main() {
  console.log('① 构建离线副本（--base ./ --outDir dist-user）...')
  console.log(viteAssetLines(buildVite({ outDir: 'dist-user' }), 'dist-user'))

  if (!existsSync(join(OUT, 'index.html'))) {
    console.error(`构建后仍没有 ${OUT}\\index.html，中止`)
    process.exit(1)
  }
  console.log(`   产出 ${kb(await dirSize(OUT))}`)

  console.log('\n② 改写成可离线打开的形态 ...')
  const { htmls, jsFiles, notes, strictified } = await postProcessOffline(OUT)
  notes.forEach((n) => console.log(`   ${n}`))
  console.log(`   补 'use strict' 的 JS：${strictified} 个`)

  console.log('\n③ 自检 ...')
  const { problems, passes } = checkOffline({ htmls, jsFiles })
  passes.forEach(ok)
  problems.forEach(bad)

  /* (d) 反向校验：调试条 / 牌面总览的文案不该出现在产物里。
     这是「DEV_TOOLS 关掉时整支分支被摇掉」的证据 —— 一旦哪天改成运行时判断，
     或者 define 没生效，这一项立刻红，日志里会指出该去查哪里。
     注：不加「再抽一次」—— 那是 ReadingPanel 里 unlimited 分支的按钮文案，
     JSX 里的字符串字面量本身不会被摇掉，加进来会误报。 */
  const banned = ['重播迎接', '抽牌模式', '牌面总览', '重置今日']
  const found = []
  for (const f of jsFiles) {
    const src = readFileSync(f, 'utf8')
    for (const word of banned) if (src.includes(word)) found.push(`${word} @ ${f.split(/[/\\]/).pop()}`)
  }
  if (found.length) {
    bad(`产物里发现了开发入口文案：${found.join('; ')}`)
    console.error('     说明 DevBar / CardGallery 被打进了生产包，请检查 vite.config.js 里 __DEV_TOOLS__ 的取值')
  } else {
    ok(`未发现开发入口（检查了 ${jsFiles.length} 个 JS：${banned.join(' / ')}）`)
  }

  console.log('\n④ 写入使用说明 ...')
  const readme = `用户视角离线副本（dist-user）
========================================

【怎么打开】直接双击本目录下的 index.html 即可。
            不需要 Node、不需要 Python、不需要起任何服务器。
            看到的界面就是他人访问网站时的样子。

与开发者版本（dist-dev/）的区别
----------------------------------------
· 没有左下角的调试条（抽卡模式 / 重置今日 / 重播迎接 / 牌面总览）
· 没有「牌面总览」全屏面板
· 抽牌模式固定为 daily（一天抽一次，记录存在浏览器 localStorage）
  抽完牌，面板上不会有「再抽一次」按钮

两者只差一个构建开关（vite.config.js 注入的 __DEV_TOOLS__）：
本目录用 vite build（默认关），dist-dev/ 用 VITE_DEV_TOOLS=1 vite build（开）。

【为什么双击能开】
----------------------------------------
产物做了两处针对离线环境的处理：
· 素材路径跟随相对基址（./skins/...），而不是 /skins/...
  否则 file:// 下会去找磁盘根目录 file:///skins/... → 图全挂
· <script type="module" crossorigin> 改成 <script defer>
  ES module 在 file:// 下会被 CORS 拦掉、页面全白；
  产物 JS 本身是自包含的（无 import / export / 动态导入），
  所以当经典脚本加载完全等价，并补了 'use strict' 保持 ESM 的严格模式语义

【唯一的功能差异：分享卡片】
----------------------------------------
「生成分享卡片」要读回 Canvas 像素，而 file:// 的图片会污染 canvas，
浏览器会拒绝读回（安全限制，无解）。需要这个功能时走 http：

  回到项目根目录，双击  start-user-preview.cmd
  （或在项目根目录执行  npm run user:serve  ，然后访问 http://127.0.0.1:8080/）

【想重新看首屏迎接动画】
----------------------------------------
清掉 localStorage 里的 tarot-daily::draw-record 键，或换无痕窗口打开。
（开发者版 dist-dev/ 不受此限制，每次打开都会播。）

【其它】
----------------------------------------
· 正式发布请用 npm run build 产出的 dist/（保持绝对路径，交给静态服务器）。
· 本目录由 scripts/build_user_preview.mjs 生成，可随时删除重建。

生成时间：${new Date().toLocaleString('zh-CN')}
`
  writeFileSync(join(OUT, 'README.txt'), readme, 'utf8')

  console.log(`\n${failures ? '⚠️ 完成但自检有 ' + failures + ' 项未通过' : '✅ 完成'}：${rel(OUT)}`)
  console.log(`   体积 ${mb(await dirSize(OUT))}`)
  console.log('   打开方式：直接双击 dist-user/index.html')
  console.log('             需要分享卡片等功能时用 start-user-preview.cmd（http）\n')

  if (failures) process.exitCode = 1
}

main().catch((err) => {
  console.error('生成失败：', err)
  process.exit(1)
})
