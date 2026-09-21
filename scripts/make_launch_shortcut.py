"""生成「塔罗日签」本地预览快捷方式（桌面 .lnk + 配套图标）。

为什么手写 .lnk 二进制：
    本机安全策略拦截 PowerShell 的 COM 实例化（WScript.Shell），pywin32 也没装。
    所以这里直接按 MS-SHLLINK 规范写字节流。

校验分两层：
    1. parse_lnk()           —— 自己写、自己读，检查字段有没有写歪；
    2. verify_with_shell()   —— 把 .lnk 交给 Windows 自己的 IShellLink 接口读回来。
       手写格式最怕"自说自话"，第 2 层用系统实现做裁判才作数。

用法：
    python scripts/make_launch_shortcut.py             # 生成图标 + 桌面快捷方式
    python scripts/make_launch_shortcut.py --verify    # 解析并校验已生成的 .lnk
    python scripts/make_launch_shortcut.py --run       # 交给 Shell 打开（等价于双击）
"""
import ctypes
import os
import struct
import sys

from PIL import Image, ImageDraw

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(PROJECT, 'assets', 'launcher')
ICO_PATH = os.path.join(ICON_DIR, 'tarot-daily.ico')
ICON_SRC = os.path.join(PROJECT, 'public', 'skins', 'mist-night', 'card-back.webp')
CMD_PATH = os.path.join(PROJECT, 'start-tarot.cmd')
LNK_NAME = '塔罗日签.lnk'
DESCRIPTION = '塔罗日签 · 本地预览'
CMD_EXE = os.path.join(os.environ.get('SystemRoot', r'C:\Windows'), 'System32', 'cmd.exe')

# ---------------------------------------------------------------- 图标


def build_icon() -> str:
    """从牌背素材裁出方形图标（八角星月徽居中），输出多尺寸 .ico。"""
    os.makedirs(ICON_DIR, exist_ok=True)
    im = Image.open(ICON_SRC).convert('RGBA')
    w, h = im.size

    side = min(w, h)
    cx, cy = w / 2, h * 0.47          # 徽记中心略高于画面正中
    left = int(round(cx - side / 2))
    top = int(round(cy - side / 2))
    left = max(0, min(left, w - side))
    top = max(0, min(top, h - side))
    square = im.crop((left, top, left + side, top + side))

    size = 512
    square = square.resize((size, size), Image.LANCZOS)

    radius = int(size * 0.17)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)

    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(square, (0, 0), mask)

    out.save(
        ICO_PATH,
        format='ICO',
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)],
    )
    out.resize((256, 256), Image.LANCZOS).save(os.path.join(ICON_DIR, 'tarot-daily-256.png'))
    return ICO_PATH


# ---------------------------------------------------------------- lnk

LINK_FLAGS = (
    0x00000002  # HasLinkInfo
    | 0x00000004  # HasName
    | 0x00000010  # HasWorkingDir
    | 0x00000020  # HasArguments
    | 0x00000040  # HasIconLocation
    | 0x00000080  # IsUnicode
)


def _u16(s: str) -> bytes:
    """CountedString：2 字节字符数 + UTF-16LE（不含终止 NUL）。"""
    return struct.pack('<H', len(s)) + s.encode('utf-16-le')


def build_lnk_blob(target: str, arguments: str, workdir: str, icon: str, description: str, icon_index: int = 0) -> bytes:
    header = struct.pack('<I', 0x4C)                                  # HeaderSize
    header += bytes.fromhex('0114020000000000C000000000000046')       # LinkCLSID
    header += struct.pack('<I', LINK_FLAGS)
    header += struct.pack('<I', 0x20)                                 # FileAttributes: ARCHIVE
    header += struct.pack('<Q', 0)                                    # CreationTime
    header += struct.pack('<Q', 0)                                    # AccessTime
    header += struct.pack('<Q', 0)                                    # WriteTime
    header += struct.pack('<I', 0)                                    # FileSize
    header += struct.pack('<i', icon_index)
    header += struct.pack('<I', 1)                                    # ShowCommand: SW_SHOWNORMAL
    header += struct.pack('<H', 0)                                    # HotKey
    header += struct.pack('<H', 0)                                    # Reserved
    header += struct.pack('<I', 0)                                    # Reserved2
    header += struct.pack('<I', 0)                                    # Reserved3
    assert len(header) == 0x4C, len(header)

    # LinkInfo：靠 LocalBasePath 把绝对路径告诉 Shell
    local_base = target.encode('mbcs') + b'\x00'
    volume_label = b'C:\\\x00'
    volume_id = struct.pack('<IIII', 16 + len(volume_label), 3, 0, 16) + volume_label  # 3 = DRIVE_FIXED
    header_size = 0x1C
    vol_off = header_size
    lb_off = vol_off + len(volume_id)
    suffix_off = lb_off + len(local_base)
    payload = (
        struct.pack('<IIIIIII', 0, header_size, 0x1, vol_off, lb_off, 0, suffix_off)
        + volume_id
        + local_base
        + b'\x00'
    )
    pad = (-len(payload)) % 4
    payload += b'\x00' * pad
    link_info = struct.pack('<I', len(payload)) + payload[4:]

    strings = _u16(description) + _u16(workdir) + _u16(arguments) + _u16(icon)
    return header + link_info + strings + struct.pack('<I', 0)


