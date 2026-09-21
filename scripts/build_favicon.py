# -*- coding: utf-8 -*-
"""
生成站点图标：`public/icon.png` / `public/apple-touch-icon.png` / `public/favicon.ico`
====================================================================================
第三十四轮（2026-09-22）新增。起因是上线前体检揪出的那条：

  `public/` 下只有 `og-cover.jpg` 与 `skins/`，`index.html` 里也没有 `<link rel="icon">`
  → 浏览器标签页是**空白默认图标**，作品集观感直接打折。

素材为什么选牌背（而不是 og 封面 / 星云）
------------------------------------------------------------------------------------
· 星云（`orb-nebula.webp`）是无形状的纹理 → 缩到 16px 只剩一片蓝雾，认不出是什么。
· og 封面是 16:9 横版，硬裁方形会把两侧的女巫构图切碎。
· 牌背（`card-back.webp`）图案居中、深墨绿底 + 金色八角星，**高对比且有明确轮廓**，
  缩到 16px 仍能认出是一枚亮色徽章。且它本身就是「抽牌」的符号，与站点主题同源。

裁切规则（**别改成 hardcode 的像素值**）
------------------------------------------------------------------------------------
实测牌背 620×906、米色外框宽 26px、深绿内框 568×851（竖长条）。要出正方形必有一处取舍，
取「内框宽」作为边长是这里的最优解：

  ① **先探测深绿内框**：深绿是画面里唯一的暗部（米色框与金色星形都亮），
     取「亮度 < DARK_LUMA」的 bbox 即内框矩形（四角圆角不影响 bbox）。
  ② ⚠️ **必须排除最外圈 `EDGE_SKIP` 像素再取 bbox**。踩过的坑：牌背图最右一列与最下一行
     有一道 **1px 的暗色描边**，纳入统计会把 bbox 撑成整张图（实测报出 594×879），
     于是裁切框超出画布，产出里星形偏左、右边多一条米色竖条 —— 而且脚本**不报任何错**。
  ③ **边长 = 内框宽**（不是内框高）：
     · 取内框宽 → 水平方向恰好贴合深绿区（既不带米色框、也不切星形的水平尖）；
     · 取内框高会超过图宽 → 把左右两条米色竖条带进来，看着像「被裁过的牌背」；
     · 取更小（如 520）则星形上下尖有被切的风险。
     垂直方向居中即可，上下自然留出深绿边距。
  ④ 正方形中心 = 内框中心。

  不选「整张牌背 contain 进正方形」：那样两侧要填色，且填充色一旦取在内框中心的星形上
  就会变成米色底（踩过），在浅色标签栏上几乎看不见。已淘汰。

用法
------------------------------------------------------------------------------------
  "$PY" scripts/build_favicon.py             # 出三个产物
  "$PY" scripts/build_favicon.py --preview   # 另出 16/32/48 放大 8 倍的对照图（肉眼核对小尺寸）

产物落在 `public/`，Vite 会原样复制进 `dist/`。
"""
import sys
import os

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from PIL import Image

SRC = os.path.join('public', 'skins', 'mist-night', 'card-back.webp')
OUT_DIR = 'public'
PREVIEW = os.path.join('scripts', 'out', '_favicon_preview.png')

# 暗部阈值：深绿底实测亮度远低于它，米色框 / 金色星形远高于它（两边都有余量，非二分值）
DARK_LUMA = 110
# 取 bbox 前排除的最外圈像素数：用来甩掉右/下边那道 1px 暗描边（见文件头 ②）
EDGE_SKIP = 6

# 主图标尺寸。**不要调到 512**：牌背带纸纹噪点，512 的 PNG 实测 543 KB，
# 而浏览器标签页真正下载的是 ico 里的 16/32/48，书签栏/任务栏最大也只显示到 ~128px
# —— 192 已完全覆盖，体积降到 75 KB（14%）。
ICON = 192
APPLE = 180         # iOS「添加到主屏幕」
ICO_SIZES = [16, 32, 48]


