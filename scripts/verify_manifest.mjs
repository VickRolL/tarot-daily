/* 校验快照完整性：按逐文件清单核对 sha256
   ==========================================================================
   用法（在解出来的 tarot-app/ 目录里跑，也就是清单文件所在的那一层）：

       node scripts/verify_manifest.mjs                                    # 核代码包
       node scripts/verify_manifest.mjs <其他目录>
       node scripts/verify_manifest.mjs . --manifest MANIFEST-art.sha256   # 核素材包

   为什么 `--manifest` 是必需的：两个 zip 都解到 `tarot-app/` 下，
   而清单**必须两个包不同名**（代码包 `MANIFEST.sha256` / 素材包 `MANIFEST-art.sha256`）。
   若同名会互相覆盖 → 合并目录里只能核到其中一个包，**而输出看起来是绿的**。
   **两个包都要各核一次**，`node scripts/verify_manifest.mjs .` 只核了代码包。

   为什么写成一个脚本而不是文档里贴一行 node -e：
   那条命令要塞进「双引号 bash 串 → JSON → Python 模板 → .format() → markdown」
   五层转义里，任何一层少一个反斜杠，命令**照样长得对**，只是切不出行、
   静默报「核对 0 个文件，不一致 0」—— 一个永远绿灯的假检查。
   真脚本没有转义层，且能自己保证「一个文件都没核对到」时**报错而不是报通过**。

   退出码：0 = 全部一致；1 = 有不一致或读不到文件。
   ========================================================================== */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const argv = process.argv.slice(2)
let manifestName = 'MANIFEST.sha256'
const positional = []
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--manifest') {
    manifestName = argv[++i]
    if (!manifestName) {
      console.error('✗ --manifest 后面要跟清单文件名')
      process.exit(1)
    }
    continue
  }
  positional.push(argv[i])
}

const root = positional[0] || '.'
const manifestPath = path.join(root, manifestName)
if (!fs.existsSync(manifestPath)) {
  console.error(`✗ 找不到 ${manifestPath} —— 请在解出来的 tarot-app/ 目录里运行`)
  process.exit(1)
}

const lines = fs
  .readFileSync(manifestPath, 'utf8')
  .split('\n')
  // 行尾的 \r 必须剥掉：Windows 上写/解压文本文件可能把 \n 变成 \r\n，
  // 而 \r 会被拼进路径尾部 → 每个文件都「找不到」。
  // （这个 bug 是反向测试抓出来的：造的样本里连那个完全正常的文件也被报成缺失。）
  .map((l) => l.replace(/\r$/, ''))
  .filter((l) => l && !l.startsWith('#'))

// 空清单必须报错：否则「什么都没查」会被读成「全部通过」
if (lines.length === 0) {
  console.error(`✗ ${manifestPath} 里一条记录都没有 —— 清单是空的`)
  process.exit(1)
}

const bad = []
const missing = []
for (const line of lines) {
  const i = line.indexOf('  ')
  if (i < 0) continue
  const want = line.slice(0, i)
  const rel = line.slice(i + 2)
  const full = path.join(root, ...rel.split('/'))
  if (!fs.existsSync(full)) {
    missing.push(rel)
    continue
  }
  const got = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')
  if (got !== want) bad.push(rel)
}

console.log(`清单：${manifestPath}`)
console.log(`核对 ${lines.length} 个文件`)
if (missing.length) {
  console.log(`\n✗ 缺失 ${missing.length} 个：`)
  for (const r of missing.slice(0, 20)) console.log('   ' + r)
  if (missing.length > 20) console.log(`   …还有 ${missing.length - 20} 个`)
}
if (bad.length) {
  console.log(`\n✗ 内容不一致 ${bad.length} 个：`)
  for (const r of bad.slice(0, 20)) console.log('   ' + r)
  if (bad.length > 20) console.log(`   …还有 ${bad.length - 20} 个`)
}

const ok = lines.length > 0 && bad.length === 0 && missing.length === 0
console.log(ok ? '\n✓ 全部一致，快照完好' : '\n✗ 快照有问题')
process.exit(ok ? 0 : 1)
