/**
 * dsh-lyric-sidebar — Client half
 *
 * 在 DSH 侧边栏底部（设置按钮旁的 footer 行）注册一张歌词卡片：
 *  - 运行时测量侧边栏容器（[class*="sidebarCol"]）→ 卡片在工作区下方、
 *    设置上方，且相对侧边栏水平居中，宽度/折叠自适应
 *  - 背景使用 --dsw-specific-sidebar-fill（与工作区栏一致），随主题明暗自适应
 *  - 数据来自 Electron 客户端通过 window.postMessage 推送的 { type: 'dsh-lyric' }
 *  - 播放中显示 5 行歌词：当前行蓝紫渐变放大 + 弹入动画，其余行灰色淡出；
 *    无歌词时显示单行歌名
 */
window.__ModuleLoader__.load({ id: 'dsh-lyric-sidebar', factory: (require) => {
  const module = { exports: {} }
  const exports = module.exports
  const React = require('react')
  const { useEffect, useRef, useState } = React

  const CARD_W = 236
  const normalStyle = {
    fontSize: 11.5,
    lineHeight: 1.55,
    fontWeight: 400,
    color: 'var(--dsw-alias-label-secondary, #8a94a6)',
    opacity: 0.55,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    transition: 'opacity 0.25s ease',
  }
  const activeStyle = {
    fontSize: 14.5,
    lineHeight: 1.55,
    fontWeight: 700,
    letterSpacing: '0.02em',
    background: 'linear-gradient(90deg, var(--dsw-alias-brand-primary, #3964fe), #8e54e9)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  }

  // 单行歌词：激活/失活时播放生动过渡
  function LyricLine({ text, active }) {
    const ref = useRef(null)
    useEffect(() => {
      const el = ref.current
      if (!el) return
      if (active) {
        el.animate([
          { transform: 'scale(0.9)', opacity: 0.3, filter: 'blur(2px)' },
          { transform: 'scale(1.07)', opacity: 1, filter: 'blur(0)', offset: 0.65 },
          { transform: 'scale(1.03)', opacity: 1, filter: 'blur(0)' },
        ], { duration: 320, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' })
      } else {
        el.animate([
          { opacity: 0.9 }, { opacity: 0.55 },
        ], { duration: 240, easing: 'ease-out' })
      }
    }, [active])
    return React.createElement('div', { ref, style: active ? activeStyle : normalStyle }, text || '\u00A0')
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
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 280, easing: 'ease-out' })
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
      bottom: Math.max(12, window.innerHeight - pos.bottom + 36),
      width: CARD_W,
      boxSizing: 'border-box',
      padding: '11px 14px',
      background: 'var(--dsw-specific-sidebar-fill, #ffffff)',
      border: '1px solid var(--dsw-alias-border-l1, #e6e9ef)',
      borderRadius: 12,
      boxShadow: '0 -6px 24px rgba(0, 0, 0, 0.12)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
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
