# ============================================================
#  蓝色大肥鱼 DeepSeek Harness 懒人客户端 - 卸载脚本
#  由"设置 -> 应用"或注册表卸载项调用
#  用法：powershell -File uninstall.ps1 "安装目录"
# ============================================================
param([string]$TargetDir)

$ErrorActionPreference = 'SilentlyContinue'

Write-Host '正在卸载蓝色大肥鱼 DSH...'

# 1) 停止客户端服务进程（dsh web）与服务窗口（run-server.ps1）
Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -match 'dsh\\lib\\bin\.js|run-server\.ps1' -and $_.CommandLine -notmatch 'npm-cache|npx' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

# 2) 删除桌面快捷方式
$desktop = [Environment]::GetFolderPath('Desktop')
Remove-Item (Join-Path $desktop 'DeepSeek Harness.lnk') -Force -ErrorAction SilentlyContinue

# 3) 删除卸载注册表项
Remove-Item 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeekHarness' -Recurse -Force -ErrorAction SilentlyContinue

# 4) 延迟删除安装目录（由独立进程执行，带重试，避免文件占用）
if ($TargetDir -and (Test-Path $TargetDir) -and $TargetDir -ne $PSScriptRoot) {
    $cmd = 'for /l %i in (1,1,20) do @(rd /s /q "' + $TargetDir + '" 2>nul & timeout /t 1 /nobreak >nul)'
    Start-Process cmd.exe -ArgumentList '/c', $cmd -WindowStyle Hidden
}

Write-Host '卸载完成'
Start-Sleep -Seconds 1
