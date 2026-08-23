# ============================================================
#  蓝色大肥鱼 DeepSeek Harness 懒人客户端 - 核心脚本
#  dsh-client.ps1
#  ------------------------------------------------------------
#  功能：
#    install   一键安装（装 Node.js -> 装 Harness -> 配 Key -> 启动）
#    launch    直接启动（已安装时）
#    reconfig  重新配置 API Key / API 地址
#    update    更新 DeepSeek Harness 到最新版
#    github    从 GitHub 下载 deepseek-harness 源码（可选，仅进阶用）
#    shortcut  重建桌面快捷方式
#  用法：
#    powershell -NoProfile -ExecutionPolicy Bypass -File dsh-client.ps1 -Mode install
# ============================================================

[CmdletBinding()]
param(
    [ValidateSet('install', 'launch', 'reconfig', 'setkey', 'update', 'github', 'shortcut')]
    [string]$Mode = 'install',
    [string]$ApiKey = '',      # 自动配置用（一般留空，交互输入）
    [string]$BaseURL = '',     # 自动配置用（一般留空，交互输入）
    [int]$Port = 0,            # 指定端口（默认 3080）
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

# ---------- 路径 ----------
$script:ClientRoot = Split-Path -Parent $PSScriptRoot
$script:AppDir     = Join-Path $script:ClientRoot 'app'
$script:ToolsDir   = Join-Path $script:ClientRoot 'tools'
$script:DataDir    = Join-Path $script:ClientRoot 'data'
$script:ConfigFile = Join-Path $script:DataDir 'config.json'
$script:NodeDir    = Join-Path $script:ToolsDir 'node'
$script:NodeExe    = Join-Path $script:NodeDir 'node.exe'
$script:DshBin     = Join-Path $script:AppDir 'node_modules\@deepseek-ai\dsh\lib\bin.js'
$script:HomeDir    = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$script:Workspace  = Join-Path $env:USERPROFILE 'DeepSeek-Harness-Workspace'
$script:Registries = @('https://registry.npmmirror.com', 'https://registry.npmjs.org')
$script:NodeMirror = ''

# ---------- 输出辅助 ----------
function Write-Step { param([string]$Msg) Write-Host "==> $Msg" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Msg) Write-Host "    $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host "    [!] $Msg" -ForegroundColor Yellow }

# ---------- 小工具 ----------
function Test-Command {
    param([string]$Name)
    return (Get-Command $Name -ErrorAction SilentlyContinue) -ne $null
}

function Test-PortOpen {
    param([int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $ar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        $ok = $ar.AsyncWaitHandle.WaitOne(800)
        if ($ok) { $client.EndConnect($ar); return $true }
        return $false
    } catch { return $false } finally { $client.Close() }
}

function Test-DshPage {
    param([int]$Port)
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 3
        return ($r.Content -match 'DeepSeek Harness')
    } catch { return $false }
}

function Find-FreePort {
    param([int]$Start)
    for ($p = $Start; $p -lt $Start + 100; $p++) {
        if (-not (Test-PortOpen $p)) { return $p }
    }
    return 0
}

function Get-DshVersion {
    try {
        $pkg = Join-Path $script:AppDir 'node_modules\@deepseek-ai\dsh\package.json'
        if (Test-Path $pkg) {
            return (Get-Content $pkg -Raw | ConvertFrom-Json).version
        }
    } catch { }
    return ''
}

function Get-Config {
    $cfg = $null
    if (Test-Path $script:ConfigFile) {
        try { $cfg = Get-Content $script:ConfigFile -Raw | ConvertFrom-Json } catch { }
    }
    if ($null -eq $cfg) {
        $cfg = [PSCustomObject]@{
            port       = 3080
            baseURL    = $null
            nodeVer    = ''
            dshVer     = ''
            configured = $false
        }
    }
    # 补齐缺失字段（旧版或手工编辑的 config.json 可能缺属性）
    if (-not ($cfg.PSObject.Properties.Name -contains 'port')) { $cfg | Add-Member -NotePropertyName port -NotePropertyValue 3080 -Force }
    if (-not ($cfg.PSObject.Properties.Name -contains 'baseURL')) { $cfg | Add-Member -NotePropertyName baseURL -NotePropertyValue $null -Force }
    if (-not ($cfg.PSObject.Properties.Name -contains 'nodeVer')) { $cfg | Add-Member -NotePropertyName nodeVer -NotePropertyValue '' -Force }
    if (-not ($cfg.PSObject.Properties.Name -contains 'dshVer')) { $cfg | Add-Member -NotePropertyName dshVer -NotePropertyValue '' -Force }
    if (-not ($cfg.PSObject.Properties.Name -contains 'configured')) { $cfg | Add-Member -NotePropertyName configured -NotePropertyValue $false -Force }
    return $cfg
}

function Save-Config {
    param($Cfg)
    New-Item -ItemType Directory -Force -Path $script:DataDir | Out-Null
    $Cfg | ConvertTo-Json | Set-Content -Path $script:ConfigFile -Encoding UTF8
}

# ---------- 1. 确保 Node.js ----------
function Find-SystemNode {
    # 返回一个可用的 Node 目录（node.exe + npm.cmd），没有则 $null
    $cands = @()
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { $cands += Split-Path $cmd.Source }
    $cands += (Join-Path $env:ProgramFiles 'nodejs')
    $cands += (Join-Path ${env:ProgramFiles(x86)} 'nodejs')
    foreach ($d in ($cands | Select-Object -Unique)) {
        $exe = Join-Path $d 'node.exe'
        if (Test-Path $exe) {
            try {
                $v = & $exe -v 2>$null
                if ($v -match 'v(\d+)\.' -and [int]$Matches[1] -ge 20) { return $d }
            } catch { }
        }
    }
    return $null
}

function Ensure-Node {
    # 1) 系统 Node 可用则直接用
    $sys = Find-SystemNode
    if ($sys) {
        $script:NodeDir = $sys
        $script:NodeExe = Join-Path $sys 'node.exe'
        Write-Ok "检测到系统 Node.js $(& $script:NodeExe -v)，直接使用"
        return
    }
    # 2) 客户端自带 Node 可用则用
    if (Test-Path $script:NodeExe) {
        try {
            $v = & $script:NodeExe -v 2>$null
            if ($v -match 'v(\d+)\.' -and [int]$Matches[1] -ge 20) {
                Write-Ok "使用客户端自带 Node.js $v"
                return
            }
        } catch { }
    }
    # 3) 下载便携版 Node.js（免管理员权限）
    Write-Step '未找到可用的 Node.js，正在自动下载（约 30MB，请稍候）...'
    New-Item -ItemType Directory -Force -Path $script:ToolsDir | Out-Null

    $index = $null
    foreach ($base in @('https://npmmirror.com/mirrors/node', 'https://nodejs.org/dist')) {
        try {
            Write-Ok "获取版本信息：$base"
            $index = (Invoke-WebRequest -Uri "$base/index.json" -UseBasicParsing -TimeoutSec 20).Content | ConvertFrom-Json
            $script:NodeMirror = $base
            break
        } catch { Write-Warn "无法访问 $base，尝试下一个源..." }
    }
    if (-not $index) { throw '无法获取 Node.js 版本信息，请检查网络后重试' }

    $lts = $index | Where-Object { $_.lts } | Select-Object -First 1
    if (-not $lts) { throw '无法确定 Node.js LTS 版本' }
    $ver = $lts.version
    $zipName = "node-$ver-win-x64.zip"
    $url = "$($script:NodeMirror)/$ver/$zipName"
    Write-Ok "下载 $zipName ..."
    $zipPath = Join-Path $script:ToolsDir $zipName
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing -TimeoutSec 900

    Write-Ok '解压安装（无需管理员权限）...'
    $tmp = Join-Path $script:ToolsDir 'node-tmp'
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Expand-Archive -Path $zipPath -DestinationPath $tmp -Force
    $inner = Join-Path $tmp "node-$ver-win-x64"
    if (Test-Path $script:NodeDir) { Remove-Item $script:NodeDir -Recurse -Force }
    Move-Item $inner $script:NodeDir
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

    $v = & $script:NodeExe -v
    if (-not $v) { throw 'Node.js 安装失败' }
    Write-Ok "Node.js $v 安装完成"
}

# ---------- 2. 确保 DeepSeek Harness ----------
function Ensure-Dsh {
    if (Test-Path $script:DshBin) {
        Write-Ok "DeepSeek Harness $((Get-DshVersion)) 已就绪"
        return
    }
    Write-Step '首次运行：正在下载 DeepSeek Harness 核心（约 1~3 分钟，请耐心等待）...'
    $npmCmd = Join-Path $script:NodeDir 'npm.cmd'
    if (-not (Test-Path $npmCmd)) { $npmCmd = 'npm' }

    $oldLoc = Get-Location
    Set-Location $script:AppDir
    try {
        $ok = $false
        foreach ($reg in $script:Registries) {
            try {
                Write-Ok "使用镜像源：$reg"
                & $npmCmd install --registry $reg --no-audit --no-fund --loglevel error
                if ($LASTEXITCODE -eq 0) { $ok = $true; break }
                Write-Warn "镜像 $reg 失败，尝试下一个..."
            } catch {
                Write-Warn "镜像 $reg 出错：$_"
            }
        }
        if (-not $ok) { throw 'DeepSeek Harness 安装失败，请检查网络后重试' }
    } finally {
        Set-Location $oldLoc
    }
    if (-not (Test-Path $script:DshBin)) { throw 'DeepSeek Harness 安装不完整，请重试' }
    Write-Ok "DeepSeek Harness $((Get-DshVersion)) 安装完成"
}

# ---------- 3. 配置 API ----------
function Quote-YamlValue {
    param([string]$Value)
    if ($Value -eq '' -or $Value -match '[:#]' -or $Value -ne $Value.Trim()) {
        return '"' + ($Value -replace '"', '\"') + '"'
    }
    return $Value
}

function Set-CredentialLine {
    param([string[]]$Lines, [string]$Name, [string]$Value)
    if ($Value -eq '') { return $Lines }
    $rendered = "$Name" + ": " + (Quote-YamlValue $Value)
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match "^$Name\s*:") { $Lines[$i] = $rendered; return $Lines }
    }
    $Lines += $rendered
    return $Lines
}

