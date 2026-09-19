/**
 * 生成「开发者版」离线副本（dist-dev/）—— 双击 index.html 即开，且带着调试条
 * ==========================================================================
 * 和 dist-user/ 的差别**只有一个构建开关**：这里注入 `VITE_DEV_TOOLS=1`。
 * 于是这份产物里：
 *   · 左下角有调试条 —— 不限次数 / 一天一次 / 重置今日 / 重播迎接 / 牌面总览
 *   · 初始抽牌模式是「不限次数」：打开即可连抽，抽完面板上是「再抽一次」
 *   · 每次冷启动都播迎接动画（无视「今天已抽过」），方便反复调这段动画
 *
 * file:// 适配（相对基址、module→classic、补 'use strict'）与用户版共用
 * scripts/lib/offline.mjs，两份产物行为一致，只是开关不同。
 *
 * ⚠️ 这个产物**不要对外分发**：调试条会暴露内部状态，抽牌模式也不是正式行为。
 *    它已被 package_project.py 排除在交付包之外（见 EXCLUDE_DIRS_BUILD）。
 *
 * 已知限制（file:// 下）：分享卡片要读回 Canvas 像素，file:// 会被安全策略拒。
 * 需要连分享卡片一起测时用 http 入口 —— 根目录双击 启动开发者版.cmd
 * （或 node scripts/serve_user_preview.mjs --dir dist-dev）。
 *
 * 用法：
 *   node scripts/build_dev_preview.mjs
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

const OUT = join(ROOT, 'dist-dev')
const TITLE_FROM = '<title>今夜一签 · 塔罗日签</title>'
const TITLE_TO = '<title>今夜一签 · 塔罗日签（开发者版）</title>'

let failures = 0
const ok = (msg) => console.log(`   ${msg} ✓`)
const bad = (msg) => {
  console.error(`   ✗ ${msg}`)
  failures += 1
}

async function main() {
  console.log('① 构建开发者版（VITE_DEV_TOOLS=1 --base ./ --outDir dist-dev）...')
  console.log(viteAssetLines(buildVite({ outDir: 'dist-dev', env: { VITE_DEV_TOOLS: '1' } }), 'dist-dev'))

  if (!existsSync(join(OUT, 'index.html'))) {
    console.error(`构建后仍没有 ${OUT}\\index.html，中止`)
    process.exit(1)
  }
  console.log(`   产出 ${kb(await dirSize(OUT))}`)

  console.log('\n② 改写成可离线打开的形态 ...')
  const { htmls, jsFiles, notes, strictified } = await postProcessOffline(OUT, {
    /* 标签页标题标上「（开发者版）」—— 同时开着用户版时不会认错窗口 */
    transformHtml: (html) => {
      if (!html.includes(TITLE_FROM)) return { html, note: '' }
      return { html: html.replace(TITLE_FROM, TITLE_TO), note: '标题标注「开发者版」' }
    }
  })
  notes.forEach((n) => console.log(`   ${n}`))
  console.log(`   补 'use strict' 的 JS：${strictified} 个`)

  console.log('\n③ 自检 ...')
  /* 前三项与用户版完全一致（file:// 能不能开，跟开关无关） */
  const { problems, passes } = checkOffline({ htmls, jsFiles })
  passes.forEach(ok)
  problems.forEach(bad)

  /* 第四项是**用户版的反面**：开发入口必须真的在产物里。
     和 dist-user/ 的第 (d) 项配对看才有意义 ——
     同一份源码，两个开关，一个不该有、一个必须有，
     任一侧失效都会立刻暴露（这比只查一侧可靠）。 */
  const must = ['重播迎接', '抽牌模式', '牌面总览', '重置今日', '再抽一次']
  const js = jsFiles.map((f) => readFileSync(f, 'utf8')).join('\n')
  const miss = must.filter((w) => !js.includes(w))
  if (miss.length) {
    bad(`产物缺少开发入口文案：${miss.join(' / ')}`)
    console.error('     VITE_DEV_TOOLS=1 没生效？检查 vite.config.js 的 __DEV_TOOLS__ 与 buildVite 的 env 透传')
  } else {
    ok(`开发入口齐全：${must.join(' / ')}`)
  }

  /* 残留的 __DEV_TOOLS__ 说明 define 没替换（那页面会直接 ReferenceError 白屏） */
  const leaked = js.includes('__DEV_TOOLS__')
  leaked ? bad('产物里残留 __DEV_TOOLS__ 符号 → define 没生效，页面会白屏') : ok('__DEV_TOOLS__ 已被构建期替换为字面量')

  /* 标题标识：产物里有几个 html 就查几个 */
  const untitled = htmls.filter((p) => !readFileSync(p, 'utf8').includes('（开发者版）'))
  untitled.length
    ? bad(`标题未标注开发者版：${untitled.map(rel).join(', ')}`)
    : ok('标题已标注「（开发者版）」，与用户版标签页可区分')

  console.log('\n④ 写入使用说明 ...')
  const readme = `开发者版离线副本（dist-dev）
========================================

【怎么打开】
  方式一（推荐，最省事）：双击本目录下的 index.html
         —— 调试条、不限次数抽卡、重播迎接全部可用。
  方式二（要测「生成分享卡片」时用）：回到项目根目录，双击 启动开发者版.cmd
         —— 会起一个本地 http 服务并自动打开浏览器。
         分享卡片要读回 Canvas 像素，file:// 下会被浏览器的安全策略拒绝，
         只有 http 下能用（这是浏览器限制，不是 bug）。

【和用户版 dist-user/ 的差别】
  只差一个构建开关（本目录用 VITE_DEV_TOOLS=1 构建）：
  · 左下角多了调试条
  · 初始抽牌模式是「不限次数」，抽完面板上有「再抽一次」
  · 每次打开都会播迎接动画（用户版「今天已抽过」就不播了）

【调试条上的四个按钮】
  · 不限次数 / 一天一次 —— 切换抽牌模式。
      「一天一次」才是正式行为：抽完记录存 localStorage，刷新后还是同一张牌。
      「不限次数」不落盘，可反复抽（方便连着看不同牌的观感）。
  · 重置今日 —— 清掉 localStorage 里的 tarot-daily::draw-record。
      在「一天一次」模式下抽完牌，点它就能重新抽。
  · 重播迎接 —— 重新播放信封开启那 2.7 秒的迎接动画。
      只重挂信封那一层，**不会**清掉你已抽到的牌，可以反复调这段动画。
  · 牌面总览 —— 全屏列出 22 张大阿卡纳，核对插画 / 牌名 / 关键词。

【⚠️ 别把这个目录发出去】
  调试条会暴露内部状态，抽牌模式也不是正式行为。
  scripts/package_project.py 已把 dist-dev/ 排除在交付包之外。

【其它】
  · 本目录由 scripts/build_dev_preview.mjs 生成，可随时删除重建。
  · 正式发布用 npm run build 产出的 dist/。

生成时间：${new Date().toLocaleString('zh-CN')}
`
  writeFileSync(join(OUT, 'README.txt'), readme, 'utf8')

  console.log(`\n${failures ? '⚠️ 完成但自检有 ' + failures + ' 项未通过' : '✅ 完成'}：${rel(OUT)}`)
  console.log(`   体积 ${mb(await dirSize(OUT))}`)
  console.log('   打开方式：双击 dist-dev/index.html（或根目录的 启动开发者版.cmd 走 http）\n')

  if (failures) process.exitCode = 1
}

main().catch((err) => {
  console.error('生成失败：', err)
  process.exit(1)
})
