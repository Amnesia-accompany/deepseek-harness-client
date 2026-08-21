/**
 * dsh-lyric-sidebar — Client half
 *
 * 在 DSH 侧边栏底部（设置按钮旁的 footer 行）注册一张歌词卡片：
 *  - 卡片向上弹出，位于「工作区列表下方、设置上方」
 *  - 背景使用 --dsw-specific-sidebar-fill（与工作区栏一致），随主题明暗自适应
 *  - 数据来自 Electron 客户端通过 window.postMessage 推送的 { type: 'dsh-lyric' }
 *  - 播放中显示 5 行歌词，当前行品牌色高亮放大；无歌词时显示单行歌名
 */
window.__ModuleLoader__.load({ id: 'dsh-lyric-sidebar', factory: (require) => {
  const module = { exports: {} }
  const exports = module.exports
  const React = require('react')
  const { useEffect, useState } = React

  const cardStyle = {
    position: 'fixed',
    left: 8,
    bottom: 56,
    width: 244,
    boxSizing: 'border-box',
    padding: '10px 12px',
    background: 'var(--dsw-specific-sidebar-fill, #ffffff)',
    border: '1px solid var(--dsw-alias-border-l1, #e6e9ef)',
    borderRadius: 12,
    boxShadow: '0 -6px 22px rgba(0, 0, 0, 0.10)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    zIndex: 40,
    pointerEvents: 'none',
  }
  const lineStyle = {
    fontSize: 11,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-secondary, #8a94a6)',
    opacity: 0.55,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    transition: 'all 0.3s ease',
  }
  const activeLineStyle = {
    fontSize: 13.5,
    lineHeight: 1.5,
    fontWeight: 700,
    color: 'var(--dsw-alias-brand-primary, #1f6fd6)',
    opacity: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    transition: 'all 0.3s ease',
    transform: 'scale(1.04)',
  }
  const hiddenStyle = { display: 'none' }

  function LyricCard() {
    const [state, setState] = useState({ show: false, lines: [], index: -1, single: '' })

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
      return () => window.removeEventListener('message', onMessage)
    }, [])

    if (!state.show) return React.createElement('div', { style: hiddenStyle })

    const hasLrc = state.lines.length > 0
    const lines = hasLrc ? state.lines : [state.single || '']
    const idx = hasLrc ? state.index : 0
    // 只显示当前行附近 5 行
    const start = Math.max(0, idx - 2)
    const visible = lines.slice(start, start + 5)

    return React.createElement('div', { style: cardStyle },
      visible.map((text, i) => {
        const isActive = hasLrc ? (start + i) === idx : i === 0
        return React.createElement('div', {
          key: start + i,
          style: isActive ? activeLineStyle : lineStyle,
        }, text || '\u00A0')
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