def luma(rgb):
    r, g, b = rgb[:3]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def find_inner_frame(im, skip=EDGE_SKIP):
    """返回深绿内框 bbox (x0, y0, x1, y1)，右下为开区间。"""
    w, h = im.size
    px = im.load()
    x0, y0, x1, y1 = w, h, -1, -1
    for y in range(skip, h - skip):
        for x in range(skip, w - skip):
            if luma(px[x, y]) < DARK_LUMA:
                if x < x0:
                    x0 = x
                if y < y0:
                    y0 = y
                if x > x1:
                    x1 = x
                if y > y1:
                    y1 = y
    if x1 < x0 or y1 < y0:
        raise SystemExit('❌ 没找到深绿内框（DARK_LUMA / EDGE_SKIP 不合适？）')
    return x0, y0, x1 + 1, y1 + 1


def main():
    make_preview = '--preview' in sys.argv

    if not os.path.exists(SRC):
        raise SystemExit('❌ 找不到素材 %s' % SRC)

    im = Image.open(SRC).convert('RGB')
    w, h = im.size
    print('素材 %s  %d×%d' % (SRC, w, h))

    x0, y0, x1, y1 = find_inner_frame(im)
    iw, ih = x1 - x0, y1 - y0
    print('深绿内框 bbox = (%d, %d, %d, %d)   %d×%d' % (x0, y0, x1, y1, iw, ih))

    side = iw                                   # ← 边长 = 内框宽（见文件头 ③）
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    left, top = int(round(cx - side / 2.0)), int(round(cy - side / 2.0))
    right, bottom = left + side, top + side
    print('裁切框 = (%d, %d, %d, %d)  边长 %d = 内框宽' % (left, top, right, bottom, side))

    box = (max(0, left), max(0, top), min(w, right), min(h, bottom))
    square = im.crop(box)
    if square.size != (side, side):
        # 兜底：取样点必须是**内框底部的深绿**（内框中心落在星形上，取那里会得到米色）
        fill = im.getpixel((int(cx), max(0, min(h - 1, y1 - 20))))
        print('  ⚠ 裁切框超出画布，用 %s 补齐' % (fill,))
        canvas = Image.new('RGB', (side, side), fill)
        canvas.paste(square, ((side - square.size[0]) // 2, (side - square.size[1]) // 2))
        square = canvas
    print('裁后尺寸 %d×%d' % square.size)

    icon = square.resize((ICON, ICON), Image.LANCZOS)
    icon_path = os.path.join(OUT_DIR, 'icon.png')
    icon.save(icon_path, 'PNG', optimize=True)
    print('✓ %s  %d×%d  %.1f KB' % (icon_path, ICON, ICON, os.path.getsize(icon_path) / 1024))

    apple = square.resize((APPLE, APPLE), Image.LANCZOS)
    apple_path = os.path.join(OUT_DIR, 'apple-touch-icon.png')
    apple.save(apple_path, 'PNG', optimize=True)
    print('✓ %s  %d×%d  %.1f KB' % (apple_path, APPLE, APPLE, os.path.getsize(apple_path) / 1024))

    # ico：老浏览器 + 「HTML 未声明 icon 时浏览器自动请求 /favicon.ico」
    ico_path = os.path.join(OUT_DIR, 'favicon.ico')
    icon.save(ico_path, 'ICO', sizes=[(s, s) for s in ICO_SIZES])
    print('✓ %s  含 %s  %.1f KB' % (ico_path, ICO_SIZES, os.path.getsize(ico_path) / 1024))

    if make_preview:
        scale, pad = 8, 12
        tiles = [square.resize((s, s), Image.LANCZOS).resize((s * scale, s * scale), Image.NEAREST)
                 for s in ICO_SIZES]
        sheet = Image.new('RGB', (sum(t.size[0] for t in tiles) + pad * (len(tiles) + 1),
                                  max(t.size[1] for t in tiles) + pad * 2), (245, 243, 238))
        x = pad
        for t in tiles:
            sheet.paste(t, (x, pad))
            x += t.size[0] + pad
        os.makedirs(os.path.dirname(PREVIEW), exist_ok=True)
        sheet.save(PREVIEW, 'PNG')
        print('✓ 对照图 %s（依次 16/32/48，各放大 %d 倍）' % (PREVIEW, scale))

    print('OK')


if __name__ == '__main__':
    main()
