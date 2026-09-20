/**
 * ab.mjs —— 轻量「Agent Browser」：用 CDP 驱动本机 Chrome 做真实网页交互
 * ---------------------------------------------------------------------------
 * 为什么不装 agent-browser / Playwright：它们要下载约 500 MB 的 Chromium，
 * 而本机已经有 Chrome，这个脚本只借它用 —— 零下载、秒开。
 *
 * 更要紧的是**人在环里**：有些流程必须用户亲手登录（扫码 / 输密码 / 短信验证），
 * 无头浏览器给不出窗口，人就没法介入。所以这里默认是**有头**。
 *
 * 核心设计：Chrome 由 `start` 拉起后**常驻**（detached + unref），
 * 之后每条命令都是「连上去 → 做一件事 → 断开」。
 * 登录态 / localStorage / cookie / 标签页因此跨命令、跨轮次保留 ——
 * 这是「第一轮让你登录，第二轮我接着点」能成立的前提。
 *
 * ---------------------------------------------------------------------------
 * 用法：
 *   node scripts/ab.mjs start [--url <url>] [--w 1440] [--h 900] [--headless]
 *   node scripts/ab.mjs status                      # 活着吗 / 现在在哪个页面
 *   node scripts/ab.mjs pages                       # 列出全部标签页（带编号）
 *   node scripts/ab.mjs goto <url> [--target N]
 *   node scripts/ab.mjs snap [--target N]           # 可交互元素清单（带 @N 编号）
 *   node scripts/ab.mjs text [--max 6000]           # 页面可见文本
 *   node scripts/ab.mjs click <sel>
 *   node scripts/ab.mjs type <sel> <text>
 *   node scripts/ab.mjs press <key> [<key>...]      # Enter / Tab / PageDown / Escape
 *   node scripts/ab.mjs eval <js> [--file <path>]
 *   node scripts/ab.mjs wait <js> [--timeout 120000] [--every 1500]
 *   node scripts/ab.mjs shot <out.png> [--full]
 *   node scripts/ab.mjs dl <dir>                    # 把下载目录指到那里
 *   node scripts/ab.mjs close
 *
 * <sel> 语法：
 *   @12         上一次 `snap` 打出的编号（页面里落成 data-ab-idx="12"）
 *   其它        原样当 CSS 选择器用
 *
 * ---------------------------------------------------------------------------
 * 踩过的坑（都不是理论，是实测）：
 *
 *  1. **React 受控输入框**：直接 `el.value = x` 不会触发 React 的 onChange，
 *     界面上看着填进去了、一点提交却是空。必须拿原型上的 value setter 赋值、
 *     再手派 input 事件。所以 type 走「先真输入、读回校验、不对再用 setter 兜底」。
 *  2. **点击要用真实鼠标事件**（Input.dispatchMouseEvent），不要 el.click()：
 *     有的组件查 `event.isTrusted`，合成点击被静默丢弃 —— 表现是「点了没反应且零报错」。
 *  3. **点击前必须把元素滚进视口**，否则 rect 是负值或超出视口高度，
 *     鼠标事件打在空白处。scrollIntoView 后要等两帧再取 rect，坐标才是稳的。
 *  4. **CDP 的 snap 必须重打**：SPA 重新渲染会洗掉 data-ab-idx。
 *     @N 编号只在「一次 snap 之后、页面没大变之前」有效。
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'
import process from 'node:process'

/* ------------------------------- 环境与状态 ------------------------------- */

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
]

const PORT = Number(process.env.AB_PORT || 9444)
const STATE_FILE = join(tmpdir(), 'ab-mjs-state.json')
const DEFAULT_PROFILE = join(tmpdir(), 'ab-chrome-profile')

function findChrome() {
  return CHROME_CANDIDATES.find((p) => existsSync(p)) || null
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return null
  }
}

function writeState(s) {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2))
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
    return new Promise((res, rej) => this.pending.set(id, { resolve: res, reject: rej }))
  }

  async waitEvent(method, timeout = 20000) {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const hit = this.events.find((e) => e.method === method)
      if (hit) return hit
      await sleep(50)
    }
    return null
  }
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', () => rej(new Error('CDP WebSocket 连接失败：' + wsUrl)), {
      once: true
    })
  })
  return { ws, cdp: new CDP(ws) }
}

