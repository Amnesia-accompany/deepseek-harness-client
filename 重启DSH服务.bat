@echo off
chcp 65001 >nul
title 重启 DSH 服务
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\restart-server.ps1" %*
