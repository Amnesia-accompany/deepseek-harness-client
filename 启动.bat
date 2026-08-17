@echo off
rem ============================================
rem  Blue Big Fish - DSH Lazy Client (Launch)
rem  Starts the DeepSeek Harness service and
rem  opens the browser. Use this after install.
rem ============================================
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dsh-client.ps1" -Mode launch
echo.
echo  Press any key to close this window...
pause >nul
