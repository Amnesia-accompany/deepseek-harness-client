// ============================================================
//  DeepSeek Harness 设置增强 - Client 半
//  在 DSH 自带设置中注册三个页面：Skills 管理 / MCP 服务器 / 插件市场
//  数据通过 fetch 调用 Host 的 /api/dshmgr/* 路由
//  （ModuleLoader bundle 格式，由 clientModules 直接加载）
// ============================================================
window.__ModuleLoader__.load({
  id: 'deepseek-harness-settings-enhancer',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    let React = require('react')

const CSS = `
.mgr-page { font-size: 13px; color: var(--dsw-alias-label-primary, #1a2233); }
.mgr-page .mgr-sub { font-size: 12px; color: var(--dsw-alias-label-tertiary, #8a94a6); margin: 2px 0 14px; }
.mgr-list { display: flex; flex-direction: column; gap: 8px; }
.mgr-item { border: 1px solid var(--dsw-alias-border-l1, #e4e9f0); border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; gap: 10px; }
.mgr-item .mgr-name { font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary, #1a2233); }
.mgr-item .mgr-desc { font-size: 11.5px; color: var(--dsw-alias-label-tertiary, #8a94a6); margin-top: 2px; }
.mgr-item .mgr-act { margin-left: auto; display: flex; gap: 6px; flex: none; }
.mgr-btn { border: 1px solid var(--dsw-alias-border-l1, #e4e9f0); border-radius: 6px; padding: 5px 12px; font-size: 11.5px; cursor: pointer; background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-secondary, #4b5563); }
.mgr-btn:hover { background: var(--dsw-alias-interactive-bg-hover-solid, #eef1f5); }
.mgr-btn.blue { background: var(--dsw-alias-interactive-primary-solid, #1f6fd6); color: #fff; border-color: transparent; }
.mgr-btn.danger { color: var(--dsw-alias-state-error-primary, #d64545); }
.mgr-empty { color: var(--dsw-alias-label-tertiary, #97a0b0); font-size: 12px; padding: 20px 0; text-align: center; }
.mgr-row { display: flex; gap: 8px; margin: 8px 0; }
.mgr-row input, .mgr-row select { flex: 1; padding: 7px 10px; border: 1px solid var(--dsw-alias-border-l1, #dde2ea); border-radius: 6px; font-size: 12.5px; outline: none; background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #1a2233); }
.mgr-label { font-size: 11.5px; color: var(--dsw-alias-label-tertiary, #8a94a6); margin-top: 8px; }
.mgr-form { border: 1px solid var(--dsw-alias-border-l1, #e4e9f0); border-radius: 8px; padding: 14px; margin-bottom: 14px; }
.mgr-cats { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.mgr-cat { padding: 4px 11px; font-size: 12px; border-radius: 14px; cursor: pointer; background: var(--dsw-alias-interactive-bg-hover-solid, #eef1f5); color: var(--dsw-alias-label-secondary, #4b5563); }
.mgr-cat.active { background: var(--dsw-alias-interactive-primary-solid, #1f6fd6); color: #fff; }
.mgr-mk { border: 1px solid var(--dsw-alias-border-l1, #e4e9f0); border-radius: 8px; padding: 9px 13px; margin-bottom: 8px; cursor: pointer; }
.mgr-mk:hover { border-color: var(--dsw-alias-border-l2, #c8d8ef); background: var(--dsw-alias-interactive-bg-hover-solid, #fafcfe); }
.mgr-mk .mk-name { font-size: 13px; font-weight: 600; color: var(--dsw-alias-interactive-primary-solid, #1f6fd6); }
.mgr-mk .mk-desc { font-size: 11.5px; color: var(--dsw-alias-label-secondary, #6b7280); margin-top: 3px; line-height: 1.5; }
.mgr-mk .mk-act { margin-top: 6px; display: flex; gap: 6px; align-items: center; }
.mgr-tag { font-size: 10px; padding: 1px 7px; border-radius: 8px; background: var(--dsw-alias-positive-bg, #e8f7ee); color: var(--dsw-alias-positive-primary, #1d9e63); }
.mgr-tabs { display: flex; gap: 4px; margin-bottom: 12px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e4e9f0); }
.mgr-tab { border: 0; background: transparent; padding: 6px 14px; font-size: 12.5px; color: var(--dsw-alias-label-secondary, #6b7280); cursor: pointer; border-bottom: 2px solid transparent; }
.mgr-tab.active { color: var(--dsw-alias-interactive-primary-solid, #1f6fd6); border-bottom-color: var(--dsw-alias-interactive-primary-solid, #1f6fd6); font-weight: 600; }
`

function injectCss() {
  const tagId = 'dshmgr-css'
  if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'deepseek-harness-settings-enhancer'
    tag.dataset.pluginCss = tagId
    tag.textContent = CSS
    document.head.appendChild(tag)
  }
}

async function api(path, body) {
  const r = await fetch(path, body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } : undefined)
  return r.json()
}

