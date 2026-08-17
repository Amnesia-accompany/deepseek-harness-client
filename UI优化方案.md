# DeepSeek Harness 安装界面 · UI 优化方案

> 基于实际界面代码（`src/InstallerUI.cs`，C# WinForms 自绘控件）的分析与优化设计。
> 技术背景：WinForms 无 CSS/WPF 容器，统一采用 **GDI+ 自绘** 实现现代视觉。

---

## 一、问题分析（对照代码）

| 问题 | 根因（代码级） |
|---|---|
| 主标题下方文字重叠/未对齐 | `title.Location` 用构造期的 `PreferredWidth` 计算居中——此时字体布局未完成，宽度可能为 0，标题/副标题落点错误 |
| 三块内容不像独立卡片 | 卡片间距仅 6~16px，且无投影，白底与背景区分弱 |
| 控件风格不统一 | `浏览`用自绘圆角按钮，但复选框是系统原生样式、进度条是自绘但高度不足、步进器无连接线 |
| 步进器指示弱 | 当前步骤仅换色，无放大/发光/连线，视觉不连贯 |
| 进度条不明显 | 高度 14px、无文字、流动动画不平滑 |
| 选项无图标 | 复选框纯文字，无图形记忆点 |

## 二、优化设计

### 1. 品牌区（标题）
- 圆形大肥鱼头像 104px 居中（已实现，保持）
- 标题/副标题改为 **Shown 事件后居中定位**（`BeginInvoke` 里用 `PreferredWidth` 计算），彻底消除重叠
- 标题 19pt 加粗深蓝，副标题 9.5pt 灰色，间距 26px

### 2. 模块化卡片（三张独立卡片）
- 卡片尺寸/间距：卡片高 ≥72px，**卡片间距 20px**
- 卡片视觉：白色圆角 14px + 浅蓝描边 + **2px 偏移半透明投影**（`DrawPath` 二次绘制模拟阴影）
- 卡片标题 8.5pt 浅灰蓝，内容区从 y=32 开始，与标题明确分离

### 3. 统一控件语言
- **IconCheckBox（自绘）**：圆角勾选框（选中=蓝色圆角+白勾）+ 左侧 20px 微型图标 + 文字；悬停浅蓝底
- **浏览按钮**：圆角 10px，浅蓝底深蓝字，悬停加深（已实现，统一圆角半径）
- **步进器 StepBadge v2**：圆 26px；未到=浅灰、当前=蓝色+**外圈光晕**（2px 亮蓝描边）、完成=绿色 ✓；徽章间 **12px 连接线**（已完成段蓝色）
- **底部按钮**：主按钮 170x46 蓝色圆角 + **投影**；取消按钮灰白圆角，主次分明

### 4. 反馈增强
- **进度条 v2**：高度 18px、圆角 9px；渐变蓝填充；Marquee 动画步长 4px/30ms（更顺滑）；非动画时右上角显示 `42%` 文字
- **绿色对勾**：环境检测状态 9.5pt 加粗绿色，位于卡片内容区首行，清晰居中于卡片左侧

### 5. 图标化（嵌入资源 PNG，32x32）
| 位置 | 图标 | 含义 |
|---|---|---|
| 安装选项·快捷方式 | 桌面显示器 | 快捷方式 |
| 安装选项·直接打开 | 火箭 | 启动 |
| 运行环境·Node.js | 绿色六边形 JS | Node.js |

图标由构建脚本 `build.ps1` 用 GDI+ 绘制并作为资源嵌入安装器（`DSHIconDesktop.png` / `DSHIconRocket.png` / `DSHIconNode.png`），运行时从程序集资源加载。

## 三、代码实施思路（关键片段）

```csharp
// 1) 标题居中：Shown 后计算（避免构造期 PreferredWidth=0）
Shown += delegate {
    BeginInvoke((Action)(delegate {
        title.Location = new Point((ClientSize.Width - title.PreferredWidth) / 2, 168);
        sub.Location = new Point((ClientSize.Width - sub.PreferredWidth) / 2, 202);
    }));
};

// 2) 卡片投影：OnPaint 里先画偏移阴影再画卡片
using (GraphicsPath sh = Rounded.Path(new Rectangle(0, 3, Width - 1, Height - 1), Radius)) {
    using (SolidBrush sb = new SolidBrush(Color.FromArgb(18, 60, 120, 200)))
        e.Graphics.FillPath(sb, sh);          // 半透明投影
}
// ...然后画白色卡片主体

// 3) 自绘复选框：勾选框 + 图标 + 文字（IconCheckBox.OnPaint）
//    勾选框 18x18 圆角 5，选中填充 MainBlue + 白色 ✓；图标 DrawImage；文字 TextRenderer

// 4) 步进器连接线：StepBadge 控件加右端线区（12px），完成/当前态画蓝线

// 5) 进度百分比：OnPaint 中 TextRenderer.DrawText(e.Graphics, pct + "%", ...)
```

## 四、预期效果
- 标题区干净无重叠，品牌感一致
- 三张卡片界限分明、呼吸感强
- 所有控件统一圆角/蓝色语言，专业一致
- 步进器、进度条、对勾反馈清晰直观
- 选项图标化，一屏看懂

> 效果预览图：`D:\DeepSeek Harness\UI效果图.png`（由渲染脚本按最终代码绘制）
