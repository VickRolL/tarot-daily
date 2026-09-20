# -*- coding: utf-8 -*-
"""
把当前工程冻结成一份**不可变快照**，落在 `_archive/<label>-<date>/`。

为什么需要它：这个项目原先没有版本控制（2026-09-19 起已 `git init`，但 git 管的是
「文本的变化」，快照管的是「随时能拿回一份完整可用产物」，两者不互相替代）。
做破坏性改造（比如 v2 上真 3D）之前，必须有一份「随时能拿回来」的东西。
快照 = 两个 zip + 一份清单：

    tarot-app-<label>-code-<date>.zip   代码 / 文档 / 配置 / public          （小，常翻）
    tarot-app-<label>-art-<date>.zip    不可再生素材：card-art / hero-art / concept /
                                        card-styles / audio-src（大 —— 重出要花积分）
    SNAPSHOT.md                         构成说明 + 校验值 + 还原步骤

刻意排除：
    node_modules                 npm install 即可恢复
    assets/_debug                临时排查图（可达数百 MB）
    assets/previews              可从 card-art 再生成的验收图
    dist / dist-user / dist-dev  构建产物，一条命令即可再构建
                                 （dist-user / dist-dev 是 v1 时代的产物，v2 起不再生成）
    _archive 自身                否则会递归套娃
    scripts/out                  本机排查产物（日志 / 截图 / 派生 mp3）—— 见下面两条例外
    .env* / *.key                密钥，绝不进包（**有硬闸，见 main()**）

scripts/out 的两条例外（判据 =「丢了会不会痛」）：
    scripts/out/_exp/            ElevenLabs 生成的候选**源素材** —— 重出要花 API 额度
    scripts/out/_raw-backup-*/   历代 `_raw` 素材备份 —— 换素材时的退路
    只留「花过 API 额度才有的」；由它们本地加工出来的派生品（_try/ · _tune/）与
    纯日志截图一律不收 —— 前者重跑脚本即可再得，后者没有复用价值。

用法：
    python scripts/freeze_snapshot.py --label v1 --date 2026-09-19
    python scripts/freeze_snapshot.py --label v2 --date 2026-09-21
"""
import hashlib
import os
import sys
import zipfile
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---- 排除：任何一层目录名命中即跳过 ----
EXCLUDE_DIRS = {
    "node_modules", ".git", "__pycache__", ".vite", ".workbuddy",
    "_archive",                            # 递归保护
    "dist", "dist-user", "dist-dev",       # 构建产物，可再生成
}
ASSETS = os.path.join("assets")
EXCLUDE_PREFIX = (
    os.path.join(ASSETS, "_debug"),
    os.path.join(ASSETS, "previews"),
    os.path.join("scripts", "out"),        # 本机排查产物（日志 / 截图 / 派生 mp3）
)
JUNK_PREFIX = ("vite.config.js.timestamp-", ".DS_Store", "Thumbs.db")

# scripts/out 整目录排除，但这两类**必须留下**（判据见文件头）：
#   _exp/            ElevenLabs 生成的候选源素材 —— 重出要花积分
#   _raw-backup-*/   历代 _raw 素材备份 —— 换素材时的退路
OUT_KEEP_PREFIX = (
    os.path.join("scripts", "out", "_exp"),
    os.path.join("scripts", "out", "_raw-backup-"),
)

# ---- 安全：密钥绝不进包 ----
# v1 冻结（2026-09-19）时工程里还没有 .env.local（R26 才引入），而 collect() 把
# 根目录散件（`os.sep not in rel`）**一律**收进代码包 —— 不排就会把 API key
# 烤进 zip，而这种包通常会被拷来拷去。`main()` 里另有一道硬闸兜底。
SECRET_BASENAMES = (".env", ".env.local")
SECRET_SUFFIXES = (".key",)
SECRET_MARKERS = ("secret", "credential", "password", "token", "apikey", "api_key")

# ---- 两个包的收纳范围 ----
CODE_DIRS = ("src", "scripts", "public")
ART_DIRS = (
    os.path.join(ASSETS, "card-art"),     # 22 张牌面母版 —— 最贵的东西
    os.path.join(ASSETS, "hero-art"),     # 主视觉母版（背景 / 球 / 牌背）
    os.path.join(ASSETS, "concept"),      # 概念稿
    os.path.join(ASSETS, "card-styles"),  # 四轮风格探索留档
    "audio-src",                          # 音效源素材台账：_raw 四音源 + 候选 + 提示词 README
)

# 自检：代码包必须能支撑「解出来即可继续开发」
MUST_HAVE = ("src/main.jsx", "src/App.jsx", "package.json", "vite.config.js", "index.html")


