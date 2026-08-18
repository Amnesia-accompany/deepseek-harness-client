// ============================================================
//  DeepSeek Harness 玻璃拟态 - Client 半
//  通用设置下注册：模式 / 模糊度 / 磨砂度 / 背景 / 壁纸 五行
//  玻璃效果 = 主题变量覆盖 + 全局 CSS（背景层 + #root 玻璃化）
// ============================================================
window.__ModuleLoader__.load({
  id: 'dsh-glass-ui',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    let React = require('react')

const ROW_CSS = `
.dshg-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0}
.dshg-label{font-size:12.5px;color:var(--dsw-alias-label-primary,#1a2233)}
.dshg-sub{font-size:11px;color:var(--dsw-alias-label-tertiary,#97a0b0);margin-top:2px}
.dshg-ctrl{display:flex;align-items:center;gap:8px;flex:none}
.dshg-seg{display:flex;border:1px solid var(--dsw-alias-border-l1,#dde2ea);border-radius:8px;overflow:hidden}
.dshg-seg button{border:0;background:transparent;padding:5px 14px;font-size:12px;color:var(--dsw-alias-label-secondary,#4b5563);cursor:pointer;font-family:inherit}
.dshg-seg button.on{background:var(--dsw-alias-interactive-primary-solid,#1f6fd6);color:#fff}
.dshg-range{width:150px;accent-color:var(--dsw-alias-interactive-primary-solid,#1f6fd6)}
.dshg-val{font-size:11.5px;color:var(--dsw-alias-label-secondary,#6b7280);min-width:34px;text-align:right;font-variant-numeric:tabular-nums}
.dshg-wp{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;max-height:240px;overflow:auto;padding:4px 2px}
.dshg-wpcard{border:1px solid var(--dsw-alias-border-l1,#e4e9f0);border-radius:8px;overflow:hidden;cursor:pointer;background:var(--dsw-alias-bg-layer-2,#fff);transition:border-color .12s}
.dshg-wpcard:hover{border-color:var(--dsw-alias-border-l2,#c8d8ef)}
.dshg-wpcard.on{border-color:var(--dsw-alias-interactive-primary-solid,#1f6fd6);box-shadow:0 0 0 2px rgba(31,111,214,.25)}
.dshg-wpcard img,.dshg-wpcard video{width:100%;height:64px;object-fit:cover;display:block;background:#000}
.dshg-wpcard .nm{font-size:10.5px;color:var(--dsw-alias-label-secondary,#6b7280);padding:4px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshg-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,#97a0b0);padding:10px 0 2px}
.dshg-empty{font-size:11.5px;color:var(--dsw-alias-label-tertiary,#97a0b0);padding:12px 0}
.dshg-fchip{border:1px solid var(--dsw-alias-border-l1,#dde2ea);background:var(--dsw-alias-bg-overlay,#fff);color:var(--dsw-alias-label-secondary,#4b5563);border-radius:20px;padding:4px 12px;font-size:11px;cursor:pointer;font-family:inherit}
.dshg-fchip:hover{border-color:var(--dsw-alias-brand-primary,#1f6fd6);color:var(--dsw-alias-brand-primary,#1f6fd6)}
.dshg-fchip.on{background:var(--dsw-alias-brand-primary,#1f6fd6);border-color:var(--dsw-alias-brand-primary,#1f6fd6);color:#fff}
`

function injectCss() {
  const tagId = 'dshg-rows-css'
  if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-glass-ui'
    tag.dataset.pluginCss = tagId
    tag.textContent = ROW_CSS
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

const DEFAULT = { mode: 'compat', blur: 0, frost: 50, bg: 'fluid', wallpaper: '', wallpaperKind: '', wallpaperDir: '', fluidTheme: 'pearl' }

// ---------- 共享配置状态 ----------
let cfg = { ...DEFAULT }
let themeSvc = null
let tokenDisposer = null
const listeners = new Set()
function notify() { for (const fn of listeners) fn() }
function subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn) } }