// ---------- Skills 页面 ----------
function SkillsPage() {
  const [items, setItems] = React.useState(null)
  const [err, setErr] = React.useState('')
  const [deleting, setDeleting] = React.useState('')
  const load = () => {
    setItems(null); setErr('')
    api('/api/dshmgr/skills').then((r) => {
      if (r && r.ok) setItems(r.items)
      else setErr((r && r.error) || '加载失败')
    }).catch((e) => setErr(String(e && e.message || e)))
  }
  React.useEffect(() => { load() }, [])
  const del = (name) => {
    if (!confirm('确定删除技能「' + name + '」？此操作会删除技能文件，不可恢复。')) return
    setDeleting(name)
    api('/api/dshmgr/skill-delete', { name }).then((r) => {
      setDeleting('')
      if (r && r.ok) load()
      else alert('删除失败：' + ((r && r.error) || '未知'))
    }).catch((e) => { setDeleting(''); alert('删除失败：' + String(e && e.message || e)) })
  }
  return React.createElement('div', { className: 'mgr-page' },
    React.createElement('div', { className: 'mgr-sub' }, '本机安装的技能（点击删除可移除）'),
    err ? React.createElement('div', { className: 'mgr-empty' }, err)
      : items === null ? React.createElement('div', { className: 'mgr-empty' }, '加载中…')
      : items.length === 0 ? React.createElement('div', { className: 'mgr-empty' }, '暂无技能')
      : React.createElement('div', { className: 'mgr-list' },
          items.map((s) => React.createElement('div', { className: 'mgr-item', key: s.name },
            React.createElement('div', null,
              React.createElement('div', { className: 'mgr-name' }, s.name),
              React.createElement('div', { className: 'mgr-desc' }, s.desc || '（无描述）'),
            ),
            React.createElement('div', { className: 'mgr-act' },
              React.createElement('button', { className: 'mgr-btn danger', disabled: deleting === s.name, onClick: () => del(s.name) }, deleting === s.name ? '删除中…' : '删除'),
            ),
          )),
        ),
  )
}

