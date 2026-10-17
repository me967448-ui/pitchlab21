@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PitchLab 21 Launcher

echo ===============================================
echo              PitchLab 21 Launcher
echo ===============================================
echo.
if not exist "%~dp0index.html" (
  echo ERROR: index.html was not found.
  echo Please extract the COMPLETE ZIP into a normal folder first.
  pause
  exit /b 1
)
if not exist "%~dp0app.js" (
  echo ERROR: app.js was not found. The ZIP was not fully extracted.
  pause
  exit /b 1
)
if not exist "%~dp0data\managers-tactics.js" (
  echo ERROR: Required data files are missing. Extract the whole ZIP again.
  pause
  exit /b 1
)

rem Start the web server in THIS window. The server itself opens the browser only
rem after it has successfully bound to a port. This avoids fragile second-window
rem quoting and health-check races that could leave the site unopened.
set "PITCHLAB_NO_BROWSER="
where py >nul 2>nul
if not errorlevel 1 (
  py -3 --version >nul 2>nul
  if not errorlevel 1 (
    echo Starting PitchLab 21 with Python 3...
    echo The browser should open automatically once the server is ready.
    echo If it does not, copy the exact URL printed below into Chrome.
    echo Keep this window open while using the website.
    echo.
    py -3 "%~dp0server.py"
    if not errorlevel 1 goto stopped
    echo.
    echo Python launcher failed. Trying the regular Python command...
  )
)
where python >nul 2>nul
if not errorlevel 1 (
  python --version 2>nul | findstr /R "Python 3\." >nul
  if not errorlevel 1 (
    echo Starting PitchLab 21 with Python 3...
    echo Keep this window open while using the website.
    echo.
    python "%~dp0server.py"
    if not errorlevel 1 goto stopped
    echo.
    echo The Python server could not start. Trying Windows compatibility mode...
  )
)
where powershell.exe >nul 2>nul
if not errorlevel 1 (
  echo Starting the built-in Windows compatibility server...
  echo Live PESMASTER syncing requires Python 3; the local website itself will open.
  echo.
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0server-fallback.ps1"
  if not errorlevel 1 goto stopped
  echo.
  echo The compatibility server failed to start.
)

echo Opening the local website directly as a last-resort fallback.
echo This mode can show the bundled site, but server-only catalogue sync will be unavailable.
start "" "%~dp0index.html"
echo.
echo If this opened a blank error screen, check the startup diagnostic shown inside the page.
pause
exit /b 1

:stopped
echo.
echo PitchLab 21 server stopped.
pause
exit /b 0