function useCfg() {
  const [, force] = React.useReducer((x) => x + 1, 0)
  React.useEffect(() => subscribe(force), [])
}

function saveCfg(patch) {
  cfg = { ...cfg, ...patch }
  applyGlass(cfg)
  notify()
  api('/api/dshmgr/glass', { config: cfg }).catch(() => { })
}

// ---------- 玻璃引擎 ----------
// ---------- 流体配色预设 ----------
const FLUID_THEMES = {
  pearl: { name: '珍珠白', css: 'radial-gradient(38% 46% at 18% 28%, rgba(255,255,255,0.90), transparent 62%), radial-gradient(32% 40% at 82% 72%, rgba(191,219,254,0.55), transparent 62%), radial-gradient(28% 38% at 65% 18%, rgba(254,215,170,0.45), transparent 62%), radial-gradient(24% 32% at 40% 85%, rgba(240,171,252,0.35), transparent 60%), linear-gradient(135deg, #f8fafc, #eef2f7, #f1f5f9)' },
  deep: { name: '深蓝宇宙', css: 'radial-gradient(38% 46% at 18% 28%, rgba(99,102,241,0.38), transparent 62%), radial-gradient(32% 40% at 82% 72%, rgba(168,85,247,0.30), transparent 62%), radial-gradient(28% 38% at 65% 18%, rgba(56,189,248,0.24), transparent 62%), radial-gradient(24% 32% at 40% 85%, rgba(236,72,153,0.15), transparent 60%), linear-gradient(135deg, #0e1320, #182038, #0f172a)' },
  violet: { name: '紫罗兰', css: 'radial-gradient(40% 48% at 20% 25%, rgba(167,139,250,0.40), transparent 60%), radial-gradient(34% 42% at 78% 70%, rgba(217,70,239,0.32), transparent 62%), radial-gradient(26% 36% at 60% 20%, rgba(99,102,241,0.28), transparent 60%), radial-gradient(22% 30% at 38% 88%, rgba(251,113,133,0.18), transparent 60%), linear-gradient(135deg, #160f2e, #241242, #1b1035)' },
  mint: { name: '薄荷青', css: 'radial-gradient(40% 48% at 22% 26%, rgba(45,212,191,0.32), transparent 60%), radial-gradient(34% 42% at 80% 72%, rgba(52,211,153,0.26), transparent 62%), radial-gradient(28% 38% at 62% 18%, rgba(96,165,250,0.22), transparent 60%), radial-gradient(22% 32% at 40% 86%, rgba(250,204,21,0.10), transparent 60%), linear-gradient(135deg, #062a2f, #0b3d42, #07313a)' },
  sunset: { name: '落日暖橙', css: 'radial-gradient(40% 48% at 22% 26%, rgba(251,146,60,0.34), transparent 60%), radial-gradient(34% 42% at 80% 72%, rgba(244,63,94,0.30), transparent 62%), radial-gradient(28% 38% at 60% 18%, rgba(251,191,36,0.22), transparent 60%), radial-gradient(22% 32% at 40% 86%, rgba(217,70,239,0.14), transparent 60%), linear-gradient(135deg, #2a1206, #3d1a10, #301308)' },
  sakura: { name: '樱花粉', css: 'radial-gradient(40% 48% at 20% 25%, rgba(244,114,182,0.32), transparent 60%), radial-gradient(34% 42% at 80% 72%, rgba(192,132,252,0.26), transparent 62%), radial-gradient(26% 36% at 60% 20%, rgba(251,207,232,0.22), transparent 60%), radial-gradient(22% 30% at 38% 88%, rgba(253,164,175,0.16), transparent 60%), linear-gradient(135deg, #2a1020, #3a1730, #241020)' },
  emerald: { name: '翡翠森林', css: 'radial-gradient(40% 48% at 22% 26%, rgba(52,211,153,0.30), transparent 60%), radial-gradient(34% 42% at 80% 72%, rgba(16,185,129,0.26), transparent 62%), radial-gradient(28% 38% at 62% 18%, rgba(132,204,22,0.18), transparent 60%), radial-gradient(22% 32% at 40% 86%, rgba(45,212,191,0.12), transparent 60%), linear-gradient(135deg, #062112, #0b2f1a, #072415)' },
}

