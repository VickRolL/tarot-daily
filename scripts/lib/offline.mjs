/**
 * 离线副本（file:// 双击可开）的构建公共件
 * ==========================================================================
 * `dist-user/`（用户视角）与 `dist-dev/`（开发者版）要做**同一套** file:// 适配，
 * 差异只有两处：构建时注入的开关、以及自检要断言什么。
 * 所以适配逻辑收在这里，两个构建脚本共用 —— 免得以后修 bug 要改两遍。
 *
 * 为什么必须适配（2026-09-19 实测定位的两个拦路石）
 * --------------------------------------------------------------------------
 *   ① `import.meta.env.BASE_URL` 默认是 `/`，运行时素材路径被拼成 `/skins/...`。
 *      file:// 下这是**磁盘根目录**（`file:///skins/...`）→ 图全挂。
 *      改法：用 `vite build --base ./` 构建，让路径变成 `./skins/...`。
 *   ② Vite 产出的是 `<script type="module" crossorigin>`：
 *      ES module 在 file:// 下受 CORS 约束、`crossorigin` 又强制走 CORS 请求，
 *      浏览器直接拒绝加载 → `#root` 永远为空、整屏白。
 *      改法：改写成 `<script defer>`。之所以可行 —— 产物 JS 是**完全自包含**的
 *      （0 处 `import` / `export` / `import.meta` / 动态 `import()`），
 *      它本身就是合法的经典脚本；再补一句 `'use strict';` 把 ESM 的严格模式语义带过来。
 *
 * 于是同一份产物三处都能跑：file:// 双击、站点根目录、任意子目录。
 *
 * 已知限制（file:// 下）
 * --------------------------------------------------------------------------
 * 「生成分享卡片」要读回 Canvas 像素，而 file:// 的图片会污染 canvas，读回会被拒。
 * 两个副本都提供了 http 入口兜这个功能（serve_user_preview.mjs / 启动开发者版.cmd）。
 */

import { readdir, stat } from 'node:fs/promises'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 项目根目录（本文件在 scripts/lib/ 下，所以往上两级） */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 绝对路径 → 相对路径（只用于日志好看） */
export const rel = (p) => p.replace(ROOT + '\\', '').replace(ROOT + '/', '')

export const kb = (n) => `${(n / 1024).toFixed(1)} KB`
export const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`

/** 绝对路径 → 相对路径。只碰标签属性里的资源引用，不动其他内容。 */
export function rewriteToRelative(html) {
  let hits = 0
  const out = html
    /* src="/x" / href="/x" —— 属性值以单个 / 开头（排除 //cdn 这种协议相对地址） */
    .replace(/(\b(?:src|href))="\/(?!\/)/g, (_m, attr) => {
      hits += 1
      return `${attr}="./`
    })
    /* og:image / twitter:image 这类走 content="..."。
       本地预览用不到，但 file:// 下指向 / 会变成盘符根目录（file:///og-cover.jpg），
       一并改写掉更干净。只改 content 里**纯路径**（以图片后缀结尾），
       避免误伤 og:url 这种本就是绝对地址的字段。 */
    .replace(/(\bcontent)="\/(?!\/)([^"]*\.(?:jpe?g|png|webp|svg|gif|ico))"/gi, (_m, attr, rest) => {
      hits += 1
      return `${attr}="./${rest}"`
    })
    /* CSS/JS 内联里可能残留的 url(/) */
    .replace(/url\(\/(?!\/)/g, () => {
      hits += 1
      return 'url(./'
    })
  return { html: out, hits }
}

/**
 * ES module → 经典脚本。两步：
 *   ① `<script type="module" crossorigin src=...>` → `<script defer src=...>`
 *   ② 去掉残余的 `crossorigin`（`<link rel=stylesheet>` 上也有一个）
 *      —— 带 crossorigin 的请求在 file:// 下必被 CORS 拦掉。
 */
export function toClassicScript(html) {
  let scripts = 0
  let cors = 0
  let out = html.replace(/<script([^>]*)\stype="module"([^>]*)>\s*<\/script>/gi, (_m, a, b) => {
    scripts += 1
    const attrs = `${a} ${b}`.replace(/\s*crossorigin(?:="[^"]*")?/gi, '').replace(/\s+/g, ' ').trim()
    return `<script defer ${attrs}></script>`
  })
  out = out.replace(/\s*crossorigin(?:="[^"]*")?/gi, () => {
    cors += 1
    return ''
  })
  return { html: out, scripts, cors }
}

/** 给产物 JS 补 `'use strict';` —— ESM 天生严格模式，经典脚本默认不是，补上语义才一致。 */
export function strictify(jsPath) {
  const src = readFileSync(jsPath, 'utf8')
  if (src.startsWith("'use strict';") || src.startsWith('"use strict";')) return false
  writeFileSync(jsPath, `'use strict';\n${src}`)
  return true
}

export async function walkHtml(dir, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) await walkHtml(p, acc)
    else if (e.name.endsWith('.html')) acc.push(p)
  }
  return acc
}

