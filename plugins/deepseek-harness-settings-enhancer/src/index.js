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
      cur.items.push({ name: m[1].trim(), url: m[2].trim(), desc: translateDesc((m[3] || '').trim().replace(/\s+/g, ' ').slice(0, 220)) })
    }
  }
  return cats.filter((c) => c.items.length)
}

// ---------- 简介本地汉化（词表映射，专有名词/URL 保留） ----------
const TRANS = {
  // 动词
  build: '构建', create: '创建', manage: '管理', automate: '自动化', connect: '连接', integrate: '集成',
  monitor: '监控', track: '跟踪', optimize: '优化', improve: '改进', enhance: '增强', simplify: '简化',
  accelerate: '加速', boost: '提升', organize: '组织', control: '控制', convert: '转换', generate: '生成',
  parse: '解析', render: '渲染', export: '导出', import: '导入', sync: '同步', backup: '备份',
  restore: '恢复', install: '安装', configure: '配置', deploy: '部署', run: '运行', test: '测试',
  analyze: '分析', visualize: '可视化', transform: '转换', process: '处理', handle: '处理', support: '支持',
  provide: '提供', offer: '提供', help: '帮助', enable: '启用', allow: '允许', make: '制作', use: '使用',
  using: '使用', used: '使用', made: '制作', get: '获取', see: '查看', look: '查看', let: '让',
  // 名词
  plugin: '插件', plugins: '插件', skill: '技能', skills: '技能', tool: '工具', tools: '工具',
  agent: '智能体', agents: '智能体', server: '服务器', servers: '服务器', client: '客户端', clients: '客户端',
  framework: '框架', library: '库', package: '包', module: '模块', extension: '扩展', extensions: '扩展',
  app: '应用', apps: '应用', application: '应用', applications: '应用', project: '项目', projects: '项目',
  workspace: '工作区', file: '文件', files: '文件', folder: '文件夹', folders: '文件夹', directory: '目录',
  data: '数据', model: '模型', models: '模型', prompt: '提示词', prompts: '提示词', context: '上下文',
  token: '令牌', tokens: '令牌', cost: '成本', usage: '用量', session: '会话', sessions: '会话',
  memory: '记忆', conversation: '对话', chat: '聊天', chatbot: '聊天机器人', assistant: '助手',
  terminal: '终端', command: '命令', commands: '命令', workflow: '工作流', workflows: '工作流',
  pipeline: '流水线', pipelines: '流水线', job: '任务', jobs: '任务', task: '任务', tasks: '任务',
  queue: '队列', event: '事件', events: '事件', endpoint: '端点', endpoints: '端点', auth: '认证',
  security: '安全', permission: '权限', permissions: '权限', sandbox: '沙箱', profile: '配置文件',
  profiles: '配置文件', layer: '层', layers: '层', patch: '补丁', bundle: '包', runtime: '运行时',
  ecosystem: '生态', marketplace: '市场', market: '市场', list: '列表', collection: '合集', suite: '套件',
  kit: '工具包', manager: '管理器', management: '管理', analyzer: '分析器', generator: '生成器',
  generators: '生成器', renderer: '渲染器', viewer: '查看器', editor: '编辑器', browser: '浏览器',
  addon: '附加组件', theme: '主题', icon: '图标', icons: '图标', sidebar: '侧边栏', panel: '面板',
  shortcut: '快捷键', hotkey: '热键', code: '代码', script: '脚本', scripts: '脚本', source: '源码',
  binary: '二进制', release: '发布', releases: '发布', version: '版本', versions: '版本', update: '更新',
  updates: '更新', upgrade: '升级', migration: '迁移', migrator: '迁移器', translator: '翻译器',
  translators: '翻译器', adapter: '适配器', bridge: '桥接', gateway: '网关', proxy: '代理',
  router: '路由器', middleware: '中间件', backend: '后端', frontend: '前端', database: '数据库',
  db: '数据库', cache: '缓存', store: '存储', storage: '存储', index: '索引', indexing: '索引',
  search: '搜索', searcher: '搜索器', crawler: '爬虫', scraper: '爬虫', parser: '解析器',
  formatter: '格式化器', linter: '代码检查器', compiler: '编译器', bundler: '打包器', testing: '测试',
  coverage: '覆盖率', benchmark: '基准测试', profiler: '性能分析器', profiling: '性能分析',
  logging: '日志', logger: '日志器', metrics: '指标', monitoring: '监控', alert: '告警', alerts: '告警',
  notification: '通知', notifications: '通知', webhook: '回调钩子', webhooks: '回调钩子', hook: '钩子',
  hooks: '钩子', trigger: '触发器', triggers: '触发器', action: '操作', actions: '操作',
  function: '函数', functions: '函数', service: '服务', services: '服务', account: '账户', accounts: '账户',
  user: '用户', users: '用户', team: '团队', teams: '团队', community: '社区', developer: '开发者',
  developers: '开发者', engineer: '工程师', engineers: '工程师', admin: '管理员', admins: '管理员',
  operator: '运维', operators: '运维', repo: '仓库', repos: '仓库', issue: '问题', issues: '问题',
  guide: '指南', tutorial: '教程', docs: '文档', doc: '文档', document: '文档', documents: '文档',
  example: '示例', examples: '示例', template: '模板', starter: '脚手架', boilerplate: '模板工程',
  // 形容词
  easy: '简单', easily: '轻松地', simple: '简单', powerful: '强大', lightweight: '轻量', full: '完整',
  'open-source': '开源', free: '免费', 'cross-platform': '跨平台', custom: '自定义', customizable: '可自定义',
  extendable: '可扩展', extensible: '可扩展', flexible: '灵活', modern: '现代', advanced: '高级',
  smart: '智能', intelligent: '智能', secure: '安全', 'real-time': '实时', streaming: '流式',
  interactive: '交互式', native: '原生', official: '官方', popular: '流行', best: '最佳', awesome: '精选',
  automated: '自动化', automatic: '自动', autonomous: '自主', 'self-hosted': '自托管', hosted: '托管',
  local: '本地', remote: '远程', cloud: '云端', unified: '统一', 'one-stop': '一站式',
  'all-in-one': '一体化', fast: '快速', quick: '快速', quickly: '快速地', safe: '安全', reliable: '可靠',
  robust: '健壮', scalable: '可扩展', efficient: '高效', effective: '有效', productive: '高效',
  convenient: '方便', useful: '有用', practical: '实用', portable: '便携', compatible: '兼容',
  private: '私有', public: '公开', shared: '共享', collaborative: '协作', open: '开放', closed: '封闭',
  experimental: '实验性', beta: '测试版', stable: '稳定', 'production-ready': '生产就绪', ready: '就绪',
  'built-in': '内置', builtin: '内置', integrated: '集成', standalone: '独立', minimal: '极简',
  minimalist: '极简', small: '小巧', compact: '紧凑', clean: '整洁', beautiful: '美观', nice: '不错',
  great: '很棒', excellent: '优秀', amazing: '惊人', impressive: '令人印象深刻', quality: '质量',
  high: '高', low: '低', multi: '多', micro: '微', mini: '迷你', auto: '自动', first: '首个',
  next: '下一个', last: '最后', new: '新', old: '旧', top: '顶级', based: '基于', powered: '驱动',
  driven: '驱动', focused: '专注', oriented: '面向', friendly: '友好',
  // 虚词/连接
  of: '的', for: '用于', with: '支持', and: '和', to: '用于', in: '在', on: '在', your: '你的',
  you: '你', more: '更多', most: '最', only: '仅', very: '非常', also: '还', even: '甚至',
  just: '只是', still: '仍然', about: '关于', after: '之后', before: '之前', into: '到', from: '从',
  by: '由', at: '在', as: '作为', or: '或', but: '但', so: '所以', because: '因为', while: '同时',
  when: '当', where: '其中', how: '如何', what: '什么', which: '哪个', who: '谁', it: '它',
  its: '它的', them: '它们', they: '它们', we: '我们', our: '我们的', is: '是', are: '是', be: '是',
  was: '曾是', were: '曾是', have: '有', has: '有', can: '可以', could: '可以', will: '将',
  would: '会', should: '应该', may: '可能', must: '必须', not: '不', no: '无', yes: '是', do: '做',
  does: '做', go: '去', all: '所有', any: '任何', some: '一些', many: '许多', much: '许多',
  // 技术名词（保留原文但给中文标注）
  ui: 'UI', ux: 'UX', cli: '命令行', sdk: '开发包', ide: 'IDE', api: '接口', ai: 'AI',
  llm: '大模型', rag: 'RAG', mcp: 'MCP', dsh: 'DSH', git: 'Git', pr: 'PR', ci: 'CI', cd: 'CD',
  web: '网页', url: 'URL', json: 'JSON', yaml: 'YAML', xml: 'XML', csv: 'CSV', pdf: 'PDF',
  md: 'Markdown', markdown: 'Markdown', html: 'HTML', css: 'CSS', js: 'JS', ts: 'TS',
  python: 'Python', java: 'Java', go: 'Go', rust: 'Rust', ruby: 'Ruby', php: 'PHP',
  swift: 'Swift', kotlin: 'Kotlin', shell: 'Shell', bash: 'Bash', sql: 'SQL', nosql: 'NoSQL',
  redis: 'Redis', postgres: 'PostgreSQL', postgresql: 'PostgreSQL', mysql: 'MySQL',
  mongo: 'MongoDB', mongodb: 'MongoDB', sqlite: 'SQLite', docker: 'Docker',
  kubernetes: 'Kubernetes', k8s: 'K8s', linux: 'Linux', windows: 'Windows', macos: 'macOS',
  ios: 'iOS', android: 'Android', chrome: 'Chrome', firefox: 'Firefox', edge: 'Edge',
  vscode: 'VS Code', jetbrains: 'JetBrains', vim: 'Vim', neovim: 'Neovim', emacs: 'Emacs',
  figma: 'Figma', notion: 'Notion', obsidian: 'Obsidian', logseq: 'Logseq', slack: 'Slack',
  discord: 'Discord', telegram: 'Telegram', whatsapp: 'WhatsApp', wechat: '微信', teams: 'Teams',
  zoom: 'Zoom', office: 'Office', word: 'Word', excel: 'Excel', powerpoint: 'PowerPoint',
  google: 'Google', apple: 'Apple', amazon: 'Amazon', aws: 'AWS', azure: 'Azure', gcp: 'GCP',
  vercel: 'Vercel', netlify: 'Netlify', heroku: 'Heroku', firebase: 'Firebase', supabase: 'Supabase',
  grafana: 'Grafana', prometheus: 'Prometheus', sentry: 'Sentry', jira: 'Jira', trello: 'Trello',
  asana: 'Asana', airtable: 'Airtable', chatgpt: 'ChatGPT', claude: 'Claude',
  gemini: 'Gemini', llama: 'Llama', mistral: 'Mistral', deepseek: 'DeepSeek', openai: 'OpenAI',
  anthropic: 'Anthropic', ollama: 'Ollama', gpt: 'GPT', whisper: 'Whisper', tts: 'TTS', stt: 'STT',
  nlp: 'NLP', ocr: 'OCR', embedding: '嵌入', embeddings: '嵌入', vector: '向量', vectors: '向量',
  semantic: '语义', text: '文本', image: '图像', images: '图像', video: '视频', audio: '音频',
  voice: '语音', speech: '语音', language: '语言', translation: '翻译', translate: '翻译',
}