function glassCss(c) {
  const blur = Math.max(0, Math.min(6, c.blur || 0))
  const frost = Math.max(0, Math.min(100, c.frost || 0))
  // 模糊度统一生效（默认 0 清晰，调高即模糊，壁纸/流体模式一致）
  const effBlur = blur
  const cardAlpha = (0.42 + (frost / 100) * 0.38).toFixed(3)
  const noiseOp = (0.028 + (frost / 100) * 0.055).toFixed(3)
  const isFloat = c.mode === 'float'
  const fluidCss = (FLUID_THEMES[c.fluidTheme] || FLUID_THEMES.deep).css
  return `
html.dsh-glass, html.dsh-glass body { background: transparent !important; }
html.dsh-glass html, html.dsh-glass body { overflow: hidden !important; }
/* 背景层（真实元素，支持视频壁纸） */
#dshg-bg { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
#dshg-bg img, #dshg-bg video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
/* 流体：光斑漂移（配色可换） */
#dshg-bg.fluid {
  background-image: ${fluidCss};
  background-size: 140% 140%;
  animation: dshg-flow 30s ease-in-out infinite alternate;
}
@keyframes dshg-flow {
  0% { background-position: 0% 0%; filter: hue-rotate(0deg) }
  50% { background-position: 60% 40%; filter: hue-rotate(14deg) }
  100% { background-position: 100% 100%; filter: hue-rotate(0deg) }
}
/* 磨砂噪点层（颗粒感，随磨砂度增强） */
html.dsh-glass body::after {
  content: ''; position: fixed; inset: 0; z-index: 2147483000; pointer-events: none;
  opacity: ${noiseOp};
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='0.6'/></svg>");
}
html.dsh-glass #root { background: transparent !important; }
html.dsh-glass[data-mode="float"] #root {
  margin: 14px; width: calc(100vw - 28px) !important; height: calc(100vh - 28px) !important;
  border-radius: 20px; overflow: hidden;
  background: rgba(255,255,255,${cardAlpha}) !important;
  background-image: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 34%) !important;
  backdrop-filter: blur(${effBlur}px) saturate(1.6) contrast(1.04); -webkit-backdrop-filter: blur(${effBlur}px) saturate(1.6) contrast(1.04);
  box-shadow: 0 22px 80px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,255,255,.12), inset 0 1px 0 rgba(255,255,255,.16);
}
html.dsh-glass[data-mode="compat"] #root {
  backdrop-filter: blur(${effBlur}px) saturate(1.5) contrast(1.03); -webkit-backdrop-filter: blur(${effBlur}px) saturate(1.5) contrast(1.03);
}
/* 浮层白化：设置面板（role=dialog，位于 #root 内 sidebar 子树）与 body 浮层恢复白色不透明 */
html.dsh-glass [role="dialog"] {
  --dsw-alias-bg-base: #ffffff !important;
  --dsw-alias-bg-layer-1: #fdfdfd !important;
  --dsw-alias-bg-layer-2: #f7f8fa !important;
  --dsw-alias-bg-layer-3: #f2f4f7 !important;
  --dsw-alias-bg-overlay: #e9ecf2 !important;
  --dsw-alias-bg-skeleton: #eef1f6 !important;
  --dsw-specific-sidebar-fill: #f9fafb !important;
  --dsw-specific-menu: #f2f4f7 !important;
}
html.dsh-glass body > div:not(#root):not(#dshg-bg) {
  --dsw-alias-bg-base: #ffffff !important;
  --dsw-alias-bg-layer-1: #fdfdfd !important;
  --dsw-alias-bg-layer-2: #f7f8fa !important;
  --dsw-alias-bg-layer-3: #f2f4f7 !important;
  --dsw-alias-bg-overlay: #e9ecf2 !important;
  --dsw-alias-bg-skeleton: #eef1f6 !important;
  --dsw-specific-sidebar-fill: #f9fafb !important;
}
`
}

