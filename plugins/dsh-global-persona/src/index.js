/**
 * dsh-global-persona — Host half
 *
 * 全局人设插件：
 *  - 用 settings 服务持久化一个全局 persona（enabled + text）
 *  - 通过 systemPrompt.section 把它注入到「每个 agent 的系统提示词」
 *    （全局作用域注册 → 所有工作区、所有会话、包括子任务都生效，
 *     section.text 是函数，每次组装提示词时读取最新值，改完立即生效）
 *  - 通过 webServer 暴露一个本地 GET/PATCH 端点，供设置页 UI 读写
 *
 * 注册的是全局提示词 section（名 global-persona），不发布任何 Cordis
 * 服务，可以在 host 组合中平铺。
 */
import { createRequire } from 'node:module'
import Schema from '@deepseek-ai/schemastery'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

export const name = 'dsh-global-persona'
export const inject = ['settings']
export const CONFIG_ENDPOINT = '/plugins/dsh-global-persona/config'
export const PROMPT_SECTION = 'global-persona'

export const Config = Schema.object({
  enabled: Schema.boolean().default(false).description('启用全局人设（默认关闭，需在设置里手动开启）'),
  text: Schema.string().default('').description('全局人设内容，注入到所有会话的系统提示词'),
}).description('全局人设（所有新工作区与新会话生效）')

const defaults = Object.freeze({
  enabled: false,
  text: '',
})

function publicConfig(config = {}) {
  return {
    enabled: config.enabled ?? defaults.enabled,
    text: typeof config.text === 'string' ? config.text : defaults.text,
  }
}

/** settings 服务不可用时的内存兜底（进程内生效，不持久化）。 */
function localSettingsScope(value) {
  let current = { ...value }
  return {
    get: () => current,
    watch: () => () => {},
    async update(patch) {
      current = { ...current, ...patch }
      return undefined
    },
    async replace(section) {
      current = { ...section }
      return undefined
    },
  }
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

async function readPatch(req) {
  const chunks = []
  let bytes = 0
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > 65536) throw new Error('request body is too large')
    chunks.push(chunk)
  }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('patch must be an object')
  }
  const allowed = new Set(['enabled', 'text'])
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`unknown setting: ${key}`)
  }
  if (value.text !== undefined && typeof value.text !== 'string') {
    throw new Error('text must be a string')
  }
  if (value.text !== undefined && value.text.length > 60000) {
    throw new Error('text is too long (max 60000 chars)')
  }
  return value
}

export function createConfigHandler(settings) {
  return async (req, res) => {
    if (!isLoopback(req.socket?.remoteAddress)) {
      jsonResponse(res, 403, { error: 'local access only' })
      return
    }
    const origin = req.headers?.origin
    if (origin) {
      let originHost
      try {
        originHost = new URL(origin).host
      } catch {
        originHost = undefined
      }
      if (!originHost || originHost !== req.headers.host) {
        jsonResponse(res, 403, { error: 'origin mismatch' })
        return
      }
    }
    if (req.method === 'GET') {
      jsonResponse(res, 200, settings.get())
      return
    }
    if (req.method !== 'PATCH') {
      jsonResponse(res, 405, { error: 'method not allowed' })
      return
    }
    try {
      await settings.update(await readPatch(req))
      jsonResponse(res, 200, settings.get())
    } catch (error) {
      jsonResponse(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }
}

function mount(ctx, config = {}, eventCtx = ctx) {
  const logger = ctx.logger ?? console
  const base = publicConfig(config)
  const settings =
    ctx.settings?.register?.('dsh-global-persona', Config, { base, applies: 'live' }) ??
    localSettingsScope(base)

  // 全局提示词 section：注册在 host 组合根作用域 → 每个 agent（所有工作区/
  // 会话/子任务）的系统提示词都包含它。text 是函数，每次组装时读最新值。
  const systemPrompt = ctx.get?.('systemPrompt')
  if (systemPrompt) {
    try {
      systemPrompt.section({
        name: PROMPT_SECTION,
        order: 1,
        text: () => {
          const value = settings.get()
          if (!value || value.enabled === false) return ''
          return value.text ?? ''
        },
      })
    } catch (error) {
      logger.error?.('[dsh-global-persona] failed to register prompt section:', error)
    }
  }

  // 本地配置端点：设置页 UI 通过 fetch 读写。
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (httpCtx) => {
      httpCtx.effect(
        () => httpCtx.webServer.register({ kind: 'exact', path: CONFIG_ENDPOINT, handler: createConfigHandler(settings) }),
        'dsh-global-persona: local settings endpoint',
      )
    })
  }

  logger.info?.(`[dsh-global-persona] mounted v${pkg.version}; endpoint ${CONFIG_ENDPOINT}`)
}

export function apply(ctx, config = {}) {
  if (typeof ctx.inject === 'function') {
    ctx.inject(['settings'], (settingsCtx) => mount(settingsCtx, config, ctx))
    return
  }
  mount(ctx, config)
}
