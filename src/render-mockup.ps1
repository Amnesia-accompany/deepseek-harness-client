# 渲染 DeepSeek Harness 安装界面效果图
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$W = 600; $H = 706
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAlias'

function New-RoundPath([int]$x, [int]$y, [int]$w, [int]$h, [int]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    return $p
}

$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(0, 0, $W, $H)), [System.Drawing.Color]::FromArgb(232, 243, 255), [System.Drawing.Color]::FromArgb(252, 254, 255), 90)
$g.FillRectangle($grad, 0, 0, $W, $H)

# 标题栏
$g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)), 0, 0, $W, 36)
$g.DrawLine((New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(225, 232, 242), 1)), 0, 36, $W, 36)
$f9 = New-Object System.Drawing.Font('Microsoft YaHei UI', 9)
$g.DrawString('  DeepSeek Harness 安装', $f9, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 85, 110))), 14, 10)
$closePath = New-RoundPath 570 7 26 22 6
$g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(231, 76, 60))), $closePath)
$g.DrawString('x', (New-Object System.Drawing.Font('Microsoft YaHei UI', 10)), (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)), 578, 8)

# 圆形头像
$src = [System.Drawing.Image]::FromFile('D:\DeepSeek Harness\懒人客户端\data\icon-source.jpg')
$clip = New-Object System.Drawing.Drawing2D.GraphicsPath
$clip.AddEllipse(248, 48, 104, 104)
$g.SetClip($clip)
$g.DrawImage($src, 248, 48, 104, 104)
$g.ResetClip()
$g.DrawEllipse((New-Object System.Drawing.Pen([System.Drawing.Color]::White, 4)), 248, 48, 104, 104)

# 标题
$t1 = New-Object System.Drawing.Font('Microsoft YaHei UI', 19, [System.Drawing.FontStyle]::Bold)
$t1w = $g.MeasureString('DeepSeek Harness', $t1).Width
$g.DrawString('DeepSeek Harness', $t1, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 46, 80))), [int](($W - $t1w) / 2), 168)
$t2 = New-Object System.Drawing.Font('Microsoft YaHei UI', 9.5)
$t2w = $g.MeasureString('蓝色大肥鱼版 · 一键安装', $t2).Width
$g.DrawString('蓝色大肥鱼版 · 一键安装', $t2, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 136, 165))), [int](($W - $t2w) / 2), 202)

# 卡片
function Draw-Card([int]$y, [int]$h, [string]$ct) {
    $shadow = New-RoundPath 32 ($y + 3) 536 ($h - 1) 14
    $g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 40, 90, 170))), $shadow)
    $cp = New-RoundPath 32 $y 536 $h 14
    $g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)), $cp)
    $g.DrawPath((New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(214, 232, 255), 1)), $cp)
    $g.DrawString($ct, (New-Object System.Drawing.Font('Microsoft YaHei UI', 8.5)), (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 136, 165))), 48, $y + 10)
}

Draw-Card 240 72 '安装位置'
$g.DrawRectangle((New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 200, 230), 1)), 50, 276, 396, 26)
$g.DrawString('C:\Users\你的用户名\DeepSeek Harness', $f9, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 85, 110))), 56, 280)
$bb = New-RoundPath 460 275 88 28 10
$g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(232, 242, 255))), $bb)
$g.DrawString('浏览', $f9, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(46, 124, 246))), 490, 280)

Draw-Card 332 102 '运行环境检测'
$g.DrawString('✔ 已检测到 Node.js v24.18.0', (New-Object System.Drawing.Font('Microsoft YaHei UI', 10, [System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(39, 174, 96))), 56, 370)
$nb = New-RoundPath 42 400 18 18 5
$g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(46, 124, 246))), $nb)
$wp = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 2)
$g.DrawLine($wp, 46, 409, 50, 413); $g.DrawLine($wp, 50, 413, 56, 405)
$g.DrawString(' 安装 Node.js（未检测到，将自动下载约 35MB）', $f9, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 75, 105))), 70, 402)

