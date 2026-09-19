#!/usr/bin/env node
/**
 * ============================================================================
 * 标题字体探针 —— 「这几个字到底是谁画的？」
 * ----------------------------------------------------------------------------
 * 跑法：
 *   node scripts/probe-fonts.mjs http://127.0.0.1:5188/
 *
 * ----------------------------------------------------------------------------
 * ★ 为什么要有这个探针
 *
 * 第二十三轮我给标题换了「罗马碑刻体」（Cinzel + 重字重宋），做完之后用
 * 截图验收、肉眼看「标题变好看了」就过了。**但那个拉丁子集根本没下载成功** ——
 * `title-latin.woff2` 里装的是 Google 返回的 HTTP 400 错误页 HTML。
 *
 * 而坏字体是**静默**的：
 *   · 浏览器 font-family 是逐字符回退的，坏的那个直接跳过、用下一个字体顶上
 *   · 不报错、不警告、Console 干净、CSS 里也看不出来
 *   · 页面照常渲染，`WOFF2` 魔数也只有真去读字节才知道
 * → 「标题用了罗马碑刻体」这个结论就这么挂着，直到下一轮我在构建产物里
 *   发现一段 data URI 解出来是 HTML 才露馅。
 *
 * 结论：**视觉正确性不能靠眼睛验字体**。字体只有问了浏览器自己才算数。
 * 本探针用两条互补的判据：
 *
 *   判据 A（文档级）：document.fonts 里每个 'Tarot Title *' 的 status。
 *                     失败的脸会停在 'error'（HTML 错误页就是这个下场）。
 *
 *   判据 B（逐字形级）：把三个 woff2 各自挂成**独立**的字体族（一文件一族名，
 *                      避免 'Tarot Title Han' 下 400/900 两张脸在**同族内**
 *                      互相顶替缺字，让「用到这个族」不等于「用到这张子集」），
 *                      再用 CDP 的 CSS.getPlatformFontsForNode 问
 *                      「这个字实际是用哪个字体画的」。
 *
 *                      ⚠️ 这里有个反直觉的坑（第一版就踩了）：
 *                      `getPlatformFontsForNode` 报的 familyName 是**字体文件
 *                      内部 name 表里的族名**，不是你 CSS 里声明的族名。
 *                      我把文件挂成 "PROBE LATIN"，它照样报 `Cinzel`；
 *                      挂成 "PROBE HAN900"，它报 `Noto Serif SC Black`。
 *                      所以判据**不能**拿族名去比对（那会全部假 FAIL），
 *                      只能看 `isCustomFont`：
 *                         · 恰好一个族 + isCustomFont=true  → 字形来自 web 字体 ✓
 *                         · 出现 isCustomFont=false 的族（SimSun / 宋体 /
 *                           Times New Roman 之类） → 逐字回退，子集缺这个字 ✗
 *                      好在这条对「系统里恰好装了同名字体」也是稳健的 ——
 *                      系统装的不算 custom，一样会被判 FAIL。
 *
 *   判据 C（真实渲染路径）：直接问页面上 `.headline__title` / `.headline__sub` /
 *                      `.topbar__brand` 三个节点用的是不是自定义字体。
 *                      判据 B 是「文件能不能画」，判据 C 是「页面有没有真的用它」。
 *                      两张都要过 —— 只过 B 说明字体没问题但 CSS 没接上。
 * ============================================================================
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
]

/* ------------------------------ 期望的字形集合 ------------------------------
   和 scripts/fetch-title-fonts.mjs 的 SPECS 一一对应：那边抓什么字，
   这边就验什么字。**改了那边一定要改这边**，否则探针查的字比字体多/少，
   多出来的会报假 FAIL，少掉的会漏检。 */
const EXPECTED = {
  latin: { probeFamily: 'PROBE LATIN', chars: 'TAROT·' },
  han900: { probeFamily: 'PROBE HAN900', chars: '今夜一签' },
  han400: {
    probeFamily: 'PROBE HAN400',
    chars: '日签这张牌，是今天的答案已抽出·明日再来静心片刻想着你此刻的疑问'
  }
}

/* --------------------------------- 参数 --------------------------------- */
function parseArgs(argv) {
  const opts = { w: 1600, h: 900, wait: 4500 }
  const rest = []
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--w') opts.w = Number(argv[++i])
    else if (a === '--h') opts.h = Number(argv[++i])
    else if (a === '--wait') opts.wait = Number(argv[++i])
    else if (a === '--chrome') opts.chrome = argv[++i]
    else rest.push(a)
  }
  opts.url = rest[0]
  return opts
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.events = []
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(msg.error.message)) : res(msg.result)
      } else if (msg.method) {
        this.events.push(msg)
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((res, reject) => this.pending.set(id, { resolve: res, reject }))
  }
  async waitEvent(method, timeout = 20000) {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const e = this.events.find((x) => x.method === method)
      if (e) return e
      await sleep(60)
    }
    return null
  }
}

