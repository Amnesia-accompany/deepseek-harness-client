# ============================================================
#  蓝色大肥鱼 DSH 懒人客户端 - 构建脚本
#  生成：蓝色大肥鱼DSH.exe（Electron 桌面端）+ launcher.exe
#       + 蓝色大肥鱼DSH-安装程序.exe（自包含，嵌入全部文件）
#  ------------------------------------------------------------
#  目录约定：
#    src\build.ps1        本脚本（源码）
#    build\               构建产物与素材（可整体删除后重建）
#      build\electron-dist   Electron 素材库
#      build\rcedit-x64.exe  图标/版本信息工具
#      build\payload.zip     打包载荷（生成物）
# ============================================================
$ErrorActionPreference = 'Stop'

$root     = Split-Path -Parent $PSScriptRoot    # 懒人客户端 目录（发行根）
$srcDir   = $PSScriptRoot
$buildDir = Join-Path $root 'build'
$csc      = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$rcedit   = Join-Path $buildDir 'rcedit-x64.exe'
$eleSrc   = Join-Path $buildDir 'electron-dist'
if (-not (Test-Path $csc)) { throw '未找到 csc.exe（需要 .NET Framework 4.x）' }
if (-not (Test-Path $eleSrc)) { throw "未找到 Electron 素材库：$eleSrc（请先解压 electron 发行包到该目录）" }

Write-Host '==> 1/5 生成图标 icon.ico / icon.png'
$iconSrc = Join-Path $root 'data\icon-source.jpg'
if (-not (Test-Path $iconSrc)) { $iconSrc = Join-Path $root 'data\icon-source.png' }
$iconOut = Join-Path $buildDir 'app.ico'
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($iconSrc)
# ico (256)
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, 256, 256)
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $ms.ToArray()
$fs = [System.IO.File]::Create($iconOut)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1)
$bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0)
$bw.Write([UInt16]1); $bw.Write([UInt16]32)
$bw.Write([UInt32]$png.Length); $bw.Write([UInt32]22)
$bw.Write($png)
$bw.Close(); $fs.Close()
$g.Dispose(); $bmp.Dispose()
# png (64x64 标题栏)
$bmp2 = New-Object System.Drawing.Bitmap 64, 64
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($img, 0, 0, 64, 64)
$pngOut = Join-Path $buildDir 'icon.png'
$bmp2.Save($pngOut, [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose(); $bmp2.Dispose()

# 品牌 Logo（安装界面左侧栏用，256px 圆角方形 + 白色细描边）
$logoOut = Join-Path $buildDir 'logo.png'
$logoBmp = New-Object System.Drawing.Bitmap 256, 256
$g3 = [System.Drawing.Graphics]::FromImage($logoBmp)
$g3.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g3.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$path3 = New-Object System.Drawing.Drawing2D.GraphicsPath
$path3.AddArc(6, 6, 48, 48, 180, 90); $path3.AddArc(202, 6, 48, 48, 270, 90)
$path3.AddArc(202, 202, 48, 48, 0, 90); $path3.AddArc(6, 202, 48, 48, 90, 90)
$path3.CloseFigure()
$g3.SetClip($path3)
$g3.DrawImage($img, 6, 6, 244, 244)
$g3.ResetClip()
$pen3 = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 6)
$g3.DrawPath($pen3, $path3)
$logoBmp.Save($logoOut, [System.Drawing.Imaging.ImageFormat]::Png)
$pen3.Dispose(); $path3.Dispose(); $g3.Dispose(); $logoBmp.Dispose()
Write-Host "    品牌 Logo：$logoOut"

# 高清启动 Logo（客户端启动动画用，512px 圆形 + 白色细描边）
$bootOut = Join-Path $buildDir 'boot-logo.png'
$bootBmp = New-Object System.Drawing.Bitmap 512, 512
$g4 = [System.Drawing.Graphics]::FromImage($bootBmp)
$g4.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g4.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$path4 = New-Object System.Drawing.Drawing2D.GraphicsPath
$path4.AddEllipse(14, 14, 484, 484)
$path4.CloseFigure()
$g4.SetClip($path4)
$g4.DrawImage($img, 14, 14, 484, 484)
$g4.ResetClip()
$pen4 = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 10)
$g4.DrawPath($pen4, $path4)
$bootBmp.Save($bootOut, [System.Drawing.Imaging.ImageFormat]::Png)
$pen4.Dispose(); $path4.Dispose(); $g4.Dispose(); $bootBmp.Dispose()
Write-Host "    高清启动 Logo：$bootOut"

$img.Dispose()

