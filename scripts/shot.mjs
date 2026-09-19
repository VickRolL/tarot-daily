/**
 * 无头截图 / 视觉自检工具（零依赖）
 * ---------------------------------------------------------------------------
 * 项目一直没有无头浏览器，构图只能靠目测，改完也不知道对不对。
 * 这个脚本直接驱动本机已装的 Chrome（Windows 上一般都有），
 * 通过 CDP（Chrome DevTools Protocol）导航、执行 JS、截图 —— 不需要装 Playwright，
 * 也不需要下载 Chromium（agent-browser / playwright 要下 500MB 左右）。
 *
 * 用法：
 *   node scripts/shot.mjs <url> <输出图> [选项]
 *
 * 选项：
 *   --w <px>          视口宽（默认 1600）
 *   --h <px>          视口高（默认 900）
 *   --wait <ms>       导航完成后额外等待多久再截图（默认 4000，等入场动画跑完）
 *   --eval <js>       截图前执行的 JS。支持 `await`，会被包成 async 函数。
 *                     例：--eval "document.querySelector('.orb').click(); await new Promise(r=>setTimeout(r,2500))"
 *   --eval-file <p>   同上，但从文件读取（长脚本用，避免命令行转义地狱）
 *   --seed <js>       先导航 → 执行这段 JS → **再导航一次**。
 *                     用来测「刷新之后」的状态（典型场景：写 localStorage 模拟今日已抽牌的回访）。
 *                     不能用 --profile 跨进程存：Chrome 被 kill 时 localStorage 还没落盘，实测必然为空。
 *   --gpu             不传 --disable-gpu，用真实 GPU 光栅化。
 *                     默认的软件光栅化在**超大图层 + 滤镜**下会降质甚至丢图层，
 *                     怀疑「某处画错了」时用它对照，能立刻区分「真 bug」和「无头渲染的锅」。
 *   --chrome <path>   指定 Chrome 可执行文件
 *   --reduced         模拟 `prefers-reduced-motion: reduce`（在导航前设置，才能影响挂载时的 matchMedia）
 *   --profile <dir>   用户数据目录（默认临时目录；同一 profile 会保留 localStorage）
 *   --print           只打印页面信息，不截图
 *
 * 例：
 *   node scripts/shot.mjs http://127.0.0.1:5173/ shot.png --w 1600 --h 900 --wait 5000
 *   node scripts/shot.mjs http://127.0.0.1:5173/ shot.png --eval-file scripts/_flow-reveal.js
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
]

function parseArgs(argv) {
  const opts = { w: 1600, h: 900, wait: 4000, print: false }
  const rest = []
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--w') opts.w = Number(argv[++i])
    else if (a === '--h') opts.h = Number(argv[++i])
    else if (a === '--wait') opts.wait = Number(argv[++i])
    else if (a === '--eval') opts.eval = argv[++i]
    else if (a === '--eval-file') opts.evalFile = argv[++i]
    else if (a === '--seed') opts.seed = argv[++i]
    else if (a === '--reduced') opts.reduced = true
    else if (a === '--gpu') opts.gpu = true
    else if (a === '--chrome') opts.chrome = argv[++i]
    else if (a === '--profile') opts.profile = argv[++i]
    else if (a === '--print') opts.print = true
    else rest.push(a)
  }
  opts.url = rest[0]
  opts.out = rest[1]
  return opts
}

function findChrome(explicit) {
  if (explicit) return existsSync(explicit) ? explicit : null
  return CHROME_CANDIDATES.find((p) => existsSync(p))
}

/* ----------------------------- 极简 CDP 客户端 ----------------------------- */
class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.events = []
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
      } else if (msg.method) {
        this.events.push(msg)
      }
    })
  }

  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }

  /** 等某个 CDP 事件（已经收到过的也算） */
  async waitEvent(method, timeout = 15000) {
    const hit = this.events.find((e) => e.method === method)
    if (hit) return hit
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
      /* 浏览器还没起来，继续等 */
    }
    await sleep(250)
  }
  throw new Error('连不上 Chrome 调试端口：' + url)
}

/* ---------------------------------- 主流程 --------------------------------- */
const opts = parseArgs(process.argv.slice(2))
if (!opts.url) {
  console.error(
    '用法：node scripts/shot.mjs <url> <输出图> [--w 1600 --h 900 --wait 4000 --eval "..." --eval-file path --seed "..." --reduced]'
  )
  process.exit(1)
}