// ---------- MCP 页面 ----------
function McpPage() {
  const [items, setItems] = React.useState(null)
  const [err, setErr] = React.useState('')
  const [form, setForm] = React.useState(null)
  const [name, setName] = React.useState('')
  const [transport, setTransport] = React.useState('stdio')
  const [command, setCommand] = React.useState('')
  const [args, setArgs] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  function reload() {
    setItems(null); setErr('')
    api('/api/dshmgr/mcp').then((r) => {
      if (r && r.ok) setItems(r.items)
      else setErr((r && r.error) || '加载失败')
    }).catch((e) => setErr(String(e && e.message || e)))
  }
  React.useEffect(() => { reload() }, [])

  function openForm(m) {
    setForm(m ? m.id : 'new')
    setName(m ? (m.serverName || '') : '')
    setTransport(m && m.transport === 'streamable-http' ? 'http' : 'stdio')
    setCommand(m ? (m.command || '') : '')
    setArgs(m ? (m.args || []).join(' ') : '')
    setUrl(m ? (m.url || '') : '')
  }

  function save() {
    if (!name.trim()) { alert('请填写服务器名称'); return }
    setBusy(true)
    let next = (items || []).filter((x) => x.id !== form)
    const rec = {
      id: form === 'new' || !(items || []).some((x) => x.id === form)
        ? 'mcp-' + name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') + '-' + Math.random().toString(36).slice(2, 6)
        : form,
      serverName: name.trim(),
      transport: transport === 'http' ? 'streamable-http' : 'stdio',
      command: command.trim(),
      args: args.trim() ? args.trim().split(/\s+/) : [],
      url: url.trim(),
    }
    next = next.concat([rec])
    api('/api/dshmgr/mcp-save', { items: next }).then((r) => {
      setBusy(false)
      if (r && r.ok) { setForm(null); reload() }
      else alert('保存失败：' + ((r && r.error) || '未知'))
    }).catch((e) => { setBusy(false); alert('保存失败：' + String(e && e.message || e)) })
  }

  function del(id) {
    if (!confirm('删除该 MCP 服务器？')) return
    api('/api/dshmgr/mcp-save', { items: (items || []).filter((x) => x.id !== id) }).then((r) => {
      if (r && r.ok) reload()
      else alert('删除失败：' + ((r && r.error) || '未知'))
    })
  }

  return React.createElement('div', { className: 'mgr-page' },
    React.createElement('div', { className: 'mgr-sub' }, '接入外部 MCP 服务器（写入 cordis.patch.yml，修改后需重启 DSH 生效）'),
    React.createElement('div', { className: 'mgr-row' },
      React.createElement('button', { className: 'mgr-btn blue', onClick: () => openForm(null) }, '+ 添加 MCP 服务器'),
    ),
    form !== null ? React.createElement('div', { className: 'mgr-form' },
      React.createElement('div', { className: 'mgr-row' },
        React.createElement('input', { placeholder: '服务器名称 serverName（如 github）', value: name, onChange: (e) => setName(e.target.value) }),
        React.createElement('select', { value: transport, onChange: (e) => setTransport(e.target.value) },
          React.createElement('option', { value: 'stdio' }, 'stdio（本地命令）'),
          React.createElement('option', { value: 'http' }, 'streamable-http（远程）'),
        ),
      ),
      transport === 'stdio'
        ? React.createElement('div', null,
            React.createElement('div', { className: 'mgr-label' }, '启动命令（如：npx -y @modelcontextprotocol/server-github）'),
            React.createElement('div', { className: 'mgr-row' },
              React.createElement('input', { placeholder: 'npx', value: command, onChange: (e) => setCommand(e.target.value) }),
              React.createElement('input', { placeholder: '参数（空格分隔）', value: args, onChange: (e) => setArgs(e.target.value) }),
            ),
          )
        : React.createElement('div', null,
            React.createElement('div', { className: 'mgr-label' }, '服务器 URL'),
            React.createElement('div', { className: 'mgr-row' },
              React.createElement('input', { placeholder: 'http://localhost:3000/mcp', value: url, onChange: (e) => setUrl(e.target.value) }),
            ),
          ),
      React.createElement('div', { className: 'mgr-row', style: { justifyContent: 'flex-end' } },
        React.createElement('button', { className: 'mgr-btn', onClick: () => setForm(null) }, '取消'),
        React.createElement('button', { className: 'mgr-btn blue', disabled: busy, onClick: save }, busy ? '保存中…' : '保存'),
      ),
    ) : null,
    err ? React.createElement('div', { className: 'mgr-empty' }, err)
      : items === null ? React.createElement('div', { className: 'mgr-empty' }, '加载中…')
      : items.length === 0 ? React.createElement('div', { className: 'mgr-empty' }, '尚未配置 MCP 服务器')
      : React.createElement('div', { className: 'mgr-list' },
          items.map((m) => React.createElement('div', { className: 'mgr-item', key: m.id },
            React.createElement('div', null,
              React.createElement('div', { className: 'mgr-name' }, m.serverName || m.id),
              React.createElement('div', { className: 'mgr-desc' }, (m.transport === 'stdio' ? 'stdio · ' + (m.command || '') + ' ' + (m.args || []).join(' ') : 'HTTP · ' + (m.url || ''))),
            ),
            React.createElement('div', { className: 'mgr-act' },
              React.createElement('button', { className: 'mgr-btn', onClick: () => openForm(m) }, '编辑'),
              React.createElement('button', { className: 'mgr-btn danger', onClick: () => del(m.id) }, '删除'),
            ),
          )),
        ),
  )
}

