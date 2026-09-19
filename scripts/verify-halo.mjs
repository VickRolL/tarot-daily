/**
 * 「球体外围紫色气泡」三层消融对照（一次跑完）
 * ---------------------------------------------------------------------------
 * 同一拍（点击后 700ms，蓄势中段）截三张，每次只隐藏一层：
 *   full      全开
 *   nocharge  隐藏 .orb__charge（充能环）
 *   noglow    隐藏 .orb__glow（外光晕）
 * 然后交给 scripts/_check_halo.py 做按半径的贡献归因。
 *
 * 为什么用消融而不是「单张图看形状」：径向平均区分不了环和盘，会误判（已踩）。
 * 为什么写成 Node 驱动：本机 bash 是降级 shell，多行/串联的长命令会被拆坏，
 * 而且退出码照样是 0 —— 会把没跑成的旧文件当新结果读。
 *
 * 用法：node scripts/verify-halo.mjs
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'scripts/out')
const SHOT = resolve(ROOT, 'scripts/shot.mjs')
const URL_BASE = process.env.ORB_URL || 'http://127.0.0.1:4188/'

/** 停在蓄势中段再动手：700ms 时 uCharge 已接近满值，且还没进释放拍 */
const CHARGE_AT = 700

const CASES = [
  { name: 'orb3d-charge', hide: null },
  { name: 'chg-nocharge', hide: '.orb__charge' },
  { name: 'chg-noglow', hide: '.orb__glow' }
]

mkdirSync(OUT, { recursive: true })

for (const c of CASES) {
  const js =
    `document.querySelector('.orb').click();` +
    `await new Promise(r=>setTimeout(r,${CHARGE_AT}));` +
    (c.hide ? `document.querySelector('${c.hide}').style.display='none';` : '')
  const args = [
    SHOT, URL_BASE, resolve(OUT, c.name + '.png'),
    '--w', '1600', '--h', '900', '--wait', '6500', '--gpu',
    '--eval', js
  ]
  process.stdout.write(`▶ ${c.name.padEnd(14)} ${c.hide ? '隐藏 ' + c.hide : '全开'} … `)
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' })
  const log = (r.stdout || '') + (r.stderr || '')
  writeFileSync(resolve(OUT, c.name + '.halo.log'), log, 'utf8')
  const failed = /--eval 抛异常/.test(log) || !/截图已保存/.test(log)
  console.log(failed ? '✗' : '✓')
  if (failed) console.log(log.split('\n').slice(-6).join('\n'))
}

console.log('\n下一步：用 scripts/_check_halo.py 读这三张图做归因')
