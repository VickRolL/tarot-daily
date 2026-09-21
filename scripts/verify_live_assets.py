#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""线上产物完整性核对（2026-09-22 新建，R36 Netlify 上线用）。

为什么需要：本地 `dist/` 验过不等于线上齐。
CDN 上可能少文件（部署时被忽略）、多文件（缓存了上一版）、
或内容不一致（构建产物与上传产物不同源）。逐字节比一次最省心。

做法：把本地 `dist/` 每个文件拼成线上 URL，GET 回来算 sha256 与本地比。

用法：
    python scripts/verify_live_assets.py https://tarotdaily.netlify.app

判据：状态码 200、字节数一致、sha256 一致。末尾打印 LIVE_ASSETS_* 聚合行。
"""
import hashlib
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(REPO, "dist")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) tarot-live-check/1.0"


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def local_files():
    out = []
    for dp, _dn, fn in os.walk(DIST):
        for f in fn:
            p = os.path.join(dp, f)
            rel = os.path.relpath(p, DIST).replace(os.sep, "/")
            out.append((rel, p))
    return sorted(out)


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA,
                                               "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read()


def main():
    base = (sys.argv[1] if len(sys.argv) > 1
            else "https://tarotdaily.netlify.app").rstrip("/")
    if not os.path.isdir(DIST):
        print("ERROR 本地 dist/ 不存在，先 npm run build")
        return 2

    files = local_files()
    print("本地 dist 文件数：%d" % len(files))
    print("线上基址：%s\n" % base)

    ok = fail = 0
    bad = []
    total = 0
    for rel, path in files:
        with open(path, "rb") as fh:
            data = fh.read()
        total += len(data)
        # 路径里的中文/特殊字符要按 URL 规则编码
        url = base + "/" + urllib.parse.quote(rel)
        try:
            status, body = fetch(url)
        except urllib.error.HTTPError as e:
            ok_ = False
            detail = "HTTP %d" % e.code
            body = b""
        except Exception as e:
            ok_ = False
            detail = "%s: %s" % (type(e).__name__, e)
            body = b""
        else:
            if status != 200:
                ok_ = False
                detail = "HTTP %d" % status
            elif len(body) != len(data):
                ok_ = False
                detail = "长度 %d != 本地 %d" % (len(body), len(data))
            elif sha256(body) != sha256(data):
                ok_ = False
                detail = "sha256 不一致"
            else:
                ok_ = True
                detail = "200 · %d B" % len(body)

        if ok_:
            ok += 1
            print("  OK   %-46s %s" % (rel, detail))
        else:
            fail += 1
            bad.append("%s -> %s" % (rel, detail))
            print("  FAIL %-46s %s" % (rel, detail))

    print("\n本地总字节：%d（%.2f MB）" % (total, total / 1048576))
    print("通过 %d / 失败 %d" % (ok, fail))
    for b in bad:
        print("  失败项：%s" % b)
    print("LIVE_ASSETS_%s ok=%d fail=%d" % ("PASS" if fail == 0 else "FAIL", ok, fail))
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