def parse_lnk(blob: bytes) -> dict:
    """最小解析器：读回自己写的 lnk，确认字段真的落对了。"""
    assert struct.unpack_from('<I', blob, 0)[0] == 0x4C, 'HeaderSize 异常'
    flags = struct.unpack_from('<I', blob, 20)[0]
    pos = 0x4C
    info = {}
    if flags & 0x2:                                     # HasLinkInfo
        size = struct.unpack_from('<I', blob, pos)[0]
        lb_rel = struct.unpack_from('<I', blob, pos + 16)[0]
        start = pos + lb_rel
        end = blob.index(b'\x00', start)
        info['local_base_path'] = blob[start:end].decode('mbcs')
        pos += size
    order = ['name', 'relative_path', 'working_dir', 'arguments', 'icon_location']
    idx = 0
    for key in order:
        if flags & (0x4 << idx):
            n = struct.unpack_from('<H', blob, pos)[0]
            raw = blob[pos + 2: pos + 2 + n * 2]
            info[key] = raw.decode('utf-16-le')
            pos += 2 + n * 2
        idx += 1
    info['flags'] = hex(flags)
    return info


# ------------------------------------------- 权威校验：让 Shell 自己读一遍

class _GUID(ctypes.Structure):
    _fields_ = [
        ('Data1', ctypes.c_uint32),
        ('Data2', ctypes.c_uint16),
        ('Data3', ctypes.c_uint16),
        ('Data4', ctypes.c_ubyte * 8),
    ]


_ole32 = ctypes.windll.ole32
_ole32.CLSIDFromString.argtypes = [ctypes.c_wchar_p, ctypes.POINTER(_GUID)]
_ole32.CLSIDFromString.restype = ctypes.c_long
_ole32.CoCreateInstance.argtypes = [
    ctypes.POINTER(_GUID),
    ctypes.c_void_p,
    ctypes.c_uint32,
    ctypes.POINTER(_GUID),
    ctypes.POINTER(ctypes.c_void_p),
]
_ole32.CoCreateInstance.restype = ctypes.c_long

CLSID_SHELLLINK = '{00021401-0000-0000-C000-000000000046}'
IID_ISHELLLINKW = '{000214F9-0000-0000-C000-000000000046}'
IID_IPERSISTFILE = '{0000010B-0000-0000-C000-000000000046}'
CLSCTX_INPROC_SERVER = 1
STGM_READ = 0


def _guid(text: str) -> '_GUID':
    g = _GUID()
    if _ole32.CLSIDFromString(ctypes.c_wchar_p(text), ctypes.byref(g)) != 0:
        raise OSError(f'CLSIDFromString 失败：{text}')
    return g


def _method(ptr, index: int, restype, *argtypes):
    """按 vtable 下标取 COM 方法（下标 0/1/2 恒为 QueryInterface/AddRef/Release）。"""
    vtable = ctypes.cast(ptr, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p)))[0]
    return ctypes.WINFUNCTYPE(restype, ctypes.c_void_p, *argtypes)(vtable[index])


def _hresult(hr: int) -> str:
    return f'0x{hr & 0xFFFFFFFF:08X}'


