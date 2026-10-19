window.__ModuleLoader__.load({
  id: 'dsh-fork-at',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const STYLE_ID = 'dsh-fork-at-style'
    const CSS = [
      '.dsh-fork-at-pop{position:fixed;z-index:100;display:flex;gap:2px;align-items:center;padding:2px;border-radius:9px;border:.5px solid rgba(0,0,0,.12);background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.18)}',
      '.dsh-fork-at-pop[hidden]{display:none}',
      '.dsh-fork-at-pop button{-webkit-appearance:none;font:inherit;font-size:11px;line-height:16px;padding:1px 8px;border-radius:7px;border:none;background:transparent;color:#3a3a3a;cursor:pointer;white-space:nowrap}',
      '.dsh-fork-at-pop button:hover{background:#f0f0f0;color:#111}',
      '.dsh-fork-at-pop button[hidden]{display:none}',
      '.dsh-fork-at-action{width:calc(28px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;padding:6px;display:inline-flex}',
      '.dsh-fork-at-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
      '.dsh-fork-at-action svg{width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px))}',
      '.dsh-fork-at-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:90;pointer-events:none;max-width:min(560px,calc(100vw - 48px));padding:8px 14px;border-radius:10px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;box-shadow:0 10px 28px rgba(0,0,0,.24)}',
    ].join('\n')

    const TEXT = {
      fork: 'Fork',
      forkTitle: 'Branch a new session after this row and keep this session',
      insert: 'Insert',
      insertTitle: 'Branch a new session after this row and archive this session',
      edit: 'Edit',
      editTitle: 'Branch before this message, archive this session, and put the original text back in the composer',
      missing: 'This row is no longer in the transcript.',
      pending: 'This content is still being produced; try again once it settles.',
      noPosition: 'There is no durable position here yet.',
      noSession: 'Session service is unavailable.',
      forkFailed: 'Fork failed: ',
      insertFailed: 'Insert failed: ',
      noArchive: 'Branched, but could not archive this session: the workspace service is unavailable.',
      archiveFailed: 'Branched, but archiving this session failed: ',
      prefillFailed: 'Branched, but the original text could not be placed in the composer.',
    }

    const HIDE_DELAY_MS = 160
    const PENCIL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19l3.5-.8L19 7.7 16.3 5 5.8 15.5 5 19z"/><path d="M13.8 7.5l2.7 2.7"/></svg>'

    const store = {
      toast: '',
      calls: new Map(),
      rows: new Map(),
      messages: new Map(),
      closing: new Set(),
      sessionId: null,
      listeners: new Set(),
    }
    let ctxRef = null
    let hidePopover = () => {}
    let toastTimer = 0
    let pendingDraft = null

    function emit() {
      for (const listener of [...store.listeners]) {
        try { listener() } catch { /* listener failures stay local */ }
      }
    }

    function messageOf(error) {
      if (error instanceof Error) return error.message
      return String(error)
    }

    function notify(text) {
      store.toast = text
      if (toastTimer) clearTimeout(toastTimer)
      toastTimer = setTimeout(() => { store.toast = ''; emit() }, 5000)
      emit()
    }

    function collectCalls(node, calls) {
      const visit = (block) => {
        if (block === null || typeof block !== 'object') return
        if (typeof block.callId === 'string') {
          calls.set(block.callId, {
            seq: block.kind === 'tool-result' ? block.seq : null,
            anchorSeq: node.anchorSeq,
            durable: block.kind === 'tool-result' || block.phase === 'start',
          })
        }
        if (Array.isArray(block.subCalls)) for (const sub of block.subCalls) visit(sub)
      }
      visit(node.data?.root)
    }

    function userText(content) {
      if (!Array.isArray(content)) return ''
      return content
        .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n')
    }

    function rebuild(nodes) {
      const calls = new Map()
      const rows = new Map()
      const messages = new Map()
      const closing = new Set()
      for (const node of nodes) {
        const seq = node.anchorSeq
        const settled = node.kind === 'assistant-step' ? node.data?.status !== 'running'
          : node.kind === 'tool-call' ? node.data?.root?.phase !== 'preparing'
            : true
        rows.set(node.key, {
          kind: node.kind,
          seq,
          durable: typeof seq === 'number' && seq >= 0 && settled,
          text: node.kind === 'user' || node.kind === 'steering' ? userText(node.data?.content) : '',
        })
        if (node.kind === 'tool-call') collectCalls(node, calls)
        const closingNode = node.data?.closing?.finalNode
        if (closingNode !== undefined && closingNode !== null && typeof closingNode.seq === 'number') closing.add(closingNode.seq)
        const finalNode = node.data?.finalNode ?? closingNode
        if (finalNode !== undefined && finalNode !== null
          && typeof finalNode.messageId === 'string' && typeof finalNode.seq === 'number') {
          messages.set(finalNode.messageId, finalNode.seq)
        }
      }
      store.calls = calls
      store.rows = rows
      store.messages = messages
      store.closing = closing
    }

    function requireSeq(info) {
      if (info === undefined) {
        notify(TEXT.missing)
        return undefined
      }
      if (!info.durable) {
        notify(TEXT.pending)
        return undefined
      }
      const seq = typeof info.seq === 'number' ? info.seq : info.anchorSeq
      if (typeof seq !== 'number' || seq < 0) {
        notify(TEXT.noPosition)
        return undefined
      }
      return seq
    }

    async function forkSeq(seq) {
      const sessions = ctxRef?.get('sessions')
      if (sessions === undefined || sessions === null || typeof store.sessionId !== 'string') {
        notify(TEXT.noSession)
        return
      }
      try {
        const childId = await sessions.fork({ sessionId: store.sessionId, atSeq: seq, increaseTitle: true })
        ctxRef?.get('uiWorkspace')?.openSession(childId)
      } catch (error) {
        notify(TEXT.forkFailed + messageOf(error))
      }
    }

    async function branch(seq, prefill) {
      const sessions = ctxRef?.get('sessions')
      if (sessions === undefined || sessions === null || typeof store.sessionId !== 'string') {
        notify(TEXT.noSession)
        return
      }
      const parentId = store.sessionId
      const workspaces = ctxRef?.get('workspaces')
      let childId
      try {
        childId = await sessions.fork({ sessionId: parentId, atSeq: seq, increaseTitle: true })
      } catch (error) {
        notify(TEXT.insertFailed + messageOf(error))
        return
      }
      if (typeof prefill === 'string' && prefill !== '') pendingDraft = { sessionId: childId, text: prefill }
      ctxRef?.get('uiWorkspace')?.openSession(childId)
      if (workspaces === undefined || workspaces === null) {
        notify(TEXT.noArchive)
        return
      }
      try {
        await workspaces.archiveSession(parentId, { stopActivity: true })
      } catch (error) {
        notify(TEXT.archiveFailed + messageOf(error))
      }
    }

    function insertAt(seq) {
      void branch(seq)
    }

    function editMessage(seq, text) {
      void branch(seq - 1, text)
    }

    function resolveTarget(target) {
      const call = target.closest('[data-chat-call-id]')
      if (call !== null) {
        const callId = call.dataset.chatCallId
        if (typeof callId === 'string' && store.calls.has(callId)) {
          const pick = () => requireSeq(store.calls.get(callId))
          return { element: call, pick }
        }
      }
      const row = target.closest('[data-chat-node-key]')
      if (row === null) return undefined
      const key = row.dataset.chatNodeKey
      const info = typeof key === 'string' ? store.rows.get(key) : undefined
      if (info === undefined || info.kind !== 'assistant-step' || !info.durable) return undefined
      if (store.closing.has(info.seq)) return undefined
      return { element: row, pick: () => requireSeq(store.rows.get(key)) }
    }

    function decorate() {
      for (const row of document.querySelectorAll('[data-chat-node-key]')) {
        if (!(row instanceof HTMLElement)) continue
        const key = row.dataset.chatNodeKey
        const info = typeof key === 'string' ? store.rows.get(key) : undefined
        if (info === undefined || (info.kind !== 'user' && info.kind !== 'steering') || !info.durable) continue
        const actions = row.querySelector('[data-clock="start"]')
        if (actions === null || actions.querySelector(':scope > [data-fork-at-edit]') !== null) continue
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'dsh-fork-at-action'
        button.dataset.forkAtEdit = ''
        button.title = TEXT.editTitle
        button.setAttribute('aria-label', TEXT.edit)
        button.innerHTML = PENCIL_SVG
        button.addEventListener('pointerdown', (event) => { event.stopPropagation() })
        button.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          const current = store.rows.get(key)
          const seq = requireSeq(current)
          if (seq !== undefined) editMessage(seq, current.text)
        })
        actions.appendChild(button)
      }
    }

    function installDom() {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = CSS
      document.head.appendChild(style)

      const pop = document.createElement('div')
      pop.className = 'dsh-fork-at-pop'
      pop.hidden = true
      const forkButton = document.createElement('button')
      forkButton.type = 'button'
      forkButton.textContent = TEXT.fork
      forkButton.title = TEXT.forkTitle
      const insertButton = document.createElement('button')
      insertButton.type = 'button'
      insertButton.textContent = TEXT.insert
      insertButton.title = TEXT.insertTitle
      pop.append(forkButton, insertButton)
      document.body.appendChild(pop)

      let current = null
      let hideTimer = 0

      const hide = () => {
        clearTimeout(hideTimer)
        current = null
        pop.hidden = true
      }
      hidePopover = hide

      const scheduleHide = () => {
        clearTimeout(hideTimer)
        hideTimer = setTimeout(hide, HIDE_DELAY_MS)
      }

      const show = (found) => {
        current = found
        pop.hidden = false
        const rect = found.element.getBoundingClientRect()
        const width = pop.offsetWidth
        const height = pop.offsetHeight
        const left = Math.min(Math.max(8, rect.right - width - 8), window.innerWidth - width - 8)
        const top = Math.min(Math.max(8, rect.bottom - height - 4), window.innerHeight - height - 8)
        pop.style.left = `${left}px`
        pop.style.top = `${top}px`
      }

      forkButton.addEventListener('click', () => {
        const seq = current?.pick?.()
        if (typeof seq !== 'number') return
        hide()
        void forkSeq(seq)
      })
      insertButton.addEventListener('click', () => {
        const seq = current?.pick?.()
        if (typeof seq !== 'number') return
        hide()
        insertAt(seq)
      })

      const canHover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? true

      const onOver = (event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        if (pop.contains(target)) {
          clearTimeout(hideTimer)
          return
        }
        const found = resolveTarget(target)
        if (found === undefined) {
          if (current !== null) scheduleHide()
          return
        }
        clearTimeout(hideTimer)
        if (current !== null && current.element === found.element) return
        show(found)
      }

      const onOut = (event) => {
        if (current === null) return
        const related = event.relatedTarget
        if (related instanceof Node && (current.element.contains(related) || pop.contains(related))) return
        scheduleHide()
      }

      const onDown = (event) => {
        if (event.pointerType === 'mouse') return
        const target = event.target
        if (!(target instanceof Element)) return
        if (pop.contains(target)) return
        const found = resolveTarget(target)
        if (found === undefined) {
          hide()
          return
        }
        if (found.element instanceof HTMLElement) {
          if (!found.element.hasAttribute('tabindex')) found.element.tabIndex = -1
          found.element.focus({ preventScroll: true })
        }
        clearTimeout(hideTimer)
        show(found)
      }

      const onFocusIn = (event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        if (pop.contains(target)) {
          clearTimeout(hideTimer)
          return
        }
        const found = resolveTarget(target)
        if (found === undefined) return
        clearTimeout(hideTimer)
        show(found)
      }

      const onFocusOut = (event) => {
        if (current === null) return
        const related = event.relatedTarget
        if (related instanceof Node && (current.element.contains(related) || pop.contains(related))) return
        scheduleHide()
      }

      let frame = 0
      const scheduleDecorate = () => {
        if (frame !== 0) return
        frame = requestAnimationFrame(() => { frame = 0; decorate() })
      }
      const observer = new MutationObserver(scheduleDecorate)
      observer.observe(document.body, { childList: true, subtree: true })
      scheduleDecorate()

      pop.addEventListener('mouseenter', () => { clearTimeout(hideTimer) })
      pop.addEventListener('mouseleave', scheduleHide)
      document.addEventListener('pointerdown', onDown)
      if (canHover) {
        document.addEventListener('mouseover', onOver)
        document.addEventListener('mouseout', onOut)
      } else {
        document.addEventListener('focusin', onFocusIn)
        document.addEventListener('focusout', onFocusOut)
      }
      window.addEventListener('scroll', hide, true)
      window.addEventListener('resize', hide)

      return () => {
        hide()
        observer.disconnect()
        if (frame !== 0) cancelAnimationFrame(frame)
        pop.remove()
        style.remove()
        for (const button of document.querySelectorAll('[data-fork-at-edit]')) button.remove()
        document.removeEventListener('pointerdown', onDown)
        document.removeEventListener('mouseover', onOver)
        document.removeEventListener('mouseout', onOut)
        document.removeEventListener('focusin', onFocusIn)
        document.removeEventListener('focusout', onFocusOut)
        window.removeEventListener('scroll', hide, true)
        window.removeEventListener('resize', hide)
      }
    }

    function useStore() {
      const [, force] = React.useState(0)
      React.useEffect(() => {
        const listener = () => force((value) => value + 1)
        store.listeners.add(listener)
        return () => { store.listeners.delete(listener) }
      }, [])
      return store
    }

    function Dock(props) {
      const sessionId = props.sessionId
      const useChat = typeof props.useChat === 'function' ? props.useChat : () => undefined
      const order = useChat((snapshot) => snapshot.order)
      const nodesStore = useChat((snapshot) => snapshot.nodes)

      React.useEffect(() => {
        store.sessionId = typeof sessionId === 'string' ? sessionId : null
        store.calls = new Map()
        store.rows = new Map()
        store.messages = new Map()
        store.closing = new Set()
        hidePopover()
        if (nodesStore !== undefined && nodesStore !== null && typeof nodesStore.values === 'function') {
          rebuild(nodesStore.values())
        }
        if (pendingDraft !== null && pendingDraft.sessionId === sessionId) {
          const draft = pendingDraft
          pendingDraft = null
          const inputActions = props.inputActions
          requestAnimationFrame(() => {
            try {
              inputActions?.setDraft(draft.text)
            } catch {
              notify(TEXT.prefillFailed)
            }
          })
        }
        return () => {
          if (store.sessionId === sessionId) store.sessionId = null
        }
      }, [sessionId])

      React.useEffect(() => {
        if (nodesStore === undefined || nodesStore === null || typeof nodesStore.values !== 'function') return
        rebuild(nodesStore.values())
        decorate()
      }, [order, nodesStore])

      return null
    }

    function InsertAction(props) {
      const messageId = props.messageId
      return h('button', {
        type: 'button',
        className: 'dsh-fork-at-action',
        title: TEXT.insertTitle,
        'aria-label': TEXT.insert,
        onClick: () => {
          const seq = store.messages.get(messageId)
          if (typeof seq !== 'number') {
            notify(TEXT.missing)
            return
          }
          insertAt(seq)
        },
      }, h('svg', {
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      }, [
        h('path', { key: 'top', d: 'M12 5v9' }),
        h('path', { key: 'arrow', d: 'M8.5 10.5L12 14l3.5-3.5' }),
        h('path', { key: 'line', d: 'M5 19h14' }),
      ]))
    }

    function Overlay() {
      const state = useStore()
      if (state.toast === '') return null
      return h('div', { className: 'dsh-fork-at-toast', role: 'status' }, state.toast)
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctxRef = ctx
        ctx.effect(() => installDom())
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'fork-at',
          order: 900,
        }, Dock))
        ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
          name: 'conversation.chat.assistant-actions',
          id: 'fork-at-insert',
          order: 50,
        }, InsertAction))
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'fork-at-toast',
          order: 900,
        }, Overlay))
      },
    }
  },
})
