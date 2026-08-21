/**
 * dsh-lyric-sidebar — Host half
 *
 * 提供网易云 Cookie 的本地配置端点（GET/POST /plugins/dsh-lyric-sidebar/config），
 * 读写 ~/.dsh/music-config.json —— 与 Electron 播放器共用同一份配置。
 * 设置页 UI 在 DSH 设置 →「音乐」里。
 */
import { createRequire } from 'node:module'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

export const name = 'dsh-lyric-sidebar'
export const CONFIG_ENDPOINT = '/plugins/dsh-lyric-sidebar/config'

function configPath() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'music-config.json')
}

function readConfig() {
  try {
    const v = JSON.parse(fs.readFileSync(configPath(), 'utf8'))
    return v && typeof v === 'object' ? v : {}
  } catch (e) { return {} }
}

function writeConfig(cfg) {
  try { fs.writeFileSync(configPath(), JSON.stringify(cfg || {}, null, 2), 'utf8') } catch (e) { }
}

function jsonResponse(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function isLoopback(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

async function readBody(req) {
  const chunks = []
  let bytes = 0
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > 65536) throw new Error('request body is too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const handler = async (req, res) => {
  if (!isLoopback(req.socket?.remoteAddress)) {
    jsonResponse(res, 403, { error: 'local access only' })
    return
  }
  if (req.method === 'GET') {
    jsonResponse(res, 200, readConfig())
    return
  }
  if (req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}')
      const next = {
        neteaseCookie: typeof body.neteaseCookie === 'string' ? body.neteaseCookie : '',
      }
      writeConfig(next)
      jsonResponse(res, 200, readConfig())
    } catch (e) {
      jsonResponse(res, 400, { error: (e && e.message) || 'bad request' })
    }
    return
  }
  jsonResponse(res, 405, { error: 'method not allowed' })
}

export function apply(ctx) {
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (httpCtx) => {
      httpCtx.effect(
        () => httpCtx.webServer.register({ kind: 'exact', path: CONFIG_ENDPOINT, handler }),
        'dsh-lyric-sidebar: music config endpoint',
      )
    })
  }
  console.log(`[dsh-lyric-sidebar] mounted v${pkg.version}; endpoint ${CONFIG_ENDPOINT}`)
}
