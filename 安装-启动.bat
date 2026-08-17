@echo off
rem ============================================
rem  Blue Big Fish - DSH Lazy Client (Install & Launch)
rem  First run: installs Node.js if needed, installs
rem  DeepSeek Harness, asks for your API Key, then
rem  starts the service and opens the browser.
rem ============================================
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dsh-client.ps1" -Mode install
echo.
echo  Press any key to close this window...
pause >nul