function ensureBg() {
  let el = document.getElementById('dshg-bg')
  if (!el) {
    el = document.createElement('div')
    el.id = 'dshg-bg'
    document.body.appendChild(el)
  }
  return el
}

function renderBg(c) {
  const el = ensureBg()
  el.innerHTML = ''
  el.className = ''
  if (c.bg === 'wallpaper' && c.wallpaper) {
    const url = '/api/dshmgr/wallpaper?p=' + encodeURIComponent(c.wallpaper)
    if (c.wallpaperKind === 'video') {
      const v = document.createElement('video')
      v.src = url
      v.muted = true
      v.loop = true
      v.autoplay = true
      v.playsInline = true
      el.appendChild(v)
    } else {
      const img = document.createElement('img')
      img.src = url
      el.appendChild(img)
    }
  } else {
    el.className = 'fluid'
  }
}

// 背景层重建去抖：只有背景相关字段变化才重建，拖滑条（blur/frost）不会让壁纸消失
let lastBgKey = ''
function bgKey(c) {
  return (c.bg || '') + '|' + (c.wallpaper || '') + '|' + (c.wallpaperKind || '')
}

function applyGlass(c) {
  const root = document.documentElement
  root.classList.add('dsh-glass')
  root.dataset.mode = c.mode
  root.dataset.bg = c.bg
  let tag = document.getElementById('dshg-glass-css')
  if (!tag) {
    tag = document.createElement('style')
    tag.id = 'dshg-glass-css'
    document.head.appendChild(tag)
  }
  tag.textContent = glassCss(c)
  const key = bgKey(c)
  if (key !== lastBgKey) {
    renderBg(c)
    lastBgKey = key
  }
  // 主题变量覆盖（磨砂度 → 透明度）。浮层变量（overlay/mask）不覆盖，
  // 让设置面板、弹窗、遮罩保持原版不透明。
  const alpha = (0.04 + (c.frost / 100) * 0.26).toFixed(3)
  const a2 = (Number(alpha) + 0.05).toFixed(3)
  const a3 = (Number(alpha) + 0.10).toFixed(3)
  const dk = 'rgba(13,18,32,' + alpha + ')'
  const lt = 'rgba(255,255,255,' + alpha + ')'
  const dk1 = 'rgba(19,26,46,' + a2 + ')'
  const lt1 = 'rgba(255,255,255,' + a2 + ')'
  const dk2 = 'rgba(25,33,56,' + a3 + ')'
  const lt2 = 'rgba(255,255,255,' + a3 + ')'
  if (themeSvc) {
    if (tokenDisposer) tokenDisposer()
    tokenDisposer = themeSvc.overrideTokens('dsh-glass-ui', {
      '--dsw-alias-bg-base': { light: lt, dark: dk },
      '--dsw-alias-bg-layer-1': { light: lt1, dark: dk1 },
      '--dsw-alias-bg-layer-2': { light: lt1, dark: dk1 },
      '--dsw-alias-bg-layer-3': { light: lt2, dark: dk2 },
      '--dsw-alias-bg-skeleton': { light: lt1, dark: dk1 },
      '--dsw-specific-sidebar-fill': { light: lt1, dark: dk1 },
    })
  }
}

// ---------- 通用设置行 ----------
function Row({ label, sub, children }) {
  return React.createElement('div', { className: 'dshg-row' },
    React.createElement('div', { className: 'dshg-label' },
      label,
      sub ? React.createElement('div', { className: 'dshg-sub' }, sub) : null
    ),
    React.createElement('div', { className: 'dshg-ctrl' }, children)
  )
}

