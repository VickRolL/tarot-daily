#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Netlify CLI 调用包装（2026-09-22 新建，R36 上线 Netlify 用）。

为什么要有这层包装：
  1. token 不落命令行 —— `--auth <token>` 会留在 shell 历史与进程列表里；
     这里从 .env.local 读进环境变量 NETLIFY_AUTH_TOKEN 再 spawn，argv 里看不到。
  2. 不经过 shell —— 本机 bash 会降级（`dirname: command not found`），
     链式命令可能静默不执行；spawnSync/list-args 直调最稳。
  3. 输出落盘 —— CLI 输出可能很长（构建日志/JSON），统一写 scripts/out/netlify/。

用法：
    python scripts/netlify_cli.py sites:list --json
    python scripts/netlify_cli.py deploy --prod --dir <abs dist> --site <id> --json
"""
import os
import re
import subprocess
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NODE = r"C:\Users\29923\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
CLI = (r"C:\Users\29923\.workbuddy\binaries\node\workspace"
       r"\node_modules\netlify-cli\bin\run.js")
ENV_FILE = os.path.join(REPO, ".env.local")
OUT_DIR = os.path.join(REPO, "scripts", "out", "netlify")


def load_token():
    """优先取环境变量，其次 .env.local。"""
    tok = os.environ.get("NETLIFY_AUTH_TOKEN")
    if tok:
        return tok.strip()
    if os.path.isfile(ENV_FILE):
        with open(ENV_FILE, encoding="utf-8") as fh:
            for line in fh:
                m = re.match(r"^\s*NETLIFY_AUTH_TOKEN\s*=\s*(\S+)\s*$", line)
                if m:
                    return m.group(1)
    return None


def main():
    args = sys.argv[1:]
    if not args:
        print("用法: python scripts/netlify_cli.py <netlify 子命令与参数...>")
        return 2
    tok = load_token()
    if not tok:
        print("ERROR 未找到 NETLIFY_AUTH_TOKEN（既不在环境变量，也不在 .env.local）")
        return 2

    env = dict(os.environ)
    env["NETLIFY_AUTH_TOKEN"] = tok
    env["NETLIFY_SITE_ID"] = env.get("NETLIFY_SITE_ID", "")
    # 关掉 CLI 的遥测与交互提示，非交互环境必备
    env["NETLIFY_CLI_DISABLE_TELEMETRY"] = "1"
    env["CI"] = "1"

    os.makedirs(OUT_DIR, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    tag = re.sub(r"[^A-Za-z0-9]+", "_", " ".join(args))[:60].strip("_")
    log = os.path.join(OUT_DIR, "%s__%s.log" % (stamp, tag))

    print("== netlify %s" % " ".join(args))
    print("== log -> %s" % os.path.relpath(log, REPO))
    with open(log, "w", encoding="utf-8", errors="replace") as fh:
        fh.write("$ netlify %s\n\n" % " ".join(args))
        fh.flush()
        p = subprocess.Popen([NODE, CLI] + args, env=env, cwd=REPO,
                             stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                             text=True, encoding="utf-8", errors="replace")
        chunks = []
        for line in p.stdout:
            chunks.append(line)
            fh.write(line)
        rc = p.wait()

    out = "".join(chunks)
    # 回显：长输出只显示尾部，完整内容看日志文件
    if len(out) > 4000:
        print("...(前 %d 字符略，完整见日志)...\n" % (len(out) - 3000))
        print(out[-3000:])
    else:
        print(out)
    print("== exit=%d" % rc)
    return rc


if __name__ == "__main__":
    sys.exit(main())