async function httpJson(path, tries = 1) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}${path}`)
      if (r.ok) return await r.json()
    } catch {
      /* 还没起来 */
    }
    if (i < tries - 1) await sleep(250)
  }
  throw new Error(`连不上 Chrome 调试端口 ${PORT}（先跑 start）`)
}

async function listPages() {
  const all = await httpJson('/json/list')
  return all.filter((t) => t.type === 'page')
}

/** 取目标标签页。默认第 0 个；用户手动开了新标签时用 --target 指定 */
async function pickPage(targetIdx = 0) {
  const pages = await listPages()
  if (!pages.length) throw new Error('没有 page target，Chrome 可能已经关掉了')
  const p = pages[targetIdx]
  if (!p) throw new Error(`没有第 ${targetIdx} 个标签页（共 ${pages.length} 个）`)
  return p
}

/** 连上某个标签页，跑一段逻辑，然后断开（Chrome 本身不关） */
async function withPage(fn, targetIdx = 0) {
  const page = await pickPage(targetIdx)
  const { ws, cdp } = await connect(page.webSocketDebuggerUrl)
  try {
    await cdp.send('Runtime.enable')
    return await fn(cdp, page)
  } finally {
    ws.close()
  }
}

/* ------------------------------ 页面内小工具 ------------------------------ */

const js = (v) => JSON.stringify(v)

async function evalIn(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', {
    expression: `(async () => { ${expression} })()`,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  })
  if (r.exceptionDetails) {
    const d = r.exceptionDetails.exception?.description || r.exceptionDetails.text
    throw new Error('页面里抛异常：' + d)
  }
  return r.result ? r.result.value : undefined
}

/** @12 → [data-ab-idx="12"]；其它原样 */
function toSelector(sel) {
  const m = /^@(\d+)$/.exec(String(sel || '').trim())
  return m ? `[data-ab-idx="${m[1]}"]` : sel
}

/** 滚进视口并等两帧，返回中心点坐标
 *
 * ⚠️ **必须给 rAF 加超时兜底**（2026-09-20 踩到，症状极难猜）：
 *    窗口处于**后台/最小化**时 `requestAnimationFrame` **根本不触发** ——
 *    于是 `await Promise.race([...])` 里的等待永不 resolve，
 *    `awaitPromise: true` 的 Runtime.evaluate 就永远挂着，
 *    表现是 click / type 这类命令**静默卡死**（外部看就是 SIGTERM 被杀），
 *    而 text / snap / eval 全都正常（它们不碰 rAF）——
 *    很容易误判成「元素找不到」或「站点拦了点击」。
 *    超时用 1200ms：后台标签的 setTimeout 会被节流到 ~1s 粒度，要留出余量。
 */
async function centerOf(cdp, selector) {
  return await evalIn(
    cdp,
    `
    const el = document.querySelector(${js(selector)});
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    await Promise.race([
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      new Promise((r) => setTimeout(r, 1200))
    ]);
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height, top: b.top };
  `
  )
}

/* --------------------------------- 命令 --------------------------------- */

const ARGS = process.argv.slice(2)
const CMD = ARGS[0]

function flag(name, def) {
  const i = ARGS.indexOf('--' + name)
  return i >= 0 ? ARGS[i + 1] : def
}
function has(name) {
  return ARGS.includes('--' + name)
}
/** 去掉所有 --flag 与其值，剩下的就是位置参数 */
function positionals() {
  const out = []
  const withValue = new Set([
    'url', 'w', 'h', 'target', 'max', 'file', 'timeout', 'every', 'profile', 'chrome'
  ])
  for (let i = 1; i < ARGS.length; i += 1) {
    const a = ARGS[i]
    if (a.startsWith('--')) {
      const name = a.slice(2)
      if (withValue.has(name)) i += 1
      continue
    }
    out.push(a)
  }
  return out
}

const POS = positionals()

async function cmdStart() {
  const live = await httpJson('/json/version', 1).catch(() => null)
  if (live) {
    console.log('已经在跑了：', live.Browser, '（端口', PORT, '）')
    console.log('要重开先 close')
    return
  }
  const chrome = flag('chrome') || findChrome()
  if (!chrome) throw new Error('找不到 Chrome / Edge，可用 --chrome <路径> 指定')
  const profile = resolve(flag('profile') || DEFAULT_PROFILE)
  mkdirSync(profile, { recursive: true })
  const url = flag('url') || 'about:blank'
  const w = flag('w', 1440)
  const h = flag('h', 900)
  const headless = has('headless')

  const child = spawn(
    chrome,
    [
      ...(headless ? ['--headless=new'] : []),
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=Translate,OptimizationHints',
      /* 窗口被别的窗口挡住时 Chrome 会降低渲染优先级，交互仍然很稳 */
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      `--window-size=${w},${h}`,
      url
    ],
    { detached: true, stdio: 'ignore' }
  )
  child.unref()

  const v = await httpJson('/json/version', 80)
  const pages = await listPages()
  writeState({
    pid: child.pid,
    port: PORT,
    profile,
    chrome,
    startedAt: new Date().toISOString()
  })
  console.log('已启动：', v.Browser)
  console.log('  pid     ', child.pid)
  console.log('  profile ', profile)
  console.log('  标签页  ', pages.length, pages.map((p) => p.url).join(' | '))
  if (!headless) console.log('\n窗口应该已经弹出来了（有头模式，你可以直接在里面操作）。')
}

/**
 * hold —— 启动 Chrome 并**保持不退出**（前台挂住，直到浏览器被关掉）。
 *
 * 为什么需要它：本机的 bash 每次命令结束都会清理子进程，连 `detached: true`
 * 都逃不掉（实测 pid 秒变 ESRCH、端口随即 closed）。所以 `start` 起的浏览器
 * 活不过一条命令。
 *
 * 对策是把它挂在一个**后台任务**上：后台任务的进程只要不退出，
 * 它作为直接子进程的 Chrome 就活着。于是 Chrome 才能跨命令、跨轮次存在 ——
 * 而"让用户慢慢扫码登录、我随后接着点"这条路，全靠这一点才走得通。
 */
async function cmdHold() {
  const live = await httpJson('/json/version', 1).catch(() => null)
  if (live) {
    console.log('Chrome 已在运行（', live.Browser, '），hold 无需再起')
    return
  }
  const chrome = flag('chrome') || findChrome()
  if (!chrome) throw new Error('找不到 Chrome / Edge')
  const profile = resolve(flag('profile') || DEFAULT_PROFILE)
  mkdirSync(profile, { recursive: true })
  const url = flag('url') || 'about:blank'

  const child = spawn(
    chrome,
    [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=Translate,OptimizationHints',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      `--window-size=${flag('w', 1440)},${flag('h', 920)}`,
      url
    ],
    { stdio: 'ignore' }
  )

  const v = await httpJson('/json/version', 80)
  writeState({
    pid: child.pid,
    port: PORT,
    profile,
    chrome,
    startedAt: new Date().toISOString()
  })
  console.log('Chrome 已启动并保持中：', v.Browser)
  console.log('  pid     ', child.pid)
  console.log('  profile ', profile)
  console.log('  url     ', url)
  console.log('窗口是真实存在的，可以直接在里面操作。（关掉窗口 / 结束后台任务才会退出）')

  await new Promise((res) => {
    child.on('exit', (code) => {
      console.log('Chrome 已退出，code =', code)
      res()
    })
  })
}

async function cmdStatus() {
  const st = readState()
  const v = await httpJson('/json/version', 1).catch(() => null)
  if (!v) {
    console.log('未运行（端口', PORT, '无响应）')
    return
  }
  const pages = await listPages()
  console.log('运行中：', v.Browser)
  if (st) console.log('  启动于 ', st.startedAt, ' profile:', st.profile)
  console.log('  标签页 ', pages.length)
  for (const [i, p] of pages.entries()) {
    console.log(`    [${i}] ${p.title || '(无标题)'}`)
    console.log(`        ${p.url}`)
  }
}

async function cmdPages() {
  const pages = await listPages()
  for (const [i, p] of pages.entries()) {
    console.log(`[${i}] ${p.title || '(无标题)'}`)
    console.log(`    ${p.url}`)
  }
}

async function cmdGoto() {
  const url = POS[0]
  if (!url) throw new Error('用法：goto <url>')
  const targetIdx = Number(flag('target', 0))
  await withPage(async (cdp) => {
    cdp.events.length = 0
    await cdp.send('Page.enable')
    await cdp.send('Page.navigate', { url })
    await cdp.waitEvent('Page.loadEventFired', 30000)
    const info = await evalIn(
      cdp,
      `await new Promise(r => setTimeout(r, 1500)); return { url: location.href, title: document.title, ready: document.readyState };`
    )
    console.log(JSON.stringify(info))
  }, targetIdx)
}

const SNAP_JS = `
  const SEL = 'a,button,input,textarea,select,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="switch"],[contenteditable="true"]';
  const rows = [];
  let i = 0;
  for (const el of document.querySelectorAll(SEL)) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width < 1 || r.height < 1) continue;
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    el.setAttribute('data-ab-idx', String(i));
    const isField = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
    const raw = isField
      ? (el.placeholder || el.value || el.getAttribute('aria-label') || '')
      : (el.innerText || el.getAttribute('aria-label') || el.title || '');
    rows.push({
      i,
      tag: el.tagName.toLowerCase() + (el.getAttribute('type') ? ':' + el.getAttribute('type') : ''),
      label: String(raw).replace(/\\s+/g, ' ').trim().slice(0, 70),
      cls: (typeof el.className === 'string' ? el.className : '').split(/\\s+/).filter(Boolean).slice(0, 3).join(' '),
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      off: r.bottom < 0 || r.top > innerHeight ? 1 : 0,
      dis: el.disabled ? 1 : 0
    });
    i++;
  }
  return { url: location.href, title: document.title, vp: [innerWidth, innerHeight], n: rows.length, rows };