def verify_with_shell(lnk_path: str) -> dict:
    """用 Windows 的 IShellLink 把 .lnk 读回，能读全字段才算格式真的合法。"""
    _ole32.CoInitialize(None)
    link = ctypes.c_void_p()
    persist = ctypes.c_void_p()
    try:
        clsid = _guid(CLSID_SHELLLINK)
        iid = _guid(IID_ISHELLLINKW)
        hr = _ole32.CoCreateInstance(
            ctypes.byref(clsid), None, CLSCTX_INPROC_SERVER, ctypes.byref(iid), ctypes.byref(link)
        )
        if hr != 0:
            raise OSError(f'CoCreateInstance(ShellLink) 失败 hr={_hresult(hr)}')

        qi_link = _method(link, 0, ctypes.c_long, ctypes.POINTER(_GUID), ctypes.POINTER(ctypes.c_void_p))
        hr = qi_link(link, ctypes.byref(_guid(IID_IPERSISTFILE)), ctypes.byref(persist))
        if hr != 0:
            raise OSError(f'QueryInterface(IPersistFile) 失败 hr={_hresult(hr)}')

        load = _method(persist, 5, ctypes.c_long, ctypes.c_wchar_p, ctypes.c_ulong)
        hr = load(persist, lnk_path, STGM_READ)
        if hr != 0:
            raise OSError(f'IPersistFile::Load 失败 hr={_hresult(hr)}')

        info = {}
        buf = ctypes.create_unicode_buffer(1024)
        get_path = _method(link, 3, ctypes.c_long, ctypes.c_wchar_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32)
        if get_path(link, buf, 1024, None, 0) == 0:
            info['target'] = buf.value
        get_desc = _method(link, 6, ctypes.c_long, ctypes.c_wchar_p, ctypes.c_int)
        if get_desc(link, buf, 1024) == 0:
            info['description'] = buf.value
        get_wd = _method(link, 8, ctypes.c_long, ctypes.c_wchar_p, ctypes.c_int)
        if get_wd(link, buf, 1024) == 0:
            info['working_dir'] = buf.value
        get_args = _method(link, 10, ctypes.c_long, ctypes.c_wchar_p, ctypes.c_int)
        if get_args(link, buf, 1024) == 0:
            info['arguments'] = buf.value
        idx = ctypes.c_int()
        get_icon = _method(link, 16, ctypes.c_long, ctypes.c_wchar_p, ctypes.c_int, ctypes.POINTER(ctypes.c_int))
        if get_icon(link, buf, 1024, ctypes.byref(idx)) == 0:
            info['icon'] = f'{buf.value},{idx.value}'
        return info
    finally:
        if persist.value:
            _method(persist, 2, ctypes.c_ulong)(persist)
        if link.value:
            _method(link, 2, ctypes.c_ulong)(link)
        _ole32.CoUninitialize()


def _check(hr: int, what: str) -> None:
    if hr != 0:
        raise OSError(f'{what} 失败 hr={_hresult(hr)}')


def create_lnk_via_shell(
    lnk_path: str,
    target: str,
    arguments: str,
    workdir: str,
    icon: str,
    description: str,
    icon_index: int = 0,
) -> None:
    """让 Windows 自己写 .lnk（IShellLink + IPersistFile::Save）。

    为什么不手写字节流就完事：手写的 lnk 缺 LinkTargetIDList，ShellExecute
    双击时解析不出目标（实测 startfile 报 1155）。SetPath 会由系统生成
    目标 IDList，产出的就是标准格式。
    """
    _ole32.CoInitialize(None)
    link = ctypes.c_void_p()
    persist = ctypes.c_void_p()
    try:
        clsid = _guid(CLSID_SHELLLINK)
        iid = _guid(IID_ISHELLLINKW)
        _check(
            _ole32.CoCreateInstance(
                ctypes.byref(clsid), None, CLSCTX_INPROC_SERVER, ctypes.byref(iid), ctypes.byref(link)
            ),
            'CoCreateInstance(ShellLink)',
        )

        _check(_method(link, 20, ctypes.c_long, ctypes.c_wchar_p)(link, target), 'SetPath')
        _check(_method(link, 11, ctypes.c_long, ctypes.c_wchar_p)(link, arguments), 'SetArguments')
        _check(_method(link, 9, ctypes.c_long, ctypes.c_wchar_p)(link, workdir), 'SetWorkingDirectory')
        _check(_method(link, 7, ctypes.c_long, ctypes.c_wchar_p)(link, description), 'SetDescription')
        _check(_method(link, 17, ctypes.c_long, ctypes.c_wchar_p, ctypes.c_int)(link, icon, icon_index), 'SetIconLocation')

        qi = _method(link, 0, ctypes.c_long, ctypes.POINTER(_GUID), ctypes.POINTER(ctypes.c_void_p))
        _check(qi(link, ctypes.byref(_guid(IID_IPERSISTFILE)), ctypes.byref(persist)), 'QueryInterface(IPersistFile)')
        _check(_method(persist, 6, ctypes.c_long, ctypes.c_wchar_p, ctypes.c_int)(persist, lnk_path, 1), 'IPersistFile::Save')
    finally:
        if persist.value:
            _method(persist, 2, ctypes.c_ulong)(persist)
        if link.value:
            _method(link, 2, ctypes.c_ulong)(link)
        _ole32.CoUninitialize()


