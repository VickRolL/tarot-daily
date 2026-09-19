# -*- coding: utf-8 -*-
"""
牌面总览拼版：把 22 张大阿卡纳插画拼成一张联络表，用于一次性验收风格一致性。
用法：python scripts/contact_sheet.py [原始插画目录] [输出文件]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "assets", "card-art")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "assets", "previews", "contact-sheet.png")

FONT_CN = [r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\simsun.ttc"]
LABELS = {
    "major-00": "0 愚人", "major-01": "I 魔术师", "major-02": "II 女祭司",
    "major-03": "III 女皇", "major-04": "IV 皇帝", "major-05": "V 教皇",
    "major-06": "VI 恋人", "major-07": "VII 战车", "major-08": "VIII 力量",
    "major-09": "IX 隐士", "major-10": "X 命运之轮", "major-11": "XI 正义",
    "major-12": "XII 倒吊人", "major-13": "XIII 死神", "major-14": "XIV 节制",
    "major-15": "XV 恶魔", "major-16": "XVI 塔", "major-17": "XVII 星星",
    "major-18": "XVIII 月亮", "major-19": "XIX 太阳", "major-20": "XX 审判",
    "major-21": "XXI 世界",
}

COLS, CW, CH, GAP, PAD = 6, 200, 300, 10, 20


def font(size):
    for f in FONT_CN:
        if os.path.exists(f):
            try:
                return ImageFont.truetype(f, size)
            except Exception:
                pass
    return ImageFont.load_default()


def find_art(card_id):
    """两路自动适配：先看 <SRC>/<card_id>/ 目录，再看 <SRC>/preview-<card_id>.png 平铺文件。"""
    d = os.path.join(SRC, card_id)
    if os.path.isdir(d):
        for f in sorted(os.listdir(d)):
            if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                return os.path.join(d, f)
    flat = os.path.join(SRC, "preview-%s.png" % card_id)
    return flat if os.path.exists(flat) else None


def main():
    ids = sorted(LABELS)
    rows = (len(ids) + COLS - 1) // COLS
    label_h = 26
    W = PAD * 2 + COLS * CW + (COLS - 1) * GAP
    H = PAD * 2 + rows * (CH + label_h) + (rows - 1) * GAP
    sheet = Image.new("RGB", (W, H), (250, 248, 244))
    d = ImageDraw.Draw(sheet)
    f = font(16)

    for i, cid in enumerate(ids):
        r, c = divmod(i, COLS)
        x = PAD + c * (CW + GAP)
        y = PAD + r * (CH + label_h + GAP)
        p = find_art(cid)
        if p:
            im = Image.open(p).convert("RGB")
            sw, sh = im.size
            scale = max(CW / sw, CH / sh)
            im = im.resize((int(sw * scale), int(sh * scale)), Image.LANCZOS)
            left = (im.width - CW) // 2
            top = (im.height - CH) // 2
            sheet.paste(im.crop((left, top, left + CW, top + CH)), (x, y))
            d.rectangle([x, y, x + CW - 1, y + CH - 1], outline=(190, 182, 168))
        else:
            d.rectangle([x, y, x + CW - 1, y + CH - 1], fill=(228, 224, 216))
            d.text((x + CW // 2, y + CH // 2), "缺图", font=f, fill=(140, 130, 120), anchor="mm")
        d.text((x + CW // 2, y + CH + 4), LABELS[cid], font=f, fill=(70, 62, 52), anchor="ma")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.save(OUT)
    print("总览 ->", OUT, sheet.size)


if __name__ == "__main__":
    main()
