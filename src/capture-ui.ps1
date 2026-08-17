# 用 PrintWindow 抓取安装器窗口内容
param([string]$OutFile = 'D:\DeepSeek Harness\真实界面截图.png')
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class PW32 {
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECTD r);
    [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
    [StructLayout(LayoutKind.Sequential)] public struct RECTD { public int L, T, R, B; }
}
'@
Add-Type -AssemblyName System.Drawing
$w = Get-Process | Where-Object { $_.ProcessName -like '*harness*' -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $w) { Write-Host '未找到安装器窗口'; exit 1 }
[PW32]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null
$r = New-Object PW32+RECTD
[PW32]::GetWindowRect($w.MainWindowHandle, [ref]$r) | Out-Null
$bmp = New-Object System.Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
[PW32]::PrintWindow($w.MainWindowHandle, $hdc, 2) | Out-Null
$g.ReleaseHdc($hdc)
$g.Dispose()
$bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "PrintWindow 截图: $OutFile ($($r.R - $r.L)x$($r.B - $r.T))"
