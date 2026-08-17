# DeepSeek Harness 设置增强插件

在 **DeepSeek Harness 自带设置**（左下角 ⚙）中新增三个页面：

| 页面 | 功能 |
|---|---|
| 🧠 **Skills 管理** | 列出 DSH 内置与已注册的全部技能（名称 + 描述），数据来自 DSH 原生 skills 服务 |
| 🔌 **MCP 服务器** | 管理 MCP 服务器（stdio / streamable-http 两种传输），读写 DSH 官方配置 `cordis.patch.yml`（`@deepseek-ai/dsh-mcp-client` 条目） |
| 🛒 **插件市场** | 浏览社区精选列表 [awesome-deepseek-harness](https://github.com/Dominic789654/awesome-deepseek-harness)，18 个类型分类 + 搜索，点击条目打开 GitHub 页面 |

## 安装

### 方式一：本地安装（推荐）

1. 把本文件夹复制到 DSH 的插件目录：

   ```
   %USERPROFILE%\.dsh\profiles\node_modules\deepseek-harness-settings-enhancer
   ```

2. 安装依赖（js-yaml）：

   ```bash
   cd %USERPROFILE%\.dsh\profiles
   npm install js-yaml
   ```

3. 编辑 `%USERPROFILE%\.dsh\profiles\<profile>\cordis.patch.yml`（`<profile>` 通常是 `web`），添加：

   ```yaml
   - id: settings-enhancer
     name: deepseek-harness-settings-enhancer
   ```

4. 重启 DeepSeek Harness，打开左下角 ⚙ 设置即可看到新页面。

### 方式二：npm 发布后安装

发布到 npm 后，在 `%USERPROFILE%\.dsh\profiles` 目录执行：

```bash
npm install deepseek-harness-settings-enhancer
```

然后按方式一的第 3、4 步操作。

## 说明

- MCP 配置修改后需**重启 DSH** 生效（DSH 通过 `@deepseek-ai/dsh-mcp-client` 接入外部 MCP 服务器）
- 插件市场数据来自 GitHub（awesome-deepseek-harness 的 README），10 分钟缓存，可点「刷新」强制更新
- 插件市场网络请求失败时，请检查网络或代理设置

## 目录结构

```
deepseek-harness-settings-enhancer/
├── package.json      # npm 包声明（dsh.client 声明 client 半）
├── src/
│   ├── index.js      # Host 半：webServer 路由 /api/dshmgr/*（skills/mcp/market 数据）
│   └── client.js     # Client 半：settings.section 注册三个页面
├── README.md
└── LICENSE           # MIT
```

## 原理

- **Host 半**：通过 DSH 的 `webServer` 服务注册 `/api/dshmgr/*` HTTP 路由，使用 DSH 原生 `skills` 服务、Node 文件 API（读写 `cordis.patch.yml`）和 `https`（拉取 GitHub 列表）
- **Client 半**：通过 `settings.section` 插槽注册设置页面（与 DSH 官方 General / Models / Plugins 页面平级），页面用 `fetch` 调用 Host 路由
- 包结构遵循 DSH 官方插件规范（`package.json` 的 `dsh.client` 字段声明浏览器半，`exports["./client"]` 提供入口）

## License

MIT