function Seg({ options, value, onChange }) {
  return React.createElement('div', { className: 'dshg-seg' },
    options.map((o) => React.createElement('button', {
      key: o.value,
      type: 'button',
      className: value === o.value ? 'on' : '',
      onClick: () => onChange(o.value),
    }, o.label))
  )
}

function ModeRow() {
  useCfg()
  return React.createElement(Row, { label: '玻璃模式', sub: '漂浮玻璃：界面变为悬浮玻璃卡片；兼容模式：保持排版只换玻璃材质' },
    React.createElement(Seg, {
      options: [
        { value: 'float', label: '漂浮玻璃' },
        { value: 'compat', label: '兼容模式' },
      ],
      value: cfg.mode,
      onChange: (v) => saveCfg({ mode: v }),
    })
  )
}

function BlurRow() {
  useCfg()
  const v = Math.min(6, cfg.blur || 0)
  return React.createElement(Row, { label: '模糊度', sub: '背景模糊半径（0-6px，可调 0.5 步进）' },
    React.createElement('input', {
      className: 'dshg-range',
      type: 'range', min: 0, max: 6, step: 0.5,
      value: v,
      onChange: (e) => saveCfg({ blur: Number(e.target.value) }),
    }),
    React.createElement('span', { className: 'dshg-val' }, v.toFixed(1) + ' px')
  )
}

function FrostRow() {
  useCfg()
  return React.createElement(Row, { label: '磨砂度', sub: '玻璃不透度与颗粒感' },
    React.createElement('input', {
      className: 'dshg-range',
      type: 'range', min: 0, max: 100, step: 1,
      value: cfg.frost,
      onChange: (e) => saveCfg({ frost: Number(e.target.value) }),
    }),
    React.createElement('span', { className: 'dshg-val' }, cfg.frost + ' %')
  )
}

function BgRow() {
  useCfg()
  return React.createElement(Row, { label: '背景', sub: '流体：动态渐变色；壁纸：选择 Wallpaper Engine 壁纸' },
    React.createElement(Seg, {
      options: [
        { value: 'fluid', label: '流体' },
        { value: 'wallpaper', label: '壁纸' },
      ],
      value: cfg.bg,
      onChange: (v) => saveCfg({ bg: v }),
    })
  )
}

function FluidRow() {
  useCfg()
  if (cfg.bg !== 'fluid') return null
  return React.createElement(Row, { label: '流体配色', sub: '选择流体的色调' },
    React.createElement('div', { className: 'dshg-ctrl', style: { flexWrap: 'wrap', justifyContent: 'flex-end' } },
      Object.keys(FLUID_THEMES).map((key) => {
        const t = FLUID_THEMES[key]
        const on = cfg.fluidTheme === key
        return React.createElement('button', {
          key,
          type: 'button',
          title: t.name,
          className: 'dshg-fchip' + (on ? ' on' : ''),
          onClick: () => saveCfg({ fluidTheme: key }),
        }, t.name)
      })
    )
  )
}

