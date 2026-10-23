window.__ModuleLoader__.load({
  id: 'dsh-session-id',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'session-id'
    const STYLE_ID = 'dsh-session-id-style'
    const FEEDBACK_MS = 1400

    const CSS = [
      '.dsh-sid{display:inline-flex;align-items:center;min-height:28px;padding:3px 6px;border:0;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11px;line-height:16px;white-space:nowrap;-webkit-appearance:none;appearance:none;transition:color .12s}',
      '.dsh-sid:hover,.dsh-sid:focus-visible{color:var(--dsw-alias-label-secondary)}',
      '.dsh-sid:focus-visible{outline:2px solid var(--dsw-alias-border-l2);outline-offset:1px}',
      '.dsh-sid[data-feedback=copied]{color:var(--dsw-alias-state-success-primary)}',
      '.dsh-sid[data-feedback=failed]{color:var(--dsw-alias-state-error-primary)}',
      '.dsh-sid-announce{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
    ].join('\n')

    const en = {
      copy: 'Copy session ID',
      copied: 'Session ID copied',
      failed: 'Could not copy the session ID',
    }
    const zh = {
      copy: '复制 Session ID',
      copied: '已复制 Session ID',
      failed: '复制 Session ID 失败',
    }

    function installStyle() {
      const style = document.createElement('style')
      style.dataset.plugin = STYLE_ID
      style.textContent = CSS
      document.head.appendChild(style)
      return () => style.remove()
    }

    function writeClipboard(text) {
      const clipboard = navigator.clipboard
      if (clipboard !== undefined && typeof clipboard.writeText === 'function') {
        return clipboard.writeText(text)
      }
      return new Promise((resolve, reject) => {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.top = '-1000px'
        area.style.opacity = '0'
        document.body.appendChild(area)
        let copied = false
        try {
          area.select()
          copied = document.execCommand('copy')
        } catch {
          copied = false
        } finally {
          area.remove()
        }
        if (copied) resolve()
        else reject(new Error('clipboard unavailable'))
      })
    }

    function SessionIdChip({ sessionId, t }) {
      const [feedback, setFeedback] = React.useState('idle')
      const timer = React.useRef(0)
      const translate = typeof t === 'function' ? t : (key) => en[key] ?? key

      React.useEffect(() => () => {
        if (timer.current !== 0) window.clearTimeout(timer.current)
      }, [])

      if (typeof sessionId !== 'string' || sessionId === '') return null

      const copy = () => {
        if (timer.current !== 0) window.clearTimeout(timer.current)
        const settle = (next) => {
          setFeedback(next)
          timer.current = window.setTimeout(() => setFeedback('idle'), FEEDBACK_MS)
        }
        writeClipboard(sessionId).then(() => settle('copied'), () => settle('failed'))
      }

      const announcement = feedback === 'copied' ? translate('copied') : feedback === 'failed' ? translate('failed') : ''

      return h('button', {
        type: 'button',
        className: 'dsh-sid',
        title: sessionId,
        'aria-label': `${translate('copy')}: ${sessionId}`,
        'data-feedback': feedback,
        onClick: copy,
      }, sessionId, h('span', {
        className: 'dsh-sid-announce',
        role: 'status',
        'aria-live': 'polite',
      }, announcement))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'session-id: dictionaries')
        ctx.effect(() => installStyle(), 'session-id: styles')
        ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
          name: 'conversation.session.header.actions',
          id: 'session-id',
          order: 0,
          locale: NS,
        }, SessionIdChip))
      },
    }
  },
})
