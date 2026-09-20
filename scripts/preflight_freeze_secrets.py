# -*- coding: utf-8 -*-
"""
冻结快照 / 推送远端之前的**密钥体检**。

为什么单独写一个：`freeze_snapshot.py` 把根目录散件（`os.sep not in rel`）**一律**收进代码包，
而 `.env.local`（API key 就写在这里）正好躺在根目录 —— 照现状冻结就会把 key 烤进 zip。
v1 冻结于 2026-09-19，那时这个文件还不存在（R26 才引入），所以这是**两个版本之间新出现的口子**。
**每次冻结前跑一次**，与 `freeze_snapshot.py` 配对使用。

三个问题都要回答：
  1) 密钥文件现在**在不在**工作区、内容是什么形状（只打印变量名与长度，绝不打印值）
  2) 密钥有没有进过 git（索引 / 历史里所有对象）—— 有的话推远端等于公开泄露
  3) 按当前的 collect() 规则冻结，会不会把它收进包

输出只给布尔与计数，密钥本体一字节都不落屏。退出码非 0 = 有风险。
"""
import importlib.util
import io
import os
import subprocess
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

FAIL = []


def sh(args, **kw):
    p = subprocess.run(args, capture_output=True, **kw)
    return p.returncode, p.stdout


def load_freeze():
    spec = importlib.util.spec_from_file_location(
        "freeze_snapshot", os.path.join(ROOT, "scripts", "freeze_snapshot.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def secrets_in_worktree():
    """找出工作区里所有「密钥类」文件，并抽出要搜的密文串（不回显）。"""
    found = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "_archive", "dist")]
        for f in files:
            if f.startswith(".env") or f.endswith(".key"):
                found.append(os.path.relpath(os.path.join(base, f), ROOT))
    return sorted(found)


def extract_values(paths):
    """从密钥文件里取出「值」部分（用于全历史搜索），只返回 (变量名, 值) 列表。"""
    vals = []
    for rel in paths:
        with io.open(os.path.join(ROOT, rel), encoding="utf-8", errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                v = v.strip().strip('"').strip("'")
                if len(v) >= 12:                 # 太短的没法当指纹搜
                    vals.append((rel, k.strip(), v))
    return vals


def scan_all_git_objects(needle: bytes):
    """遍历仓库里所有对象（含历史、含已删除文件），找 needle。"""
    hits = []
    p = subprocess.Popen(["git", "cat-file", "--batch-all-objects", "--batch"],
                         stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    n = 0
    while True:
        header = p.stdout.readline()
        if not header:
            break
        parts = header.split()
        if len(parts) < 3:
            continue
        oid, typ, size = parts[0].decode(), parts[1].decode(), int(parts[2])
        body = p.stdout.read(size)
        p.stdout.read(1)                          # 对象间的换行
        n += 1
        if typ == "blob" and needle in body:
            hits.append(oid)
    p.stdout.close()
    p.wait()
    return n, hits


def main():
    print("① 工作区里的密钥类文件")
    secs = secrets_in_worktree()
    if secs:
        for s in secs:
            print("   %s  (%d 字节)" % (s, os.path.getsize(os.path.join(ROOT, s))))
    else:
        print("   无")
    print("")

    print("② 这些文件是否被 git 跟踪 / 进过历史")
    rc, out = sh(["git", "ls-files", "--error-unmatch"] + secs) if secs else (1, b"")
    tracked = [s for s in secs if not sh(["git", "ls-files", "--error-unmatch", s])[0]]
    print("   当前被跟踪的密钥文件：%s" % (tracked if tracked else "无 ★"))
    if tracked:
        FAIL.append("密钥文件已被 git 跟踪")
    rc, out = sh(["git", "log", "--all", "--oneline", "--name-only", "--"] + (secs or ["."]))
    touched = [l for l in out.decode("utf-8", "replace").splitlines()
               if any(s in l for s in secs)]
    print("   历史上出现过密钥文件路径的提交行：%d 条" % len(touched))
    for l in touched[:10]:
        print("      %s" % l.strip())
    if touched:
        FAIL.append("密钥文件路径出现在 git 历史里")

    print("")
    print("③ 把密钥的『值』当指纹，扫遍仓库所有对象（含历史 / 已删文件）")
    vals = extract_values(secs)
    if not vals:
        print("   没有长度 >=12 的值可取，跳过（视为无明文密钥）")
    total_obj = 0
    for rel, name, val in vals:
        n, hits = scan_all_git_objects(val.encode("utf-8"))
        total_obj = n
        print("   %s 的 %s：扫描 %d 个对象 -> 命中 %d 个 blob %s"
              % (rel, name, n, len(hits), "★" if not hits else hits[:5]))
        if hits:
            FAIL.append("密钥明文出现在 git 对象 %s" % hits[:3])

    print("")
    print("④ 按当前规则冻结，密钥会不会进包")
    m = load_freeze()
    code, art = m.collect()
    leaked = [r for r in code + art if os.path.basename(r).startswith(".env")
              or r.endswith(".key")]
    print("   代码包 %d 文件 / 美术包 %d 文件" % (len(code), len(art)))
    print("   会被收进包的密钥文件：%s" % (leaked if leaked else "无"))
    if leaked:
        FAIL.append("冻结脚本会把密钥收进包：%s" % leaked)
    out_dir = [r for r in code if r.startswith(os.path.join("scripts", "out"))]
    print("   会被收进包的 scripts/out 文件数：%d（%.1f MB）"
          % (len(out_dir), sum(os.path.getsize(os.path.join(ROOT, r)) for r in out_dir) / 1048576))

    print("")
    if FAIL:
        print("RESULT: FAIL —— 有 %d 项必须先修：" % len(FAIL))
        for f in FAIL:
            print("   · %s" % f)
        return 1
    print("RESULT: PASS —— 密钥未入 git、也不在任何包的收录范围内")
    return 0


if __name__ == "__main__":
    sys.exit(main())
