# -*- coding: utf-8 -*-
"""
冻结快照的**还原演练**：换一个全新路径解出来，并真的跑一遍。

为什么要单独有这一步：zip 生成成功、哈希对得上，都只证明**写盘成功**。
真正的失效模式是「打包时漏了一个目录 / 一个素材」—— zip 完好、清单全绿，
解出来却是裂图或构建失败。判据只有一条：**换路径解出来，能构建、素材能解码。**

（这条规矩是 v1 冻结时踩出来的，见 `NEXT_STEPS.md` 第 6 节第 27 条。）

做四件事：
  ① 把 code / art 两个 zip 解到一个**全新目录**（不用旧目录，避免「其实是旧文件还在」）
  ② 两份清单各核一次 —— 代码包 `MANIFEST.sha256`、素材包 `MANIFEST-art.sha256`
     （两个包同名会互相覆盖，只核一次就会漏掉半个包而**看起来还是绿的**）
  ③ 在该副本里用 `_raw/` 源素材重跑 `build-sfx.py`（证明音效源素材足够重建）
  ④ 在该副本里 `vite build`（证明源码树完整 —— 缺任何被 import 的东西都会在这里炸）

用法：
    python scripts/verify_snapshot_restore.py --label v2 --date 2026-09-21
    python scripts/verify_snapshot_restore.py --label v2 --date 2026-09-21 --skip-build

退出码：0 = 全过；1 = 有任何一项没过。
"""
import argparse
import io
import json
import os
import shutil
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ART_MANIFEST = "MANIFEST-art.sha256"


def free_dir(base):
    """取一个不存在的目录名 —— 本机删目录不可信（安全删除守卫会拦），
    所以宁可用新名字，也不去 rmtree 旧的。"""
    if not os.path.exists(base):
        return base
    for i in range(2, 100):
        cand = "%s-%d" % (base, i)
        if not os.path.exists(cand):
            return cand
    raise RuntimeError("找不到可用的空目录名：%s" % base)


def run(args, cwd, log_path, timeout=900):
    with io.open(log_path, "w", encoding="utf-8", errors="replace") as fh:
        p = subprocess.run(args, cwd=cwd, stdout=fh, stderr=subprocess.STDOUT, timeout=timeout)
    return p.returncode


def read(log_path):
    return io.open(log_path, encoding="utf-8", errors="replace").read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", required=True)
    ap.add_argument("--date", required=True)
    ap.add_argument("--skip-build", action="store_true")
    ap.add_argument("--node", default=None, help="node 可执行文件路径（默认从 PATH 找）")
    ap.add_argument("--python", default=None, help="跑 build-sfx.py 的解释器（默认当前解释器）")
    a = ap.parse_args()

    D = os.path.join(ROOT, "_archive", "%s-%s" % (a.label, a.date))
    zips = {
        "code": os.path.join(D, "tarot-app-%s-code-%s.zip" % (a.label, a.date)),
        "art": os.path.join(D, "tarot-app-%s-art-%s.zip" % (a.label, a.date)),
    }
    for k, p in zips.items():
        if not os.path.isfile(p):
            print("✗ 找不到 %s 包：%s" % (k, p))
            return 1

    verdicts = []

    # ---- ① 解到一个全新目录 ----
    dest = free_dir(os.path.join(D, "_verify"))
    print("① 解包 -> %s" % dest)
    for k, p in zips.items():
        with zipfile.ZipFile(p) as z:
            z.extractall(dest)
            print("   %s 包 %d 个条目" % (k, len(z.namelist())))
    copy = os.path.join(dest, "tarot-app")
    n = sum(len(f) for _, _, f in os.walk(copy))
    print("   合并后 %d 个文件" % n)
    verdicts.append(("解包", n > 0, "%d 个文件" % n))

    # ---- ② 两份清单各核一次 ----
    print("② 逐文件核对清单")
    node = a.node or shutil.which("node") or shutil.which("node.exe")
    if not node:
        print("   ✗ 找不到 node —— 无法核对清单（可用 --node 指定）")
        return 1
    vm = os.path.join(copy, "scripts", "verify_manifest.mjs")
    for label, mf in (("代码包", "MANIFEST.sha256"), ("素材包", ART_MANIFEST)):
        lg = os.path.join(dest, "_manifest-%s.log" % label)
        rc = run([node, vm, ".", "--manifest", mf], copy, lg)
        txt = read(lg)
        ok = rc == 0 and u"全部一致" in txt
        print("   %s：%s" % (label, "✓ 0 不一致" if ok else "✗ 见 %s" % lg))
        if not ok:
            print(txt[-600:])
        verdicts.append(("%s清单" % label, ok, "rc=%d" % rc))

    # ---- ③④ 真跑一遍 ----
    if a.skip_build:
        print("③④ 已跳过（--skip-build）")
    else:
        # 依赖不进包（可 npm install 再生成），用目录联接把原工程的 node_modules 借过来
        link = os.path.join(copy, "node_modules")
        if not os.path.exists(link):
            src = os.path.join(ROOT, "node_modules")
            # 注意：mklink 的输出是本机 OEM 代码页（简中 Windows 上是 GBK），
            # 用 text=True 走 utf-8 会在线程里抛 UnicodeDecodeError（不致命，但很脏）。
            r = subprocess.run(["cmd", "/c", "mklink", "/J", link, src], capture_output=True)
            err = (r.stderr or b"").decode("utf-8", "replace").strip()
            ok = r.returncode == 0 and os.path.exists(link)
            print("③ 借 node_modules：%s" % ("✓ 目录联接" if ok else "✗ 失败 %s" % err[:120]))
            if not ok:
                print("   退路：cd 到副本里跑 npm install")
                verdicts.append(("依赖", False, "无法联接 node_modules"))
        else:
            print("③ node_modules 已存在")

        py = a.python or sys.executable
        lg = os.path.join(dest, "_build-sfx.log")
        rc = run([py, os.path.join("scripts", "build-sfx.py"), "--force"], copy, lg)
        txt = read(lg)
        ok = rc == 0 and "ALL_PASS true" in txt
        print("④ 在副本里重建音效（源素材来自包内 audio-src/sfx/_raw/）：%s" % ("✓ ALL_PASS" if ok else "✗ 见 %s" % lg))
        if not ok:
            print(txt[-800:])
        verdicts.append(("由源重建音效", ok, "rc=%d" % rc))

        lg = os.path.join(dest, "_vite-build.log")
        rc = run([node, os.path.join("node_modules", "vite", "bin", "vite.js"), "build"], copy, lg)
        txt = read(lg)
        ok = rc == 0 and "built in" in txt
        dist_mp3 = 0
        dist = os.path.join(copy, "dist", "assets")
        if os.path.isdir(dist):
            dist_mp3 = len([f for f in os.listdir(dist) if f.endswith(".mp3")])
        print("④ 在副本里构建生产产物：%s（dist/assets 里 %d 个 mp3）"
              % ("✓ built" if ok else "✗ 见 %s" % lg, dist_mp3))
        if not ok:
            print(txt[-800:])
        verdicts.append(("构建产物", ok, "dist mp3=%d" % dist_mp3))

    print("")
    bad = [v for v in verdicts if not v[1]]
    for name, ok, note in verdicts:
        print("   %s %-14s %s" % ("✓" if ok else "✗", name, note))
    print("")
    print("RESULT: %s（演练副本：%s）" % ("PASS" if not bad else "FAIL", copy))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
