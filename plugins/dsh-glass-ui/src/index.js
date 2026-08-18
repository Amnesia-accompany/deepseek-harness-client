// ============================================================
//  DeepSeek Harness 玻璃拟态 - Host 半
//  配置读写 / Wallpaper Engine 壁纸扫描 / 壁纸文件路由
// ============================================================
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import https from 'node:https'
import { execSync } from 'node:child_process'

const CFG_FILE = path.join(os.homedir(), '.dsh', 'dshmgr-glass.json')
const CACHE_DIR = path.join(os.homedir(), '.dsh', 'dshmgr-wallpaper-cache')
const DEFAULT_CFG = { mode: 'compat', blur: 18, frost: 60, bg: 'fluid', wallpaper: '', wallpaperKind: '', wallpaperDir: '' }

function readCfg() {
  try {
    if (!fs.existsSync(CFG_FILE)) return { ...DEFAULT_CFG }
    const j = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'))
    return { ...DEFAULT_CFG, ...(j && typeof j === 'object' ? j : {}) }
  } catch (e) { return { ...DEFAULT_CFG } }
}

function writeCfg(cfg) {
  try {
    fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2), 'utf8')
    return true
  } catch (e) { return false }
}

// ---------- Wallpaper Engine 壁纸目录探测 ----------
function steamRoots() {
  const roots = []
  try {
    const out = execSync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', {
      encoding: 'utf8', timeout: 5000, windowsHide: true,
    })
    const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/i)
    if (m) {
      const sp = m[1].trim()
      roots.push(path.join(sp, 'steamapps', 'workshop', 'content', '431960'))
      roots.push(path.join(sp, 'steamapps', 'common', 'wallpaper_engine', 'projects', 'myprojects'))
    }
  } catch (e) { }
  return roots
}

function wallpaperRoots() {
  const home = os.homedir()
  const roots = []
  roots.push(path.join(home, 'Documents', 'Wallpaper Engine', 'wallpapers'))
  roots.push(path.join(home, 'Documents', 'Wallpaper Engine', 'projects'))
  for (const r of steamRoots()) roots.push(r)
  const pf = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
  roots.push(path.join(pf, 'Steam', 'steamapps', 'workshop', 'content', '431960'))
  return roots
}

function readProjectMeta(dir) {
  try {
    const f = path.join(dir, 'project.json')
    if (!fs.existsSync(f)) return null
    const j = JSON.parse(fs.readFileSync(f, 'utf8'))
    return j
  } catch (e) { return null }
}

function findPreview(dir, meta) {
  const candidates = []
  if (meta && typeof meta.preview === 'string' && meta.preview) {
    candidates.push(path.join(dir, meta.preview))
  }
  candidates.push(
    path.join(dir, 'preview.jpg'), path.join(dir, 'preview.jpeg'),
    path.join(dir, 'preview.png'), path.join(dir, 'preview.webp'),
    path.join(dir, 'preview.mp4'), path.join(dir, 'preview.gif'),
  )
  for (const f of candidates) {
    try { if (fs.statSync(f).isFile()) return f } catch (e) { }
  }
  try {
    for (const f of fs.readdirSync(dir)) {
      if (/\.(jpe?g|png|webp|gif|mp4)$/i.test(f)) {
        const full = path.join(dir, f)
        try { if (fs.statSync(full).isFile()) return full } catch (e) { }
      }
    }
  } catch (e) { }
  return null
}

function scanWallpapers() {
  const items = []
  const seen = new Set()
  for (const root of wallpaperRoots()) {
    if (!fs.existsSync(root)) continue
    let entries
    try { entries = fs.readdirSync(root) } catch (e) { continue }
    for (const d of entries) {
      const dir = path.join(root, d)
      try { if (!fs.statSync(dir).isDirectory()) continue } catch (e) { continue }
      const meta = readProjectMeta(dir)
      const preview = findPreview(dir, meta)
      if (!preview) continue
      const key = dir.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      // 背景源：目录内独立视频优先（高清），否则用预览图
      let source = preview
      let kind = /\.mp4$/i.test(preview) ? 'video' : 'image'
      try {
        const videos = fs.readdirSync(dir).filter((f) => /\.mp4$/i.test(f))
        if (videos.length) {
          videos.sort((a, b) => {
            try { return fs.statSync(path.join(dir, b)).size - fs.statSync(path.join(dir, a)).size } catch (e) { return 0 }
          })
          source = path.join(dir, videos[0])
          kind = 'video'
        }
      } catch (e) { }
      items.push({
        name: (meta && meta.title) || d,
        dir,
        preview,
        source,
        kind,
        w: (getImageSize(preview) || {}).w || 0,
        h: (getImageSize(preview) || {}).h || 0,
      })
    }
  }
  items.sort((a, b) => a.name.localeCompare(b.name))
  return items
}

