@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  set "MW_PYTHON=py -3"
  goto prepare
)
where python >nul 2>nul
if not errorlevel 1 (
  set "MW_PYTHON=python"
  goto prepare
)
echo Python 3.9 or newer is required. Install Python and run this file again.
pause
exit /b 1

:prepare
%MW_PYTHON% -c "import sys; sys.exit(0 if sys.version_info >= (3,9) else 1)"
if errorlevel 1 (
  echo Python 3.9 or newer is required.
  pause
  exit /b 1
)
%MW_PYTHON% tools\unpack_battlefield.py --dest battlefield-v02
if errorlevel 1 (
  echo Could not unpack battlefield assets. See the error above.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:8000/index.html
echo Keep this window open. Press Ctrl+C to stop.
start "" "http://127.0.0.1:8000/index.html"
%MW_PYTHON% -m http.server 8000 --bind 127.0.0.1
if errorlevel 1 (
  echo Could not start the server. Port 8000 may already be in use.
  pause
)
endlocal
