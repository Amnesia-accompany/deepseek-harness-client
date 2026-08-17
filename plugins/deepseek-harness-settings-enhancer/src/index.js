// ============================================================
//  DeepSeek Harness 设置增强 - Host 半
//  在 DSH 自带设置中提供：Skills 列表 / MCP 配置读写 / 插件市场
//  通过 webServer 注册 /api/dshmgr/* HTTP 路由供 Client 调用
// ============================================================
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import https from 'node:https'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let YAML = null
try { YAML = require('js-yaml') } catch (e) { /* js-yaml 未安装 */ }

// ---------- 插件市场分类映射 ----------
const catMap = {
  'Official': '官方', 'Profiles & Patch Layers': '配置方案', 'Harnesses & Runtimes': '运行时',
  'Security & Permissions': '安全与权限', 'Session & Memory Management': '会话与记忆',
  'Cost & Usage Tracking': '用量与计费', 'Channel / IM Bridges': '消息与接入',
  'Plugin Marketplaces & Ecosystem': '插件市场', 'Visualization': '可视化',
  'Slides / PPT': '演示文稿', 'Coding': '编程开发', 'Agents': '智能体',
  'Loops (Auto-Research, Self-Improve, etc.)': '自动化循环', 'MCP Servers': 'MCP 服务器',
  'Orchestrators & Aggregators': '编排与聚合', 'UI / Clients': '界面与客户端',
  'Skills': '技能', 'Resources': '资源',
}

function parseAwesome(md) {
  const cats = []
  let cur = null
  for (const line of String(md).split(/\r?\n/)) {
    const h = line.match(/^## (.+)$/)
    if (h) {
      const en = h[1].trim()
      cur = catMap[en] ? { zh: catMap[en], items: [] } : null
      if (cur) cats.push(cur)
      continue
    }
    if (!cur) continue
    const m = line.match(/^\s*-\s*\[([^\]]+)\]\(([^)]+)\)\s*[-–—]?\s*(.*)$/)
    if (m) {
      cur.items.push({ name: m[1].trim(), url: m[2].trim(), desc: (m[3] || '').trim().replace(/\s+/g, ' ').slice(0, 220) })
    }
  }
  return cats.filter((c) => c.items.length)
}

// ---------- MCP 配置定位 ----------
function profilePatchFile() {
  const pd = path.join(os.homedir(), '.dsh', 'profiles')
  try {
    for (const d of fs.readdirSync(pd)) {
      const f = path.join(pd, d, 'cordis.patch.yml')
      if (fs.existsSync(f)) return f
    }
  } catch (e) { }
  return null
}

function readMcpItems() {
  const pf = profilePatchFile()
  if (!pf || !YAML) return { file: pf, items: [] }
  let data
  try { data = YAML.load(fs.readFileSync(pf, 'utf8').replace(/^\uFEFF/, '')) } catch (e) { return { file: pf, items: [], error: String(e.message || e) } }
  const arr = Array.isArray(data) ? data : []
  const items = arr.filter((p) => p && p.name === '@deepseek-ai/dsh-mcp-client').map((p) => ({
    id: p.id,
    serverName: (p.config || {}).serverName,
    transport: (p.config || {}).transport,
    command: (p.config || {}).command,
    args: (p.config || {}).args || [],
    url: (p.config || {}).url,
  }))
  return { file: pf, items }
}

function writeMcpItems(items) {
  const pf = profilePatchFile()
  if (!pf || !YAML) return { ok: false, error: '未找到 DSH 配置或 js-yaml 未安装' }
  let data
  try { data = YAML.load(fs.readFileSync(pf, 'utf8').replace(/^\uFEFF/, '')) } catch (e) { return { ok: false, error: '无法解析现有配置：' + String(e.message || e) } }
  const arr = (Array.isArray(data) ? data : []).filter((p) => !(p && p.name === '@deepseek-ai/dsh-mcp-client'))
  for (const m of items) {
    const config = { serverName: m.serverName, transport: m.transport }
    if (m.transport === 'stdio') {
      config.command = m.command
      if (m.args && m.args.length) config.args = m.args
    } else {
      config.url = m.url
    }
    arr.push({ id: m.id, name: '@deepseek-ai/dsh-mcp-client', config })
  }
  try {
    fs.writeFileSync(pf, YAML.dump(arr, { lineWidth: 120 }), 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e.message || e) }
  }
}

// ---------- 插件市场数据（GitHub，10 分钟缓存） ----------
let marketCache = null
let marketCacheAt = 0

function fetchMarket(force) {
  return new Promise((resolve) => {
    if (marketCache && Date.now() - marketCacheAt < 600000 && !force) {
      resolve({ ok: true, cached: true, cats: marketCache })
      return
    }
    const req = https.get('https://api.github.com/repos/Dominic789654/awesome-deepseek-harness/readme', {
      headers: { 'User-Agent': 'deepseek-harness-settings-enhancer' },
      timeout: 12000,
    }, (res) => {
      let body = ''
      res.on('data', (d) => { body += d; if (body.length > 2 * 1024 * 1024) req.destroy() })
      res.on('end', () => {
        try {
          const j = JSON.parse(body)
          if (!j.content) { resolve({ ok: false, error: '获取插件列表失败（' + (j.message || '未知') + '）' }); return }
          const md = Buffer.from(String(j.content).replace(/\s/g, ''), 'base64').toString('utf8')
          marketCache = parseAwesome(md)
          marketCacheAt = Date.now()
          resolve({ ok: true, cached: false, cats: marketCache })
        } catch (e) { resolve({ ok: false, error: '解析插件列表失败' }) }
      })
      res.on('error', () => resolve({ ok: false, error: '网络错误' }))
    })
    req.on('error', () => resolve({ ok: false, error: '无法连接 GitHub（请检查网络或代理）' }))
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: '请求超时' }) })
  })
}