function translateDesc(desc) {
  if (!desc) return desc
  return String(desc).replace(/(https?:\/\/[^\s]+|[A-Za-z][A-Za-z0-9_-]*)/g, (word) => {
    const t = TRANS[word.toLowerCase()]
    return t || word
  })
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

// ---------- 插件市场数据（GitHub，10 分钟内存缓存 + 7 天磁盘缓存） ----------
let marketCache = null
let marketCacheAt = 0
const MARKET_CACHE_FILE = path.join(os.homedir(), '.dsh', '.dshmgr-market-cache.json')
const MARKET_CACHE_TTL = 7 * 24 * 3600 * 1000

function loadDiskCache() {
  try {
    if (!fs.existsSync(MARKET_CACHE_FILE)) return null
    const j = JSON.parse(fs.readFileSync(MARKET_CACHE_FILE, 'utf8'))
    if (j && Array.isArray(j.cats) && j.at && Date.now() - j.at < MARKET_CACHE_TTL) return j.cats
  } catch (e) { }
  return null
}

function saveDiskCache(cats) {
  try {
    fs.writeFileSync(MARKET_CACHE_FILE, JSON.stringify({ at: Date.now(), cats }), 'utf8')
  } catch (e) { }
}

function fetchMarket(force) {
  return new Promise((resolve) => {
    if (marketCache && Date.now() - marketCacheAt < 600000 && !force) {
      resolve({ ok: true, cached: true, cats: marketCache })
      return
    }
    const fallback = (reason) => {
      const disk = loadDiskCache()
      if (disk) {
        marketCache = disk
        marketCacheAt = Date.now()
        resolve({ ok: true, cached: true, fromDisk: true, cats: disk })
      } else {
        resolve({ ok: false, error: reason || '无法连接 GitHub（请检查网络或代理）' })
      }
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
          if (!j.content) { fallback('获取插件列表失败（' + (j.message || '未知') + '）'); return }
          const md = Buffer.from(String(j.content).replace(/\s/g, ''), 'base64').toString('utf8')
          marketCache = parseAwesome(md)
          marketCacheAt = Date.now()
          saveDiskCache(marketCache)
          resolve({ ok: true, cached: false, cats: marketCache })
        } catch (e) { fallback('解析插件列表失败') }
      })
      res.on('error', () => fallback('网络错误'))
    })
    req.on('error', () => fallback('无法连接 GitHub（请检查网络或代理）'))
    req.on('timeout', () => { req.destroy(); fallback('请求超时') })
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

