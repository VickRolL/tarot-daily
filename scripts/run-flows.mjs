/**
 * 通用 flow 运行器：跑 `scripts/flows/<name>.js` 并打印它 return 的 JSON
 * ---------------------------------------------------------------------------
 * 为什么要有它：
 *  ① 本机 bash 是降级 shell —— 多行 / `&&` 串联的长命令会被拆坏，
 *     而且**退出码仍是 0**，会把没跑成的旧输出当新结果读（踩过）。
 *     spawnSync + 参数数组不经过 shell，这些问题一次消失。
 *  ② `--eval-file` 会覆盖 `--eval`，所以「一段公共逻辑 + 不同参数」没法用命令行表达；
 *     批量跑多个 flow 时手工拼命令太容易出错。
 *
 * 用法：
 *   node scripts/run-flows.mjs audit-title audit-draw audit-motion
 *   node scripts/run-flows.mjs reveal share --w 1582 --h 804 --wait 5200
 *   node scripts/run-flows.mjs --list          # 看有哪些 flow
 *
 * 输出：
 *   scripts/out/<name>.png   截图
 *   scripts/out/<name>.log   原始输出（跑挂了先看它）
 *   控制台：每个 flow 的 return JSON + 汇总
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'scripts/out')
const FLOWS = resolve(ROOT, 'scripts/flows')
const SHOT = resolve(ROOT, 'scripts/shot.mjs')
const URL_BASE = process.env.APP_URL || 'http://127.0.0.1:4188/'

/* ---- 解析参数：前导的非 -- 参数是 flow 名，其余透传给 shot.mjs ---- */
const argv = process.argv.slice(2)
if (argv.includes('--list')) {
  console.log('可用 flow：')
  for (const f of readdirSync(FLOWS).filter((f) => f.endsWith('.js')).sort()) {
    console.log('  ' + f.replace(/\.js$/, ''))
  }
  process.exit(0)
}

const names = []
const passthrough = []
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i]
  if (a.startsWith('--')) {
    passthrough.push(a)
    /* 这几个开关后面要跟一个值 */
    if (['--w', '--h', '--wait', '--chrome', '--profile', '--dpr'].includes(a)) {
      passthrough.push(argv[++i])
    }
  } else {
    names.push(a)
  }
}
if (!names.length) {
  console.error('用法：node scripts/run-flows.mjs <flow...> [--w 1582 --h 804 --wait 5200]')
  console.error('      node scripts/run-flows.mjs --list')
  process.exit(1)
}

const W = passthrough.includes('--w') ? null : ['--w', '1582']
const H = passthrough.includes('--h') ? null : ['--h', '804']
const WAIT = passthrough.includes('--wait') ? null : ['--wait', '5200']
const extra = [...(W || []), ...(H || []), ...(WAIT || []), ...passthrough]

mkdirSync(OUT, { recursive: true })

const results = []
for (const name of names) {
  const flow = resolve(FLOWS, name + '.js')
  if (!existsSync(flow)) {
    console.log(`✗ ${name}：找不到 ${flow}`)
    results.push({ name, ok: false, why: 'flow 不存在' })
    continue
  }
  /* ── 可选前置：把「产物生成者写下的期望值」注入页面 ──────────────────
   * 为什么：探针里的期望值若**手抄**，就会随产物一起过期，而且是**静默**过期 ——
   * 实测 `probe-sfx.js` 里手抄的 `burst: 1.0` 不是契约，是当时旧产物量出来的值；
   * 2026-09-21 burst 按契约改成 1.5s 后，那条判据立刻假红。
   * 现在由 `build-sfx.py` 把刚产出的成品期望值写成 `scripts/out/_sfx_expect.js`，
   * 这里把它贴在 flow 前面一起 eval（`--eval-file` 只能给一个文件，所以先拼再传）。
   * 文件不存在就照常单跑 flow —— 老流程一行都不用改。 */
  const prelude = resolve(OUT, '_sfx_expect.js')
  let evalFile = flow
  if (existsSync(prelude)) {
    const merged = resolve(OUT, `_flow-${name}.js`)
    writeFileSync(
      merged,
      readFileSync(prelude, 'utf8') + '\n' + readFileSync(flow, 'utf8'),
      'utf8'
    )
    evalFile = merged
  }

  const args = [SHOT, URL_BASE, resolve(OUT, name + '.png'), ...extra, '--eval-file', evalFile]
  process.stdout.write(`▶ ${name.padEnd(16)} … `)
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' })
  const log = (r.stdout || '') + (r.stderr || '')
  writeFileSync(resolve(OUT, name + '.log'), log, 'utf8')

  let rep = null
  const m = log.match(/--eval 返回： (\{.*\})/)
  if (m) {
    try {
      rep = JSON.parse(m[1])
    } catch {
      rep = null
    }
  }
  const threw = /--eval 抛异常/.test(log)
  const shotOk = /截图已保存/.test(log)
  const ok = !!rep && !threw && shotOk
  console.log(ok ? '✓' : '✗')
  if (!ok) {
    console.log('   ' + log.split('\n').filter((l) => l.trim()).slice(-8).join('\n   '))
  } else {
    console.log('   ' + JSON.stringify(rep))
  }
  results.push({ name, ok, rep })
}

console.log('\n================ 汇总 ================')
for (const r of results) {
  console.log(`${r.name.padEnd(16)} ${r.ok ? '有结果' : '✗ ' + (r.why || '跑挂了')}`)
}
const bad = results.filter((r) => !r.ok)
console.log(bad.length ? `\n✗ 失败 ${bad.length} 个：${bad.map((b) => b.name).join(', ')}` : '\n✓ 全部流程返回了结果')
console.log('（注意：「返回了结果」不等于「断言全过」—— 断言要看每个 JSON 里的具体字段）')
process.exit(bad.length ? 1 : 0)