`

async function cmdSnap() {
  const targetIdx = Number(flag('target', 0))
  await withPage(async (cdp) => {
    const d = await evalIn(cdp, SNAP_JS)
    console.log(`页面：${d.title}`)
    console.log(`地址：${d.url}`)
    console.log(`视口：${d.vp[0]}×${d.vp[1]}    可交互元素：${d.n}`)
    console.log('-'.repeat(100))
    const max = Number(flag('max', 999))
    for (const r of d.rows.slice(0, max)) {
      const tags = [r.dis ? 'disabled' : '', r.off ? 'offscreen' : ''].filter(Boolean).join(',')
      console.log(
        `@${String(r.i).padEnd(3)} ${r.tag.padEnd(16)} ${('"' + r.label + '"').padEnd(56)} ` +
          `[${r.rect.join(',')}] ${tags}`
      )
      if (r.cls) console.log(`     .${r.cls}`)
    }
  }, targetIdx)
}

async function cmdText() {
  const max = Number(flag('max', 6000))
  await withPage(async (cdp) => {
    const t = await evalIn(
      cdp,
      `return { url: location.href, text: (document.body ? document.body.innerText : '').replace(/\\n{3,}/g, '\\n\\n') };`
    )
    console.log('地址：' + t.url)
    const s = t.text || ''
    console.log(s.length > max ? s.slice(0, max) + `\n…（截断，共 ${s.length} 字符）` : s)
  }, Number(flag('target', 0)))
}

async function cmdClick() {
  const sel = toSelector(POS[0])
  if (!sel) throw new Error('用法：click <sel>（@12 或 CSS 选择器）')
  await withPage(async (cdp) => {
    const c = await centerOf(cdp, sel)
    if (!c) throw new Error('找不到元素：' + sel)
    const base = { x: Math.round(c.x), y: Math.round(c.y), button: 'left', clickCount: 1 }
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: base.x, y: base.y })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base })
    await sleep(40)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base })
    console.log(`已点 (${base.x}, ${base.y}) 元素 ${c.w}×${c.h}  ${sel}`)
  }, Number(flag('target', 0)))
}

async function cmdType() {
  const [rawSel, text] = POS
  const sel = toSelector(rawSel)
  if (!sel || text === undefined) throw new Error('用法：type <sel> <text>')
  await withPage(async (cdp) => {
    const c = await centerOf(cdp, sel)
    if (!c) throw new Error('找不到输入框：' + sel)
    /* 先点一下让它真的获得焦点（有些组件靠 mousedown 才进入编辑态） */
    const base = { x: Math.round(c.x), y: Math.round(c.y), button: 'left', clickCount: 1 }
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base })

    /* 清空：选中全部已有内容，随后的 insertText 会替换掉 */
    await evalIn(
      cdp,
      `const el = document.querySelector(${js(sel)});
       el.focus();
       if (el.select) { try { el.select(); } catch (e) {} }
       return true;`
    )
    await cdp.send('Input.insertText', { text })

    /* 读回校验 —— insertText 对付不了的地方（富文本、受控组件拦截）用 setter 兜底 */
    const back = await evalIn(
      cdp,
      `const el = document.querySelector(${js(sel)});
       return el.isContentEditable ? (el.innerText || '') : (el.value || '');`
    )
    if (back !== text) {
      await evalIn(
        cdp,
        `const el = document.querySelector(${js(sel)});
         const want = ${js(text)};
         el.focus();
         if (el.isContentEditable) {
           el.textContent = want;
         } else {
           const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
           const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
           setter.call(el, want);
         }
         el.dispatchEvent(new InputEvent('input', { bubbles: true, data: want, inputType: 'insertText' }));
         el.dispatchEvent(new Event('change', { bubbles: true }));
         return true;`
      )
      const back2 = await evalIn(
        cdp,
        `const el = document.querySelector(${js(sel)});
         return el.isContentEditable ? (el.innerText || '') : (el.value || '');`
      )
      console.log(
        `已填 ${text.length} 字（setter 兜底，回读 ${back2.length} 字）` +
          (back2 === text ? ' ✓' : ' ⚠ 回读与写入不一致')
      )
    } else {
      console.log(`已填 ${text.length} 字（真输入，回读一致）✓`)
    }
  }, Number(flag('target', 0)))
}

/**
 * click-text —— 按**可见文本**点击（真实鼠标事件）。
 *
 * 为什么要单独有它：
 *  ① 有些按钮的 innerText 前面带着图标换行符（实测是 "\n下载"），
 *     写精确文本匹配或 CSS 选择器都很脆；
 *  ② `el.click()` 是**合成**事件（isTrusted=false），会被查 isTrusted 的组件
 *     静默丢弃 —— 表现是「点了没反应、且零报错」，最难查的那类。
 * 这里走「按文本找最内层 → 滚进视口 → Input.dispatchMouseEvent」。
 */
async function cmdClickText() {
  const want = POS[0]
  if (!want) throw new Error('用法：click-text <可见文本> [--exact] [--vw 2000] [--vh 1000]')
  const exact = has('exact')
  const vw = Number(flag('vw', 0))
  await withPage(async (cdp) => {
    /* 页面横向溢出时，元素会落在视口右侧外面（实测某按钮 x=1671 而视口只有 1427），
       此时鼠标事件打在空气上、静默失败。先把视口撑宽，等 reflow 完成再算坐标。 */
    if (vw) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vw,
        height: Number(flag('vh', 1000)),
        deviceScaleFactor: 1,
        mobile: false
      })
      await sleep(800)
    }
    const box = await evalIn(
      cdp,
      `
      const want = ${js(want)};
      const cand = [...document.querySelectorAll('button, a, [role="button"], span, div, li')]
        .filter((el) => {
          const s = (el.innerText || '').trim();
          if (!s) return false;
          const hit = ${exact ? 's === want' : 's.includes(want)'};
          return hit && s.length <= want.length + 14;
        });
      if (!cand.length) return null;
      cand.sort((a, b) => (a.innerText || '').trim().length - (b.innerText || '').trim().length);
      const el = cand[0];
      el.scrollIntoView({ block: 'center' });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const b = el.getBoundingClientRect();
      return {
        x: b.x + b.width / 2,
        y: b.y + b.height / 2,
        w: Math.round(b.width),
        h: Math.round(b.height),
        tag: el.tagName,
        text: (el.innerText || '').trim().slice(0, 30)
      };
    `
    )
    if (!box) throw new Error('找不到文本为「' + want + '」的可点元素')
    const base = { x: Math.round(box.x), y: Math.round(box.y), button: 'left', clickCount: 1 }
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: base.x, y: base.y })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base })
    await sleep(50)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base })
    console.log(`已点「${box.text}」(${box.tag} ${box.w}×${box.h}) @ ${base.x},${base.y}`)
  }, Number(flag('target', 0)))
}

async function cmdPress() {
  const keys = POS
  if (!keys.length) throw new Error('用法：press <key> [<key>...]')
  const VK = {
    Enter: 13, Tab: 9, Escape: 27, Backspace: 8, Delete: 46,
    ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39,
    PageDown: 34, PageUp: 33, Home: 36, End: 35, ' ': 32
  }
  await withPage(async (cdp) => {
    for (const k of keys) {
      const code = VK[k] || (k.length === 1 ? k.toUpperCase().charCodeAt(0) : null)
      if (!code) throw new Error('不认识的键：' + k)
      const common = { key: k, code: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code }
      await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...common })
      if (k.length === 1) await cdp.send('Input.dispatchKeyEvent', { type: 'char', text: k, ...common })
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...common })
      await sleep(120)
    }
    console.log('已按：' + keys.join(' '))
  }, Number(flag('target', 0)))
}

async function cmdEval() {
  let src = POS[0]
  const f = flag('file')
  if (f) src = readFileSync(resolve(f), 'utf8')
  if (!src) throw new Error('用法：eval <js>  或  eval --file <path>')
  await withPage(async (cdp) => {
    /* ⚠️ evalIn 会把源码包进 `(async () => { … })()`，所以**没写 return 的纯表达式**
       会静默返回 undefined（`eval "1+1"` 也是 undefined —— 这个坑很坑人：
       看起来像「页面上找不到东西」，其实是「值没交回来」）。
       所以这里先按「表达式」调一次：能过就天然把值带回来；
       真遇到多语句脚本（作为表达式是 SyntaxError）再退回原样执行。
       ⚠️ 反过来也要小心：**运行期异常不能被当成语法问题吞掉**，所以只在
       SyntaxError 时回退，其它异常原样抛。 */
    let v
    try {
      v = await evalIn(cdp, `return (${src});`)
    } catch (e) {
      if (!/SyntaxError/.test(String(e.message))) throw e
      v = await evalIn(cdp, src)
    }
    console.log('--eval 返回：', JSON.stringify(v))
  }, Number(flag('target', 0)))
}

async function cmdWait() {
  const cond = POS[0]
  if (!cond) throw new Error('用法：wait "<js 表达式>" [--timeout 120000] [--every 1500]')
  const timeout = Number(flag('timeout', 120000))
  const every = Number(flag('every', 1500))
  const t0 = Date.now()
  let last
  while (Date.now() - t0 < timeout) {
    try {
      last = await withPage(
        async (cdp) => await evalIn(cdp, `return (${cond});`),
        Number(flag('target', 0))
      )
      if (last) {
        console.log(`条件成立（等了 ${((Date.now() - t0) / 1000).toFixed(1)}s）：`, JSON.stringify(last))
        return
      }
    } catch (e) {
      last = 'ERR: ' + e.message
    }
    await sleep(every)
  }
  console.log(`超时 ${timeout}ms，条件始终不成立。最后一次值：`, JSON.stringify(last))
  process.exitCode = 1
}

async function cmdShot() {
  const out = POS[0]
  if (!out) throw new Error('用法：shot <out.png> [--full]')
  await withPage(async (cdp) => {
    await cdp.send('Page.enable')
    const r = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: has('full')
    })
    const p = resolve(out)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, Buffer.from(r.data, 'base64'))
    console.log('截图已保存：', p)
  }, Number(flag('target', 0)))
}

async function cmdDl() {
  const dir = POS[0]
  if (!dir) throw new Error('用法：dl <dir>')
  const abs = resolve(dir)
  mkdirSync(abs, { recursive: true })
  /* 先试 page 级 session；不行再连 browser 级 */
  let ok = false
  try {
    await withPage(async (cdp) => {
      await cdp.send('Browser.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: abs,
        eventsEnabled: true
      })
      ok = true
    })
  } catch {
    /* 落到下面 */
  }
  if (!ok) {
    const v = await httpJson('/json/version')
    const { ws, cdp } = await connect(v.webSocketDebuggerUrl)
    await cdp.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: abs,
      eventsEnabled: true
    })
    ws.close()
    ok = true
  }
  console.log('下载目录已指向：', abs)
}

async function cmdClose() {
  const v = await httpJson('/json/version', 2).catch(() => null)
  if (!v) {
    console.log('本来就没在跑')
    try { unlinkSync(STATE_FILE) } catch {}
    return
  }
  const { ws, cdp } = await connect(v.webSocketDebuggerUrl)
  try {
    await cdp.send('Browser.close')
  } catch {
    /* 关的过程中连接断掉是正常的 */
  }
  ws.close()
  await sleep(800)
  try { unlinkSync(STATE_FILE) } catch {}
  console.log('已关闭')
}

/* --------------------------------- 入口 --------------------------------- */

const TABLE = {
  start: cmdStart,
  hold: cmdHold,
  status: cmdStatus,
  pages: cmdPages,
  goto: cmdGoto,
  snap: cmdSnap,
  text: cmdText,
  click: cmdClick,
  'click-text': cmdClickText,
  type: cmdType,
  press: cmdPress,
  eval: cmdEval,
  wait: cmdWait,
  shot: cmdShot,
  dl: cmdDl,
  close: cmdClose
}

if (!CMD || !TABLE[CMD]) {
  console.log(
    '命令：start | status | pages | goto | snap | text | click | type | press | eval | wait | shot | dl | close'
  )
  process.exit(CMD ? 1 : 0)
}

try {
  await TABLE[CMD]()
} catch (err) {
  console.error('失败：', err.message)
  process.exitCode = 1
}
process.exit(process.exitCode || 0)
