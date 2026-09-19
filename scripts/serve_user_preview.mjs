/**
 * 给离线副本起一个本地静态服务器（零依赖），并自动打开浏览器
 * ==========================================================================
 * 什么时候需要它
 * --------------------------------------------------------------------------
 * 离线副本**双击 index.html 就能看**（两处 file:// 适配见 scripts/lib/offline.mjs），
 * 但有一处功能双击时不可用：「生成分享卡片」。
 * 那一步要把卡面画进 Canvas 再读回像素，而 file:// 加载的图片会**污染 canvas**，
 * 浏览器会拒绝读回（安全限制，改路径绕不过去）。
 *
 * 所以「连分享卡片一起看」的正确姿势是起一个 http 服务。
 * 本脚本起完会**自动在默认浏览器打开页面**，等于一键。
 * （根目录的 start-user-preview.cmd / 启动开发者版.cmd 是给不熟悉命令行的人用的双击入口。）
 *
 * 用法：
 *   node scripts/serve_user_preview.mjs [端口] [--dir dist-dev] [--no-open]
 * 默认端口 8080；默认目录 dist-user（要开发者版就 --dir dist-dev）。
 */

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, resolve, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const NO_OPEN = argv.includes('--no-open')
const PORT = Number(argv.find((a) => /^\d+$/.test(a))) || 8080
/* --dir <目录名>：默认用户版；dist-dev 是开发者版 */
const DIR_NAME = (() => {
  const i = argv.indexOf('--dir')
  return i >= 0 && argv[i + 1] ? argv[i + 1].replace(/[/\\]+$/, '') : 'dist-user'
})()
const DIST = join(ROOT, DIR_NAME)

const LABEL = DIR_NAME === 'dist-dev' ? '开发者版' : '用户视角'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
}

if (!existsSync(DIST)) {
  console.error(`没有 ${DIR_NAME}/，先生成它：`)
  console.error(DIR_NAME === 'dist-dev' ? '  node scripts/build_dev_preview.mjs' : '  node scripts/build_user_preview.mjs')
  process.exit(1)
}

/* 启动前自检：确认 index.html 真的引了脚本，避免「服务起着但页面是白的」 */
const indexPath = join(DIST, 'index.html')
const indexHTML = await readFile(indexPath, 'utf8').catch(() => '')
if (!indexHTML) {
  console.error(`读不到 ${indexPath}`)
  process.exit(1)
}
const entry = indexHTML.match(/<script[^>]+src="([^"]+)"/)?.[1]
if (!entry) {
  console.error('index.html 里找不到入口 script —— 产物不完整，请重新构建。')
  process.exit(1)
}
const entryPath = join(DIST, normalize(entry).replace(/^([/\\])+/, ''))
if (!existsSync(entryPath)) {
  console.error(`入口脚本不存在：${entryPath}\n产物不完整，请重新构建。`)
  process.exit(1)
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    let rel = decodeURIComponent(url.pathname)
    if (rel === '/' || rel.endsWith('/')) rel += 'index.html'

    /* 防目录穿越 */
    const target = join(DIST, normalize(rel).replace(/^([/\\])+/, ''))
    if (!target.startsWith(DIST)) {
      res.writeHead(403).end('Forbidden')
      return
    }

    const info = await stat(target).catch(() => null)
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404')
      console.log(`404 ${rel}`)
      return
    }

    const body = await readFile(target)
    res.writeHead(200, {
      'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-cache'
    })
    res.end(body)
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('500')
    console.error(err)
  }
})

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/`
  console.log(`\n${LABEL}预览：${url}`)
  console.log(`根目录：${DIST}`)
  console.log('Ctrl+C 停止\n')

  if (!NO_OPEN) {
    /* Windows 用 start（注意第一个参数是窗口标题，不能省，否则路径带空格会出错）；
       macOS 用 open；Linux 用 xdg-open。用 detached 让浏览器独立于本进程。 */
    const cmd =
      process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : process.platform === 'darwin'
          ? ['open', [url]]
          : ['xdg-open', [url]]
    try {
      spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref()
      console.log('已在默认浏览器打开。若没弹出，手动访问上面的地址。')
    } catch {
      console.log('自动打开浏览器失败，请手动访问上面的地址。')
    }
  }
})
