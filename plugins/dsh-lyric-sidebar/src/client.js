/**
 * dsh-lyric-sidebar — Client half
 *
 * 在 DSH 侧边栏底部（设置按钮旁的 footer 行）注册一张歌词卡片：
 *  - 运行时测量侧边栏容器（[class*="sidebarCol"]）→ 卡片在工作区下方、
 *    设置上方，且相对侧边栏水平居中，宽度/折叠自适应
 *  - 背景使用 --dsw-specific-sidebar-fill（与工作区栏一致），随主题明暗自适应
 *  - 数据来自 Electron 客户端通过 window.postMessage 推送的 { type: 'dsh-lyric' }
 *  - 当前行：蓝紫粉渐变流动 + 胶囊高亮 + 弹性弹入 + 呼吸；其余行灰字随动淡出
 */
window.__ModuleLoader__.load({ id: 'dsh-lyric-sidebar', factory: (require) => {
  const module = { exports: {} }
  const exports = module.exports
  const React = require('react')
  const { useEffect, useRef, useState } = React

  const CARD_W = 240
  const BRAND = 'var(--dsw-alias-brand-primary, #3964fe)'
  const GRADIENT = 'linear-gradient(90deg, #3964fe, #a855f7, #ec4899, #3964fe)'

  // 普通行
  const normalBoxStyle = {
    fontSize: 11,
    lineHeight: 1.55,
    fontWeight: 400,
    color: 'var(--dsw-alias-label-secondary, #8a94a6)',
    opacity: 0.45,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    padding: '1px 10px',
  }
  // 当前行（胶囊 + 渐变文字）
  const activeBoxStyle = {
    fontSize: 15,
    lineHeight: 1.55,
    fontWeight: 800,
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    padding: '2px 12px',
    borderRadius: 10,
    background: 'color-mix(in srgb, ' + BRAND + ' 12%, transparent)',
    boxShadow: '0 0 18px color-mix(in srgb, ' + BRAND + ' 18%, transparent)',
  }
  const activeTextStyle = {
    background: GRADIENT,
    backgroundSize: '200% 100%',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  }

  // 单行歌词：激活时弹性弹入 + 呼吸 + 渐变流动；失活时上移淡出
  function LyricLine({ text, active }) {
    const boxRef = useRef(null)
    const txtRef = useRef(null)

    useEffect(() => {
      const box = boxRef.current
      if (!box) return
      if (active) {
        // 弹入：滑入 + 过冲落定
        box.animate([
          { opacity: 0, transform: 'translateY(16px) scale(0.92)' },
          { opacity: 1, transform: 'translateY(-3px) scale(1.05)', offset: 0.62 },
          { opacity: 1, transform: 'translateY(0) scale(1.02)' },
        ], { duration: 420, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)', fill: 'forwards' })
        // 呼吸：进入结束后开始，轻柔起伏
        box.animate([
          { transform: 'translateY(0) scale(1.02)' },
          { transform: 'translateY(-1px) scale(1.06)' },
          { transform: 'translateY(0) scale(1.02)' },
        ], { duration: 2400, iterations: Infinity, easing: 'ease-in-out', delay: 460 })
        // 渐变流动
        const txt = txtRef.current
        if (txt) {
          txt.animate([
            { backgroundPosition: '0% 50%' },
            { backgroundPosition: '200% 50%' },
          ], { duration: 3400, iterations: Infinity, easing: 'linear' })
        }
      } else {
        box.animate([
          { opacity: 0.7, transform: 'translateY(0)' },
          { opacity: 0.45, transform: 'translateY(-6px)' },
        ], { duration: 280, easing: 'ease-out', fill: 'forwards' })
      }
    }, [active])

    return React.createElement('div', { ref: boxRef, style: active ? activeBoxStyle : normalBoxStyle },
      React.createElement('span', { ref: txtRef, style: active ? activeTextStyle : undefined }, text || '\u00A0'),
    )
  }

  function LyricCard() {
    const [state, setState] = useState({ show: false, lines: [], index: -1, single: '' })
    const [pos, setPos] = useState(null) // { left, width, bottom }
    const cardRef = useRef(null)

    useEffect(() => {
      const onMessage = (event) => {
        const data = event.data
        if (!data || data.type !== 'dsh-lyric') return
        setState({
          show: !!data.show,
          lines: Array.isArray(data.lines) ? data.lines : [],
          index: typeof data.index === 'number' ? data.index : -1,
          single: typeof data.single === 'string' ? data.single : '',
        })
      }
      window.addEventListener('message', onMessage)

      // 测量侧边栏容器：宽度/位置变化时自适应（拖拽、折叠、resize）
      let col = null
      let ro = null
      const measure = () => {
        if (!col) col = document.querySelector('[class*="sidebarCol"]')
        if (!col) { setPos(null); return }
        const r = col.getBoundingClientRect()
        setPos({ left: r.left, width: r.width, bottom: r.bottom })
      }
      measure()
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(measure)
        const attach = () => {
          if (!col) col = document.querySelector('[class*="sidebarCol"]')
          if (col) ro.observe(col)
          else setTimeout(attach, 500)
        }
        attach()
      } else {
        window.addEventListener('resize', measure)
      }

      return () => {
        window.removeEventListener('message', onMessage)
        if (ro) ro.disconnect()
        window.removeEventListener('resize', measure)
      }
    }, [])

    // 卡片出现：淡入 + 上浮
    useEffect(() => {
      const el = cardRef.current
      if (el) {
        el.animate([
          { opacity: 0, transform: 'translateY(12px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 300, easing: 'ease-out' })
      }
    }, [state.show])

    if (!state.show || !pos) return null
    if (pos.width < 120) return null // 侧边栏折叠成窄条时不显示

    const hasLrc = state.lines.length > 0
    const lines = hasLrc ? state.lines : [state.single || '']
    const idx = hasLrc ? state.index : 0
    const start = Math.max(0, idx - 2)
    const visible = lines.slice(start, start + 5)

    const cardStyle = {
      position: 'fixed',
      left: pos.left + (pos.width - CARD_W) / 2,
      bottom: Math.max(12, window.innerHeight - pos.bottom + 58),
      width: CARD_W,
      boxSizing: 'border-box',
      padding: '12px 14px 10px',
      background: 'var(--dsw-specific-sidebar-fill, #ffffff)',
      border: '1px solid var(--dsw-alias-border-l1, #e6e9ef)',
      borderTop: '2px solid ' + GRADIENT,
      borderRadius: 12,
      boxShadow: '0 -8px 26px rgba(0, 0, 0, 0.12)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 1,
      zIndex: 40,
      pointerEvents: 'none',
    }

    return React.createElement('div', { ref: cardRef, style: cardStyle },
      visible.map((text, i) => {
        const isActive = hasLrc ? (start + i) === idx : i === 0
        return React.createElement(LyricLine, { key: start + i, text: text, active: isActive })
      }),
    )
  }

  function apply(ctx) {
    const registerCard = () => {
      try {
        ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'lyric-card',
          order: 90,
          label: '歌词',
        }, LyricCard)
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[dsh-lyric-sidebar] failed to register lyric card:', error)
        }
      }
    }
    try {
      ctx.slots.inject('sidebar.footer.action', registerCard)
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[dsh-lyric-sidebar] failed to inject slot:', error)
      }
    }
  }

  module.exports = {
    name: 'dsh-lyric-sidebar-client',
    inject: ['slots'],
    apply,
  }
  return module.exports
} })
