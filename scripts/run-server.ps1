# ============================================================
#  蓝色大肥鱼 - DeepSeek Harness 服务窗口脚本
#  由 dsh-client.ps1 在新窗口启动；关闭本窗口 = 停止服务
# ============================================================

param([int]$Port = 3080)

$ErrorActionPreference = 'Stop'

$clientRoot = Split-Path -Parent $PSScriptRoot

# 读取配置
$config = [PSCustomObject]@{ baseURL = $null }
$cfgFile = Join-Path $clientRoot 'data\config.json'
if (Test-Path $cfgFile) {
    try { $config = Get-Content $cfgFile -Raw | ConvertFrom-Json } catch { }
}

# 环境
$homeDir = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$env:DSH_HOME = $homeDir
if ($config.baseURL) { $env:DEEPSEEK_BASE_URL = $config.baseURL }
# 隐私：默认关闭遥测上报
$env:DSH_TELEMETRY_DISABLED = '1'

# 工作区
$workspace = Join-Path $env:USERPROFILE 'DeepSeek-Harness-Workspace'
New-Item -ItemType Directory -Force -Path $workspace | Out-Null
Set-Location $workspace

# Node 与 dsh 入口
$node = Join-Path $clientRoot 'tools\node\node.exe'
if (-not (Test-Path $node)) { $node = 'node' }
$dsh = Join-Path $clientRoot 'app\node_modules\@deepseek-ai\dsh\lib\bin.js'

$host.UI.RawUI.WindowTitle = '蓝色大肥鱼 DSH 服务 - 关闭本窗口即停止服务'

Write-Host ''
Write-Host '  ==============================================' -ForegroundColor Cyan
Write-Host '    蓝色大肥鱼 DeepSeek Harness 服务已启动' -ForegroundColor Cyan
Write-Host '    稍候浏览器会自动打开页面' -ForegroundColor Cyan
Write-Host '    关闭本窗口 = 停止服务' -ForegroundColor Yellow
Write-Host '  ==============================================' -ForegroundColor Cyan
Write-Host ''

try {
    & $node $dsh web --host 127.0.0.1 --port $Port
} catch {
    Write-Host ''
    Write-Host "启动失败：$_" -ForegroundColor Red
    Write-Host ''
}

Write-Host ''
Write-Host '  服务已停止，按任意键关闭窗口...' -ForegroundColor DarkGray
[void]$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
