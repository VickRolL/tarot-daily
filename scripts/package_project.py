# -*- coding: utf-8 -*-
"""
项目打包：把 tarot-app 打成一份可迁移的 zip。

三种用法：
    完整包   python scripts/package_project.py            含全部原始素材（约 190 MB）
    轻量包   python scripts/package_project.py --light    只含代码 + 运行时素材 + 验收图（约 23 MB）
    不带预览 python scripts/package_project.py --no-preview
                                                          不含 dist-user/（省 6 MB，
                                                          但收到包的人就不能双击直看了）

排除：node_modules（用 `npm install` 恢复）、assets/_debug（临时排查图）、dist/（正式发布产物）。
包含：dist-user/（**离线副本，双击 index.html 就能看** —— 这是给接收方的「本地快捷方式」）、
      打开网站.cmd / start-user-preview.cmd（双击入口）。

打包前会自检 .cmd 的编码与换行（GBK + CRLF）—— 2026-09-19 踩过这个坑：
UTF-8 + LF 的 .cmd 双击会报一堆「不是内部或外部命令」，而退出码还是 0，极难察觉。
"""
import os
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fix_cmd_encoding import find_targets, inspect  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAMP = "2026-09-19"
DEFAULT_OUT = os.path.join(os.path.dirname(ROOT), "tarot-app-handoff-%s.zip" % STAMP)
LIGHT_OUT = os.path.join(os.path.dirname(ROOT), "tarot-app-code-%s.zip" % STAMP)

EXCLUDE_DIRS = {"node_modules", ".git", "__pycache__", ".vite", ".workbuddy", "_archive"}
# _archive/ 是 v1 冻结快照（scripts/freeze_snapshot.py 产出，体积可达 100 MB+），
#          属于**本地保险**而非交付内容 —— 卷进交付包会让包凭空胖一倍，且毫无用处。
EXCLUDE_PREFIX = (os.path.join("assets", "_debug"),)
# dist/ 与 dist-dev/ 都是**构建产物**，不进包：
#   dist/     正式发布用（绝对路径，交给静态服务器），随 npm run build 随时可再生成，
#             留着反而会让人误以为是「已上线的版本」。
#   dist-dev/ 开发者版（带调试条：不限次数抽卡 / 重播迎接 / 牌面总览），
#             只给本地调试用 —— 发出去会暴露内部状态，也让收包人分不清该开哪个。
EXCLUDE_DIRS_BUILD = {"dist", "dist-dev"}
# 预览副本：默认包含 —— 收到包的人不用装 Node 就能双击看
PREVIEW_DIR = "dist-user"
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


def should_skip(rel, light, with_preview):
    parts = rel.split(os.sep)
    if any(p in EXCLUDE_DIRS for p in parts):
        return True
    if any(p in EXCLUDE_DIRS_BUILD for p in parts):
        return True
    if not with_preview and PREVIEW_DIR in parts:
        return True
    if os.path.basename(rel).startswith(JUNK_PREFIX):
        return True
    if rel.startswith(EXCLUDE_PREFIX):
        return True
    if light and rel.startswith(LIGHT_EXCLUDE) and rel not in LIGHT_KEEP:
        return True
    return False


def preflight():
    """打包前把关：.cmd 必须是 GBK + CRLF，否则双击就是坏的。"""
    bad = []
    for p in find_targets():
        state, why = inspect(p)
        if state != "ok":
            bad.append((os.path.relpath(p, ROOT), why))
    if bad:
        print("✗ 以下 .cmd/.bat 不合格（收包的人双击会失败）：")
        for rel, why in bad:
            print("    %s —— %s" % (rel, why))
        print("  先跑：python scripts/fix_cmd_encoding.py")
        return False
    print("① 快捷方式自检：.cmd/.bat 均为 GBK + CRLF ✓")
    return True


def main():
    light = "--light" in sys.argv
    with_preview = "--no-preview" not in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = args[0] if args else (LIGHT_OUT if light else DEFAULT_OUT)
    out = os.path.abspath(out)
    if os.path.exists(out):
        os.remove(out)

    if not preflight():
        return 1

    # 预览副本在不在，先说清楚（收包的人能不能双击直看，就看这个目录）
    preview_ok = os.path.exists(os.path.join(ROOT, PREVIEW_DIR, "index.html"))
    if with_preview and not preview_ok:
        print("   ⚠️ 没有 %s/index.html —— 收包的人无法双击直看。" % PREVIEW_DIR)
        print("      先跑：node scripts/build_user_preview.mjs")
    elif with_preview:
        print("② 离线副本 %s/ 已就位，收包的人双击「打开网站.cmd」即可 ✓" % PREVIEW_DIR)

    count = 0
    total = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for base, dirs, files in os.walk(ROOT):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for f in files:
                full = os.path.join(base, f)
                rel = os.path.relpath(full, ROOT)
                if should_skip(rel, light, with_preview):
                    continue
                z.write(full, os.path.join("tarot-app", rel))
                count += 1
                total += os.path.getsize(full)

    print("\n③ 打包(%s) -> %s" % ("轻量" if light else "完整", out))
    print("   文件数 %d | 原始体积 %.1f MB | 压缩后 %.1f MB"
          % (count, total / 1024 / 1024, os.path.getsize(out) / 1024 / 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())