async function fetchJson(url, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url)
      if (r.ok) return await r.json()
    } catch {
      /* 还没起来 */
    }
    await sleep(250)
  }
  throw new Error('连不上 Chrome 调试端口：' + url)
}

/* ================================ 主流程 ================================ */
const opts = parseArgs(process.argv.slice(2))
if (!opts.url) {
  console.error('用法：node scripts/probe-fonts.mjs <url> [--w 1600 --h 900]')
  process.exit(1)
}

const chrome = opts.chrome || CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('找不到 Chrome / Edge，可用 --chrome <路径> 指定')
  process.exit(1)
}

const port = 9333 + Math.floor(Math.random() * 400)
const profile = resolve(tmpdir(), `font-probe-${process.pid}-${Date.now()}-${port}`)
mkdirSync(dirname(profile), { recursive: true })

const child = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${opts.w},${opts.h}`,
    'about:blank'
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] }
)
child.stderr.on('data', () => {})

let exitCode = 0

/** 在页面里执行一段 async 函数体，返回它的值（抛异常则原样把栈带回来） */
async function evaluate(cdp, body) {
  const r = await cdp.send('Runtime.evaluate', {
    expression: `(async () => { ${body} })()`,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  })
  if (r.exceptionDetails) {
    const msg = r.exceptionDetails.exception?.description || r.exceptionDetails.text
    throw new Error('页面内脚本抛异常：' + msg)
  }
  return r.result.value
}

/** 把选择器 + 期望的探针族名，翻译成「实际渲染字体」列表 */
async function platformFonts(cdp, selector) {
  const doc = await cdp.send('DOM.getDocument', { depth: 1 })
  const { nodeId } = await cdp.send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector
  })
  if (!nodeId) return null
  const r = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
  return r.fonts.map((f) => ({
    family: f.familyName,
    glyphs: f.glyphCount,
    custom: !!f.isCustomFont
  }))
}

try {
  await fetchJson(`http://127.0.0.1:${port}/json/version`)
  const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`)
  const page = targets.find((t) => t.type === 'page')
  if (!page) throw new Error('没有可用的 page target')

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', rej, { once: true })
  })
  const cdp = new CDP(ws)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')

  console.log('导航 %s', opts.url)
  await cdp.send('Page.navigate', { url: opts.url })
  await cdp.waitEvent('Page.loadEventFired')
  await sleep(opts.wait)

  /* ---------------- 判据 A：document.fonts 的 status ---------------- */
  const faces = await evaluate(
    cdp,
    `
    await document.fonts.ready
    return [...document.fonts]
      .filter((f) => String(f.family).replace(/["']/g, '').startsWith('Tarot Title'))
      .map((f) => ({ family: String(f.family).replace(/["']/g, ''), weight: f.weight, status: f.status }))
    `
  )

  console.log('\n── 判据 A：@font-face 加载状态 ──')
  for (const f of faces) console.log(`   ${f.family.padEnd(18)} ${String(f.weight).padEnd(4)} ${f.status}`)
  const faceErrors = faces.filter((f) => f.status === 'error')
  const A_pass = faces.length === 3 && faceErrors.length === 0
  console.log(
    `   → ${A_pass ? 'PASS' : 'FAIL'}：${faces.length} 张脸，error ${faceErrors.length} 张` +
      (faces.length !== 3 ? '（期望正好 3 张：latin / han900 / han400）' : '')
  )
  if (!A_pass) exitCode = 1

  /* ------------- 准备判据 B：把三个 woff2 各自挂成唯一族名 -------------
     从页面已有 @font-face 规则里**读它自己的 src**，不在探针里硬编码路径 ——
     这样 vite dev / 生产构建 / base 改动都不会让探针失效。 */
  const prepare = await evaluate(
    cdp,
    `
    const rules = []
    for (const sheet of document.styleSheets) {
      let list
      try { list = sheet.cssRules } catch { continue }
      for (const r of list) {
        if (r.type === 5 /* CSSFontFaceRule */ && /Tarot Title/.test(r.style.fontFamily)) {
          rules.push({
            family: r.style.fontFamily.replace(/["']/g, ''),
            weight: r.style.fontWeight,
            src: r.style.src || (r.cssText.match(/url\\([^)]*\\)/) || [''])[0]
          })
        }
      }
    }
    const urlOf = (src) => (String(src).match(/url\\(["']?([^"')]+)["']?\\)/) || [])[1] || null

    const probeOf = (weight) =>
      weight === '400' ? 'PROBE HAN400' :
      weight === '900' ? 'PROBE HAN900' : 'PROBE LATIN'

    const made = []
    for (const rule of rules) {
      const url = urlOf(rule.src)
      if (!url) continue
      const name = probeOf(rule.weight)
      const ff = new FontFace(name, \`url("\${url}")\`)
      document.fonts.add(ff)
      made.push({ name, url, weight: rule.weight, face: ff })
    }
    // 逐个 load，失败的不要抛（要让调用方看到是谁失败了）
    const loaded = []
    for (const m of made) {
      try { await m.face.load(); loaded.push({ name: m.name, url: m.url, status: m.face.status }) }
      catch (e) { loaded.push({ name: m.name, url: m.url, status: 'error:' + (e.message || e) }) }
    }

    /* 渲染层：一个字形一个 span，各自只挂一个探针族名。
       font-size 用 44px 是为了让字形真的被光栅化（太小的隐藏节点有些版本
       会跳过 shaping）。放在视口右下角、pointer-events:none、字号小 → 不影响
       任何布局断言（本探针也不截图）。 */
    const box = document.createElement('div')
    box.id = '__fontprobe__'
    box.setAttribute('aria-hidden', 'true')
    box.style.cssText =
      'position:fixed;right:0;bottom:0;z-index:-1;pointer-events:none;' +
      'font-size:44px;line-height:1;white-space:nowrap;color:#fff;'
    document.body.appendChild(box)

    const spans = []
    const specs = ${JSON.stringify(EXPECTED)}
    for (const key of Object.keys(specs)) {
      for (const ch of specs[key].chars) {
        const s = document.createElement('span')
        s.dataset.probe = specs[key].probeFamily
        s.dataset.ch = ch
        // 只挂探针族名，后面**不留任何兜底族** —— 缺字就必须落到浏览器默认字体，
        // 从而在平台字体里暴露成 SimSun / Times New Roman 之类。
        s.style.fontFamily = \`"\${specs[key].probeFamily}"\`
        s.textContent = ch
        box.appendChild(s)
        spans.push(s)
      }
    }
    // 等一帧，确保 shaping 完成
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return { loaded, spans: spans.length, uniqueProbeNames: [...new Set(spans.map((s) => s.dataset.probe))] }
    `
  )

  console.log('\n── 判据 B 准备：三个 woff2 各自挂成独立族名 ──')
  /* data URI 要截断显示 —— 生产构建里小字体是内联进 CSS 的，
     直接把 base64 打出来会刷掉好几屏。 */
  const shortUrl = (u) => (u.startsWith('data:') ? u.slice(0, 46) + `…(${u.length} 字符)` : u)
  for (const l of prepare.loaded) console.log(`   ${l.name.padEnd(14)} ${l.status.padEnd(8)} ${shortUrl(l.url)}`)

  /* 逐字形问「谁画的」：给每个探针族名一个节点，一次问完。
     一次一个节点会有几十次往返，太慢；按族名分组合并成三个节点就够了 ——
     缺字会体现为「同一个节点上出现了第二个族名」。 */
  const byFamily = await evaluate(
    cdp,
    `
    const box = document.getElementById('__fontprobe__')
    const groups = {}
    for (const s of box.querySelectorAll('span[data-probe]')) {
      ;(groups[s.dataset.probe] ||= []).push(s.dataset.ch)
    }
    return Object.entries(groups).map(([name, chars]) => ({ name, chars: chars.join('') }))
    `
  )

  console.log('\n── 判据 B：逐字形实际渲染字体 ──')
  const B_fail = []
  for (const g of byFamily) {
    /* 把该组的所有字符合并成一个节点来问：族名多出来一个就是有字缺了。
       为了能指出**是哪个字**缺的，命中兜底族名时再逐字二分定位。 */
    const fams = await evaluate(
      cdp,
      `
      const box = document.getElementById('__fontprobe__')
      const old = document.getElementById('__fontprobe_group__')
      if (old) old.remove()
      const el = document.createElement('span')
      el.id = '__fontprobe_group__'
      el.style.cssText =
        'position:fixed;right:0;bottom:0;z-index:-2;pointer-events:none;' +
        'font-size:44px;line-height:1;white-space:nowrap;color:#fff;' +
        'font-family:"${g.name}"'
      el.textContent = ${JSON.stringify(g.chars)}
      document.body.appendChild(el)
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      return true
      `
    )
    void fams
    const fonts = await platformFonts(cdp, '#__fontprobe_group__')
    const list = fonts || []
    /* 唯一判据：恰好一个族，且它是 web 字体（isCustomFont）。
       不比对族名 —— 见文件头那段「反直觉的坑」。 */
    const ok = list.length === 1 && list[0].custom === true
    console.log(
      `   ${g.name.padEnd(14)} ${g.chars.length} 字 → ` +
        (list.map((f) => `${f.family}(${f.glyphs}字形)${f.custom ? '' : ' ← 系统字体!'}`).join(' + ') || '未取到')
    )
    if (!ok) {
      B_fail.push(g.name)
      /* 定位到具体是哪些字：逐字单独挂 */
      const perChar = await evaluate(
        cdp,
        `
        const box = document.getElementById('__fontprobe_box2__') || (() => {
          const b = document.createElement('div'); b.id='__fontprobe_box2__'
          b.style.cssText='position:fixed;right:0;bottom:0;z-index:-3;pointer-events:none;font-size:44px;line-height:1;white-space:nowrap;color:#fff;'
          document.body.appendChild(b); return b
        })()
        box.innerHTML = ''
        const chars = ${JSON.stringify(g.chars)}.split('')
        for (const [i, ch] of chars.entries()) {
          const s = document.createElement('span')
          s.dataset.i = String(i)
          s.style.fontFamily = '${g.name}'
          s.textContent = ch
          box.appendChild(s)
        }
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        return true
        `
      )
      void perChar
      for (let i = 0; i < g.chars.length; i += 1) {
        const f = await platformFonts(cdp, `#__fontprobe_box2__ > span[data-i="${i}"]`)
        if (!f || f.length !== 1 || f[0].custom !== true) {
          console.log(`        ✗ 「${g.chars[i]}」 U+${g.chars.codePointAt(i).toString(16).toUpperCase().padStart(4, '0')} → ${(f || []).map((x) => x.family).join('+') || '未取到'}`)
        }
      }
    }
  }
  const B_pass = B_fail.length === 0
  console.log(`   → ${B_pass ? 'PASS' : 'FAIL'}：${B_pass ? '每个字都在自己的子集里' : `缺字的子集：${B_fail.join(', ')}`}`)
  if (!B_pass) exitCode = 1

  /* ---------- 判据 C：页面真实节点有没有用上自定义字体 ---------- */
  console.log('\n── 判据 C：页面真实节点的渲染字体 ──')
  const targetsSel = ['.headline__title', '.headline__sub', '.topbar__brand']
  const C_fail = []
  for (const sel of targetsSel) {
    const fonts = await platformFonts(cdp, sel)
    const custom = (fonts || []).filter((f) => f.custom).map((f) => f.family)
    const sys = (fonts || []).filter((f) => !f.custom).map((f) => f.family)
    console.log(`   ${sel.padEnd(20)} ${(fonts || []).map((f) => `${f.family}${f.custom ? '★' : ''}(${f.glyphs})`).join(' + ') || '未取到'}`)
    /* topbar__brand 期望 latin + han 两个自定义族都在（"TAROT ·" 走 Cinzel，
       "日签" 走宋）；title/sub 期望只有自定义族、没有系统字体。
       ★ = 自定义字体（isCustomFont）。系统族名出现即视为回退。 */
    const ok = custom.length > 0 && sys.length === 0
    if (!ok) C_fail.push(sel)
  }
  const C_pass = C_fail.length === 0
  console.log(`   → ${C_pass ? 'PASS' : 'FAIL'}：${C_pass ? '三个节点全部由自定义字体绘制' : `回退到系统字体：${C_fail.join(', ')}`}`)
  if (!C_pass) exitCode = 1

  /* ------------------------------- 汇总 ------------------------------- */
  const summary = { A_faceStatus: A_pass ? 'PASS' : 'FAIL', B_glyphCoverage: B_pass ? 'PASS' : 'FAIL', C_liveRender: C_pass ? 'PASS' : 'FAIL' }
  console.log('\n汇总：', JSON.stringify(summary))
  console.log(exitCode === 0 ? '全部通过 ✓' : '有失败项 ✗')

  ws.close()
} catch (err) {
  console.error('失败：', err.message)
  exitCode = 1
} finally {
  child.kill()
  try {
    rmSync(profile, { recursive: true, force: true })
  } catch {
    /* 删不掉就算了 */
  }
}

process.exit(exitCode)
