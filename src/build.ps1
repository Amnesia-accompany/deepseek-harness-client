# ============================================================
#  钃濊壊澶ц偉楸?DSH 鎳掍汉瀹㈡埛绔?- 鏋勫缓鑴氭湰
#  鐢熸垚锛氳摑鑹插ぇ鑲ラ奔DSH.exe锛圗lectron 妗岄潰绔級+ launcher.exe
#       + deepseek-harness-client-v0.3.1.exe锛堣嚜鍖呭惈锛屽祵鍏ュ叏閮ㄦ枃浠讹級
#  ------------------------------------------------------------
#  鐩綍绾﹀畾锛?#    src\build.ps1        鏈剼鏈紙婧愮爜锛?#    build\               鏋勫缓浜х墿涓庣礌鏉愶紙鍙暣浣撳垹闄ゅ悗閲嶅缓锛?#      build\electron-dist   Electron 绱犳潗搴?#      build\rcedit-x64.exe  鍥炬爣/鐗堟湰淇℃伅宸ュ叿
#      build\payload.zip     鎵撳寘杞借嵎锛堢敓鎴愮墿锛?# ============================================================
$ErrorActionPreference = 'Stop'

$VER = '0.3.1.0'    # 鐗堟湰鍙凤紙瀹夎鍖呮枃浠跺悕涓庣増鏈俊鎭級

