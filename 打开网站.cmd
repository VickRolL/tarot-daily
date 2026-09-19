@echo off
title 今夜一签 · 本地打开

REM ===========================================================================
REM  本地快捷方式：双击我，用默认浏览器打开网站
REM  ---------------------------------------------------------------------------
REM  零依赖：不需要 Node、不需要 Python、不需要起任何服务器。
REM  原理：dist-user/ 那份产物已经把两处离线拦路石处理掉了
REM        （素材走相对路径 ./skins/，脚本从 ES module 改成经典脚本）。
REM  唯一功能差异：离线打开时浏览器不允许导出画布图片，
REM        「生成分享卡片」会给出提示。需要它就用 start-user-preview.cmd（走 http）。
REM ===========================================================================

cd /d "%~dp0"

if not exist "dist-user\index.html" (
  echo.
  echo   [需要先构建] 没找到 dist-user\index.html
  echo   正在尝试用 Node 构建 ...
  echo.
  where node >nul 2>nul
  if errorlevel 1 (
    echo   [错误] 这台机器上没有 node，无法自动构建。
    echo          请在项目根目录执行：node scripts\build_user_preview.mjs
    echo.
    pause
    exit /b 1
  )
  node scripts\build_user_preview.mjs
  if errorlevel 1 (
    echo.
    echo   [错误] 构建失败，请看上面的输出。
    pause
    exit /b 1
  )
)

echo.
echo   正在用默认浏览器打开网站 ...
echo.
echo   · 这就是他人访问时看到的界面：没有调试条、没有牌面总览
echo   · 需要「生成分享卡片」时，请改用  start-user-preview.cmd（走本地服务器）
echo.

start "" "%~dp0dist-user\index.html"

REM 让上面的提示停留几秒再关窗（浏览器此时已经打开了）
timeout /t 5 >nul 2>&1
exit /b 0