def is_secret(rel):
    """密钥类文件判定 —— collect() 与 main() 的硬闸共用这一处。"""
    b = os.path.basename(rel).lower()
    if b in SECRET_BASENAMES or b.startswith(".env"):
        return True
    if b.endswith(SECRET_SUFFIXES):
        return True
    return any(m in b for m in SECRET_MARKERS)


def skip(rel):
    parts = rel.split(os.sep)
    if any(p in EXCLUDE_DIRS for p in parts):
        return True
    if is_secret(rel):
        return True
    if rel.startswith(EXCLUDE_PREFIX):
        # scripts/out 的例外：_exp/ 与 _raw-backup-*/ 是花过 API 额度的，留下
        return not rel.startswith(OUT_KEEP_PREFIX)
    if os.path.basename(rel).startswith(JUNK_PREFIX):
        return True
    return False


def collect():
    """返回 (code_files, art_files)，元素为相对路径。"""
    code, art = [], []
    code_top_dirs = tuple(CODE_DIRS)
    art_top_dirs = tuple(ART_DIRS)
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            full = os.path.join(base, f)
            rel = os.path.relpath(full, ROOT)
            if skip(rel):
                continue
            if rel.startswith(code_top_dirs) or (os.sep not in rel and not rel.endswith(".pyc")):
                code.append(rel)          # 根目录下的散件（*.md / package.json …）都算代码包
            elif rel.startswith(art_top_dirs):
                art.append(rel)
    return sorted(code), sorted(art)