# ---- 微型功能图标（安装界面用，32x32 PNG） ----
function New-IconPng {
    param([string]$Path, [scriptblock]$Draw)
    $b = New-Object System.Drawing.Bitmap 32, 32
    $g = [System.Drawing.Graphics]::FromImage($b)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    & $Draw $g
    $b.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $b.Dispose()
}
# 桌面图标（显示器）
New-IconPng (Join-Path $buildDir 'icon-desktop.png') {
    param($g)
    $blue = [System.Drawing.Color]::FromArgb(46, 124, 246)
    $pen = New-Object System.Drawing.Pen($blue, 2.4)
    $g.DrawRectangle($pen, 5, 6, 22, 15)
    $g.DrawLine($pen, 12, 25, 20, 25)
    $g.DrawLine($pen, 16, 21, 16, 25)
    $g.DrawLine($pen, 8, 25, 24, 25)
    $pen.Dispose()
}
# 火箭图标
New-IconPng (Join-Path $buildDir 'icon-rocket.png') {
    param($g)
    $blue = [System.Drawing.Color]::FromArgb(46, 124, 246)
    $sb = New-Object System.Drawing.SolidBrush($blue)
    $pts = @(
        (New-Object System.Drawing.Point(16, 3)),
        (New-Object System.Drawing.Point(22, 10)),
        (New-Object System.Drawing.Point(22, 16)),
        (New-Object System.Drawing.Point(10, 16)),
        (New-Object System.Drawing.Point(10, 10))
    )
    $g.FillPolygon($sb, $pts)
    $g.FillEllipse($sb, 13, 8, 6, 6)
    $sb2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 170, 60))
    $g.FillEllipse($sb2, 15, 22, 2, 3)
    $g.FillEllipse($sb2, 11, 24, 2, 3)
    $g.FillEllipse($sb2, 19, 24, 2, 3)
    $sb.Dispose(); $sb2.Dispose()
}
# Node.js 图标（绿色六边形）
New-IconPng (Join-Path $buildDir 'icon-node.png') {
    param($g)
    $green = [System.Drawing.Color]::FromArgb(60, 165, 92)
    $sb = New-Object System.Drawing.SolidBrush($green)
    $pts = @(
        (New-Object System.Drawing.Point(16, 2)),
        (New-Object System.Drawing.Point(27, 9)),
        (New-Object System.Drawing.Point(27, 23)),
        (New-Object System.Drawing.Point(16, 30)),
        (New-Object System.Drawing.Point(5, 23)),
        (New-Object System.Drawing.Point(5, 9))
    )
    $g.FillPolygon($sb, $pts)
    $sb2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.DrawString('JS', (New-Object System.Drawing.Font('Arial', 9, [System.Drawing.FontStyle]::Bold)), $sb2, 8, 10)
    $sb.Dispose(); $sb2.Dispose()
}
Write-Host "    微型图标：icon-desktop / icon-rocket / icon-node"

Write-Host '==> 2/5 同步 Electron 桌面端到发行根'
# 复制 electron 素材（排除 resources，单独同步）
# 注意：目录先清空目标再复制，否则目录复制到已存在目录会产生嵌套（locales\locales）
Get-ChildItem $eleSrc -Force | Where-Object { $_.Name -ne 'resources' } | ForEach-Object {
    $dest = Join-Path $root $_.Name
    if ($_.PSIsContainer -and (Test-Path $dest)) { Remove-Item $dest -Recurse -Force }
    Copy-Item -LiteralPath $_.FullName $dest -Recurse -Force
}
# electron 应用（main.js / preload / ui / package.json）
# 注意：先清空目标再复制，否则目录复制到已存在目录会产生嵌套（ui\ui）
$eleApp = Join-Path $eleSrc 'resources\app'
$rootApp = Join-Path $root 'resources\app'
if (Test-Path $rootApp) { Remove-Item $rootApp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $rootApp | Out-Null
Get-ChildItem $eleApp -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName (Join-Path $rootApp $_.Name) -Recurse -Force
}
# 标题栏图标 + 高清启动 Logo
Copy-Item -LiteralPath $pngOut (Join-Path $rootApp 'ui\icon.png') -Force
Copy-Item -LiteralPath (Join-Path $buildDir 'boot-logo.png') (Join-Path $rootApp 'ui\boot-logo.png') -Force
# 主 exe（素材库中已 rcedit 图标；确保存在）
$mainExe = Join-Path $root '蓝色大肥鱼DSH.exe'
if (-not (Test-Path $mainExe)) {
    Copy-Item -LiteralPath (Join-Path $eleSrc '蓝色大肥鱼DSH.exe') $mainExe -Force
}
& $rcedit $mainExe `
    --set-icon $iconOut `
    --set-version-string 'FileDescription' 'DeepSeek Harness 懒人客户端' `
    --set-version-string 'ProductName' 'DeepSeek Harness' `
    --set-version-string 'CompanyName' '蓝色大肥鱼' `
    --set-product-version '0.1.1.0' --set-file-version '0.1.1.0' | Out-Null
Write-Host "    桌面端就绪：$mainExe"

Write-Host '==> 3/5 编译 launcher.exe（浏览器模式备选）与 uninstaller.exe（卸载器）'
$refs = @(
    '/r:System.dll',
    '/r:System.Core.dll',
    '/r:System.Windows.Forms.dll',
    '/r:System.Drawing.dll',
    '/r:System.Management.dll',
    '/r:Microsoft.CSharp.dll'
)
& $csc /nologo /target:winexe /optimize+ "/win32icon:$iconOut" "/win32manifest:$srcDir\app.manifest" $refs "/out:$root\launcher.exe" "$srcDir\Launcher.cs"
if ($LASTEXITCODE -ne 0) { throw 'launcher.exe 编译失败' }
& $csc /nologo /target:winexe /optimize+ "/win32icon:$iconOut" "/win32manifest:$srcDir\app.manifest" $refs "/out:$root\uninstaller.exe" "$srcDir\Uninstaller.cs"
if ($LASTEXITCODE -ne 0) { throw 'uninstaller.exe 编译失败' }
& $rcedit "$root\uninstaller.exe" `
    --set-icon $iconOut `
    --set-version-string 'FileDescription' 'DeepSeek Harness 客户端 卸载程序' `
    --set-version-string 'ProductName' 'DeepSeek Harness' `
    --set-version-string 'CompanyName' '蓝色大肥鱼' `
    --set-product-version '0.1.1.0' --set-file-version '0.1.1.0' | Out-Null