const chrome = findChrome(opts.chrome)
if (!chrome) {
  console.error('找不到 Chrome / Edge，可用 --chrome <路径> 指定')
  process.exit(1)
}

const port = 9333 + Math.floor(Math.random() * 400)
/* 临时 profile 名要带上进程号与时间戳：只用随机端口命名的话，
   上一轮删不掉的残留目录（Chrome 退出时文件常被占用，rmSync 会失败）
   有可能被这一轮的随机端口撞上，于是带着旧的 localStorage 跑起来 ——
   实测就因此误判过一次「今日已抽牌」的回访分支。
   要跨进程保留状态请显式用 --profile。 */
const profile = opts.profile
  ? resolve(opts.profile)
  : resolve(tmpdir(), `shot-profile-${process.pid}-${Date.now()}-${port}`)
mkdirSync(dirname(resolve(opts.out || 'out.png')), { recursive: true })

const child = spawn(
  chrome,
  [
    '--headless=new',
    /* 默认走软件光栅化（最稳、可复现）。但如果页面里有**超大图层 + 滤镜**，
       软件光栅化会悄悄降质甚至丢掉某些图层（实测：信封放大到 2400px 后，
       SVG 里的火漆封印整个不画）。要判断某处「是不是真的画错了」，
       加 --gpu 用真实 GPU（headless 下走 SwiftShader）再截一张对比 */
    ...(opts.gpu ? [] : ['--disable-gpu']),
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

  /* 必须在导航**之前**设置，否则 App 挂载时读到的 matchMedia 还是旧值 */
  if (opts.reduced) {
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    })
  }

  const navigate = async (url) => {
    cdp.events.length = 0
    await cdp.send('Page.navigate', { url })
    await cdp.waitEvent('Page.loadEventFired')
  }

  console.log('导航 %s', opts.url)
  await navigate(opts.url)

  /* --seed：先在真实源下执行一段 JS（通常是写 localStorage），
     再重新导航一次 —— 这样 App 会在「已经有本地状态」的前提下重新挂载，
     等价于用户刷新页面，才能真正测到「回访」分支。 */
  if (opts.seed) {
    const seeded = await cdp.send('Runtime.evaluate', {
      expression: `(async () => { ${opts.seed} })()`,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    })
    if (seeded.exceptionDetails) {
      console.error(
        '--seed 抛异常：',
        seeded.exceptionDetails.exception?.description || seeded.exceptionDetails.text
      )
      exitCode = 2
    } else if (seeded.result && seeded.result.value !== undefined) {
      console.log('--seed 返回：', JSON.stringify(seeded.result.value))
    }
    await navigate(opts.url)
  }

  await sleep(opts.wait)

  let evalSource = opts.eval
  if (opts.evalFile) evalSource = readFileSync(resolve(opts.evalFile), 'utf8')

  if (evalSource) {
    const wrapped = `(async () => { ${evalSource} })()`
    const r = await cdp.send('Runtime.evaluate', {
      expression: wrapped,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    })
    if (r.exceptionDetails) {
      console.error('--eval 抛异常：', r.exceptionDetails.exception?.description || r.exceptionDetails.text)
      exitCode = 2
    }
    if (r.result && r.result.value !== undefined) console.log('--eval 返回：', JSON.stringify(r.result.value))
  }

  const info = await cdp.send('Runtime.evaluate', {
    expression: `JSON.stringify({
      url: location.href,
      title: document.title,
      viewport: [innerWidth, innerHeight],
      scrollHeight: document.documentElement.scrollHeight,
      scripts: document.scripts.length
    })`,
    returnByValue: true
  })
  console.log('页面：', info.result.value)

  if (!opts.print && opts.out) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const outPath = resolve(opts.out)
    writeFileSync(outPath, Buffer.from(shot.data, 'base64'))
    console.log('截图已保存：%s', outPath)
  }

  ws.close()
} catch (err) {
  console.error('失败：', err.message)
  exitCode = 1
} finally {
  child.kill()
  if (!opts.profile) {
    // 临时 profile 用完即删，不占磁盘
    try {
      rmSync(profile, { recursive: true, force: true })
    } catch {
      /* 删不掉就算了 */
    }
  }
}

process.exit(exitCode)