def sha256(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for blk in iter(lambda: fh.read(chunk), b""):
            h.update(blk)
    return h.hexdigest()


def build_zip(out, rels, note, manifest_name="MANIFEST.sha256"):
    """打包 + 在包根写入逐文件 sha256 清单。返回 (文件数, 原始字节, 压缩后字节)。

    `manifest_name` 必须**两个包不同名**：两个 zip 都解到 `tarot-app/` 下，
    同名会互相覆盖 → 合并目录里核对时只覆盖到其中一个包，**而结果看起来是绿的**。
    """
    total = 0
    lines = []
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for i, rel in enumerate(rels, 1):
            full = os.path.join(ROOT, rel)
            size = os.path.getsize(full)
            total += size
            lines.append("%s  %s" % (sha256(full), rel.replace(os.sep, "/")))
            z.write(full, "tarot-app/" + rel.replace(os.sep, "/"))
            if i % 200 == 0:
                print("      …%d/%d" % (i, len(rels)))
        manifest = "# %s\n# 生成于 %s\n# 校验：sha256  路径（相对 tarot-app/）\n%s\n" % (
            note, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "\n".join(lines))
        z.writestr("tarot-app/" + manifest_name, manifest)
    return len(rels), total, os.path.getsize(out)


ART_MANIFEST = "MANIFEST-art.sha256"


def main():
    argv = sys.argv[1:]
    label = "v1"
    date = datetime.now().strftime("%Y-%m-%d")
    if "--label" in argv:
        label = argv[argv.index("--label") + 1]
    if "--date" in argv:
        date = argv[argv.index("--date") + 1]

    dest = os.path.join(ROOT, "_archive", "%s-%s" % (label, date))
    os.makedirs(dest, exist_ok=True)

    code_rels, art_rels = collect()

    # ---- 硬闸：收集结果里一旦出现密钥类文件，立刻中止，一个 zip 都不生成 ----
    # 只靠 skip() 不够 —— 以后若有人把 key 挪进 `secrets.json` 之类的新文件名，
    # 白名单式排除会静默放行。这里从「实际收集结果」反查一遍，是最后一道。
    leaked = [r for r in code_rels + art_rels if is_secret(r)]
    if leaked:
        print("✗ 收集结果里出现密钥类文件，拒绝冻结（一个 zip 都不会生成）：")
        for r in leaked:
            print("     %s" % r)
        print("  处置：把密钥移出工程，或给 skip() 补规则。")
        return 1

    kept_out = [r for r in code_rels if r.startswith(os.path.join("scripts", "out"))]
    print("① 待冻结：代码包 %d 个文件，素材包 %d 个文件" % (len(code_rels), len(art_rels)))
    print("   （其中 scripts/out 按例外保留 %d 个 —— 花过 API 额度的候选源素材与素材备份）"
          % len(kept_out))

    code_zip = os.path.join(dest, "tarot-app-%s-code-%s.zip" % (label, date))
    art_zip = os.path.join(dest, "tarot-app-%s-art-%s.zip" % (label, date))

    print("② 打包代码包 …")
    c_n, c_raw, c_zip = build_zip(code_zip, code_rels, "%s 代码快照" % label)
    print("③ 打包不可再生素材 …（%d 个文件，稍慢）" % len(art_rels))
    a_n, a_raw, a_zip = build_zip(art_zip, art_rels, "%s 不可再生素材快照" % label, ART_MANIFEST)

    # 关键文件指纹：日后要确认「手上这份还是当初冻结的那份」时对这几行
    keys = [r for r in code_rels if r.replace(os.sep, "/") in (
        "package.json", "package-lock.json", "vite.config.js", "index.html",
        "src/App.jsx", "src/config/skin.js", "src/components/DevBar.jsx", "src/index.css",
        "PROJECT_STATE.md", "NEXT_STEPS.md", "README.md",
    )]
    key_lines = ["| 文件 | sha256（前 16 位） |", "|---|---|"]
    for rel in keys:
        key_lines.append("| `%s` | `%s` |" % (rel.replace(os.sep, "/"),
                                            sha256(os.path.join(ROOT, rel))[:16]))

    # 用解包清单复核：代码包是否真的能还原出「可继续开发」的状态
    with zipfile.ZipFile(code_zip) as z:
        names = z.namelist()
    missing = [p for p in MUST_HAVE if not any(n.endswith(p) for n in names)]
    skin_cnt = sum(1 for n in names if "/skins/" in n)
    out_cnt = sum(1 for n in names if "/scripts/out/" in n)
    secret_cnt = len([n for n in names if is_secret(n)])

    # 素材包同样复核：不可再生的音效源素材必须到齐（四个音各一份 `*-raw.mp3`）
    with zipfile.ZipFile(art_zip) as z:
        art_names = z.namelist()
    raw_cnt = sum(1 for n in art_names if n.endswith("-raw.mp3"))

    md = """# 快照清单 · tarot-app {label}（冻结于 {date}）

> 这份目录是**只读保险**，不是工作副本。不要在这里改东西。
> 工程已于 2026-09-19 建立 git 仓库，快照与 git **互补而非替代**：
> git 管文本变化（`git diff` 能回答「哪天弄坏的、坏在哪一行」），
> 快照管「随时拿回一份完整可用产物」。
> 收哪些、不收哪些由 `scripts/freeze_snapshot.py` 的 `skip()` 决定（判据 =「丢了会不会痛」）。

## 一、包里有什么

| 包 | 文件数 | 原始 | 压缩后 | 内容 |
|---|---|---|---|---|
| `tarot-app-{label}-code-{date}.zip` | {c_n} | {c_raw:.1f} MB | {c_zip:.1f} MB | `src/` · `scripts/` · `public/` · 根目录全部文档与配置（`PROJECT_STATE.md` / `NEXT_STEPS.md` / `README.md` / `DRAW_RITUAL_BRIEF.md` / `HERO_V2_PROMPT.md` / `MOTION_AUDIT.md` / `动效与质感-skills指令清单.md` / `package.json` / `package-lock.json` / `vite.config.js` / `index.html` / `.gitignore` / `.gitattributes`）。另按例外保留了 `scripts/out/_exp/` 与 `scripts/out/_raw-backup-*/`（共 {out_cnt} 个 —— 花过 API 额度的候选源素材与素材备份） |
| `tarot-app-{label}-art-{date}.zip` | {a_n} | {a_raw:.1f} MB | {a_zip:.1f} MB | **不可再生素材**：`assets/card-art/`（22 张牌面母版）· `assets/hero-art/`（背景 / 球 / 牌背母版）· `assets/concept/` · `assets/card-styles/`（四轮风格探索留档）· `audio-src/`（音效源素材台账：`sfx/_raw/` 四个音源 + 候选母版 + 提示词 README） |

每个 zip 的根都带一份逐文件 sha256 清单，**两个包各一份、且名字不同**：
`tarot-app/MANIFEST.sha256`（代码包）与 `tarot-app/MANIFEST-art.sha256`（素材包）。
两个 zip 都解到同一个 `tarot-app/` 下，若同名会互相覆盖 —— 那样合并目录里只能核到其中一个包，
**而结果看起来是绿的**（v1 就是这样，已改）。

核对完整性（在解出来的 `tarot-app/` 目录里跑；**别用 `sha256sum -c`** —— 本机 Git Bash 缺 coreutils）：

```bash
node scripts/verify_manifest.mjs                                    # 核代码包
node scripts/verify_manifest.mjs . --manifest MANIFEST-art.sha256   # 核素材包
```

**两个 zip 的指纹：**

| 包 | sha256 | 体积 |
|---|---|---|
| code | `{code_sha}` | {c_zip:.1f} MB |
| art | `{art_sha}` | {a_zip:.1f} MB |

## 二、刻意没包进来的东西

| 排除项 | 为什么 |
|---|---|
| `node_modules/` | `npm install` 即可恢复 |
| `assets/_debug/` | 临时排查图 + 无头浏览器 profile 残留，体积可达数百 MB，无复用价值 |
| `assets/previews/` | 验收总览图，可由 `scripts/contact_sheet.py` 从 `card-art/` 再生成 |
| `dist/` `dist-user/` `dist-dev/` | 构建产物。`dist/` 用 `npm run build` 重来；后两者是 v1 时代的离线副本与开发者版产物，**v2 起不再生成** |
| `scripts/out/` | 本机排查产物（日志 / 截图 / 派生 mp3），可达数十 MB。**例外**：`_exp/` 与 `_raw-backup-*/` 保留 —— 那是花过 API 额度的源素材，本地不可再生 |
| `.env*` `*.key` | **密钥，绝不进包。** 冻结脚本有硬闸：收集结果一旦出现密钥类文件就拒绝出包（v1 冻结时 `.env.local` 尚未存在，这是两个版本之间新出现的口子） |
| `_archive/` 自身 | 递归保护 |

## 三、还原步骤

```bash
# 1) 解到任意空目录
unzip tarot-app-{label}-code-{date}.zip
unzip tarot-app-{label}-art-{date}.zip     # 覆盖式解到同一个 tarot-app/ 下
cd tarot-app

# 2) 跑起来看（网站只走 http，v2 起已无离线双击副本）
npm install
npm run dev
```

## 四、关键文件指纹（核对「手上这份还是不是当初冻结的那份」）

{key_table}

## 五、本次冻结的产物自检

- 代码包内条目数：**{c_n_all} 个**（含包根 `MANIFEST.sha256`）
- 可开发性必备文件缺失项：**{missing}**
- 运行时素材 `public/skins/`：**{skin_cnt} 个文件**
- **密钥类文件混入包内：{secret_cnt} 个**（必须是 0）
- 音效源素材 `audio-src/sfx/_raw/`：**{raw_cnt} 个**（应为 4 —— 四个音各一份 `*-raw.mp3`）

（代码包必须能独立还原出可继续开发的状态 —— 缺 `src/main.jsx` / `package.json`
这类文件就说明收集器漏了，快照不可用。素材包的 `-raw.mp3` 同理：少了它，
AI 音效就只能重新花钱生成。）

> ⚠️ **这份清单的校验只到「字节完整」为止，不等于「备份可用」。**
> 可用性另有一道**还原演练**（换全新路径解出来真跑一遍），记录见工程
> `NEXT_STEPS.md` 的冻结快照小节。
""".format(
        label=label, date=date,
        c_n=c_n, c_raw=c_raw / 1048576, c_zip=c_zip / 1048576,
        a_n=a_n, a_raw=a_raw / 1048576, a_zip=a_zip / 1048576,
        code_sha=sha256(code_zip), art_sha=sha256(art_zip),
        key_table="\n".join(key_lines),
        c_n_all=len(names),
        missing=("无 ✓" if not missing else "**" + ", ".join(missing) + " ✗**"),
        skin_cnt=skin_cnt,
        out_cnt=out_cnt,
        secret_cnt=secret_cnt,
        raw_cnt=raw_cnt,
    )

    with open(os.path.join(dest, "SNAPSHOT.md"), "w", encoding="utf-8") as fh:
        fh.write(md)

    print("")
    print("④ 冻结完成 -> %s" % dest)
    print("   code  {:.1f} MB（原始 {:.1f} MB，{} 个文件）".format(c_zip / 1048576, c_raw / 1048576, c_n))
    print("   art   {:.1f} MB（原始 {:.1f} MB，{} 个文件）".format(a_zip / 1048576, a_raw / 1048576, a_n))
    print("   清单  SNAPSHOT.md")

    # 三条硬自检：缺一条就别把这个快照当「可用备份」
    bad = []
    if missing:
        bad.append("代码包缺关键文件：%s" % ", ".join(missing))
    if secret_cnt:
        bad.append("密钥类文件混入代码包：%d 个" % secret_cnt)
    if raw_cnt != 4:
        bad.append("音效源素材未到齐：%d / 4" % raw_cnt)
    if bad:
        for b in bad:
            print("   ✗ %s" % b)
        print("   —— 快照不完整，别当备份用")
        return 1
    print("   自检  ✓ 关键文件齐全 · ✓ 密钥 0 · public/skins/ %d 个 · audio-src/_raw %d/4"
          % (skin_cnt, raw_cnt))
    return 0


if __name__ == "__main__":
    sys.exit(main())
