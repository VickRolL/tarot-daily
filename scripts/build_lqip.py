"""生成主视觉的低清占位图（LQIP），内联进 JS 供首屏秒显

为什么要内联而不是放一张小图：放到 public/ 下就又多一次网络请求，
首屏那一下反而更慢。内联成 data URI 后，浏览器解析 JS 时就已经拿到了，
主页背景出图前会先显示这块模糊底色，不会有「黑屏一闪」。

用法：
    cd "C:/Users/29923/WorkBuddy/2026-09-17-19-02-52/tarot-app"
    "C:/Users/29923/.workbuddy/binaries/python/envs/default/Scripts/python.exe" scripts/build_lqip.py

换主视觉（hero-bg）之后必须重跑一次，否则模糊底色和实际画面会对不上。
"""
import base64
import io
import pathlib
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("需要 Pillow：pip install pillow")

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIN = "mist-night"
SRC = ROOT / "public" / "skins" / SKIN / "hero-bg.webp"
OUT = ROOT / "src" / "config" / "lqip.js"

# 24px 宽足够表达色彩分布，再配 CSS 的一点点模糊就是干净的占位底
WIDTH = 24


def main() -> None:
    if not SRC.exists():
        sys.exit(f"找不到主视觉：{SRC}")

    img = Image.open(SRC).convert("RGB")
    height = max(1, round(WIDTH * img.height / img.width))
    small = img.resize((WIDTH, height), Image.LANCZOS)

    buf = io.BytesIO()
    small.save(buf, format="WEBP", quality=28, method=6)
    raw = buf.getvalue()
    b64 = base64.b64encode(raw).decode("ascii")

    OUT.write_text(
        "/**\n"
        " * 主视觉低清占位图（LQIP）——由 scripts/build_lqip.py 自动生成，不要手改。\n"
        f" * 源：public/skins/{SKIN}/hero-bg.webp，压到 {WIDTH}x{height} 的 WebP 后内联。\n"
        " * 换主视觉后重跑脚本，否则模糊底色会和新画面对不上。\n"
        " */\n"
        f"export const HERO_BG_LQIP =\n  'data:image/webp;base64,{b64}'\n",
        encoding="utf-8",
    )

    print(f"源尺寸 {img.width}x{img.height} -> {WIDTH}x{height}")
    print(f"内联体积 {len(b64)} 字符（{len(raw) / 1024:.1f} KB 二进制）")
    print(f"已写入 {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