// ---------- 插件市场页面 ----------
function MarketPage() {
  const [cats, setCats] = React.useState(null)
  const [cat, setCat] = React.useState('')
  const [kw, setKw] = React.useState('')
  const [installed, setInstalled] = React.useState([])
  const [tab, setTab] = React.useState('market')
  const [err, setErr] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [busyName, setBusyName] = React.useState('')

  function reloadInstalled() {
    api('/api/dshmgr/installed').then((r) => {
      if (r && r.ok) setInstalled(r.items || [])
    })
  }

  function load(force) {
    setLoading(true)
    api('/api/dshmgr/market' + (force ? '?force=1' : '')).then((r) => {
      setLoading(false)
      if (r && r.ok) {
        setCats(r.cats)
        if (!cat || !r.cats.some((c) => c.zh === cat)) setCat(r.cats.length ? r.cats[0].zh : '')
      } else setErr((r && r.error) || '加载失败')
    }).catch((e) => { setLoading(false); setErr(String(e && e.message || e)) })
  }
  React.useEffect(() => { load(false); reloadInstalled() }, [])

  function installItem(i) {
    const pkg = prompt('输入要安装的 npm 包名（默认使用仓库名）：', i.name)
    if (!pkg) return
    setBusyName(i.name)
    api('/api/dshmgr/plugin-install', { name: pkg.trim() }).then((r) => {
      setBusyName('')
      if (r && r.ok) { alert('插件已安装！重启 DSH 后生效。'); reloadInstalled() }
      else alert('安装失败：' + ((r && r.error) || '未知'))
    }).catch((e) => { setBusyName(''); alert('安装失败：' + String(e && e.message || e)) })
  }

  function uninstallItem(id) {
    if (!confirm('从 DSH 配置中移除该插件？')) return
    api('/api/dshmgr/plugin-uninstall', { id }).then((r) => {
      if (r && r.ok) { alert('已移除，重启 DSH 后生效。'); reloadInstalled() }
      else alert('移除失败：' + ((r && r.error) || '未知'))
    })
  }

  const installedNames = {}
  installed.forEach((x) => { installedNames[x.name] = true })

  const cur = cats ? cats.find((c) => c.zh === cat) : null
  let list = cur ? cur.items : []
  if (kw.trim()) {
    const k = kw.trim().toLowerCase()
    list = list.filter((i) => (i.name + ' ' + i.desc + ' ' + i.url).toLowerCase().indexOf(k) >= 0)
  }

  const marketView = React.createElement('div', null,
    React.createElement('div', { className: 'mgr-row' },
      React.createElement('input', { placeholder: '搜索插件、技能、MCP…', value: kw, onChange: (e) => setKw(e.target.value) }),
      React.createElement('button', { className: 'mgr-btn', onClick: () => load(true) }, loading ? '加载中…' : '刷新'),
    ),
    err ? React.createElement('div', { className: 'mgr-empty' }, err)
      : cats === null ? React.createElement('div', { className: 'mgr-empty' }, '加载插件市场…')
      : React.createElement('div', null,
          React.createElement('div', { className: 'mgr-cats' },
            cats.map((c) => React.createElement('span', { className: 'mgr-cat' + (c.zh === cat ? ' active' : ''), key: c.zh, onClick: () => setCat(c.zh) }, c.zh + ' (' + c.items.length + ')')),
          ),
          list.length === 0 ? React.createElement('div', { className: 'mgr-empty' }, '没有匹配的插件')
          : React.createElement('div', null,
              list.map((i) => React.createElement('div', { className: 'mgr-mk', key: i.url + i.name, onClick: () => { window.open(i.url, '_blank') } },
                React.createElement('div', { className: 'mk-name' }, i.name, installedNames[i.name] ? React.createElement('span', { className: 'mgr-tag' }, ' 已安装') : null),
                i.desc ? React.createElement('div', { className: 'mk-desc' }, i.desc) : null,
                React.createElement('div', { className: 'mk-act' },
                  React.createElement('button', { className: 'mgr-btn blue', disabled: busyName === i.name, onClick: (e) => { e.stopPropagation(); installItem(i) } }, busyName === i.name ? '安装中…' : '安装'),
                ),
              )),
            ),
        ),
  )

  const installedView = React.createElement('div', null,
    React.createElement('div', { className: 'mgr-sub' }, '当前 DSH 配置（cordis.patch.yml）中的插件条目'),
    installed.length === 0 ? React.createElement('div', { className: 'mgr-empty' }, '尚未安装任何插件')
    : React.createElement('div', { className: 'mgr-list' },
        installed.map((x) => React.createElement('div', { className: 'mgr-item', key: x.id },
          React.createElement('div', null,
            React.createElement('div', { className: 'mgr-name' }, x.name),
            React.createElement('div', { className: 'mgr-desc' }, x.id),
          ),
          React.createElement('div', { className: 'mgr-act' },
            React.createElement('button', { className: 'mgr-btn danger', onClick: () => uninstallItem(x.id) }, '删除'),
          ),
        )),
      ),
  )

  return React.createElement('div', { className: 'mgr-page' },
    React.createElement('div', { className: 'mgr-sub' }, '来自 awesome-deepseek-harness 社区精选列表；安装 = npm 安装 + 写入 cordis.patch.yml（重启后生效）'),
    React.createElement('div', { className: 'mgr-tabs' },
      React.createElement('span', { className: 'mgr-tab' + (tab === 'market' ? ' active' : ''), onClick: () => setTab('market') }, '插件市场'),
      React.createElement('span', { className: 'mgr-tab' + (tab === 'installed' ? ' active' : ''), onClick: () => setTab('installed') }, '已安装 (' + installed.length + ')'),
    ),
    tab === 'market' ? marketView : installedView,
  )
}

