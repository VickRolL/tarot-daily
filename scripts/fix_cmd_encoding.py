# -*- coding: utf-8 -*-
"""
修正 .cmd / .bat 的编码与换行 —— 让它们在这台机器（以及中文 Windows）上真的能跑。

为什么要这个脚本
==========================================================================
2026-09-19 实测踩到的两个坑，都是「文件写出来了、看着没问题、双击就报错」：

  ① **换行必须是 CRLF**。
     编辑器/工具默认写成 LF 时，cmd.exe 解析会错乱：
     报一堆「'xxx' 不是内部或外部命令」，而退出码仍是 0 —— 极难察觉。
     对照实验：同样的内容 CRLF 正常、LF 报错。

  ② **编码应该是 GBK（中文 Windows 控制台的 OEM 代码页）**，且**不要**再用
     `chcp 65001`。UTF-8 文件配 chcp 65001，中文输出在 GBK 控制台上会串码；
     而纯 UTF-8 不配 chcp，cmd 按 GBK 逐行读文件，中文注释会把语法结构读坏。

所以：写 GBK + CRLF，不带 chcp，中文在 zh-CN Windows 上直接正常显示。

用法
==========================================================================
    python scripts/fix_cmd_encoding.py          修正全部（幂等，可反复跑）
    python scripts/fix_cmd_encoding.py --check   只检查，不写回；有问题退出码 1
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET_EXT = (".cmd", ".bat")


def find_targets():
    out = []
    for base, dirs, files in os.walk(ROOT):
        # 产物目录不进自检：dist / dist-user / dist-dev 都是构建生成的，
        # 里面即便有 .cmd 也不该由这里负责（它们会被 --emptyOutDir 清掉）。
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "dist", "dist-user", "dist-dev")]
        for f in files:
            if f.lower().endswith(TARGET_EXT):
                out.append(os.path.join(base, f))
    return sorted(out)


def inspect(path):
    """返回 (状态, 说明)。状态取值：ok / eol / enc / both / bad"""
    with open(path, "rb") as fh:
        raw = fh.read()

    has_crlf = b"\r\n" in raw
    has_bare_lf = raw.replace(b"\r\n", b"").count(b"\n") > 0
    eol_ok = has_crlf and not has_bare_lf

    try:
        raw.decode("gbk")
        enc_ok = True
    except UnicodeDecodeError:
        enc_ok = False

    if eol_ok and enc_ok:
        return "ok", "CRLF + GBK"
    if not eol_ok and not enc_ok:
        return "both", "换行与编码都不对"
    return ("eol" if not eol_ok else "enc",
            "换行不是 CRLF" if not eol_ok else "不是 GBK 编码")


def convert(path):
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    try:
        data = text.replace("\n", "\r\n").encode("gbk")
    except UnicodeEncodeError as err:
        return False, "有 GBK 无法表示的字符：%s" % err
    with open(path, "wb") as fh:
        fh.write(data)
    return True, "已写为 GBK + CRLF"


def main():
    check_only = "--check" in sys.argv
    targets = find_targets()
    if not targets:
        print("没找到 .cmd / .bat 文件")
        return 0

    problems = 0
    for p in targets:
        rel = os.path.relpath(p, ROOT)
        state, why = inspect(p)
        if state == "ok":
            print("  ok    %s（%s）" % (rel, why))
            continue
        if check_only:
            print("  ✗     %s —— %s" % (rel, why))
            problems += 1
            continue
        ok, msg = convert(p)
        if ok:
            print("  修正  %s —— %s（原：%s）" % (rel, msg, why))
            state2, why2 = inspect(p)
            if state2 != "ok":
                print("        ⚠️ 修正后仍不对：%s" % why2)
                problems += 1
        else:
            print("  ✗     %s —— %s" % (rel, msg))
            problems += 1

    if check_only and problems:
        print("\n有 %d 个文件不合格。跑 python scripts/fix_cmd_encoding.py 修正。" % problems)
        return 1
    if problems:
        return 1
    print("\n全部合格：GBK + CRLF")
    return 0


if __name__ == "__main__":
    sys.exit(main())
