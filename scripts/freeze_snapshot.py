# -*- coding: utf-8 -*-
"""
把当前工程冻结成一份**不可变快照**，落在 `_archive/<label>-<date>/`。

为什么需要它：这个项目原先没有版本控制（2026-09-19 起已 `git init`，但 git 管的是
「文本的变化」，快照管的是「随时能拿回一份完整可用产物」，两者不互相替代）。
做破坏性改造（比如 v2 上真 3D）之前，必须有一份「随时能拿回来」的东西。
快照 = 两个 zip + 一份清单：

    tarot-app-<label>-code-<date>.zip   代码 / 文档 / 配置 / public          （小，常翻）
    tarot-app-<label>-art-<date>.zip    美术母版：card-art / hero-art / concept / card-styles
                                        （大，不可再生 —— 重出要花积分）
    SNAPSHOT.md                         构成说明 + 校验值 + 还原步骤

刻意排除：
    node_modules                 npm install 即可恢复
    assets/_debug                临时排查图（可达数百 MB）
    assets/previews              可从 card-art 再生成的验收图
    dist / dist-user / dist-dev  构建产物，一条命令即可再构建
                                 （dist-user / dist-dev 是 v1 时代的产物，v2 起不再生成）
    _archive 自身                否则会递归套娃

用法：
    python scripts/freeze_snapshot.py --label v1 --date 2026-09-19
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
)
JUNK_PREFIX = ("vite.config.js.timestamp-", ".DS_Store", "Thumbs.db")

# ---- 两个包的收纳范围 ----
CODE_DIRS = ("src", "scripts", "public")
ART_DIRS = (
    os.path.join(ASSETS, "card-art"),     # 22 张牌面母版 —— 最贵的东西
    os.path.join(ASSETS, "hero-art"),     # 主视觉母版（背景 / 球 / 牌背）
    os.path.join(ASSETS, "concept"),      # 概念稿
    os.path.join(ASSETS, "card-styles"),  # 四轮风格探索留档
)

# 自检：代码包必须能支撑「解出来即可继续开发」
MUST_HAVE = ("src/main.jsx", "src/App.jsx", "package.json", "vite.config.js", "index.html")


def skip(rel):
    parts = rel.split(os.sep)
    if any(p in EXCLUDE_DIRS for p in parts):
        return True
    if rel.startswith(EXCLUDE_PREFIX):
        return True
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


def build_zip(out, rels, note):
    """打包 + 在包根写入 MANIFEST.sha256。返回 (文件数, 原始字节, 压缩后字节)。"""
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
        z.writestr("tarot-app/MANIFEST.sha256", manifest)
    return len(rels), total, os.path.getsize(out)


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
    print("① 待冻结：代码包 %d 个文件，美术包 %d 个文件" % (len(code_rels), len(art_rels)))

    code_zip = os.path.join(dest, "tarot-app-%s-code-%s.zip" % (label, date))
    art_zip = os.path.join(dest, "tarot-app-%s-art-%s.zip" % (label, date))

    print("② 打包代码包 …")
    c_n, c_raw, c_zip = build_zip(code_zip, code_rels, "%s 代码快照" % label)
    print("③ 打包美术母版 …（%d 个文件，稍慢）" % len(art_rels))
    a_n, a_raw, a_zip = build_zip(art_zip, art_rels, "%s 美术母版快照" % label)

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

    md = """# 快照清单 · tarot-app {label}（冻结于 {date}）

> 这份目录是**只读保险**，不是工作副本。不要在这里改东西。
> 冻结动机：该工程做破坏性改造（v2 主页上真 3D、女巫主视觉重构图）之前，
> 必须先有一份随时能拿回来的基线。工程已于 2026-09-19 建立 git 仓库，
> 快照与 git **互补而非替代**：git 管文本变化，快照管「完整可用产物」。

## 一、包里有什么

| 包 | 文件数 | 原始 | 压缩后 | 内容 |
|---|---|---|---|---|
| `tarot-app-{label}-code-{date}.zip` | {c_n} | {c_raw:.1f} MB | {c_zip:.1f} MB | `src/` · `scripts/` · `public/` · 根目录全部文档与配置（`PROJECT_STATE.md` / `NEXT_STEPS.md` / `README.md` / `DRAW_RITUAL_BRIEF.md` / `MOTION_AUDIT.md` / `动效与质感-skills指令清单.md` / `package.json` / `package-lock.json` / `vite.config.js` / `index.html` / `.gitignore` / `.gitattributes`） |
| `tarot-app-{label}-art-{date}.zip` | {a_n} | {a_raw:.1f} MB | {a_zip:.1f} MB | `assets/card-art/`（22 张牌面母版）· `assets/hero-art/`（背景 / 球 / 牌背母版）· `assets/concept/` · `assets/card-styles/`（四轮风格探索留档） |

每个 zip 的根都带一份 `tarot-app/MANIFEST.sha256`，逐文件记录了 sha256。
核对完整性（在解出来的 `tarot-app/` 目录里跑；**别用 `sha256sum -c`** —— 本机 Git Bash 缺 coreutils）：

```bash
node scripts/verify_manifest.mjs
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

（代码包必须能独立还原出可继续开发的状态 —— 缺 `src/main.jsx` / `package.json`
这类文件就说明收集器漏了，快照不可用。）
""".format(
        label=label, date=date,
        c_n=c_n, c_raw=c_raw / 1048576, c_zip=c_zip / 1048576,
        a_n=a_n, a_raw=a_raw / 1048576, a_zip=a_zip / 1048576,
        code_sha=sha256(code_zip), art_sha=sha256(art_zip),
        key_table="\n".join(key_lines),
        c_n_all=len(names),
        missing=("无 ✓" if not missing else "**" + ", ".join(missing) + " ✗**"),
        skin_cnt=skin_cnt,
    )

    with open(os.path.join(dest, "SNAPSHOT.md"), "w", encoding="utf-8") as fh:
        fh.write(md)

    print("")
    print("④ 冻结完成 -> %s" % dest)
    print("   code  {:.1f} MB（原始 {:.1f} MB，{} 个文件）".format(c_zip / 1048576, c_raw / 1048576, c_n))
    print("   art   {:.1f} MB（原始 {:.1f} MB，{} 个文件）".format(a_zip / 1048576, a_raw / 1048576, a_n))
    print("   清单  SNAPSHOT.md")
    if missing:
        print("   ✗ 代码包缺关键文件：%s —— 快照不完整" % ", ".join(missing))
        return 1
    print("   自检  关键文件齐全 ✓（public/skins/ %d 个文件）" % skin_cnt)
    return 0


if __name__ == "__main__":
    sys.exit(main())