// ---------- HTTP 工具 ----------
function json(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve) => {
    let chunks = ''
    req.on('data', (d) => { chunks += d; if (chunks.length > 2 * 1024 * 1024) req.destroy() })
    req.on('end', () => resolve(chunks))
    req.on('error', () => resolve(''))
  })
}

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (webServer === undefined) return

  // Skills 列表（DSH 原生 skills 服务）
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/dshmgr/skills',
    handler: async (req, res) => {
      const skills = ctx.get('skills')
      if (skills === undefined) { json(res, { ok: false, error: 'skills 服务不可用' }); return }
      try {
        const list = await skills.list()
        json(res, {
          ok: true,
          items: (list || []).map((s) => ({ name: s.name, desc: (s.description || s.title || '').slice(0, 160) })),
        })
      } catch (e) {
        json(res, { ok: false, error: String((e && e.message) || e) })
      }
    },
  }))

  // MCP 列表
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/dshmgr/mcp',
    handler: async (req, res) => {
      const r = readMcpItems()
      if (r.error) json(res, { ok: false, error: r.error })
      else json(res, { ok: true, file: r.file, items: r.items })
    },
  }))

  // MCP 保存 / 删除（POST body: { items: [...] }）
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/dshmgr/mcp-save',
    handler: async (req, res) => {
      const body = await readBody(req)
      let payload
      try { payload = JSON.parse(body) } catch (e) { json(res, { ok: false, error: '请求体不合法' }); return }
      if (!payload || !Array.isArray(payload.items)) { json(res, { ok: false, error: '参数不合法' }); return }
      json(res, writeMcpItems(payload.items))
    },
  }))

  // 插件市场（GET ?force=1 强制刷新）
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/dshmgr/market',
    handler: async (req, res) => {
      const force = /[?&]force=1/.test(req.url || '')
      json(res, await fetchMarket(force))
    },
  }))

  // ---------- 已安装插件列表（cordis.patch.yml 全部条目） ----------
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/dshmgr/installed',
    handler: async (req, res) => {
      const pf = profilePatchFile()
      if (!pf || !YAML) { json(res, { ok: true, items: [] }); return }
      try {
        const data = YAML.load(fs.readFileSync(pf, 'utf8').replace(/^\uFEFF/, ''))
        const arr = Array.isArray(data) ? data : []
        json(res, { ok: true, items: arr.map((p) => ({ id: p && p.id, name: p && p.name })) })
      } catch (e) {
        json(res, { ok: false, error: String(e.message || e) })
      }
    },
  }))

  // ---------- 安装插件：npm install + patch 添加条目 ----------
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/dshmgr/plugin-install',
    handler: async (req, res) => {
      const body = await readBody(req)
      let payload
      try { payload = JSON.parse(body) } catch (e) { json(res, { ok: false, error: '请求体不合法' }); return }
      const name = payload && payload.name ? String(payload.name).trim() : ''
      if (!name) { json(res, { ok: false, error: '缺少包名' }); return }
      const { execSync } = await import('node:child_process')
      const pd = path.join(os.homedir(), '.dsh', 'profiles')
      try {
        // 同时安装 js-yaml，防止 npm 清理不在 package.json 中的依赖
        execSync('npm install --no-save --no-package-lock ' + JSON.stringify(name) + ' js-yaml@^4.1.0', { cwd: pd, stdio: 'pipe', timeout: 120000 })
      } catch (e) {
        const msg = String((e.stderr || e.message || '')).slice(0, 400)
        json(res, { ok: false, error: 'npm 安装失败：' + msg })
        return
      }
      const pf = profilePatchFile()
      if (pf && YAML) {
        try {
          let data
          try { data = YAML.load(fs.readFileSync(pf, 'utf8').replace(/^\uFEFF/, '')) } catch (e) { data = [] }
          const arr = Array.isArray(data) ? data : []
          if (!arr.some((p) => p && p.name === name)) {
            const id = 'plug-' + name.replace(/[^a-z0-9_-]/gi, '').toLowerCase().slice(0, 20) + '-' + Math.random().toString(36).slice(2, 6)
            arr.push({ id, name })
            fs.writeFileSync(pf, YAML.dump(arr, { lineWidth: 120 }), 'utf8')
          }
        } catch (e) {
          json(res, { ok: false, error: '写入配置失败：' + String(e.message || e) })
          return
        }
      }
      json(res, { ok: true, restart: true })
    },
  }))

  // ---------- 卸载插件：patch 移除条目（不删 npm 包） ----------
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/dshmgr/plugin-uninstall',
    handler: async (req, res) => {
      const body = await readBody(req)
      let payload
      try { payload = JSON.parse(body) } catch (e) { json(res, { ok: false, error: '请求体不合法' }); return }
      const id = payload && payload.id ? String(payload.id).trim() : ''
      if (!id) { json(res, { ok: false, error: '缺少插件 id' }); return }
      const pf = profilePatchFile()
      if (!pf || !YAML) { json(res, { ok: false, error: '未找到 DSH 配置' }); return }
      try {
        let data
        try { data = YAML.load(fs.readFileSync(pf, 'utf8').replace(/^\uFEFF/, '')) } catch (e) { data = [] }
        const arr = (Array.isArray(data) ? data : []).filter((p) => !(p && p.id === id))
        fs.writeFileSync(pf, YAML.dump(arr, { lineWidth: 120 }), 'utf8')
        json(res, { ok: true, restart: true })
      } catch (e) {
        json(res, { ok: false, error: String(e.message || e) })
      }
    },
  }))
}
