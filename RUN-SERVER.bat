@echo off
setlocal
cd /d "%~dp0"
set PITCHLAB_NO_BROWSER=1
where py >nul 2>nul
if not errorlevel 1 (
  py -3 server.py
  goto finished
)
where python >nul 2>nul
if not errorlevel 1 (
  python server.py
  goto finished
)
echo ERROR: Python 3 was not found.
:finished
echo.
echo PitchLab server has stopped. Read the error above.
pause