$root     = Split-Path -Parent $PSScriptRoot    # 鎳掍汉瀹㈡埛绔?鐩綍锛堝彂琛屾牴锛?$srcDir   = $PSScriptRoot
$buildDir = Join-Path $root 'build'
$csc      = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$rcedit   = Join-Path $buildDir 'rcedit-x64.exe'
$eleSrc   = Join-Path $buildDir 'electron-dist'
if (-not (Test-Path $csc)) { throw '鏈壘鍒?csc.exe锛堥渶瑕?.NET Framework 4.x锛? }
if (-not (Test-Path $eleSrc)) { throw "鏈壘鍒?Electron 绱犳潗搴擄細$eleSrc锛堣鍏堣В鍘?electron 鍙戣鍖呭埌璇ョ洰褰曪級" }

Write-Host '==> 1/5 鐢熸垚鍥炬爣 icon.ico / icon.png'
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
# png (64x64 鏍囬鏍?
$bmp2 = New-Object System.Drawing.Bitmap 64, 64
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($img, 0, 0, 64, 64)
$pngOut = Join-Path $buildDir 'icon.png'
$bmp2.Save($pngOut, [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose(); $bmp2.Dispose()

# 鍝佺墝 Logo锛堝畨瑁呯晫闈㈠乏渚ф爮鐢紝256px 鍦嗚鏂瑰舰 + 鐧借壊缁嗘弿杈癸級
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
Write-Host "    鍝佺墝 Logo锛?logoOut"

# 楂樻竻鍚姩 Logo锛堝鎴风鍚姩鍔ㄧ敾鐢紝512px 鍦嗗舰 + 鐧借壊缁嗘弿杈癸級
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
Write-Host "    楂樻竻鍚姩 Logo锛?bootOut"

$img.Dispose()

# ---- 寰瀷鍔熻兘鍥炬爣锛堝畨瑁呯晫闈㈢敤锛?2x32 PNG锛?----
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
# 妗岄潰鍥炬爣锛堟樉绀哄櫒锛?New-IconPng (Join-Path $buildDir 'icon-desktop.png') {
    param($g)
    $blue = [System.Drawing.Color]::FromArgb(46, 124, 246)
    $pen = New-Object System.Drawing.Pen($blue, 2.4)
    $g.DrawRectangle($pen, 5, 6, 22, 15)
    $g.DrawLine($pen, 12, 25, 20, 25)
    $g.DrawLine($pen, 16, 21, 16, 25)
    $g.DrawLine($pen, 8, 25, 24, 25)
    $pen.Dispose()
}
# 鐏鍥炬爣
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
# Node.js 鍥炬爣锛堢豢鑹插叚杈瑰舰锛?New-IconPng (Join-Path $buildDir 'icon-node.png') {
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
Write-Host "    寰瀷鍥炬爣锛歩con-desktop / icon-rocket / icon-node"

Write-Host '==> 2/5 鍚屾 Electron 妗岄潰绔埌鍙戣鏍?
# 澶嶅埗 electron 绱犳潗锛堟帓闄?resources锛屽崟鐙悓姝ワ級
# 娉ㄦ剰锛氱洰褰曞厛娓呯┖鐩爣鍐嶅鍒讹紝鍚﹀垯鐩綍澶嶅埗鍒板凡瀛樺湪鐩綍浼氫骇鐢熷祵濂楋紙locales\locales锛?Get-ChildItem $eleSrc -Force | Where-Object { $_.Name -ne 'resources' } | ForEach-Object {
    $dest = Join-Path $root $_.Name
    if ($_.PSIsContainer -and (Test-Path $dest)) { Remove-Item $dest -Recurse -Force }
    Copy-Item -LiteralPath $_.FullName $dest -Recurse -Force
}
# electron 搴旂敤锛坢ain.js / preload / ui / package.json锛?# 娉ㄦ剰锛氬厛娓呯┖鐩爣鍐嶅鍒讹紝鍚﹀垯鐩綍澶嶅埗鍒板凡瀛樺湪鐩綍浼氫骇鐢熷祵濂楋紙ui\ui锛?$eleApp = Join-Path $eleSrc 'resources\app'
$rootApp = Join-Path $root 'resources\app'
if (Test-Path $rootApp) { Remove-Item $rootApp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $rootApp | Out-Null
Get-ChildItem $eleApp -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName (Join-Path $rootApp $_.Name) -Recurse -Force
}
# 鏍囬鏍忓浘鏍?+ 楂樻竻鍚姩 Logo
Copy-Item -LiteralPath $pngOut (Join-Path $rootApp 'ui\icon.png') -Force
Copy-Item -LiteralPath (Join-Path $buildDir 'boot-logo.png') (Join-Path $rootApp 'ui\boot-logo.png') -Force
# 涓?exe锛堢礌鏉愬簱涓凡 rcedit 鍥炬爣锛涚‘淇濆瓨鍦級
$mainExe = Join-Path $root '钃濊壊澶ц偉楸糄SH.exe'
if (-not (Test-Path $mainExe)) {
    Copy-Item -LiteralPath (Join-Path $eleSrc '钃濊壊澶ц偉楸糄SH.exe') $mainExe -Force
}
& $rcedit $mainExe `
    --set-icon $iconOut `
    --set-version-string 'FileDescription' 'DeepSeek Harness 鎳掍汉瀹㈡埛绔? `
    --set-version-string 'ProductName' 'DeepSeek Harness' `
    --set-version-string 'CompanyName' '钃濊壊澶ц偉楸? `
    --set-product-version "$VER" --set-file-version "$VER" | Out-Null
Write-Host "    妗岄潰绔氨缁細$mainExe"

Write-Host '==> 3/5 缂栬瘧 launcher.exe锛堟祻瑙堝櫒妯″紡澶囬€夛級涓?uninstaller.exe锛堝嵏杞藉櫒锛?
$refs = @(
    '/r:System.dll',
    '/r:System.Core.dll',
    '/r:System.Windows.Forms.dll',
    '/r:System.Drawing.dll',
    '/r:System.Management.dll',
    '/r:Microsoft.CSharp.dll'
)
& $csc /nologo /target:winexe /optimize+ "/win32icon:$iconOut" "/win32manifest:$srcDir\app.manifest" $refs "/out:$root\launcher.exe" "$srcDir\Launcher.cs"
if ($LASTEXITCODE -ne 0) { throw 'launcher.exe 缂栬瘧澶辫触' }
& $csc /nologo /target:winexe /optimize+ "/win32icon:$iconOut" "/win32manifest:$srcDir\app.manifest" $refs "/out:$root\uninstaller.exe" "$srcDir\Uninstaller.cs"
if ($LASTEXITCODE -ne 0) { throw 'uninstaller.exe 缂栬瘧澶辫触' }
& $rcedit "$root\uninstaller.exe" `
    --set-icon $iconOut `
    --set-version-string 'FileDescription' 'DeepSeek Harness 瀹㈡埛绔?鍗歌浇绋嬪簭' `
    --set-version-string 'ProductName' 'DeepSeek Harness' `
    --set-version-string 'CompanyName' '钃濊壊澶ц偉楸? `
    --set-product-version "$VER" --set-file-version "$VER" | Out-Null
Write-Host "    鍗歌浇鍣ㄥ氨缁細$root\uninstaller.exe"

Write-Host '==> 4/6 浠ｇ爜绛惧悕锛堥槻鏉€姣掕蒋浠惰鎶ワ級'
function Sign-Exe {
    param([string]$Path)
    $cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue |
        Where-Object { $_.Subject -like '*钃濊壊澶ц偉楸?' } | Select-Object -First 1
    if (-not $cert) {
        $cert = New-SelfSignedCertificate -Type CodeSigningCert `
            -Subject 'CN=钃濊壊澶ц偉楸?DeepSeek Harness 瀹㈡埛绔? `
            -CertStoreLocation Cert:\CurrentUser\My -KeyUsage DigitalSignature `
            -NotAfter (Get-Date).AddYears(3)
    }
    if ($cert) {
        Set-AuthenticodeSignature -FilePath $Path -Certificate $cert -HashAlgorithm SHA256 -ErrorAction SilentlyContinue | Out-Null
        Write-Host ("    宸茬鍚嶏細{0}" -f (Split-Path $Path -Leaf))
    }
}
Sign-Exe $mainExe
Sign-Exe "$root\launcher.exe"
Sign-Exe "$root\uninstaller.exe"

Write-Host '==> 5/6 鎵撳寘杞借嵎 payload.zip锛堝惈 Electron 鍏ㄩ儴鏂囦欢锛?
$payload = Join-Path $buildDir 'payload.zip'
if (Test-Path $payload) { Remove-Item $payload -Force }
# 寮哄埗 scripts 涓嬬殑 ps1 涓?UTF-8 BOM锛圵indows PowerShell 5.1 渚濊禆 BOM 璇嗗埆涓枃锛?foreach ($ps1 in Get-ChildItem (Join-Path $root 'scripts') -Filter '*.ps1') {
    $raw = [System.IO.File]::ReadAllBytes($ps1.FullName)
    if (-not ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF)) {
        $txt = [System.IO.File]::ReadAllText($ps1.FullName, [System.Text.Encoding]::UTF8)
        [System.IO.File]::WriteAllText($ps1.FullName, $txt, (New-Object System.Text.UTF8Encoding $true))
        Write-Host ("    宸蹭负 {0} 娣诲姞 BOM" -f $ps1.Name)
    }
}
# 鏁寸悊鍒?staging 鐩綍锛岀敤 ZipFile 鎵撳寘淇濈暀鐩綍缁撴瀯锛圥S 5.1 Copy-Item 涓枃璺緞 bug锛氱敤 -LiteralPath锛?$stage = Join-Path $env:TEMP 'dsh-payload-stage'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
Get-ChildItem $root -File | Where-Object { $_.Name -notmatch '^payload\.zip$' -and $_.Name -ne '.gitignore' } | ForEach-Object { Copy-Item -LiteralPath $_.FullName $stage }
foreach ($sub in @('scripts', 'locales', 'resources', 'plugins')) {
    if (Test-Path (Join-Path $root $sub)) {
        Copy-Item -LiteralPath (Join-Path $root $sub) (Join-Path $stage $sub) -Recurse -Force
    }
}
# data 鍙甫鍥炬爣绱犳潗锛屾帓闄よ繍琛屼骇鐢熺殑 config.json / server.log 绛?$stageData = Join-Path $stage 'data'
New-Item -ItemType Directory -Force -Path $stageData | Out-Null
Get-ChildItem (Join-Path $root 'data') -File | Where-Object { $_.Name -notmatch '\.(json|log)$' } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName $stageData
}
New-Item -ItemType Directory -Path (Join-Path $stage 'app') | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'app\package.json') (Join-Path $stage 'app')
Copy-Item -LiteralPath (Join-Path $root 'app\package-lock.json') (Join-Path $stage 'app')
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $payload)
Write-Host ("    杞借嵎锛歿0:N1} MB锛堣В鍘嬬害 {1:N0} MB锛? -f ((Get-Item $payload).Length / 1MB), ((Get-ChildItem $stage -Recurse -File | Measure-Object Length -Sum).Sum / 1MB))
Remove-Item $stage -Recurse -Force

Write-Host '==> 6/6 缂栬瘧瀹夎绋嬪簭锛堝祵鍏?payload锛夊苟绛惧悕'
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
$outExe = 'D:\DeepSeek Harness\deepseek-harness-client-v0.3.1.exe'
& $csc /nologo /target:winexe /optimize+ "/win32icon:$iconOut" "/win32manifest:$srcDir\app.manifest" $refs3 "/resource:$payload,DSHPayload.zip" "/resource:$buildDir\logo.png,DSHLogo.png" "/resource:$buildDir\icon-desktop.png,DSHIconDesktop.png" "/resource:$buildDir\icon-rocket.png,DSHIconRocket.png" "/resource:$buildDir\icon-node.png,DSHIconNode.png" "/out:$outExe" "$srcDir\Installer.cs" "$srcDir\InstallerUI.cs"
if ($LASTEXITCODE -ne 0) { throw '瀹夎绋嬪簭缂栬瘧澶辫触' }
# 瀹夎鍣ㄤ篃琛ヤ笂鐗堟湰淇℃伅锛堝惁鍒欏彸閿睘鎬ф樉绀?0.0.0.0锛?& $rcedit $outExe `
    --set-icon $iconOut `
    --set-version-string 'FileDescription' 'DeepSeek Harness 鎳掍汉瀹㈡埛绔?瀹夎绋嬪簭' `
    --set-version-string 'ProductName' 'DeepSeek Harness' `
    --set-version-string 'CompanyName' '钃濊壊澶ц偉楸? `
    --set-product-version "$VER" --set-file-version "$VER" | Out-Null
Sign-Exe $outExe

Write-Host '==> 7/7 鎵撳寘渚挎惡 zip锛堣В鍘嬪悗寰楀埌 DeepSeek Harness 鏂囦欢澶癸級'
$zip = 'D:\DeepSeek Harness\deepseek-harness-client-v0.3.1.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
$zipStage = Join-Path $env:TEMP 'dsh-zip-stage'
if (Test-Path $zipStage) { Remove-Item $zipStage -Recurse -Force }
$zipInner = Join-Path $zipStage 'DeepSeek Harness'
New-Item -ItemType Directory -Force -Path $zipInner | Out-Null
Get-ChildItem $root -File | Where-Object { $_.Name -notmatch '^payload\.zip$' -and $_.Name -ne '.gitignore' } | ForEach-Object { Copy-Item -LiteralPath $_.FullName $zipInner }
foreach ($sub in @('scripts', 'locales', 'resources', 'plugins')) {
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
Write-Host ("    渚挎惡鍖咃細$zip锛坽0:N1} MB锛? -f ((Get-Item $zip).Length / 1MB))

Write-Host ''
Write-Host '瀹屾垚锛?
Write-Host "  妗岄潰瀹㈡埛绔細$root\钃濊壊澶ц偉楸糄SH.exe"
Write-Host "  娴忚鍣ㄦā寮忥細$root\launcher.exe"
Write-Host ("  瀹夎鍖咃細$outExe锛坽0:N1} MB锛? -f ((Get-Item $outExe).Length / 1MB))
Write-Host ("  渚挎惡鍖咃細$zip锛坽0:N1} MB锛? -f ((Get-Item $zip).Length / 1MB))
