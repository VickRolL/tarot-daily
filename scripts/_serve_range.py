"""带 Range 支持的静态服务，专门用来试听音频。

为什么需要它：Python 自带的 `http.server` 不实现 Range 请求
（CPython 长期 known issue），浏览器拿不到 206 响应就**拖不动进度条** ——
一段 3 分钟的素材必须能跳到任意位置听，否则试听变成"从头憋到尾"。

用法：
    python scripts/_serve_range.py <root_dir> <port>
"""
import http.server
import os
import re
import socketserver
import sys

CHUNK = 64 * 1024


class RangeHandler(http.server.SimpleHTTPRequestHandler):
    _range_len = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=kwargs.pop('_root'), **kwargs)

    def log_message(self, fmt, *args):
        pass

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        if not os.path.isfile(path):
            self.send_error(404, 'Not found')
            return None

        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, 'Not found')
            return None

        size = os.fstat(f.fileno()).st_size
        ctype = self.guess_type(path)
        rng = self.headers.get('Range')

        if rng:
            m = re.match(r'bytes=(\d*)-(\d*)', rng.strip())
            if m:
                first, last = m.group(1), m.group(2)
                if first == '':
                    if last == '':
                        f.close()
                        self.send_error(416)
                        return None
                    length = int(last)
                    start = max(0, size - length)
                    end = size - 1
                else:
                    start = int(first)
                    end = int(last) if last else size - 1
                end = min(end, size - 1)
                if start > end or start >= size:
                    f.close()
                    self.send_error(416, 'Range Not Satisfiable')
                    return None
                self._range_len = end - start + 1
                self.send_response(206)
                self.send_header('Content-Type', ctype)
                self.send_header('Accept-Ranges', 'bytes')
                self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
                self.send_header('Content-Length', str(self._range_len))
                self.end_headers()
                f.seek(start)
                return f

        self._range_len = None
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(size))
        self.end_headers()
        return f

    def copyfile(self, source, outputfile):
        if self._range_len is None:
            return super().copyfile(source, outputfile)
        remaining = self._range_len
        while remaining > 0:
            chunk = source.read(min(CHUNK, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    root = os.path.abspath(sys.argv[1])
    port = int(sys.argv[2])
    handler = lambda *a, **kw: RangeHandler(*a, _root=root, **kw)  # noqa: E731
    with Server(('127.0.0.1', port), handler) as httpd:
        print(f'serving {root} on http://127.0.0.1:{port}/', flush=True)
        httpd.serve_forever()


if __name__ == '__main__':
    main()
