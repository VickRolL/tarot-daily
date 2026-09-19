@echo off
title 今夜一签 · 本地服务器（完整模式）

REM ===========================================================================
REM  完整模式：起一个本地 http 服务
REM  ---------------------------------------------------------------------------
REM  与线上行为一致，包含「生成分享卡片」（离线打开时这一步会被浏览器拦掉）。
REM  需要 Node。没有 Node 也能看网站：直接双击「打开网站.cmd」即可。
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
  echo          离线看网站不需要 node：直接双击  打开网站.cmd
  echo          要用完整模式请先装 Node.js：https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "dist-user\index.html" (
  echo.
  echo   还没生成离线副本，正在构建 ...
  echo.
  "%NODE_BIN%" scripts\build_user_preview.mjs
  if errorlevel 1 (
    echo.
    echo   [错误] 构建失败，请看上面的输出。
    pause
    exit /b 1
  )
)

echo.
echo   正在启动本地服务器并打开浏览器 ...
echo   · 访问地址：http://127.0.0.1:8080/
echo   · 关闭本窗口即停止服务
echo.

"%NODE_BIN%" scripts\serve_user_preview.mjs 8080

echo.
echo   服务已停止。
pause