export async function walkJs(dir, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) await walkJs(p, acc)
    else if (e.name.endsWith('.js')) acc.push(p)
  }
  return acc
}

export async function dirSize(dir) {
  let total = 0
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) total += await dirSize(p)
    else total += (await stat(p)).size
  }
  return total
}

/**
 * 跑一次 vite 构建。
 *
 * 不用 npm —— 本机 `npm` 会走 wsl.exe，被安全策略拦掉（exit code 稀奇古怪）。
 * 直接调 node 跑 vite 入口，同时把 `env` 透传进去（开发者版靠 `VITE_DEV_TOOLS=1` 开调试条）。
 */
export function buildVite({ outDir, env = {}, base = './' }) {
  const viteBin = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(viteBin)) throw new Error(`找不到 vite：${viteBin}`)
  return execFileSync(process.execPath, [viteBin, 'build', '--base', base, '--outDir', outDir, '--emptyOutDir'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env }
  })
}

/** 从 vite 的 stdout 里挑出产物行，缩进后返回（日志里只关心这几个文件） */
export function viteAssetLines(stdout, outDir) {
  return stdout
    .split('\n')
    .filter((l) => l.includes(`${outDir}/`) || l.includes('built in'))
    .map((l) => `   ${l.trim()}`)
    .join('\n')
}

/**
 * 离线后处理：相对路径改写 → module 换 classic → 补 'use strict'。
 *
 * `transformHtml(html, path)` 可选，给调用方做产物专属改写
 * （开发者版用它把 `<title>` 标上「开发者版」，好和用户版区分标签页）。
 *
 * 返回 { htmls, jsFiles, notes, strictified } —— 统计值交给调用方自检。
 */
export async function postProcessOffline(outDir, { transformHtml } = {}) {
  const htmls = await walkHtml(outDir)
  const notes = []
  for (const p of htmls) {
    const before = readFileSync(p, 'utf8')
    const r = rewriteToRelative(before)
    const c = toClassicScript(r.html)
    let html = c.html
    let extra = ''
    if (transformHtml) {
      const res = transformHtml(html, p)
      if (res && typeof res === 'object') {
        html = res.html
        extra = res.note || ''
      } else if (typeof res === 'string') {
        html = res
      }
    }
    if (r.hits > 0 || c.scripts > 0 || c.cors > 0 || extra) {
      writeFileSync(p, html)
      notes.push(
        `${rel(p)}：相对路径 ${r.hits} 处 · module→classic ${c.scripts} 个 · 去 crossorigin ${c.cors} 处` +
          (extra ? ` · ${extra}` : '')
      )
    } else {
      notes.push(`${rel(p)}：无需改写`)
    }
  }

  const jsFiles = await walkJs(outDir)
  const strictified = jsFiles.filter(strictify).length
  return { htmls, jsFiles, notes, strictified }
}

/**
 * 通用离线自检：三件事任一不成立，file:// 双击就是白屏或图全挂。
 * 注意 (c) 的判据 —— 压缩后素材路径是变量拼接（`Fr="./", e=>[\`${Fr}skins/…\`]`），
 * 所以不能直接找 "/skins/"（那是压缩前的形态，早就没了），
 * 而要判**每个 `skins/` 前面那段里的基址字面量**是不是裸的 "/"。
 * 拿 `dist/`（应为 `"/"`）与 `dist-user/`、`dist-dev/`（应为 `"./"`）双向验，能过才算判据有效。
 */
export function checkOffline({ htmls, jsFiles }) {
  const problems = []
  const passes = []

  const leftover = []
  for (const p of htmls) {
    const h = readFileSync(p, 'utf8')
    if (/\btype="module"/.test(h)) leftover.push(`${rel(p)} 仍有 type="module"`)
    if (/\bcrossorigin/i.test(h)) leftover.push(`${rel(p)} 仍有 crossorigin`)
  }
  if (leftover.length) problems.push(...leftover)
  else passes.push('产物 HTML 无 type="module" / crossorigin')

  const leaks = []
  for (const p of htmls) {
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      if (line.includes('og:url')) continue
      const m = line.match(/\b(?:src|href|content)="\/(?!\/)[^"]*"/g)
      if (m) leaks.push(`${rel(p)}: ${m.join(', ')}`)
    }
  }
  if (leaks.length) problems.push(...leaks)
  else passes.push('零残留绝对资源路径（og:url 占位符已豁免）')

  const absJs = []
  for (const f of jsFiles) {
    const src = readFileSync(f, 'utf8')
    const name = f.split(/[/\\]/).pop()
    for (const m of src.matchAll(/skins\//g)) {
      const prefix = src.slice(Math.max(0, m.index - 100), m.index)
      if (/["'`]\/["'`]/.test(prefix)) {
        absJs.push(`${name}：素材基址是裸 "/" → ${prefix.slice(-60).replace(/\n/g, ' ')}`)
      }
    }
  }
  if (absJs.length) problems.push(...absJs)
  else passes.push('产物 JS 的素材基址为相对路径（base=./ 生效，file:// 下不会去找磁盘根目录）')

  return { problems, passes }
}