// ---------- Steam Workshop 高清预览下载（缓存到本地，失败重试一次） ----------
function fetchSteamPreview(id) {
  return new Promise((resolve) => {
    const cached = path.join(CACHE_DIR, id + '.jpg')
    if (fs.existsSync(cached)) { resolve(cached); return }
    const attempt = (round) => {
      const body = 'itemcount=1&publishedfileids[0]=' + encodeURIComponent(id)
      const req = https.request({
        host: 'api.steampowered.com',
        path: '/ISteamRemoteStorage/GetPublishedFileDetails/v1/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 15000,
      }, (res) => {
        let data = ''
        res.on('data', (d) => { data += d; if (data.length > 2 * 1024 * 1024) req.destroy() })
        res.on('end', () => {
          try {
            const j = JSON.parse(data)
            const list = j.response && j.response.publishedfiledetails
            const url = list && list[0] && list[0].preview_url
            if (!url) { resolve(null); return }
            const imgReq = https.get(url, { timeout: 120000 }, (ir) => {
              if (ir.statusCode !== 200) { resolve(null); return }
              const chunks = []
              ir.on('data', (d) => { chunks.push(d); if (chunks.length > 80 * 1024 * 1024) imgReq.destroy() })
              ir.on('end', () => {
                try {
                  fs.mkdirSync(CACHE_DIR, { recursive: true })
                  fs.writeFileSync(cached, Buffer.concat(chunks))
                  resolve(cached)
                } catch (e) { resolve(null) }
              })
              ir.on('error', () => resolve(null))
            })
            imgReq.on('error', () => resolve(null))
          } catch (e) { resolve(null) }
        })
        res.on('error', () => resolve(null))
      })
      req.on('error', () => {
        if (round < 1) attempt(round + 1)
        else resolve(null)
      })
      req.on('timeout', () => { req.destroy(); resolve(null) })
      req.end(body)
    }
    attempt(0)
  })
}

/** 读取图片尺寸（JPEG/GIF/PNG 头部解析，不依赖图形库） */
function getImageSize(file) {
  try {
    const fd = fs.openSync(file, 'r')
    const buf = Buffer.alloc(24)
    const n = fs.readSync(fd, buf, 0, 24, 0)
    fs.closeSync(fd)
    if (n < 12) return null
    // PNG: 签名 + IHDR 宽高
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
    }
    // GIF: GIF87a/GIF89a 宽高（小端）
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
      return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) }
    }
    // JPEG: 扫描 SOF0/SOF2 段
    if (buf[0] === 0xFF && buf[1] === 0xD8) {
      const big = Buffer.alloc(65536)
      const m = fs.openSync(file, 'r')
      const got = fs.readSync(m, big, 0, 65536, 0)
      fs.closeSync(m)
      for (let i = 2; i < got - 8; i++) {
        if (big[i] === 0xFF && (big[i + 1] === 0xC0 || big[i + 1] === 0xC2)) {
          const h = big.readUInt16BE(i + 5)
          const w = big.readUInt16BE(i + 7)
          if (w > 0 && h > 0) return { w, h }
        }
      }
    }
  } catch (e) { }
  return null
}

/** 解析一个壁纸目录的最佳背景源：mp4 > gif > 本地预览图（纯本地，快速稳定） */
async function resolveWallpaperSource(dir) {
  try {
    const files = fs.readdirSync(dir)
    const mp4s = files.filter((f) => /\.mp4$/i.test(f))
    if (mp4s.length) {
      mp4s.sort((a, b) => {
        try { return fs.statSync(path.join(dir, b)).size - fs.statSync(path.join(dir, a)).size } catch (e) { return 0 }
      })
      return { source: path.join(dir, mp4s[0]), kind: 'video' }
    }
  } catch (e) { }
  try {
    const gif = fs.readdirSync(dir).find((f) => /\.gif$/i.test(f))
    if (gif) return { source: path.join(dir, gif), kind: 'image' }
  } catch (e) { }
  const preview = findPreview(dir, readProjectMeta(dir))
  if (preview) return { source: preview, kind: /\.mp4$/i.test(preview) ? 'video' : 'image' }
  return null
}

