# ============================================================
#  蓝色大肥鱼 - DSH 服务智能重启
#  由「重启DSH服务.bat」调用
#  流程：找服务 -> 确认是 DSH(防误杀) -> 停服务/客户端 -> 自动重启 -> 等待就绪 -> 报版本
# ============================================================

param([switch]$DryRun)

$ErrorActionPreference = 'Continue'
$script:total = 4
$clientRoot = Split-Path -Parent $PSScriptRoot
$cfgFile = Join-Path $clientRoot 'data\config.json'
$clientExe = Join-Path $clientRoot '蓝色大肥鱼DSH.exe'
$port = 3080

# ---------- 读取实际端口（端口自适应，不一定 3080） ----------
if (Test-Path $cfgFile) {
    try { $cfg = Get-Content $cfgFile -Raw -Encoding UTF8 | ConvertFrom-Json; if ($cfg.port) { $port = [int]$cfg.port } } catch { }
}

function Step([int]$n, [string]$title) {
    Write-Host ''
    Write-Host ('  [' + $n + '/' + $script:total + '] ' + $title) -ForegroundColor Cyan
}
function Ok([string]$m)  { Write-Host ('  ✓ ' + $m) -ForegroundColor Green }
function Warn([string]$m) { Write-Host ('  ! ' + $m) -ForegroundColor Yellow }
function Err([string]$m) { Write-Host ('  ✗ ' + $m) -ForegroundColor Red }

function Get-DshListener {
    # 返回监听 $port 的进程对象（且命令行确认是 DSH 服务），否则 $null
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $conn) { return $null }
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)" -ErrorAction SilentlyContinue
    if (-not $p) { return $null }
    $cl = [string]$p.CommandLine
    if ($cl -match 'dsh[\\/]node_modules[\\/]@deepseek-ai[\\/]dsh[\\/]lib[\\/]bin\.js|dsh[\\/]lib[\\/]bin\.js' -and $cl -match '\bweb\b') {
        return $p
    }
    return $p   # 端口被其他程序占用
}

function Wait-PortFree([int]$sec = 10) {
    for ($i = 0; $i -lt ($sec * 5); $i++) {
        if (-not (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) { return $true }
        Start-Sleep -Milliseconds 200
    }
    return $false
}

function Wait-DshUp([int]$sec = 90) {
    for ($i = 0; $i -lt $sec; $i++) {
        Start-Sleep -Seconds 1
        try {
            $t = New-Object System.Net.Sockets.TcpClient
            try { $t.Connect('127.0.0.1', $port); $t.Close(); return $true } catch { }
        } catch { }
    }
    return $false
}

function Get-DshVersion {
    $pj = Join-Path $clientRoot 'app\node_modules\@deepseek-ai\dsh\package.json'
    if (Test-Path $pj) {
        try { $v = (Get-Content $pj -Raw -Encoding UTF8 | ConvertFrom-Json).version; if ($v) { return $v } } catch { }
    }
    return '未知'
}

Write-Host '  ==============================================' -ForegroundColor Cyan
Write-Host ('  蓝色大肥鱼 DSH 服务智能重启  端口 ' + $port) -ForegroundColor Cyan
Write-Host '  ==============================================' -ForegroundColor Cyan

# ---------- 1. 查找服务 ----------
Step 1 '查找 DSH 服务进程'
$listener = Get-DshListener
if (-not $listener) {
    Ok ('端口 ' + $port + ' 当前没有服务在监听（可能本来就未运行）')
} else {
    $cl = [string]$listener.CommandLine
    if ($cl -match 'dsh[\\/]lib[\\/]bin\.js') {
        Ok ('发现 DSH 服务：PID ' + $listener.ProcessId + '  node ' + $listener.Name)
    } else {
        Err ('端口 ' + $port + ' 被其他程序占用（PID ' + $listener.ProcessId + ' ' + $listener.Name + '）')
        Err ('为避免误杀，本脚本不会自动处理。请关闭该程序或换个端口后重试。')
        Read-Host '按回车键退出'
        exit 1
    }
}

# ---------- 2. 停止服务 ----------
Step 2 '停止旧服务'
if ($DryRun) { Warn '[DryRun] 跳过停止服务'; }
elseif ($listener -and $listener.CommandLine -match 'dsh[\\/]lib[\\/]bin\.js') {
    taskkill /PID $listener.ProcessId /F /T 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0 -or -not (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) {
        Ok ('服务进程已停止（PID ' + $listener.ProcessId + '）')
    } else {
        Err ('无法停止服务进程（PID ' + $listener.ProcessId + '），可能权限不足。')
        Err ('请右键“以管理员身份运行”本脚本，或手动结束该进程。')
        Read-Host '按回车键退出'
        exit 1
    }
    if (-not (Wait-PortFree 10)) {
        Err ('端口 ' + $port + ' 10 秒内未释放，请检查进程。')
        Read-Host '按回车键退出'
        exit 1
    }
    Ok ('端口 ' + $port + ' 已释放')
} else {
    Ok ('无服务需要停止')
}

# ---------- 3. 重启客户端 ----------
Step 3 '重启客户端'
if ($DryRun) {
    Warn '[DryRun] 跳过重启客户端'
} else {
    $clients = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like '*蓝色大肥鱼DSH*' })
    if ($clients.Count -gt 0) {
        foreach ($c in $clients) { taskkill /PID $c.Id /F /T 2>&1 | Out-Null }
        Start-Sleep -Seconds 2
        Ok ('旧客户端窗口已关闭')
    }
    if (Test-Path $clientExe) {
        Start-Process -FilePath $clientExe -WorkingDirectory $clientRoot
        Ok ('已启动客户端：' + $clientExe)
    } else {
        Err ('未找到客户端：' + $clientExe)
        Read-Host '按回车键退出'
        exit 1
    }
}

# ---------- 4. 等待就绪 ----------
Step 4 '等待服务就绪'
if ($DryRun) {
    Warn '[DryRun] 结束（未实际重启）'
    Read-Host '按回车键退出'
    exit 0
}
if (Wait-DshUp 90) {
    Ok ('服务就绪：http://127.0.0.1:' + $port)
    Ok ('当前 DeepSeek Harness 版本：' + (Get-DshVersion))
} else {
    Err ('90 秒内服务未就绪，请查看最新日志：')
    $log = Join-Path $clientRoot 'data\server.log'
    if (Test-Path $log) {
        Write-Host ''
        Get-Content $log -Tail 20 -Encoding UTF8 | ForEach-Object { Write-Host ('    ' + $_) -ForegroundColor DarkGray }
    }
}

Write-Host ''
Write-Host '  ==============================================' -ForegroundColor Cyan
Write-Host '    重启完成，按任意键关闭本窗口' -ForegroundColor Green
Write-Host '  ==============================================' -ForegroundColor Cyan
Read-Host
