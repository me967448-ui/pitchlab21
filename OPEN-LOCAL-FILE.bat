@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0index.html" (
  echo index.html was not found. Please extract the entire ZIP first.
  pause
  exit /b 1
)
start "" "%~dp0index.html"
echo Opened the bundled page directly.
echo Direct-file mode does not support live local-server catalogue sync.
echo For full features, run START-PITCHLAB.bat instead.
timeout /t 3 >nul