// ---------- HTTP 工具 ----------
function json(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve) => {
    let chunks = ''
    req.on('data', (d) => { chunks += d; if (chunks.length > 1024 * 1024) req.destroy() })
    req.on('end', () => resolve(chunks))
    req.on('error', () => resolve(''))
  })
}

export const inject = ['webServer']

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (webServer === undefined) return

  // 配置读写（GET 读 / POST 写）
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/dshmgr/glass',
    handler: async (req, res) => {
      if (req.method === 'POST') {
        const body = await readBody(req)
        let payload
        try { payload = JSON.parse(body) } catch (e) { json(res, { ok: false, error: '请求体不合法' }); return }
        const next = payload && typeof payload.config === 'object' && payload.config
          ? payload.config
          : (payload || {})
        const cfg = { ...readCfg(), ...next }
        writeCfg(cfg)
        json(res, { ok: true, config: cfg })
        return
      }
      json(res, { ok: true, config: readCfg() })
    },
  }))

  // 壁纸列表
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/dshmgr/wallpapers',
    handler: async (req, res) => {
      json(res, { ok: true, items: scanWallpapers() })
    },
  }))

  // 壁纸源解析：mp4 > gif > Steam 高清 > 本地预览
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/dshmgr/wallpaper-resolve',
    handler: async (req, res) => {
      const body = await readBody(req)
      let payload
      try { payload = JSON.parse(body) } catch (e) { json(res, { ok: false, error: '请求体不合法' }); return }
      const dir = payload && payload.dir ? String(payload.dir) : ''
      const resolved = path.resolve(dir)
      const roots = wallpaperRoots()
      if (!roots.some((r) => resolved === r || resolved.startsWith(r + path.sep))) {
        json(res, { ok: false, error: '路径越界' }); return
      }
      const src = await resolveWallpaperSource(resolved)
      if (!src) json(res, { ok: false, error: '未找到可用壁纸源' })
      else json(res, { ok: true, ...src })
    },
  }))

  // 壁纸文件（图片/视频，流式 + Range 支持，上限 1GB）
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/dshmgr/wallpaper',
    handler: async (req, res) => {
      let u
      try { u = new URL(req.url || '', 'http://localhost') } catch (e) { res.writeHead(400); res.end(); return }
      const p = u.searchParams.get('p')
      if (!p) { res.writeHead(400); res.end(); return }
      const resolved = path.resolve(String(p))
      const roots = wallpaperRoots()
      const ok = roots.some((r) => resolved === r || resolved.startsWith(r + path.sep))
        || resolved.startsWith(CACHE_DIR + path.sep)
      if (!ok) { res.writeHead(403); res.end('forbidden'); return }
      try {
        const st = fs.statSync(resolved)
        if (!st.isFile() || st.size > 1024 * 1024 * 1024) { res.writeHead(404); res.end(); return }
        const total = st.size
        const ext = path.extname(resolved).toLowerCase()
        const ct = {
          '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
          '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4',
        }[ext] || 'application/octet-stream'
        const range = req.headers.range
        if (range) {
          const m = /bytes=(\d*)-(\d*)/.exec(String(range))
          let start = m && m[1] ? parseInt(m[1], 10) : 0
          let end = m && m[2] ? parseInt(m[2], 10) : total - 1
          if (isNaN(start) || start < 0) start = 0
          if (isNaN(end) || end >= total) end = total - 1
          res.writeHead(206, {
            'Content-Type': ct,
            'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Cache-Control': 'public, max-age=86400',
          })
          fs.createReadStream(resolved, { start, end }).pipe(res)
        } else {
          res.writeHead(200, {
            'Content-Type': ct,
            'Accept-Ranges': 'bytes',
            'Content-Length': total,
            'Cache-Control': 'public, max-age=86400',
          })
          fs.createReadStream(resolved).pipe(res)
        }
      } catch (e) { res.writeHead(404); res.end(); return }
    },
  }))
}