Write-Host "    卸载器就绪：$root\uninstaller.exe"

Write-Host '==> 4/6 代码签名（防杀毒软件误报）'
function Sign-Exe {
    param([string]$Path)
    $cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue |
        Where-Object { $_.Subject -like '*蓝色大肥鱼*' } | Select-Object -First 1
    if (-not $cert) {
        $cert = New-SelfSignedCertificate -Type CodeSigningCert `
            -Subject 'CN=蓝色大肥鱼 DeepSeek Harness 客户端' `
            -CertStoreLocation Cert:\CurrentUser\My -KeyUsage DigitalSignature `
            -NotAfter (Get-Date).AddYears(3)
    }
    if ($cert) {
        Set-AuthenticodeSignature -FilePath $Path -Certificate $cert -HashAlgorithm SHA256 -ErrorAction SilentlyContinue | Out-Null
        Write-Host ("    已签名：{0}" -f (Split-Path $Path -Leaf))
    }
}
Sign-Exe $mainExe
Sign-Exe "$root\launcher.exe"
Sign-Exe "$root\uninstaller.exe"

Write-Host '==> 5/6 打包载荷 payload.zip（含 Electron 全部文件）'
$payload = Join-Path $buildDir 'payload.zip'
if (Test-Path $payload) { Remove-Item $payload -Force }
# 强制 scripts 下的 ps1 为 UTF-8 BOM（Windows PowerShell 5.1 依赖 BOM 识别中文）
foreach ($ps1 in Get-ChildItem (Join-Path $root 'scripts') -Filter '*.ps1') {
    $raw = [System.IO.File]::ReadAllBytes($ps1.FullName)
    if (-not ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF)) {
        $txt = [System.IO.File]::ReadAllText($ps1.FullName, [System.Text.Encoding]::UTF8)
        [System.IO.File]::WriteAllText($ps1.FullName, $txt, (New-Object System.Text.UTF8Encoding $true))
        Write-Host ("    已为 {0} 添加 BOM" -f $ps1.Name)
    }
}
# 整理到 staging 目录，用 ZipFile 打包保留目录结构（PS 5.1 Copy-Item 中文路径 bug：用 -LiteralPath）
$stage = Join-Path $env:TEMP 'dsh-payload-stage'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
Get-ChildItem $root -File | Where-Object { $_.Name -notmatch '^payload\.zip$' -and $_.Name -ne '.gitignore' } | ForEach-Object { Copy-Item -LiteralPath $_.FullName $stage }
foreach ($sub in @('scripts', 'locales', 'resources', 'plugins')) {
    if (Test-Path (Join-Path $root $sub)) {
        Copy-Item -LiteralPath (Join-Path $root $sub) (Join-Path $stage $sub) -Recurse -Force
    }
}
# data 只带图标素材，排除运行产生的 config.json / server.log 等
$stageData = Join-Path $stage 'data'
New-Item -ItemType Directory -Force -Path $stageData | Out-Null
Get-ChildItem (Join-Path $root 'data') -File | Where-Object { $_.Name -notmatch '\.(json|log)$' } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName $stageData
}
New-Item -ItemType Directory -Path (Join-Path $stage 'app') | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'app\package.json') (Join-Path $stage 'app')
Copy-Item -LiteralPath (Join-Path $root 'app\package-lock.json') (Join-Path $stage 'app')
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $payload)
Write-Host ("    载荷：{0:N1} MB（解压约 {1:N0} MB）" -f ((Get-Item $payload).Length / 1MB), ((Get-ChildItem $stage -Recurse -File | Measure-Object Length -Sum).Sum / 1MB))
Remove-Item $stage -Recurse -Force

Write-Host '==> 6/6 编译安装程序（嵌入 payload）并签名'
$refs3 = @(
    '/r:System.dll',
    '/r:System.Core.dll',
    '/r:System.Windows.Forms.dll',
    '/r:System.Drawing.dll',
    '/r:System.IO.Compression.dll',
    '/r:System.IO.Compression.FileSystem.dll',
    '/r:System.Management.dll',
    '/r:Microsoft.CSharp.dll'
)
$outExe = 'D:\DeepSeek Harness\deepseek-harness-client.exe'
& $csc /nologo /target:winexe /optimize+ "/win32icon:$iconOut" "/win32manifest:$srcDir\app.manifest" $refs3 "/resource:$payload,DSHPayload.zip" "/resource:$buildDir\logo.png,DSHLogo.png" "/resource:$buildDir\icon-desktop.png,DSHIconDesktop.png" "/resource:$buildDir\icon-rocket.png,DSHIconRocket.png" "/resource:$buildDir\icon-node.png,DSHIconNode.png" "/out:$outExe" "$srcDir\Installer.cs" "$srcDir\InstallerUI.cs"
if ($LASTEXITCODE -ne 0) { throw '安装程序编译失败' }
# 安装器也补上版本信息（否则右键属性显示 0.0.0.0）
& $rcedit $outExe `
    --set-icon $iconOut `
    --set-version-string 'FileDescription' 'DeepSeek Harness 懒人客户端 安装程序' `
    --set-version-string 'ProductName' 'DeepSeek Harness' `
    --set-version-string 'CompanyName' '蓝色大肥鱼' `
    --set-product-version '0.1.1.0' --set-file-version '0.1.1.0' | Out-Null
Sign-Exe $outExe

Write-Host '==> 7/7 打包便携 zip（解压后得到 DeepSeek Harness 文件夹）'
$zip = 'D:\DeepSeek Harness\deepseek-harness-client.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
$zipStage = Join-Path $env:TEMP 'dsh-zip-stage'
if (Test-Path $zipStage) { Remove-Item $zipStage -Recurse -Force }
$zipInner = Join-Path $zipStage 'DeepSeek Harness'
New-Item -ItemType Directory -Force -Path $zipInner | Out-Null
Get-ChildItem $root -File | Where-Object { $_.Name -notmatch '^payload\.zip$' -and $_.Name -ne '.gitignore' } | ForEach-Object { Copy-Item -LiteralPath $_.FullName $zipInner }
foreach ($sub in @('scripts', 'locales', 'resources')) {
    Copy-Item -LiteralPath (Join-Path $root $sub) (Join-Path $zipInner $sub) -Recurse -Force
}
$zipData = Join-Path $zipInner 'data'
New-Item -ItemType Directory -Force -Path $zipData | Out-Null
Get-ChildItem (Join-Path $root 'data') -File | Where-Object { $_.Name -notmatch '\.(json|log)$' } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName $zipData
}
New-Item -ItemType Directory -Path (Join-Path $zipInner 'app') | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'app\package.json') (Join-Path $zipInner 'app')
Copy-Item -LiteralPath (Join-Path $root 'app\package-lock.json') (Join-Path $zipInner 'app')
[System.IO.Compression.ZipFile]::CreateFromDirectory($zipStage, $zip)
Remove-Item $zipStage -Recurse -Force
Write-Host ("    便携包：$zip（{0:N1} MB）" -f ((Get-Item $zip).Length / 1MB))

Write-Host ''
Write-Host '完成！'
Write-Host "  桌面客户端：$root\蓝色大肥鱼DSH.exe"
Write-Host "  浏览器模式：$root\launcher.exe"
Write-Host ("  安装包：$outExe（{0:N1} MB）" -f ((Get-Item $outExe).Length / 1MB))
Write-Host ("  便携包：$zip（{0:N1} MB）" -f ((Get-Item $zip).Length / 1MB))