// ---------- 系统信息 & 更新通道页面 ----------
function SysInfoPage() {
  const [info, setInfo] = React.useState(null)
  const [check, setCheck] = React.useState(null)
  const [busy, setBusy] = React.useState('')
  const [err, setErr] = React.useState('')

  function loadInfo() {
    api('/api/dshmgr/system-info').then((r) => {
      if (r && r.ok) setInfo(r)
      else setErr((r && r.error) || '加载失败')
    }).catch((e) => setErr(String(e && e.message || e)))
  }
  React.useEffect(() => { loadInfo() }, [])

  function doCheck(force) {
    setBusy('check'); setErr('')
    api('/api/dshmgr/update-check' + (force ? '?force=1' : '')).then((r) => {
      setBusy('')
      if (r && r.ok) setCheck(r)
      else setErr((r && r.error) || '检查失败')
    }).catch((e) => { setBusy(''); setErr(String(e && e.message || e)) })
  }
  React.useEffect(() => { doCheck(false) }, [])

  function doUpdate() {
    if (!confirm('开始更新 DeepSeek Harness 核心（npm @deepseek-ai/dsh@latest）？\n更新在后台进行，完成后请重启客户端生效。')) return
    setBusy('update'); setErr('')
    api('/api/dshmgr/update-dsh', {}).then((r) => {
      setBusy('')
      if (r && r.ok) alert('更新已在后台启动！\n稍后到「系统信息」重新检查版本；完成后重启蓝色大肥鱼DSH.exe 生效。\n日志：' + (r.log || ''))
      else alert('启动更新失败：' + ((r && r.error) || '未知'))
    }).catch((e) => { setBusy(''); alert('启动更新失败：' + String(e && e.message || e)) })
  }

  const Row = (label, value) => React.createElement('div', { className: 'mgr-item' },
    React.createElement('div', null,
      React.createElement('div', { className: 'mgr-name' }, label),
      React.createElement('div', { className: 'mgr-desc' }, String(value == null ? '—' : value)),
    ),
  )

  const hasUpd = check && check.hasUpdate
  const latestLabel = check && check.npm ? check.npm.latest : '—'

  return React.createElement('div', { className: 'mgr-page' },
    React.createElement('div', { className: 'mgr-sub' }, '当前系统与 DeepSeek Harness 核心版本信息（来源：npm registry @deepseek-ai/dsh 与 GitHub）'),
    info ? React.createElement('div', { className: 'mgr-list' },
      Row('DSH 核心版本（DeepSeek Harness）', info.dshVersion),
      Row('客户端版本（懒人客户端）', info.clientVersion),
      Row('Node.js 版本', info.node),
      Row('平台架构', info.platform),
      Row('服务端口', 'http://127.0.0.1:' + (info.port || '?')) ,
      Row('客户端安装位置', info.clientRoot),
    ) : React.createElement('div', { className: 'mgr-empty' }, '加载系统信息…'),
    err ? React.createElement('div', { className: 'mgr-empty' }, err) : null,
    React.createElement('div', { className: 'mgr-form', style: { marginTop: 14 } },
      React.createElement('div', { className: 'mgr-name', style: { marginBottom: 8 } }, '更新通道'),
      React.createElement('div', { className: 'mgr-desc', style: { marginBottom: 10 } },
        check && check.npm
          ? (hasUpd
              ? '检测到新版本：' + latestLabel + '（当前 ' + check.current + '）' + (check.npm.published ? '，发布于 ' + String(check.npm.published).slice(0, 10) : '')
              : '已是最新版本：' + latestLabel)
          : check ? '无法获取 npm 最新版本（网络或代理问题），可稍后重试。' : '查询 npm 最新版本…',
      ),
      React.createElement('div', { className: 'mgr-row' },
        React.createElement('button', { className: 'mgr-btn', disabled: busy !== '', onClick: () => doCheck(true) }, busy === 'check' ? '检查中…' : '检查更新'),
        React.createElement('button', { className: 'mgr-btn blue', disabled: busy !== '' || !hasUpd, onClick: doUpdate }, busy === 'update' ? '启动中…' : '立即更新'),
      ),
      React.createElement('div', { className: 'mgr-desc', style: { marginTop: 8 } },
        '更新命令：npm install @deepseek-ai/dsh@latest（npmmirror 镜像，自动回退官方源），更新后重启客户端生效。',
      ),
      check && check.github ? React.createElement('div', { className: 'mgr-desc', style: { marginTop: 6 } },
        '客户端仓库最新版：', check.github.tag,
        '（', String(check.github.published || '').slice(0, 10), '）',
        React.createElement('button', { className: 'mgr-btn', style: { marginLeft: 8, padding: '2px 8px' }, onClick: () => window.open(check.github.url, '_blank') }, '查看'),
      ) : null,
    ),
  )
}

function apply(ctx) {
  injectCss()
  const slots = ctx.get('slots')
  if (slots === undefined) return

  slots.inject('settings.section', () => slots.register(
    { name: 'settings.section', id: 'dshmgr-skills', order: 30, label: 'Skills 管理' },
    () => React.createElement(SkillsPage),
  ))
  slots.inject('settings.section', () => slots.register(
    { name: 'settings.section', id: 'dshmgr-mcp', order: 40, label: 'MCP 服务器' },
    () => React.createElement(McpPage),
  ))
  slots.inject('settings.section', () => slots.register(
    { name: 'settings.section', id: 'dshmgr-market', order: 50, label: '插件市场' },
    () => React.createElement(MarketPage),
  ))
  slots.inject('settings.section', () => slots.register(
    { name: 'settings.section', id: 'dshmgr-sysinfo', order: 60, label: '系统信息' },
    () => React.createElement(SysInfoPage),
  ))
}

    exports.apply = apply;
    exports.inject = ['slots'];
    return module.exports;
  },
});
