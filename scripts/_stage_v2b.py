"""临时脚本：把用户参考图收进项目，并把上一版主视觉挪进 _v2/。

用法：cd <project> && "$PY" scripts/_stage_v2b.py
（本机 mkdir / mv 不稳定，所以用 Python 的 pathlib / shutil。）
"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REF_SRC = Path(r"C:\Users\29923\.workbuddy\clipboard-images\clipboard-2026-09-19T13-17-25-147Z-5098f5c9.jpg")
REF_DST = ROOT / "assets/hero-art/refs/composition-ref-2026-09-19.jpg"
BG = ROOT / "assets/hero-art/bg"
V2_DIR = BG / "_v2"


def main() -> int:
    REF_DST.parent.mkdir(parents=True, exist_ok=True)
    if not REF_DST.exists():
        shutil.copy2(REF_SRC, REF_DST)
        print(f"copied  {REF_SRC.name} -> {REF_DST.relative_to(ROOT)}")
    else:
        print(f"exists  {REF_DST.relative_to(ROOT)}")

    V2_DIR.mkdir(parents=True, exist_ok=True)
    moved = 0
    for p in sorted(BG.glob("*.png")):  # 只处理 bg 根目录下的图，不动子目录
        shutil.move(str(p), str(V2_DIR / p.name))
        print(f"moved   {p.name} -> bg/_v2/")
        moved += 1
    print(f"\nbg/ 根目录剩余图片数：{len(list(BG.glob('*.png')))}（应为 0）· 本次移动 {moved} 张")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