function Has-ApiKey {
    $credFile = Join-Path $script:HomeDir '.credentials.yaml'
    if (Test-Path $credFile) {
        $lines = @(Get-Content $credFile)
        foreach ($line in $lines) {
            if ($line -match '^\s*DEEPSEEK_API_KEY\s*:\s*\S') { return $true }
        }
    }
    return $false
}

function Configure-Api {
    Write-Step '配置 API Key'
    $key = $ApiKey
    $base = $BaseURL
    if (-not $key) {
        $key = (Read-Host '  请输入 DeepSeek API Key（在 platform.deepseek.com 申请，形如 sk-xxxx）').Trim()
        if (-not $key) { throw 'API Key 不能为空' }
        $base = (Read-Host '  API 地址（官方接口请直接回车；第三方中转请填完整地址，如 https://xxx.com/v1）').Trim()
    }

    New-Item -ItemType Directory -Force -Path $script:HomeDir | Out-Null
    $credFile = Join-Path $script:HomeDir '.credentials.yaml'
    $lines = @()
    if (Test-Path $credFile) { $lines = @(Get-Content $credFile) }
    $lines = Set-CredentialLine $lines 'DEEPSEEK_API_KEY' $key
    $lines = Set-CredentialLine $lines 'DEEPSEEK_BASE_URL' $base
    Set-Content -Path $credFile -Value $lines -Encoding UTF8

    $cfg = Get-Config
    if ($base) { $cfg.baseURL = $base }
    $cfg.configured = $true
    Save-Config $cfg

    Write-Ok "已保存到 $credFile"
    if ($base) { Write-Ok "API 地址：$base" } else { Write-Ok 'API 地址：官方 https://api.deepseek.com' }
}

