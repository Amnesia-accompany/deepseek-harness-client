@echo off
chcp 65001 >nul
title 重启 DSH 服务
echo ============================================
echo   正在停止 DSH 服务（端口 3080）...
echo ============================================
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3080" ^| findstr "LISTENING"') do (
  echo   结束进程 PID %%a
  taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo.
echo   服务已停止！
echo   请关闭并重新打开「蓝色大肥鱼DSH.exe」，
echo   客户端会自动启动全新的 DSH 服务。
echo.
pause
