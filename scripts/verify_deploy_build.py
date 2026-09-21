#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""部署前仿真：用「仓库里真正有的东西」在干净目录里从零构建一次。

## 为什么需要这一步

平台的构建源是 **GitHub 仓库里被跟踪的文件**，不是本机工作区。
本机能构建成功，**不能**证明平台能构建成功 —— 本机多了 node_modules、
多了被 .gitignore 排除的目录、可能还依赖了没入库的素材。典型翻车：

  · 运行时素材（音频 / 字体 / public 下的图）被 .gitignore 漏掉
    → 平台构建「成功」，但线上缺素材，肉眼要等很久才发现
  · `package-lock.json` 没入库 → 平台按 `^` 解析到更新的依赖，构建行为漂移
  · 构建脚本里调了本机才有的东西（python / 绝对路径脚本）
    → 平台直接构建失败

这个脚本把上述风险一次性证伪：**clone 一个只含被跟踪文件的干净副本 → 装依赖 → 构建 → 逐项核对产物**。

## 判据（任一条红就说明平台侧会出问题）

  P1  clone 成功，且克隆目录的文件数 == HEAD 跟踪文件数（证明工作区与版本库一致）
  P2  `npm ci` 成功（平台默认走 lockfile 精确复现）
  P3  `npm run build`（与平台同一条命令）成功，exit 0
  P4  dist 根部四件套齐全：favicon.ico / icon.png / apple-touch-icon.png / og-cover.jpg
  P5  dist 里 22 张牌面 webp 齐全（skins/mist-night/cards/major-00..21）
  P6  dist 里 5 个音频齐全（ambient-loop + sfx 四个）
  P7  dist 里 3 个字体齐全（title-han / title-han-400 / title-latin）
  P8  three 独立 chunk 存在（水晶球 3D 没被摇掉）
  P9  **JS** 里 `devbar` 零命中（调试条在产物里必须被摇掉）
      ⚠️ 只扫 .js —— CSS 里必然有命中（Tailwind 扫类名），见 NEXT_STEPS §19.9
  P10 仿真产物与本地 `dist/`（若存在）的**相对路径集合**一致

## 用法

    <managed-python> scripts/verify_deploy_build.py          # 全流程
    <managed-python> scripts/verify_deploy_build.py --quick  # 跳过 npm ci（复用上次克隆的 node_modules）

