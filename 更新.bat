@echo off
rem ============================================
rem  Blue Big Fish - DSH Lazy Client (Update)
rem  Updates DeepSeek Harness to the latest version.
rem ============================================
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dsh-client.ps1" -Mode update
echo.
echo  Press any key to close this window...
pause >nul