Draw-Card 454 96 '安装选项'
$c1 = New-RoundPath 42 492 18 18 5
$g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(46, 124, 246))), $c1)
$g.DrawLine($wp, 46, 501, 50, 505); $g.DrawLine($wp, 50, 505, 56, 497)
$g.DrawString(' 添加桌面快捷方式', $f9, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 75, 105))), 70, 493)
$c2 = New-RoundPath 42 524 18 18 5
$g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(46, 124, 246))), $c2)
$g.DrawLine($wp, 46, 533, 50, 537); $g.DrawLine($wp, 50, 537, 56, 529)
$g.DrawString(' 安装完成后直接打开', $f9, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 75, 105))), 70, 525)

# 步进器
$steps = @('1 解压文件', '2 运行环境', '3 安装依赖', '4 完成')
for ($i = 0; $i -lt 4; $i++) {
    if ($i -lt 3) {
        $lc = if ($i -eq 0) { [System.Drawing.Color]::FromArgb(46, 124, 246) } else { [System.Drawing.Color]::FromArgb(214, 224, 240) }
        $g.DrawLine((New-Object System.Drawing.Pen($lc, 2.4)), 76 + $i * 134, 585, 156 + $i * 134, 585)
    }
    $bc = if ($i -eq 0) { [System.Drawing.Color]::FromArgb(46, 124, 246) } elseif ($i -eq 1) { [System.Drawing.Color]::FromArgb(39, 174, 96) } else { [System.Drawing.Color]::FromArgb(214, 224, 240) }
    $bp = New-RoundPath (40 + $i * 134) 572 26 26 13
    $g.FillPath((New-Object System.Drawing.SolidBrush($bc)), $bp)
    $g.DrawString(($i + 1).ToString(), (New-Object System.Drawing.Font('Microsoft YaHei UI', 9, [System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)), 46 + $i * 134, 576)
    $tc = if ($i -eq 0) { [System.Drawing.Color]::FromArgb(46, 124, 246) } else { [System.Drawing.Color]::FromArgb(60, 75, 105) }
    $g.DrawString($steps[$i], $f9, (New-Object System.Drawing.SolidBrush($tc)), 76 + $i * 134, 576)
}

# 进度条
$track = New-RoundPath 36 606 528 18 9
$g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(222, 236, 255))), $track)
$fill = New-RoundPath 36 606 222 18 9
$fg = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(36, 606, 222, 18)), [System.Drawing.Color]::FromArgb(120, 180, 255), [System.Drawing.Color]::FromArgb(46, 124, 246), 0)
$g.FillPath($fg, $fill)
$g.DrawString('42%', (New-Object System.Drawing.Font('Microsoft YaHei UI', 8)), (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 120, 170))), 512, 609)
$g.DrawString('正在安装 DeepSeek Harness 核心（约 1~3 分钟）...', (New-Object System.Drawing.Font('Microsoft YaHei UI', 8.5)), (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 136, 165))), 36, 634)

# 按钮
$ib = New-RoundPath 178 658 176 46 14
$ig = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(178, 658, 176, 46)), [System.Drawing.Color]::FromArgb(80, 150, 255), [System.Drawing.Color]::FromArgb(46, 124, 246), 90)
$g.FillPath($ig, $ib)
$g.DrawString('开 始 安 装', (New-Object System.Drawing.Font('Microsoft YaHei UI', 11, [System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)), 216, 672)
$eb = New-RoundPath 368 658 100 46 14
$g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(236, 242, 250))), $eb)
$g.DrawString('取 消', (New-Object System.Drawing.Font('Microsoft YaHei UI', 10)), (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 105, 130))), 398, 672)

$bmp.Save('D:\DeepSeek Harness\UI效果图.png', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host '效果图已生成: D:\DeepSeek Harness\UI效果图.png'
