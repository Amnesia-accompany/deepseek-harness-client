/**
 * dsh-lyric-sidebar — Client half
 *
 * 歌词显示由 Electron 客户端顶栏承担（前后两列错位歌词），
 * 本插件只提供 DSH 设置 →「音乐」页（网易云 Cookie），
 * 通过 Host 的 /plugins/dsh-lyric-sidebar/config 端点读写配置。
 */
window.__ModuleLoader__.load({ id: 'dsh-lyric-sidebar', factory: (require) => {
  const module = { exports: {} }
  const exports = module.exports
  const React = require('react')
  const { useEffect, useRef, useState } = React

  // DSH 设置 →「音乐」页：网易云 Cookie
  function MusicSettings() {
    const [val, setVal] = useState('')
    const [busy, setBusy] = useState(false)
    const [status, setStatus] = useState('')
    const loaded = useRef(false)

    useEffect(() => {
      if (loaded.current) return
      loaded.current = true
      fetch('/plugins/dsh-lyric-sidebar/config', { cache: 'no-store' })
        .then((r) => r.json())
        .then((c) => { if (c && c.neteaseCookie) setVal(c.neteaseCookie) })
        .catch(() => { })
    }, [])

    const save = async () => {
      setBusy(true)
      setStatus('保存中…')
      try {
        const r = await fetch('/plugins/dsh-lyric-sidebar/config', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ neteaseCookie: val.trim() }),
        })
        if (!r.ok) throw new Error('bad status')
        setStatus(val.trim() ? '已保存 ✓ 播放网易云歌曲时生效' : '已清除 Cookie')
      } catch (e) {
        setStatus('保存失败，请确认 DSH 服务正常')
      } finally {
        setBusy(false)
      }
    }

    const wrap = {
      display: 'grid', gap: 12, maxWidth: 560, padding: '4px 2px',
    }
    const title = {
      margin: 0, fontSize: 15, fontWeight: 650, color: 'var(--dsw-alias-label-primary, #1a2233)',
    }
    const desc = {
      margin: 0, fontSize: 12.5, lineHeight: 1.6, opacity: 0.65,
      color: 'var(--dsw-alias-label-secondary, #3c4452)',
    }
    const row = { display: 'flex', gap: 8, alignItems: 'center' }
    const input = {
      flex: 1, padding: '8px 12px', border: '1px solid var(--dsw-alias-border-l1, #dde2ea)',
      borderRadius: 8, fontSize: 12.5, color: 'var(--dsw-alias-label-primary, #1a2233)',
      background: 'var(--dsw-alias-bg-layer-1, #fff)', outline: 'none', fontFamily: 'inherit',
    }
    const btn = {
      padding: '8px 18px', border: 0, borderRadius: 8, cursor: 'pointer',
      background: 'var(--dsw-alias-brand-primary, #3964fe)', color: '#fff',
      fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
    }
    const hint = { margin: 0, fontSize: 11.5, lineHeight: 1.6, opacity: 0.6, color: 'var(--dsw-alias-label-secondary, #8a94a6)' }

    return React.createElement('div', { style: wrap },
      React.createElement('div', null,
        React.createElement('h3', { style: title }, '网易云 Cookie'),
        React.createElement('p', { style: desc }, '解锁网易云歌曲音频播放（歌名/歌词/歌单不需要）。Cookie 只保存在本机，不会上传。'),
      ),
      React.createElement('div', { style: row },
        React.createElement('input', {
          type: 'password',
          value: val,
          placeholder: 'MUSIC_U=…',
          style: input,
          onChange: (e) => setVal(e.target.value),
        }),
        React.createElement('button', { type: 'button', style: btn, disabled: busy, onClick: save }, '保存'),
      ),
      React.createElement('p', { style: hint }, status || '获取方法：浏览器登录 music.163.com → F12 → Application → Cookies → 复制 MUSIC_U 的值，填成 MUSIC_U=xxx 保存。'),
    )
  }

  function apply(ctx) {
    const registerSettings = () => {
      try {
        ctx.slots.register({
          name: 'settings.section',
          id: 'music',
          order: 25,
          label: '音乐',
        }, MusicSettings)
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[dsh-lyric-sidebar] failed to register music settings:', error)
        }
      }
    }
    try {
      ctx.slots.inject('settings.section', registerSettings)
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[dsh-lyric-sidebar] failed to inject settings slot:', error)
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
