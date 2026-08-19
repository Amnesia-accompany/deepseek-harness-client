# dsh-global-persona（全局人设）

给 DeepSeek Harness 加一个「全局人设」：在 **设置 → 全局人设** 页面里填写一段 persona 文字，
它会作为系统提示词的一部分注入到 **每一个 Agent 会话** —— 无论新建哪个工作区、哪个会话，
连子任务也一样。修改后立即生效，无需重启会话。

> ⚠️ **默认关闭**：全新安装后该功能默认不启用（`enabled: false`），
> 需要在 设置 → 全局人设 里手动打开开关并填写内容后才生效。

## 工作原理

- **Host**：用 `settings` 服务持久化 `{ enabled, text }`；用 `systemPrompt.section`
  注册一个全局提示词 section（`global-persona`，order 1），`text` 是函数，
  每次组装系统提示词时读取最新值；`webServer` 暴露本地 `GET/PATCH /plugins/dsh-global-persona/config`。
- **Client**：在 `settings.section` 注册「全局人设」设置页，通过 fetch 读写配置。

## 安装（本机 profile）

1. 把本目录复制到 `~/.dsh/profiles/web/node_modules/dsh-global-persona/`
   （`profiles/web/package.json` 的 postinstall 已包含此拷贝）。
2. 在 `~/.dsh/profiles/web/cordis.patch.yml` 的 `insert` 列表加一行：

   ```yaml
   - id: dsh-global-persona
     name: dsh-global-persona
   ```

3. 重启 DSH（关闭「蓝色大肥鱼DSH.exe」再打开，或双击「重启DSH服务.bat」）。

## 卸载

从 `cordis.patch.yml` 删除该行，删除 `profiles/web/node_modules/dsh-global-persona/`，
重启 DSH 即可。设置里保存的人设数据保留在 settings 文件中（无害）。