// ---------- patch 条目工具（展开 insert 块） ----------
function flattenPatch(arr) {
  const items = []
  for (const p of Array.isArray(arr) ? arr : []) {
    if (p && Array.isArray(p.insert)) {
      for (const q of p.insert) items.push({ id: q && q.id, name: q && q.name })
    } else if (p) {
      items.push({ id: p.id, name: p.name })
    }
  }
  return items
}

function hasPatchName(arr, name) {
  return flattenPatch(arr).some((x) => x.name === name)
}

function removePatchId(arr, id) {
  const out = []
  for (const p of Array.isArray(arr) ? arr : []) {
    if (p && Array.isArray(p.insert)) {
      const rest = p.insert.filter((q) => !(q && q.id === id))
      if (rest.length) out.push({ insert: rest })
    } else if (!(p && p.id === id)) {
      out.push(p)
    }
  }
  return out
}

function addPatchItem(arr, item) {
  const out = Array.isArray(arr) ? arr.slice() : []
  const ins = out.find((p) => p && Array.isArray(p.insert))
  if (ins) ins.insert.push(item)
  else out.push({ insert: [item] })
  return out
}

export const inject = ['webServer']

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
        json(res, { ok: true, items: flattenPatch(data) })
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
          if (!hasPatchName(data, name)) {
            const id = 'plug-' + name.replace(/[^a-z0-9_-]/gi, '').toLowerCase().slice(0, 20) + '-' + Math.random().toString(36).slice(2, 6)
            fs.writeFileSync(pf, YAML.dump(addPatchItem(data, { id, name }), { lineWidth: 120 }), 'utf8')
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
        fs.writeFileSync(pf, YAML.dump(removePatchId(data, id), { lineWidth: 120 }), 'utf8')
        json(res, { ok: true, restart: true })
      } catch (e) {
        json(res, { ok: false, error: String(e.message || e) })
      }
    },
  }))
}
