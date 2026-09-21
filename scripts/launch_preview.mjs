#!/usr/bin/env node
/**
 * 塔罗日签 —— 本地预览启动器（零依赖）
 *
 * 干什么：
 *   1. 检查构建产物。dist 缺失、或源码比 dist 新，就自动跑一次 vite build
 *      （直接调 node_modules/vite/bin/vite.js，不走 npm —— 本机 npm 会拉起 wsl.exe 被安全策略拦）。
 *   2. 起一个带 Range 支持的静态服务（音频要靠 206 响应才能拖动进度、边播边缓冲）。
 *   3. 自动打开默认浏览器；重复双击时若服务已在跑，不再起第二个，直接开页面。
 *
 * 用法：
 *   node scripts/launch_preview.mjs [--root dist] [--port 5180] [--no-open] [--no-build] [--force-build]
 *
 * 停止：关掉窗口，或在窗口里按 Ctrl+C。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
const PING = 'tarot-daily-preview';

const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

const ROOT = path.resolve(PROJECT, opt('root', 'dist'));
const START_PORT = Number(opt('port', '5180'));
const AUTO_OPEN = !has('no-open');
const NO_BUILD = has('no-build');
const FORCE_BUILD = has('force-build');

const USAGE = `
塔罗日签 · 本地预览启动器

  node scripts/launch_preview.mjs [选项]

选项
  --port <n>      起始端口（默认 5180，被占用就往后找）
  --root <dir>    要预览的目录（默认 dist）
  --no-open       不自动打开浏览器
  --no-build      不检查构建、不自动构建
  --force-build   无条件先构建一次
  -h, --help      显示本帮助

说明
  双击桌面「塔罗日签」快捷方式 = 跑这个脚本。源码比 dist 新时会自动重新构建；
  若已有预览服务在跑（端口扫到 ping 通），不会重复起服务，直接开页面。
`;

if (has('help') || argv.includes('-h')) {
  console.log(USAGE.trim());
  process.exit(0);
}

try {
  process.title = '塔罗日签 · 本地预览';
} catch {
  /* 某些终端不支持改标题，忽略 */
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

const SKIP_DIRS = new Set(['node_modules', '.git', '_archive', 'dist', 'scripts']);

function newestMtime(dir) {
  let newest = 0;
  const walk = (d) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(p);
      } else {
        try {
          newest = Math.max(newest, fs.statSync(p).mtimeMs);
        } catch {
          /* ignore */
        }
      }
    }
  };
  walk(dir);
  return newest;
}

