# 卸载「全局人设」插件（dsh-global-persona）
# 用法：双击 卸载全局人设.bat；或 PowerShell 里加 -DryRun 只预览不执行。
# 作用：
#   1. 从 cordis.patch.yml（插件启用名单）移除 dsh-global-persona 行（先自动备份）
#   2. 删除 web profile 里的插件安装目录
#   3. 从 package.json 的 postinstall 里移除拷贝步骤
#   4. 提示重启 DSH 生效
# 保留：D:\DeepSeek Harness\懒人客户端\plugins\dsh-global-persona（源目录），
#        以后想重新启用随时可以装回来。
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$patchFile = Join-Path $env:USERPROFILE '.dsh\profiles\web\cordis.patch.yml'
$pkgDir    = Join-Path $env:USERPROFILE '.dsh\profiles\web\node_modules\dsh-global-persona'
$pkgJson   = Join-Path $env:USERPROFILE '.dsh\profiles\web\package.json'
$postSegment = "; Copy-Item -Recurse -Force 'D:/DeepSeek Harness/懒人客户端/plugins/dsh-global-persona' 'node_modules/dsh-global-persona'"

function Step([string]$msg) { Write-Host "`n== $msg ==" -ForegroundColor Cyan }
function Done([string]$msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Skip([string]$msg) { Write-Host "  [--] $msg" -ForegroundColor Yellow }

if ($DryRun) { Write-Host '>>> 预览模式（-DryRun）：只显示将要执行的操作，不修改任何文件。' -ForegroundColor Magenta }

Step '1/4 从插件启用名单 cordis.patch.yml 移除 dsh-global-persona'
$content = [System.IO.File]::ReadAllText($patchFile, [System.Text.Encoding]::UTF8)
$pattern = "(?m)^    - id: dsh-global-persona\r?\n      name: dsh-global-persona\r?\n"
if ($content -match $pattern) {
  if ($DryRun) { Done '将移除该行（执行前会自动备份 cordis.patch.yml）' }
  else {
    $backup = "$patchFile.bak-$(Get-Date -Format yyyyMMddHHmmss)"
    Copy-Item $patchFile $backup -Force
    $content = $content -replace $pattern, ''
    # 无 BOM 的 UTF-8 写入，兼容各版本 PowerShell / YAML 解析器
    [System.IO.File]::WriteAllText($patchFile, $content, (New-Object System.Text.UTF8Encoding $false))
    Done "已移除，备份在 $backup"
  }
} else { Skip '未找到插件行（可能已经移除过）' }

Step '2/4 删除插件安装目录'
if (Test-Path $pkgDir) {
  if ($DryRun) { Done "将删除 $pkgDir" }
  else { Remove-Item $pkgDir -Recurse -Force; Done '已删除安装目录' }
} else { Skip '安装目录不存在（可能已经删除）' }

Step '3/4 从 package.json 的 postinstall 移除拷贝步骤'
$json = [System.IO.File]::ReadAllText($pkgJson, [System.Text.Encoding]::UTF8)
if ($json.Contains($postSegment)) {
  if ($DryRun) { Done '将移除 postinstall 中的拷贝步骤' }
  else {
    $json = $json.Replace($postSegment, '')
    [System.IO.File]::WriteAllText($pkgJson, $json, (New-Object System.Text.UTF8Encoding $false))
    Done '已移除 postinstall 拷贝步骤'
  }
} else { Skip 'postinstall 里没有该步骤（可能已经移除）' }

Step '4/4 完成'
if ($DryRun) {
  Write-Host '  预览结束：以上是脚本将要执行的内容，实际运行时每个步骤都会真实执行。' -ForegroundColor Magenta
} else {
  Write-Host '  卸载完成！请重启 DSH 服务（关闭「蓝色大肥鱼DSH.exe」再重新打开）使改动生效。' -ForegroundColor Green
  Write-Host '  源目录 D:\DeepSeek Harness\懒人客户端\plugins\dsh-global-persona 已保留；' -ForegroundColor Yellow
  Write-Host '  想重新启用时告诉我一声，我帮你装回来。' -ForegroundColor Yellow
}
