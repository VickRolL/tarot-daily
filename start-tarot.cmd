@echo off
rem ============================================================
rem  Tarot Daily - local preview launcher (ASCII only on purpose:
rem  .cmd files are read as ANSI, Chinese text here would garble.
rem  All user-facing Chinese output comes from the node script.)
rem ============================================================
chcp 65001 >nul 2>&1
title Tarot Daily - Local Preview
setlocal
pushd "%~dp0"

set "NODE="
if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-3\node.exe" set "NODE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
if not defined NODE for /d %%D in ("%USERPROFILE%\.workbuddy\binaries\node\versions\*") do if not defined NODE if exist "%%~fD\node.exe" set "NODE=%%~fD\node.exe"
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE (
  echo [ERROR] Node.js not found. Expected the portable Node under
  echo         %%USERPROFILE%%\.workbuddy\binaries\node\versions\
  echo.
  pause
  exit /b 1
)

"%NODE%" "%~dp0scripts\launch_preview.mjs" %*
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] Launcher exited with code %RC%.
  pause
)

popd
endlocal