function fileMtime(p) {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

function runBuild(reason) {
  const viteBin = path.join(PROJECT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(viteBin)) {
    console.log(`[!] ${reason}，但没找到 vite（node_modules 缺失），先按现有 dist 预览。`);
    return false;
  }
  console.log(`[*] ${reason}，正在重新构建（约 10~20 秒）…`);
  const r = spawnSync(process.execPath, [viteBin, 'build'], { cwd: PROJECT, stdio: 'inherit' });
  if (r.status !== 0) {
    console.log('[!] 构建失败，继续用现有 dist 预览（页面可能是旧的）。');
    return false;
  }
  console.log('[*] 构建完成。');
  return true;
}

function ensureBuild() {
  const distIndex = path.join(ROOT, 'index.html');
  if (FORCE_BUILD) {
    runBuild('已指定 --force-build');
    return;
  }
  if (!fs.existsSync(distIndex)) {
    runBuild('还没有构建产物 dist/index.html');
    return;
  }
  if (NO_BUILD) return;

  const srcTime = Math.max(
    newestMtime(path.join(PROJECT, 'src')),
    newestMtime(path.join(PROJECT, 'public')),
    fileMtime(path.join(PROJECT, 'index.html')),
    fileMtime(path.join(PROJECT, 'vite.config.js'))
  );
  const distTime = newestMtime(ROOT);
  if (srcTime > distTime + 1000) {
    const t = (ms) => new Date(ms).toLocaleString('zh-CN');
    runBuild(`源码（${t(srcTime)}）比构建产物（${t(distTime)}）新`);
  }
}

function ping(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/__preview_ping', timeout: 700 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(body.trim() === PING));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/** 在 [start, start+tries) 里找已在运行的预览服务 —— 双击多次也只会有一个服务。 */
async function findRunning(start, tries = 30) {
  const ports = Array.from({ length: tries }, (_, i) => start + i);
  const hits = await Promise.all(ports.map(async (p) => ((await ping(p)) ? p : null)));
  const found = hits.filter((p) => p !== null);
  return found.length ? Math.min(...found) : null;
}

function safeJoin(root, urlPath) {
  const rel = path.normalize(urlPath).replace(/^([/\\])+/, '');
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

function sendFile(req, res, filePath, status = 200) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }
  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const size = stat.size;
  const rangeHeader = req.headers.range;

  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
    if (m && (m[1] !== '' || m[2] !== '')) {
      let start;
      let end;
      if (m[1] === '') {
        const suffix = Number(m[2]);
        start = Math.max(0, size - suffix);
        end = size - 1;
      } else {
        start = Number(m[1]);
        end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        'Content-Type': type,
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': end - start + 1,
        'Cache-Control': 'no-store',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
  }

  res.writeHead(status, {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Content-Length': size,
    'Cache-Control': 'no-store',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

function createServer() {
  return http.createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    } catch {
      res.writeHead(400);
      res.end('400 Bad Request');
      return;
    }

    if (urlPath === '/__preview_ping') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(PING);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end('405 Method Not Allowed');
      return;
    }

    let target = safeJoin(ROOT, urlPath);
    if (!target) {
      res.writeHead(403);
      res.end('403 Forbidden');
      return;
    }

    let stat = null;
    try {
      stat = fs.statSync(target);
    } catch {
      /* not found */
    }
    if (stat && stat.isDirectory()) target = path.join(target, 'index.html');

    if (!fs.existsSync(target)) {
      const fallback = path.join(ROOT, 'index.html');
      if (fs.existsSync(fallback) && !path.extname(urlPath)) {
        sendFile(req, res, fallback);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${urlPath}`);
      return;
    }
    sendFile(req, res, target);
  });
}

function listenFrom(port, tries = 30) {
  return new Promise((resolve, reject) => {
    const attempt = (p, left) => {
      const server = createServer();
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && left > 0) {
          attempt(p + 1, left - 1);
          return;
        }
        reject(err);
      });
      server.listen(p, '127.0.0.1', () => resolve({ server, port: p }));
    };
    attempt(port, tries);
  });
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    console.log(`[*] 没能自动打开浏览器，请手动访问：${url}`);
  }
}

function banner(port, reused) {
  const line = '─'.repeat(46);
  console.log('');
  console.log(`┌${line}┐`);
  console.log(`│  塔罗日签 · 本地预览${reused ? '（复用已在运行的服务）' : ''}`);
  console.log(`├${line}┤`);
  console.log(`│  地址   http://127.0.0.1:${port}/`);
  console.log(`│  目录   ${ROOT}`);
  console.log(`│  停止   关闭本窗口，或按 Ctrl+C`);
  console.log(`└${line}┘`);
  console.log('');
}

async function main() {
  console.log(`[*] 项目目录：${PROJECT}`);
  ensureBuild();

  if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
    console.log('[!] 找不到页面（dist/index.html）。请先构建，或检查 --root 参数。');
    process.exitCode = 1;
    return;
  }

  const running = await findRunning(START_PORT);
  if (running) {
    banner(running, true);
    if (AUTO_OPEN) openBrowser(`http://127.0.0.1:${running}/`);
    return;
  }

  const { server, port } = await listenFrom(START_PORT);
  banner(port, false);
  if (AUTO_OPEN) openBrowser(`http://127.0.0.1:${port}/`);

  const bye = () => {
    console.log('\n[*] 预览服务已停止。');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 800);
  };
  process.on('SIGINT', bye);
  process.on('SIGTERM', bye);
}

main().catch((err) => {
  console.error('[!] 启动失败：', err && err.message ? err.message : err);
  process.exitCode = 1;
});