function WallpaperRow() {
  useCfg()
  const [items, setItems] = React.useState(null)
  const [err, setErr] = React.useState('')
  React.useEffect(() => {
    let dead = false
    api('/api/dshmgr/wallpapers').then((r) => {
      if (dead) return
      if (r && r.ok) setItems(r.items || [])
      else setErr((r && r.error) || '加载失败')
    }).catch((e) => { if (!dead) setErr(String((e && e.message) || e)) })
    return () => { dead = true }
  }, [])
  if (cfg.bg !== 'wallpaper') return null
  // 高清优先排序：视频 > 高分辨率 > 低分辨率
  const sorted = (items || []).slice().sort((a, b) => {
    const av = a.kind === 'video' ? 1 : 0
    const bv = b.kind === 'video' ? 1 : 0
    if (av !== bv) return bv - av
    return ((b.w || 0) - (a.w || 0))
  })
  return React.createElement('div', null,
    React.createElement('div', { className: 'dshg-hint' }, '选择 Wallpaper Engine 壁纸（视频壁纸最清晰，优先排序；低清壁纸已标注）'),
    err ? React.createElement('div', { className: 'dshg-empty' }, err)
      : items === null ? React.createElement('div', { className: 'dshg-empty' }, '正在扫描壁纸…')
      : items.length === 0 ? React.createElement('div', { className: 'dshg-empty' }, '没有找到壁纸。请确认 Wallpaper Engine 的壁纸目录存在（文档\\Wallpaper Engine\\wallpapers 或 Steam workshop\\431960）。')
      : React.createElement('div', { className: 'dshg-wp' },
          sorted.map((w) => {
            const src = '/api/dshmgr/wallpaper?p=' + encodeURIComponent(w.preview)
            const on = cfg.wallpaperDir === w.dir
            const lowRes = !w.w || (w.w < 800 && w.kind !== 'video')
            return React.createElement('div', {
              key: w.dir,
              className: 'dshg-wpcard' + (on ? ' on' : ''),
              title: w.dir,
              onClick: () => {
                api('/api/dshmgr/wallpaper-resolve', { dir: w.dir }).then((r) => {
                  if (r && r.ok) {
                    saveCfg({ wallpaperDir: w.dir, wallpaper: r.source, wallpaperKind: r.kind })
                  } else {
                    window.alert('获取壁纸源失败：' + ((r && r.error) || '未知'))
                  }
                })
              },
            },
              React.createElement('img', { src, alt: w.name, loading: 'lazy' }),
              React.createElement('div', { className: 'nm' },
                w.name + (w.kind === 'video' ? ' ▶' : '') +
                (w.w ? ' · ' + w.w + '×' + w.h : '') +
                (lowRes ? ' · 低清' : ''))
            )
          })
        )
  )
}

function apply(ctx) {
  injectCss()
  const slots = ctx.get('slots')
  if (slots === undefined) return

  // 捕获主题服务（供玻璃变量覆盖使用）
  const theme = ctx.get('theme')
  if (theme !== undefined) themeSvc = theme

  // 恢复持久化配置并应用
  api('/api/dshmgr/glass').then((r) => {
    if (r && r.ok && r.config) {
      cfg = { ...DEFAULT, ...r.config }
      applyGlass(cfg)
      notify()
    }
  }).catch(() => { })

  // 卸载清理：移除 CSS 标签、背景层、html 标记与主题覆盖层
  ctx.effect(() => () => {
    const root = document.documentElement
    root.classList.remove('dsh-glass')
    delete root.dataset.mode
    delete root.dataset.bg
    const tag = document.getElementById('dshg-glass-css')
    if (tag) tag.remove()
    const bg = document.getElementById('dshg-bg')
    if (bg) bg.remove()
    if (tokenDisposer) { tokenDisposer(); tokenDisposer = null }
  }, 'dsh-glass-ui: cleanup')

  const rows = [
    { id: 'glass-mode', order: 30, el: ModeRow },
    { id: 'glass-blur', order: 31, el: BlurRow },
    { id: 'glass-frost', order: 32, el: FrostRow },
    { id: 'glass-bg', order: 33, el: BgRow },
    { id: 'glass-fluid', order: 34, el: FluidRow },
    { id: 'glass-wallpaper', order: 35, el: WallpaperRow },
  ]
  for (const row of rows) {
    slots.inject('settings.general.item', () => slots.register(
      { name: 'settings.general.item', id: row.id, order: row.order, label: () => '玻璃外观' },
      () => React.createElement(row.el)
    ))
  }
}

    exports.apply = apply;
    exports.inject = ['slots'];
    return module.exports;
  },
});
