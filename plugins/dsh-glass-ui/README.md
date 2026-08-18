# dsh-glass-ui 🧊

**DeepSeek Harness 玻璃拟态界面插件** —— 把 DSH 界面变成悬浮玻璃卡片，支持 Wallpaper Engine 壁纸背景。

## 功能

- **两种玻璃模式**
  - 🫧 **漂浮玻璃**：整个界面变成悬浮玻璃卡片（圆角、阴影、漂浮感）
  - 🔄 **兼容模式**：保持原版排版，只把材质换成玻璃，兼容其他插件界面
- **模糊度**：0~6px 滑动调节（0.5 步进），控制背景模糊半径
- **磨砂度**：0~100% 滑动调节，控制玻璃不透度与颗粒感
- **背景**
  - 🌊 **流体**：7 套配色（珍珠白/深蓝宇宙/紫罗兰/薄荷青/落日暖橙/樱花粉/翡翠森林），光斑漂移动画
  - 🖼️ **壁纸**：自动扫描 Wallpaper Engine 壁纸库（Steam Workshop + 自定义项目），视频壁纸用高清 mp4 源、GIF 动图、静态图按分辨率排序并标注低清
- **设置持久化**：所有配置自动保存，重启客户端后保持上次设置

## 效果细节

- 玻璃材质通过 DSH 官方主题机制（`theme.overrideTokens`）实现，所有组件包括第三方插件界面自动玻璃化
- 设置面板/弹窗保持白色不透明（只玻璃化主界面）
- 磨砂噪点纹理 + 高光描边，玻璃质感更真实
- 大视频壁纸支持流式加载和拖拽进度（HTTP Range）

## 安装

1. 将 `dsh-glass-ui` 目录复制到客户端 `plugins\` 目录（若为懒人客户端发行版，启动时自动部署）
2. 在 `~\.dsh\profiles\web\cordis.patch.yml` 中注册：

```yaml
- insert:
    - id: builtin-dsh-glass-ui
      name: dsh-glass-ui
```

3. 重启 DSH 客户端

## 使用

设置 → 通用 → 玻璃外观（模式/模糊度/磨砂度/背景/壁纸/流体配色）

## 兼容性

- Windows 10/11 + DeepSeek Harness（Web 客户端）
- Wallpaper Engine 壁纸目录：`文档\Wallpaper Engine`、Steam Workshop `steamapps\workshop\content\431960`（自动定位 Steam 安装路径）

## License

MIT
