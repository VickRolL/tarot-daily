@echo off
title 今夜一签 · 开发者版（本地服务器）

REM ===========================================================================
REM  开发者版：起本地 http 服务 + 自动在默认浏览器打开
REM  ---------------------------------------------------------------------------
REM  这一份带左下角调试条（正式产物 dist/ 里没有）：
REM    · 不限次数 / 一天一次  —— 切换抽牌模式。默认就是「不限次数」，可连抽
REM    · 重置今日             —— 清掉今天的抽牌记录（一天一次模式下用它再抽）
REM    · 重播迎接             —— 重新播放信封开启那段迎接动画
REM    · 牌面总览             —— 全屏看 22 张大阿卡纳
REM
REM  为什么走 http 而不是直接双击 index.html：
REM    「生成分享卡片」要把卡面画进 Canvas 再读回像素，file:// 下浏览器
REM    会以安全策略拒绝读回。只想看抽卡/迎接动画的话，双击
REM    dist-dev\index.html 完全一样，而且不需要 Node。
REM
REM  看完关掉本窗口，或按 Ctrl+C 停止服务。
REM ===========================================================================

cd /d "%~dp0"

set "NODE_BIN="
where node >nul 2>nul && set "NODE_BIN=node"
REM 下面这行是开发机上 Node 的安装位置，仅作兜底；换机器后可以直接删掉这行
if not defined NODE_BIN if exist "C:\Users\29923\.workbuddy\binaries\node\versions\22.22.2-3\node.exe" set "NODE_BIN=C:\Users\29923\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"

if not defined NODE_BIN (
  echo.
  echo   [错误] 没找到 node。
  echo          不用 Node 也能看：直接双击  dist-dev\index.html
  echo          要用完整模式（含分享卡片）请先装 Node.js：https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "dist-dev\index.html" (
  echo.
  echo   还没构建开发者版，正在构建 ...
  echo.
  "%NODE_BIN%" scripts\build_dev_preview.mjs
  if errorlevel 1 (
    echo.
    echo   [错误] 构建失败，请看上面的输出。
    pause
    exit /b 1
  )
)

echo.
echo   正在启动本地服务器并打开浏览器 ...
echo   · 访问地址：http://127.0.0.1:8099/
echo   · 调试条在左下角：不限次数 / 重置今日 / 重播迎接 / 牌面总览
echo   · 关闭本窗口即停止服务
echo.

"%NODE_BIN%" scripts\serve_user_preview.mjs 8099 --dir dist-dev

echo.
echo   服务已停止。
pause
