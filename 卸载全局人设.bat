@echo off
rem ============================================
rem  Uninstall dsh-global-persona (one-click)
rem  One-click removal of the global persona plugin
rem ============================================
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\uninstall-global-persona.ps1"
echo.
pause