# ---------- 4. 启动服务 ----------
function Start-Server {
    $cfg = Get-Config
    if (-not (Test-Path $script:DshBin)) {
        Write-Step 'Harness 尚未安装，先进行安装...'
        Ensure-Node
        Ensure-Dsh
    }

    $port = if ($Port -gt 0) { $Port } elseif ($cfg.port -gt 0) { [int]$cfg.port } else { 3080 }

    # 已在运行？
    if (Test-PortOpen $port) {
        if (Test-DshPage $port) {
            Write-Ok "服务已在运行：http://127.0.0.1:$port"
            if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$port" }
            return $true
        }
        $free = Find-FreePort $port
        if ($free -le 0) { throw "端口 $port 及后续 100 个端口都被占用，无法启动" }
        Write-Warn "端口 $port 被其他程序占用，改用端口 $free"
        $port = $free
    }

    # 工作区
    New-Item -ItemType Directory -Force -Path $script:Workspace | Out-Null
    if (-not (Test-Path (Join-Path $script:Workspace '说明.txt'))) {
        Set-Content -Path (Join-Path $script:Workspace '说明.txt') -Value @'
这是 DeepSeek Harness 的工作目录。
你在网页里让 AI 处理的所有文件都会放在这个文件夹里。
（例如：让它"写一个 Python 脚本"，脚本就会出现在这里）
'@ -Encoding UTF8
    }

    # 确定可用的 Node.js（系统 node 或客户端自带 node）
    $nodeExe = $null
    if (Test-Path $script:NodeExe) {
        $nodeExe = $script:NodeExe
    } else {
        $sys = Find-SystemNode
        if ($sys) {
            $script:NodeDir = $sys
            $script:NodeExe = Join-Path $sys 'node.exe'
            $nodeExe = $script:NodeExe
        }
    }
    if (-not $nodeExe) { throw '未找到可用的 Node.js，请重新运行安装程序（勾选"安装 Node.js"）' }

    $cfg.port = $port
    $cfg.nodeVer = & $nodeExe -v
    $cfg.dshVer = Get-DshVersion
    Save-Config $cfg

    Write-Step "正在启动 DeepSeek Harness 服务 http://127.0.0.1:$port ..."
    $runScript = Join-Path $PSScriptRoot 'run-server.ps1'
    $runArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$runScript`" -Port $port -NoOpen"
    $serverProc = Start-Process powershell.exe -ArgumentList $runArgs -WindowStyle Normal -WorkingDirectory $script:ClientRoot

    # 轮询等待服务就绪
    $deadline = (Get-Date).AddSeconds(120)
    $up = $false
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 800
        if (Test-DshPage $port) { $up = $true; break }
        try { if ($serverProc.HasExited) { break } } catch { break }
    }

    if ($up) {
        Write-Ok "服务启动成功：http://127.0.0.1:$port"
        if (-not $NoBrowser) {
            Start-Sleep -Milliseconds 500
            Start-Process "http://127.0.0.1:$port"
        }
        Write-Ok '提示：服务窗口请保持开启；关闭服务窗口 = 停止服务'
        return $true
    }
    Write-Warn '服务似乎没有正常启动，请查看新弹出的服务窗口里的错误信息'
    Write-Warn "也可以手动运行：tools\node\node.exe app\node_modules\@deepseek-ai\dsh\lib\bin.js web --port $port"
    return $false
}

# ---------- 5. 更新 ----------
function Update-Dsh {
    Write-Step '正在更新 DeepSeek Harness 到最新版...'
    Ensure-Node
    $npmCmd = Join-Path $script:NodeDir 'npm.cmd'
    if (-not (Test-Path $npmCmd)) { $npmCmd = 'npm' }
    $oldLoc = Get-Location
    Set-Location $script:AppDir
    try {
        $ok = $false
        foreach ($reg in $script:Registries) {
            Write-Ok "使用镜像源：$reg"
            & $npmCmd install @deepseek-ai/dsh@latest --registry $reg --no-audit --no-fund --loglevel error
            if ($LASTEXITCODE -eq 0) { $ok = $true; break }
        }
        if (-not $ok) { throw '更新失败，请检查网络后重试' }
    } finally {
        Set-Location $oldLoc
    }
    Write-Ok "更新完成，当前版本：$((Get-DshVersion))"
}

# ---------- 6. 下载 GitHub 源码（进阶可选） ----------
function Get-GitHubSource {
    $dest = Join-Path $script:ClientRoot '源码-deepseek-harness'
    if (Test-Path $dest) {
        Write-Ok "源码已存在：$dest"
        return
    }
    Write-Step '正在从 GitHub 获取 deepseek-harness 源码...'
    if (Test-Command git) {
        Write-Ok '使用 git 克隆（只拉取最新版本）...'
        git clone --depth 1 https://github.com/deepseek-ai/deepseek-harness.git $dest
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "克隆完成：$dest"
            return
        }
        Write-Warn 'git 克隆失败，改用 ZIP 下载...'
    } else {
        Write-Ok '未检测到 git，改用 ZIP 下载...'
    }
    $zip = Join-Path $script:ClientRoot 'deepseek-harness-src.zip'
    $done = $false
    foreach ($branch in @('main', 'master')) {
        try {
            Invoke-WebRequest -Uri "https://codeload.github.com/deepseek-ai/deepseek-harness/zip/refs/heads/$branch" -OutFile $zip -UseBasicParsing -TimeoutSec 600
            $done = $true
            break
        } catch { }
    }
    if (-not $done) { throw '源码下载失败，请检查网络后重试' }
    $tmp = Join-Path $script:ClientRoot 'src-tmp'
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
    Move-Item $inner.FullName $dest
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
    Write-Ok "源码下载完成：$dest"
}

# ---------- 7. 桌面快捷方式 ----------
function New-IconFromImage {
    # 从 data\icon-source.jpg/png 生成 data\icon.ico，失败返回 $null
    $src = $null
    foreach ($ext in @('jpg', 'jpeg', 'png')) {
        $cand = Join-Path $script:DataDir "icon-source.$ext"
        if (Test-Path $cand) { $src = $cand; break }
    }
    if (-not $src) { return $null }
    try {
        Add-Type -AssemblyName System.Drawing
        $img = [System.Drawing.Image]::FromFile($src)
        $bmp = New-Object System.Drawing.Bitmap 256, 256
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        try {
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $g.DrawImage($img, 0, 0, 256, 256)
            $ms = New-Object System.IO.MemoryStream
            $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
            $png = $ms.ToArray()
        } finally {
            $g.Dispose(); $bmp.Dispose(); $img.Dispose()
        }
        $icon = Join-Path $script:DataDir 'icon.ico'
        $fs = [System.IO.File]::Create($icon)
        $bw = New-Object System.IO.BinaryWriter $fs
        try {
            $bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1)
            $bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0)
            $bw.Write([UInt16]1); $bw.Write([UInt16]32)
            $bw.Write([UInt32]$png.Length); $bw.Write([UInt32]22)
            $bw.Write($png)
        } finally {
            $bw.Close(); $fs.Close()
        }
        return $icon
    } catch {
        Write-Warn "生成图标失败（不影响使用）：$_"
        return $null
    }
}

function New-Shortcut {
    try {
        $icon = Join-Path $script:DataDir 'icon.ico'
        if (-not (Test-Path $icon)) { $icon = New-IconFromImage }
        $ws = New-Object -ComObject WScript.Shell
        $desktop = [Environment]::GetFolderPath('Desktop')
        $lnkPath = Join-Path $desktop '蓝色大肥鱼 DSH.lnk'
        $lnk = $ws.CreateShortcut($lnkPath)
        $lnk.TargetPath = Join-Path $script:ClientRoot '启动.bat'
        $lnk.WorkingDirectory = $script:ClientRoot
        if ($icon) { $lnk.IconLocation = $icon }
        $lnk.Description = '蓝色大肥鱼 - DeepSeek Harness 懒人客户端'
        $lnk.Save()
        Write-Ok '已在桌面创建快捷方式：蓝色大肥鱼 DSH'
    } catch {
        Write-Warn "创建桌面快捷方式失败（不影响使用）：$_"
    }
}

# ---------- 主流程 ----------
Write-Host ''
Write-Host '  ================================================' -ForegroundColor Blue
Write-Host '    蓝色大肥鱼  DeepSeek Harness 懒人客户端' -ForegroundColor Blue
Write-Host '    项目：https://github.com/deepseek-ai/deepseek-harness' -ForegroundColor DarkGray
Write-Host '  ================================================' -ForegroundColor Blue
Write-Host ''

switch ($Mode) {
    'install' {
        Ensure-Node
        Ensure-Dsh
        if ($ApiKey) {
            Configure-Api
        } elseif (-not (Has-ApiKey)) {
            Write-Step '首次使用，需要配置 API Key'
            Configure-Api
        } else {
            Write-Ok '已检测到 API Key，跳过配置（如需修改请打开客户端，点标题栏右侧 🔑 按钮）'
        }
        New-Shortcut
        Start-Server
    }
    'launch' {
        if (-not (Test-Path $script:DshBin)) {
            Write-Step '尚未安装，自动补装...'
            Ensure-Node
            Ensure-Dsh
        }
        if (-not (Has-ApiKey) -and -not $ApiKey) {
            Write-Step '首次使用，需要配置 API Key'
            Configure-Api
        } elseif ($ApiKey) {
            Write-Step '使用启动器提供的 API Key'
            Configure-Api
        }
        New-Shortcut
        Start-Server
    }
    'reconfig' {
        Ensure-Node
        Ensure-Dsh
        Configure-Api
        New-Shortcut
        Start-Server
    }
    'setkey' {
        # 只写 API Key（桌面客户端调用），不启动服务
        if (-not $ApiKey) { Write-Step '请输入 API Key'; Configure-Api }
        else { Configure-Api }
    }
    'update' {
        Update-Dsh
    }
    'github' {
        Get-GitHubSource
    }
    'shortcut' {
        New-Shortcut
    }
}

Write-Host ''
Write-Host '  完成！' -ForegroundColor Green