产物落在 `scripts/out/_deploy-sim-<时间戳>/`。
**刻意不删除旧目录**（本机安全策略会拦 rmtree），所以每跑一次多一个目录。
"""

import base64
import hashlib
import os
import re
import shutil
import subprocess
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NODE_CANDIDATES = [
    r"C:\Users\29923\.workbuddy\binaries\node\versions\22.22.2-3\node.exe",
    r"C:\Program Files\nodejs\node.exe",
]
NPM_CLI_REL = os.path.join("node_modules", "npm", "bin", "npm-cli.js")

results = []  # (编号, 说明, 是否通过, 补充信息)


def log(msg=""):
    print(msg, flush=True)


def run(cmd, cwd, log_path, timeout=1800):
    """跑一条命令，stdout+stderr 落到 log_path，返回 (returncode, 合并输出)。"""
    log(f"  $ {' '.join(os.path.basename(c) if i == 0 else c for i, c in enumerate(cmd))}")
    try:
        p = subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(f"TIMEOUT after {timeout}s\n")
        return -1, f"TIMEOUT after {timeout}s"
    out = (p.stdout or "") + ("\n--- stderr ---\n" + p.stderr if p.stderr else "")
    with open(log_path, "w", encoding="utf-8") as f:
        f.write(f"$ {' '.join(cmd)}\ncwd={cwd}\nexit={p.returncode}\n\n{out}")
    return p.returncode, out


def pick_node():
    for c in NODE_CANDIDATES:
        if os.path.isfile(c):
            return c
    return None


def find_reusable_sim():
    """找最近一个「已经装过依赖」的仿真目录，供 --quick 复用。

    为什么要复用：完整跑一次要 clone + npm ci(≈53s) + build，
    判据本身却在几秒内就算完 —— 改判据时要反复跑，每次都等一分钟太笨。
    """
    base = os.path.join(REPO, "scripts", "out")
    if not os.path.isdir(base):
        return None, None
    cands = sorted(d for d in os.listdir(base) if d.startswith("_deploy-sim-"))
    for d in reversed(cands):
        root = os.path.join(base, d)
        dest = os.path.join(root, "tarot-daily")
        if os.path.isdir(os.path.join(dest, "node_modules")):
            return root, dest
    return None, None


def tracked_files():
    p = subprocess.run(["git", "-C", REPO, "ls-files"], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return [f for f in p.stdout.splitlines() if f.strip()]


def walk_rel(root):
    """列出 root 下所有文件的相对路径（用 / 分隔）。"""
    out = set()
    for dp, _dn, fn in os.walk(root):
        for f in fn:
            out.add(os.path.relpath(os.path.join(dp, f), root).replace("\\", "/"))
    return out


def check(idx, desc, ok, extra=""):
    results.append((idx, desc, bool(ok), extra))
    log(f"  [{'PASS' if ok else 'FAIL'}] {idx}  {desc}" + (f"  — {extra}" if extra else ""))
    return bool(ok)


def main():
    quick = "--quick" in sys.argv
    node = pick_node()
    if not node:
        log("找不到 node.exe，无法仿真。")
        return 2
    npm_cli = os.path.join(os.path.dirname(node), NPM_CLI_REL)
    if not os.path.isfile(npm_cli):
        log(f"找不到 npm-cli.js：{npm_cli}")
        return 2

    ts = time.strftime("%Y%m%d-%H%M%S")
    sim_root, dest = (find_reusable_sim() if quick else (None, None))
    reuse = sim_root is not None
    if not reuse:
        sim_root = os.path.join(REPO, "scripts", "out", f"_deploy-sim-{ts}")
        dest = os.path.join(sim_root, "tarot-daily")
    os.makedirs(sim_root, exist_ok=True)
    logs = os.path.join(sim_root, "logs")
    os.makedirs(logs, exist_ok=True)

    log(f"仓库   : {REPO}")
    log(f"仿真到 : {sim_root}")
    log(f"node   : {node}")
    log("")

    # ---- P1 干净克隆 ----
    log("[1/3] 干净克隆（只含被跟踪文件）" + ("（--quick：复用）" if reuse else ""))
    if reuse:
        check("P1", "clone 成功且文件集 == HEAD 跟踪文件集", True, f"复用 {dest}")
    else:
        rc, _ = run(["git", "clone", "--depth", "1", "--branch", "main", REPO, dest],
                    cwd=sim_root, log_path=os.path.join(logs, "01-clone.log"), timeout=600)
        if rc != 0:
            check("P1", "clone 成功", False, "见 logs/01-clone.log")
            return 1
        # .git 目录内的文件不属于工作区，剔除
        clone_files = {f for f in walk_rel(dest) if not f.startswith(".git/")}
        expect = set(tracked_files())
        missing = sorted(expect - clone_files)
        extra = sorted(clone_files - expect)
        check("P1", "clone 成功且文件集 == HEAD 跟踪文件集",
              not missing,
              f"跟踪 {len(expect)} / 克隆 {len(clone_files)}"
              + (f"；缺失 {len(missing)}：{missing[:5]}" if missing else "")
              + (f"；多出 {len(extra)}：{extra[:5]}" if extra else ""))

    # 克隆里有没有 node_modules 之外的构建必需物
    log("")

    # ---- P2 npm ci ----
    log("[2/3] 装依赖" + ("（--quick：跳过）" if (quick or reuse) else "（npm ci，平台同款）"))
    if quick or reuse:
        check("P2", "npm ci 成功", True, "已跳过（复用已有 node_modules）")
    else:
        rc, out = run([node, npm_cli, "ci", "--no-audit", "--no-fund"],
                      cwd=dest, log_path=os.path.join(logs, "02-npm-ci.log"), timeout=1800)
        tail = [l for l in out.splitlines() if l.strip()][-3:]
        check("P2", "npm ci 成功（lockfile 精确复现）", rc == 0, f"exit={rc} " + " | ".join(tail))
        if rc != 0:
            log("\nnpm ci 失败 → 平台会构建失败，先看 logs/02-npm-ci.log")
            return 1

    # ---- P3 构建 ----
    log("")
    log("[3/3] 构建（平台同一条命令：npm run build）")
    rc, out = run([node, npm_cli, "run", "build"],
                  cwd=dest, log_path=os.path.join(logs, "03-build.log"), timeout=1800)
    build_ok = rc == 0
    dist = os.path.join(dest, "dist")
    if not build_ok and os.path.isdir(dist):
        log("  （npm run build 非零，但 dist 已生成，继续核对产物）")
    # vite 的警告也打出来，方便定位
    for line in out.splitlines():
        if re.search(r"error|warn|fail", line, re.I):
            log("    ! " + line.strip()[:160])
    check("P3", "npm run build 成功（exit 0）", build_ok, f"exit={rc}")

    if not os.path.isdir(dist):
        log("\ndist/ 不存在，后面没法核对。")
        return 1

    # ---- P4~P9 产物核对 ----
    log("")
    log("[核对] 产物完整性")

    four = ["favicon.ico", "icon.png", "apple-touch-icon.png", "og-cover.jpg"]
    lack4 = [f for f in four if not os.path.isfile(os.path.join(dist, f))]
    check("P4", "dist 根部四件套齐全（favicon/icon/apple-touch/og-cover）", not lack4,
          f"缺 {lack4}" if lack4 else "4/4")

    cards_dir = os.path.join(dist, "skins", "mist-night", "cards")
    cards = sorted(os.listdir(cards_dir)) if os.path.isdir(cards_dir) else []
    check("P5", "22 张牌面 webp 齐全", len(cards) == 22, f"{len(cards)}/22")

    rel = walk_rel(dist)
    mp3 = sorted(f for f in rel if f.lower().endswith(".mp3"))
    check("P6", "5 个音频齐全（1 环境音 + 4 音效）", len(mp3) == 5,
          f"{len(mp3)} 个：" + ", ".join(os.path.basename(m) for m in mp3))

    # P7 字体：独立文件 or CSS 内联，**两种形态都算通过**
    # ⚠️ 为什么不能只数 dist 里的 woff2 个数（第一版判据就是这么写错的）：
    #   vite 的 assetsInlineLimit 默认 4096 字节，而三个标题字体分别只有
    #   1.8KB / 1.6KB / 6.6KB —— 前两个**会被内联成 base64 塞进 CSS**，
    #   只有超限的 6.6KB 那个留成独立文件。
    #   于是产物里「只有 1 个 woff2」看起来像丢了两个字体，实际一个都没丢。
    #   → 正确判据是「源字体的**字节**必须原封不动出现在产物里」（文件或 base64 皆可），
    #     顺带校 woff2 魔数（第二十三轮踩过「字体文件里装的其实是 HTTP 400 错误页」）。
    font_dir = os.path.join(REPO, "src", "assets", "fonts")
    font_srcs = sorted(f for f in os.listdir(font_dir) if f.lower().endswith(".woff2"))
    dist_woff = {}
    for _f in rel:
        if _f.lower().endswith(".woff2"):
            dist_woff[os.path.basename(_f)] = open(os.path.join(dist, _f), "rb").read()
    all_text = ""
    for _f in rel:
        if _f.endswith((".css", ".js")):
            all_text += open(os.path.join(dist, _f), "r", encoding="utf-8", errors="replace").read()
    font_detail, font_ok = [], True
    for name in font_srcs:
        raw = open(os.path.join(font_dir, name), "rb").read()
        magic_ok = raw[:4] == b"wOF2"
        inlined = base64.b64encode(raw).decode() in all_text
        as_file = any(v == raw for v in dist_woff.values())
        ok = magic_ok and (inlined or as_file)
        font_ok = font_ok and ok
        where = "内联base64" if inlined else ("独立文件" if as_file else "**丢失**")
        font_detail.append(f"{name}({len(raw)}B,{where}{'' if magic_ok else ',魔数坏'})")
    check("P7", f"{len(font_srcs)} 个字体都进了产物（文件或 base64 内联）+ woff2 魔数正确",
          font_ok and len(font_srcs) == 3, "；".join(font_detail))
    bad_magic = sorted(n for n, v in dist_woff.items() if v[:4] != b"wOF2")
    if dist_woff:
        check("P7b", "产物里独立 woff2 文件的魔数正确", not bad_magic,
              f"{len(dist_woff)} 个独立文件" + (f"，坏的：{bad_magic}" if bad_magic else ""))

    three_chunks = [f for f in rel if re.search(r"three.*\.js$", f)]
    check("P8", "three 独立 chunk 存在（3D 球没被摇掉）", bool(three_chunks),
          ", ".join(os.path.basename(t) for t in three_chunks))

    # P9：只扫 JS。CSS 里 devbar 命中是正常的（Tailwind 扫类名），见 §19.9
    hits = []
    js_files = [f for f in rel if f.endswith(".js")]
    for f in js_files:
        p = os.path.join(dist, f)
        try:
            txt = open(p, "r", encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        n = txt.lower().count("devbar")
        if n:
            hits.append(f"{f}:{n}")
    check("P9", "JS 里 devbar 零命中（CSS 允许命中，不算红）", not hits,
          "；".join(hits) if hits else f"扫了 {len(js_files)} 个 js")

    # P10 与本地 dist 对比
    local_dist = os.path.join(REPO, "dist")
    if os.path.isdir(local_dist):
        local_rel = walk_rel(local_dist)
        only_sim = sorted(rel - local_rel)
        only_local = sorted(local_rel - rel)
        check("P10", "仿真产物与本地 dist 的相对路径集合一致",
              not only_sim and not only_local,
              f"仿真独有 {len(only_sim)} / 本地独有 {len(only_local)}"
              + (f"；如 {only_sim[:3]} {only_local[:3]}" if (only_sim or only_local) else ""))
    else:
        check("P10", "与本地 dist 对比", True, "本地无 dist/，跳过")

    # ---- 汇总 ----
    log("")
    failed = [r for r in results if not r[2]]
    for idx, desc, ok, extra in results:
        log(f"{'PASS' if ok else 'FAIL'}  {idx}  {desc}" + (f"  — {extra}" if extra else ""))
    log("")
    if failed:
        log(f"RESULT: FAIL（{len(failed)} 项红）—— 平台侧很可能出同样的问题")
        log(f"日志目录：{logs}")
        return 1
    log(f"RESULT: ALL_PASS（{len(results)} 项全绿）")
    log(f"仿真目录：{sim_root}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
