"""下载芒果灵创生成的 4 个音频变体。

URL 是带签名的临时链接（q-sign-time 到期即失效），所以必须落地成文件，
不能直接写进网页里引用。
"""
import os
import urllib.parse
import urllib.request

OUT = os.path.join('scripts', 'out', 'mglc')
os.makedirs(OUT, exist_ok=True)

ITEMS = [
    ('ambient-01_1', 'https://aigc-assets.mgtv.com/aigc/video_music/muisc_database/161834227400705_0.mp3?q-sign-algorithm=sha1&q-ak=AKIDVvBINGzVr1zoSuBKJ6ZqxtcCarRuAIF0&q-sign-time=1789847093%3B1790106893&q-key-time=1789847093%3B1790106893&q-header-list=host&q-url-param-list=&q-signature=33a86becf8ff4690fe37fdb38e33b2d36c074241'),
    ('ambient-01_2', 'https://aigc-assets.mgtv.com/aigc/video_music/muisc_database/161834227400705_1.mp3?q-sign-algorithm=sha1&q-ak=AKIDVvBINGzVr1zoSuBKJ6ZqxtcCarRuAIF0&q-sign-time=1789847093%3B1790106893&q-key-time=1789847093%3B1790106893&q-header-list=host&q-url-param-list=&q-signature=106022bfc4b531bc94cc3132dbd6ee3771682792'),
    ('sfx-test_1', 'https://aigc-assets.mgtv.com/aigc/video_music/muisc_database/161834122543105_0.mp3?q-sign-algorithm=sha1&q-ak=AKIDVvBINGzVr1zoSuBKJ6ZqxtcCarRuAIF0&q-sign-time=1789847029%3B1790106829&q-key-time=1789847029%3B1790106829&q-header-list=host&q-url-param-list=&q-signature=daf2ca825069ac076d3e776f52bc01d739e00d0b'),
    ('sfx-test_2', 'https://aigc-assets.mgtv.com/aigc/video_music/muisc_database/161834122543105_1.mp3?q-sign-algorithm=sha1&q-ak=AKIDVvBINGzVr1zoSuBKJ6ZqxtcCarRuAIF0&q-sign-time=1789847029%3B1790106829&q-key-time=1789847029%3B1790106829&q-header-list=host&q-url-param-list=&q-signature=322d2db1a8bde911e7c8780186f7bda3377867c5'),
]


def main():
    for name, url in ITEMS:
        path = os.path.join(OUT, name + '.mp3')
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
            with open(path, 'wb') as f:
                f.write(data)
            head = data[:3]
            ok = head == b'ID3' or (len(data) > 1 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0)
            print(f'{name:14s} {len(data):9d} B  head={head!r}  {"MP3-OK" if ok else "CHECK"}')
        except Exception as e:
            print(f'{name:14s} FAIL {type(e).__name__} {str(e)[:120]}')


if __name__ == '__main__':
    main()
