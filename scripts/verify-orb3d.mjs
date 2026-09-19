/**
 * 3D 水晶球验证批次（一次跑完，聚合报告）
 * ---------------------------------------------------------------------------
 * 为什么要有这个文件：本机 Git Bash 是降级 shell，`\` 换行 + `&&` 串联的长命令
 * 会被拆坏（实测：三个 node 调用一个都没跑，输出文件里只有 shell 的
 * `line 3: : command not found`，而**退出码仍是 0** —— 会静默地把旧结果当新结果读）。
 * 所以把「跑几轮截图」这件事收进 Node：spawnSync 一次一个，参数是数组，
 * 不经过 shell 的引号与续行规则。
 *
 * 用法：
 *   node scripts/verify-orb3d.mjs            # 跑全部
 *   node scripts/verify-orb3d.mjs norm red   # 只跑指定几项
 *
 * 每轮产出：
 *   scripts/out/<name>.png    截图
 *   scripts/out/<name>.log    原始输出（含页面里 --eval 返回的 JSON）
 * 汇总打印每个用例的 PASS 明细，以及 ALL_PASS。
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'scripts/out')
const PROBE = resolve(ROOT, 'scripts/flows/probe-orb3d.js')
const SHOT = resolve(ROOT, 'scripts/shot.mjs')
const URL_BASE = process.env.ORB_URL || 'http://127.0.0.1:4188/'

/** 每个用例：名字 / 视口 / 是否 reduced / 是否走 CDP 手机模拟 / 导航后额外等待 */
const CASES = {
  norm: { name: 'orb3d-norm', w: 1600, h: 900, wait: 6500 },
  /* 手机视口必须走 --mobile（CDP 覆盖）：只给 --w 420 会被 Chrome 的最小窗口宽顶到 504 */
  mob: { name: 'orb3d-mob', w: 390, h: 844, wait: 6500, mobile: true, dpr: 2 },
  red1: { name: 'orb3d-red1', w: 1600, h: 900, wait: 4000, reduced: true },
  red2: { name: 'orb3d-red2', w: 1600, h: 900, wait: 4000, reduced: true },
  wide: { name: 'orb3d-wide', w: 1920, h: 1080, wait: 6500 }
}

const picked = process.argv.slice(2)
const keys = (picked.length ? picked : ['norm', 'mob', 'red1', 'red2']).filter((k) => CASES[k])

mkdirSync(OUT, { recursive: true })

/** 从 shot.mjs 的输出里抠出 `--eval 返回： {...}` 的 JSON */
function extractReport(log) {
  const m = log.match(/--eval 返回： (\{.*\})/)
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

const results = []
for (const key of keys) {
  const c = CASES[key]
  const png = resolve(OUT, c.name + '.png')
  const logPath = resolve(OUT, c.name + '.log')
  const args = [
    SHOT, URL_BASE, png,
    '--w', String(c.w), '--h', String(c.h),
    '--wait', String(c.wait),
    '--gpu',
    '--eval-file', PROBE
  ]
  if (c.reduced) args.push('--reduced')
  if (c.mobile) args.push('--mobile', '--dpr', String(c.dpr || 2))

  process.stdout.write(`▶ ${key.padEnd(5)} ${c.w}x${c.h}${c.reduced ? ' reduced' : ''}${c.mobile ? ' mobile' : ''} … `)
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' })
  const log = (r.stdout || '') + (r.stderr || '')
  writeFileSync(logPath, log, 'utf8')
  const rep = extractReport(log)
  if (!rep) {
    console.log('✗ 没有拿到探针结果（见 %s）', c.name + '.log')
    console.log('  退出码 %s / 截图存在 %s', r.status, existsSync(png))
    results.push({ key, ok: false, rep: null })
    continue
  }
  const pass = rep.PASS || {}
  const ok = rep.ALL_PASS === true
  console.log(ok ? '✓' : '✗', JSON.stringify(pass))
  results.push({ key, ok, rep })
}

console.log('\n================ 汇总 ================')
/* 汇总只是「好看」，不能因为它出错就把上面已经跑出来的用例结果一起吞掉 */
try {
  for (const r of results) {
  const j = r.rep
  if (!j) {
    console.log(`${r.key.padEnd(5)} 无结果`)
    continue
  }
  const pm = j.particles || {}
  /* 汇总行一律容错：字段缺失时打 `-` 而不是让整个聚合崩掉。
     （第一版直接 `.padEnd()`，探针少一个字段就把 4 个已经跑绿的用例全埋了。） */
  const s = (v) => (v === undefined || v === null ? '-' : String(v))
  console.log(
    [
      r.key.padEnd(5),
      `reduced=${s(j.reducedActive).padEnd(5)}`,
      `viewport=${s(JSON.stringify(j.viewport)).padEnd(14)}`,
      `canvas=${s(j.canvasCount)}`,
      `gl=${(j.gl || {}).lost === false ? 'ok' : 'LOST'}`,
      `hand/球层级=${s(j.zOrderOk)}`,
      `星屑稳态变=${s(pm.settledChanged)}`,
      `窗口内变=${s(pm.everChanged)}`,
      `ALL=${s(j.ALL_PASS)}`
    ].join('  ')
  )
  }
} catch (e) {
  console.log('（汇总渲染出错，不影响上面的用例结果）', e.message)
}
const bad = results.filter((r) => !r.ok)
console.log(bad.length ? `\n✗ 有 ${bad.length} 个用例未通过：${bad.map((b) => b.key).join(', ')}` : '\n✓ 全部用例通过')
process.exit(bad.length ? 1 : 0)
