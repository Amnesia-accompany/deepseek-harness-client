/**
 * dsh-global-persona — Client half
 *
 * 在「设置」里注册一个「全局人设」页面（settings.section），
 * 通过本地 HTTP 端点读写 Host 持久化的人设配置。
 * 修改立即生效：下一个模型步骤的系统提示词就会带上新人设。
 */
window.__ModuleLoader__.load({ id: 'dsh-global-persona', factory: (require) => {
  const module = { exports: {} }
  const exports = module.exports
  const React = require('react')
  const { useEffect, useRef, useState } = React
  const CONFIG_ENDPOINT = '/plugins/dsh-global-persona/config'

  const cardStyle = {
    display: 'grid',
    gap: 16,
    maxWidth: 640,
    padding: '4px 2px',
  }
  const headingStyle = {
    display: 'grid',
    gap: 4,
  }
  const titleStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: 0,
    fontSize: 17,
    fontWeight: 650,
    letterSpacing: '0.01em',
    color: 'var(--text-color, inherit)',
  }
  const subtitleStyle = {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.55,
    opacity: 0.62,
    color: 'var(--text-color, inherit)',
  }
  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '12px 14px',
    border: '1px solid var(--border-color, #d8d8d8)',
    borderRadius: 10,
    background: 'var(--surface-color, transparent)',
  }
  const editorStyle = {
    display: 'grid',
    gap: 8,
  }
  const textareaStyle = {
    width: '100%',
    minHeight: 220,
    padding: '12px 14px',
    boxSizing: 'border-box',
    border: '1px solid var(--border-color, #d8d8d8)',
    borderRadius: 10,
    background: 'var(--surface-color, transparent)',
    color: 'var(--text-color, inherit)',
    fontSize: 13.5,
    lineHeight: 1.7,
    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
    resize: 'vertical',
    outline: 'none',
  }
  const textareaFocusStyle = {
    borderColor: 'var(--accent-color, #7c8cf8)',
    boxShadow: '0 0 0 2px color-mix(in srgb, var(--accent-color, #7c8cf8) 22%, transparent)',
  }
  const toolbarStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  }
  const counterStyle = {
    fontSize: 12,
    opacity: 0.55,
    color: 'var(--text-color, inherit)',
  }
  const buttonStyle = {
    padding: '7px 18px',
    border: 'none',
    borderRadius: 8,
    background: 'var(--accent-color, #4f6ef7)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    opacity: 1,
  }
  const buttonDisabledStyle = {
    opacity: 0.55,
    cursor: 'default',
  }
  const statusStyle = {
    fontSize: 12.5,
    color: 'var(--text-color, inherit)',
    opacity: 0.75,
  }
  const previewStyle = {
    padding: '10px 14px',
    border: '1px dashed var(--border-color, #d8d8d8)',
    borderRadius: 10,
    fontSize: 12.5,
    lineHeight: 1.6,
    opacity: 0.75,
    color: 'var(--text-color, inherit)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: 120,
    overflow: 'auto',
    background: 'var(--surface-color, transparent)',
  }
  // 胶囊式开关（toggle switch）
  const switchBaseStyle = {
    position: 'relative',
    display: 'inline-block',
    width: 42,
    height: 24,
    borderRadius: 999,
    border: 'none',
    padding: 0,
    margin: 0,
    flexShrink: 0,
    cursor: 'pointer',
    background: 'var(--accent-color, #4f6ef7)',
    transition: 'background 0.18s ease',
  }
  const switchOffStyle = {
    background: 'var(--border-color, #c9c9c9)',
  }
  const switchDisabledStyle = {
    opacity: 0.55,
    cursor: 'default',
  }
  const knobStyle = {
    position: 'absolute',
    top: 2,
    left: 20,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.28)',
    transition: 'left 0.18s ease',
    pointerEvents: 'none',
  }

  function ToggleSwitch({ checked, disabled, onChange, label }) {
    return React.createElement('button', {
      type: 'button',
      role: 'switch',
      'aria-checked': checked === true,
      'aria-label': label,
      disabled: disabled,
      style: {
        ...switchBaseStyle,
        ...(checked === true ? null : switchOffStyle),
        ...(disabled ? switchDisabledStyle : null),
      },
      onClick: () => onChange(!(checked === true)),
    },
      React.createElement('span', {
        style: checked === true ? knobStyle : { ...knobStyle, left: 2 },
      }),
    )
  }

  function PersonaSection() {
    const [status, setStatus] = useState('loading') // loading | ready | unavailable
    const [value, setValue] = useState({ enabled: true, text: '' })
    const [draft, setDraft] = useState('')
    const [focused, setFocused] = useState(false)
    const [busy, setBusy] = useState(false)
    const [savedAt, setSavedAt] = useState(0)
    const seqRef = useRef(0)

    useEffect(() => {
      let active = true
      fetch(CONFIG_ENDPOINT, { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) throw new Error(`settings request failed: ${response.status}`)
          return response.json()
        })
        .then((next) => {
          if (!active) return
          setValue({ enabled: next.enabled !== false, text: typeof next.text === 'string' ? next.text : '' })
          setDraft(typeof next.text === 'string' ? next.text : '')
          setStatus('ready')
        })
        .catch(() => {
          if (active) setStatus('unavailable')
        })
      return () => {
        active = false
      }
    }, [])

    const write = async (patch) => {
      const seq = ++seqRef.current
      setBusy(true)
      try {
        const response = await fetch(CONFIG_ENDPOINT, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!response.ok) throw new Error(`settings write failed: ${response.status}`)
        const updated = await response.json()
        if (seq !== seqRef.current) return
        setValue({ enabled: updated.enabled !== false, text: typeof updated.text === 'string' ? updated.text : '' })
        setBusy(false)
        setSavedAt(Date.now())
      } catch {
        if (seq === seqRef.current) {
          setBusy(false)
          setStatus('unavailable')
        }
      }
    }

    const saveText = () => {
      if (draft === value.text) return
      void write({ text: draft })
    }

    const toggleEnabled = (checked) => {
      void write({ enabled: checked })
    }

    if (status === 'unavailable') {
      return React.createElement('div', { style: cardStyle },
        React.createElement('div', { style: headingStyle },
          React.createElement('h3', { style: titleStyle }, '全局人设'),
          React.createElement('p', { style: subtitleStyle }, '设置页面未能连接到 DSH Host，请确认服务运行正常。'),
        ),
        React.createElement('span', { role: 'status', style: statusStyle }, '无法读取全局人设配置。'),
      )
    }
    if (status === 'loading') {
      return React.createElement('div', { style: cardStyle },
        React.createElement('div', { style: headingStyle },
          React.createElement('h3', { style: titleStyle }, '全局人设'),
          React.createElement('p', { style: subtitleStyle }, '正在读取配置…'),
        ),
      )
    }

    const dirty = draft !== value.text
    return React.createElement('div', { style: cardStyle },
      React.createElement('div', { style: headingStyle },
        React.createElement('h3', { style: titleStyle }, '全局人设'),
        React.createElement('p', { style: subtitleStyle },
          '给所有 Agent 定一个统一的人设：无论新建哪个工作区、哪个会话，系统提示词都会带上这段话。修改后立即生效。',
        ),
      ),
      React.createElement('div', { style: rowStyle },
        React.createElement('div', { style: { display: 'grid', gap: 3 } },
          React.createElement('strong', { style: { fontSize: 13.5 } }, '启用全局人设'),
          React.createElement('small', { style: { opacity: 0.62, fontSize: 12 } },
            value.enabled ? '当前已生效' : '已关闭：所有会话恢复默认人设',
          ),
        ),
        React.createElement(ToggleSwitch, {
          checked: value.enabled === true,
          disabled: busy,
          label: '启用全局人设',
          onChange: toggleEnabled,
        }),
      ),
      React.createElement('div', { style: editorStyle },
        React.createElement('textarea', {
          value: draft,
          disabled: value.enabled === false || busy,
          placeholder: '例如：你是一位资深的全栈工程师，说话简洁直接，习惯先给结论再给理由……',
          style: focused ? { ...textareaStyle, ...textareaFocusStyle } : textareaStyle,
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          onChange: (event) => setDraft(event.target.value),
        }),
        React.createElement('div', { style: toolbarStyle },
          React.createElement('span', { style: counterStyle },
            `${draft.length} 字${dirty ? '（未保存）' : ''}`,
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            savedAt > 0 && !dirty && !busy
              ? React.createElement('span', { role: 'status', style: statusStyle }, `已保存 ${new Date(savedAt).toLocaleTimeString()}`)
              : busy
              ? React.createElement('span', { role: 'status', style: statusStyle }, '保存中…')
              : null,
            React.createElement('button', {
              type: 'button',
              disabled: !dirty || busy,
              style: (!dirty || busy) ? { ...buttonStyle, ...buttonDisabledStyle } : buttonStyle,
              onClick: saveText,
            }, '保存人设'),
          ),
        ),
      ),
      draft.trim().length > 0 && value.enabled !== false
        ? React.createElement('div', { style: previewStyle },
            React.createElement('strong', null, '注入效果预览：'), ' 每个新会话的系统提示词会追加以下内容 —',
            React.createElement('br', null),
            draft,
          )
        : null,
    )
  }

  function apply(ctx) {
    const registerSection = () => {
      try {
        ctx.slots.register({
          name: 'settings.section',
          id: 'global-persona',
          order: 5,
          label: '全局人设',
        }, PersonaSection)
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[dsh-global-persona] failed to register settings section:', error)
        }
      }
    }
    try {
      ctx.slots.inject('settings.section', registerSection)
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[dsh-global-persona] failed to inject settings slot:', error)
      }
    }
  }

  module.exports = {
    name: 'dsh-global-persona-client',
    inject: ['slots'],
    apply,
  }
  return module.exports
} })
