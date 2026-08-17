# DeepSeek Harness 懒人客户端 🐟

基于开源项目 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的一键部署 Windows 客户端：**下载一个 exe，双击安装，只需输入你自己的 API Key**。

界面是**独立的无边框桌面应用窗口**（Electron 客户端，高清显示，非浏览器），网页内容与官方 DeepSeek Harness 完全一致。

> ⚠️ 本项目为第三方封装客户端，非 DeepSeek 官方出品。核心引擎与界面来自官方开源项目。

---

## ✨ 功能特性

| 特性 | 说明 |
|---|---|
| 🖥️ 独立桌面窗口 | 无边框、无地址栏、无标签页，像普通软件一样使用 |
| 🔍 高清显示 | PerMonitorV2 高 DPI 感知，150% 缩放的屏幕上依然锐利 |
| 🚀 一键安装 | 自动检测/下载 Node.js（免管理员）、自动安装依赖 |
| 🔑 自己的 API Key | 首次打开输入你自己的 Key，只保存在本机，绝不预置/上传 |
| ⚙️ 服务内嵌管理 | 后台拉起 `dsh web`，关窗确认后自动停服，无黑窗口 |
| 🔄 端口自适应 | 默认 3080，被占用自动换端口并记忆 |
| 📦 安装选项 | 可勾选「添加桌面快捷方式」「安装完成后直接打开」 |
| 🗑️ 干净卸载 | 设置 → 应用 → 卸载，自动清理全部文件 |

---

## 🚀 快速开始

### 方式一：安装包（推荐给别人）

1. 下载 `蓝色大肥鱼DSH-安装程序.exe`（约 127MB，自包含）
2. 双击运行：
   - 自动检测 Node.js（没装会自动下载便携版，免管理员）
   - 勾选「添加桌面快捷方式」「安装完成后直接打开」
   - 点「安装」，约 1~5 分钟完成
3. 首次打开输入**你自己的 DeepSeek API Key**（[platform.deepseek.com](https://platform.deepseek.com) 申请）
4. 开始使用！

安装位置：`C:\Users\你的用户名\DeepSeek Harness`

### 方式二：便携包

1. 下载 `蓝色大肥鱼-DSH懒人客户端.zip`（约 127MB）
2. 解压得到 `DeepSeek Harness` 文件夹
3. 双击文件夹里的 `蓝色大肥鱼DSH.exe`（首次启动会自动安装依赖）
4. 输入你的 API Key 即可

### 方式三：从源码构建（开发者）

见下方 [开发与构建](#-开发与构建)。

---

## 🔑 关于 API Key（重要）

- **客户端不预置任何人的 Key**，安装包里没有、也不会携带任何密钥
- Key 只保存在**运行者自己电脑**的 `C:\Users\你的用户名\.dsh\.credentials.yaml`
- 首次打开**必须输入自己的 Key**，否则无法使用
- 换 Key：运行安装目录里的 `重新配置APIKey.bat`

---

## 📖 使用说明

### 日常使用
- 双击桌面快捷方式 **DeepSeek Harness**（或安装目录的 `蓝色大肥鱼DSH.exe`）
- 关闭窗口时会询问「是否同时停止服务」，点「是」即全部退出

### 两种模式
- `蓝色大肥鱼DSH.exe`：桌面客户端（默认，推荐）
- `launcher.exe`：浏览器模式备选（双击后自动打开浏览器）

### 文件位置
| 内容 | 位置 |
|---|---|
| 客户端安装目录 | `C:\Users\你的用户名\DeepSeek Harness` |
| AI 工作目录（生成的文件） | `C:\Users\你的用户名\DeepSeek-Harness-Workspace` |
| API Key | `C:\Users\你的用户名\.dsh\.credentials.yaml` |
| 历史会话记录 | `C:\Users\你的用户名\.dsh\sessions` |
| 服务日志 | 安装目录 `data\server.log` |

### 升级与卸载
- 升级：双击安装目录里的 `更新.bat`
- 卸载：双击安装目录的 uninstaller.exe，或 设置 → 应用 → 卸载

---

## 🛠️ 开发与构建

### 环境要求
- Windows 10/11 x64
- .NET Framework 4.8（系统自带）+ `csc.exe`
- Node.js ≥ 20（构建 Electron 素材时需要网络）

### 目录结构

```
├── src/                  C# 安装器/启动器源码 + build.ps1 构建脚本
├── resources/app/        Electron 桌面客户端（main.js / preload / UI）
├── scripts/              安装/配置/卸载 PowerShell 脚本
├── app/                  dsh 核心依赖（node_modules 不入库，npm install 生成）
├── data/                 图标素材
└── build/                （构建产物，不入库）
```

### 构建安装包

```powershell
# 1. 安装依赖
cd app
npm install --registry=https://registry.npmmirror.com

# 2. 准备 Electron 素材库（首次）
#    下载 electron 发行包解压到 build/electron-dist/，
#    并将 electron.exe 改名 蓝色大肥鱼DSH.exe 后用 rcedit 换图标

# 3. 一键构建（生成安装器 exe + 便携 zip）
powershell -File src\build.ps1
```

产物输出到 `D:\DeepSeek Harness\`：
- `蓝色大肥鱼DSH-安装程序.exe`（自包含安装器）
- `蓝色大肥鱼-DSH懒人客户端.zip`（便携包）

### 技术要点
- **Electron 43**：自包含 Chromium 内核，免疫杀毒软件 ML 误报（早期 WebView2 方案曾被 Defender 误报而弃用）
- **C# 5 + .NET Framework 4.8**：安装器/启动器用系统自带 `csc.exe` 编译，零额外运行时
- **代码签名**：构建脚本自动用自签名证书签署全部 exe，降低杀软误报
- **国内网络友好**：npm/Node 下载默认走 npmmirror 镜像，自动回退官方源

---

## ❓ 常见问题

**Q: 杀毒软件提示"已保护你的电脑"？**
A: 程序已带代码签名。若仍被拦截：点「更多信息」→「仍要运行」；或在 Windows 安全中心 → 排除项添加安装目录。

**Q: 首次打开需要输入 Key？**
A: 是的，必须输入你自己的 Key。安装包不携带任何 Key。

**Q: 端口被占用？**
A: 自动换端口。如果已有 DSH 在运行，客户端会直接复用。

**Q: 安装包为什么这么大？**
A: 内置了 Electron/Chromium 内核（约 250MB 解压后），换来稳定高清的独立窗口。

---

## 📄 许可

- 本项目为学习与分享用途，基于 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（MIT 协议）
- 使用时请遵守 DeepSeek 平台服务条款与相关法律法规
- API 费用由使用者自行承担（Key 归属使用者）

---

*有问题欢迎提 Issue，或直接找蓝色大肥鱼 🐟*