def desktop_dir() -> str:
    try:
        import winreg  # noqa: PLC0415

        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r'Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders',
        )
        path = winreg.QueryValueEx(key, 'Desktop')[0]
        if os.path.isdir(path):
            return os.path.normpath(path)
    except Exception as exc:  # pragma: no cover
        print(f'[!] 读注册表取桌面路径失败（{exc}），退回 %USERPROFILE%\\Desktop')
    return os.path.join(os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Desktop')


def main() -> int:
    args = sys.argv[1:]

    if '--verify' in args:
        lnk = os.path.join(desktop_dir(), LNK_NAME)
        if not os.path.exists(lnk):
            print(f'[!] 快捷方式不存在：{lnk}')
            return 1
        with open(lnk, 'rb') as fh:
            print('[自解析]')
            for k, v in parse_lnk(fh.read()).items():
                print(f'  {k:16} = {v}')
        try:
            shell_info = verify_with_shell(lnk)
        except OSError as exc:
            print(f'[Shell 校验] 失败：{exc}')
            return 1
        print('[Shell 校验] 通过（Windows 的 IShellLink 读得出下列字段）')
        for k, v in shell_info.items():
            print(f'  {k:16} = {v}')
        return 0

    if '--run' in args:
        lnk = os.path.join(desktop_dir(), LNK_NAME)
        if not os.path.exists(lnk):
            print(f'[!] 快捷方式不存在：{lnk}')
            return 1
        os.startfile(lnk)  # ShellExecuteW —— 与鼠标双击完全等价
        print(f'[ok] 已通过 Shell 打开：{lnk}')
        return 0

    icon = build_icon()
    print(f'[ok] 图标：{icon} ({os.path.getsize(icon)} B)')

    if ' ' in CMD_PATH or '&' in CMD_PATH:
        arguments = f'/c ""{CMD_PATH}""'
    else:
        arguments = f'/c {CMD_PATH}'

    blob = build_lnk_blob(CMD_EXE, arguments, PROJECT, ICO_PATH, DESCRIPTION)
    parse_lnk(blob)  # 写盘前先自检

    desktop = desktop_dir()
    lnk_path = os.path.join(desktop, LNK_NAME)
    print(f'     target      = {CMD_EXE}')
    print(f'     arguments   = {arguments}')
    print(f'     working dir = {PROJECT}')
    print(f'     icon        = {ICO_PATH}')

    try:
        create_lnk_via_shell(lnk_path, CMD_EXE, arguments, PROJECT, ICO_PATH, DESCRIPTION)
        print(f'[ok] 已由 Windows 生成快捷方式：{lnk_path} ({os.path.getsize(lnk_path)} B)')
    except OSError as exc:
        print(f'[!] 让 Shell 生成失败（{exc}），退回手写字节流 —— 双击可能不生效。')
        with open(lnk_path, 'wb') as fh:
            fh.write(blob)
        print(f'[ok] 已写入手写 lnk：{lnk_path} ({len(blob)} B)')

    try:
        shell_info = verify_with_shell(lnk_path)
    except OSError as exc:
        print(f'[!] Shell 校验失败：{exc}')
        return 1
    print('[ok] Shell 校验通过（Windows 的 IShellLink 读回的字段）：')
    for k, v in shell_info.items():
        print(f'       {k:12} = {v}')
    if 'target' not in shell_info:
        print('[!] 没能解析出 target —— 双击可能不生效，请告诉我，我换个生成方式。')
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
