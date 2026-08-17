@echo off
rem ============================================
rem  Blue Big Fish - DSH Lazy Client (GitHub Source)
rem  Optional: downloads the deepseek-harness
rem  source code from GitHub (advanced users).
rem ============================================
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dsh-client.ps1" -Mode github
echo.
echo  Press any key to close this window...
pause >nul
