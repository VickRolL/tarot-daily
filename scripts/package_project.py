# -*- coding: utf-8 -*-
"""
项目打包：把 tarot-app 打成一份可迁移的 zip。

两种用法：
    完整包   python scripts/package_project.py            含全部原始素材（约 190 MB）
    轻量包   python scripts/package_project.py --light    只含代码 + 运行时素材 + 验收图（约 23 MB）

排除：node_modules（用 `npm install` 恢复）、assets/_debug（临时排查图）、
      dist/（构建产物，`npm run build` 随时可再生成）、
      _archive/（本地冻结快照，属「保险」不属「交付」）。

2026-09-19（v2 起）**不再包含任何离线预览副本** —— 网站只走 http。
    接收方怎么用：解压 → `npm install && npm run dev` 本地看，或直接打开线上链接。
    v1 那套「双击 `打开网站.cmd` / 双击 `dist-user/index.html` 离线直看」已随
    `scripts/lib/offline.mjs` 一并移除（原因与代价见 PROJECT_STATE.md 第十七轮）。

（原先打包前会自检 .cmd 的 GBK + CRLF 编码 —— 随三个 .cmd 一起移除了，
  本项目里已不存在 .cmd/.bat 文件。）
"""
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAMP = "2026-09-19"
DEFAULT_OUT = os.path.join(os.path.dirname(ROOT), "tarot-app-handoff-%s.zip" % STAMP)
LIGHT_OUT = os.path.join(os.path.dirname(ROOT), "tarot-app-code-%s.zip" % STAMP)

EXCLUDE_DIRS = {"node_modules", ".git", "__pycache__", ".vite", ".workbuddy", "_archive"}
# _archive/ 是冻结快照（scripts/freeze_snapshot.py 产出，100 MB+），
#            属于**本地保险**而非交付内容 —— 卷进交付包会让包凭空胖一倍，且毫无用处。
EXCLUDE_PREFIX = (os.path.join("assets", "_debug"),)
# dist/ 是构建产物：绝对路径、交给静态服务器，随 npm run build 再生成，
#       留着反而会让人误以为是「已上线的版本」。
# dist-user/ 与 dist-dev/（v1 的离线副本与开发者版产物）**自 v2 起不再生成**，
#       仍列在这里是防呆：万一手上还有早期解出来的旧目录，别顺手卷进包。
EXCLUDE_DIRS_BUILD = {"dist", "dist-user", "dist-dev"}
# Vite 加载配置时会落一堆临时文件，正常会自动删；本机偶尔残留，别带进包
JUNK_PREFIX = ("vite.config.js.timestamp-",)
# 轻量包排除的「原始素材」目录；但验收用的两张总览图要保留
LIGHT_EXCLUDE = (
    os.path.join("assets", "card-art"),
    os.path.join("assets", "card-styles"),
    os.path.join("assets", "concept"),
    os.path.join("assets", "previews"),
)
LIGHT_KEEP = (
    os.path.join("assets", "previews", "contact-sheet.png"),
    os.path.join("assets", "previews", "contact-sheet-framed.png"),
)


def should_skip(rel, light):
    parts = rel.split(os.sep)
    if any(p in EXCLUDE_DIRS for p in parts):
        return True
    if any(p in EXCLUDE_DIRS_BUILD for p in parts):
        return True
    if os.path.basename(rel).startswith(JUNK_PREFIX):
        return True
    if rel.startswith(EXCLUDE_PREFIX):
        return True
    if light and rel.startswith(LIGHT_EXCLUDE) and rel not in LIGHT_KEEP:
        return True
    return False


def main():
    light = "--light" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = args[0] if args else (LIGHT_OUT if light else DEFAULT_OUT)
    out = os.path.abspath(out)
    if os.path.exists(out):
        os.remove(out)

    count = 0
    total = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for base, dirs, files in os.walk(ROOT):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for f in files:
                full = os.path.join(base, f)
                rel = os.path.relpath(full, ROOT)
                if should_skip(rel, light):
                    continue
                z.write(full, os.path.join("tarot-app", rel))
                count += 1
                total += os.path.getsize(full)

    print("① 打包(%s) -> %s" % ("轻量" if light else "完整", out))
    print("   文件数 %d | 原始体积 %.1f MB | 压缩后 %.1f MB"
          % (count, total / 1024 / 1024, os.path.getsize(out) / 1024 / 1024))
    print("   接收方：解压 → npm install && npm run dev（或直接用线上链接）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
