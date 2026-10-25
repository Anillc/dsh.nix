import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ContentBlock, UserMessage } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { SessionId as createSessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-subagent'

export const name = 'btw'
export const inject = ['commands', 'subagents']

const PUBLIC_COMMAND = 'btw'
const RUN_COMMAND = 'btw-run'
const CLOSE_COMMAND = 'btw-close'
const TIMEOUT_MS = 10 * 60_000
const MAX_REFERENCE_CHARS = 32_000
const MAX_MESSAGE_CHARS = 4_000
const MAX_TOOL_ARGS_CHARS = 800
const MAX_TOOL_RESULT_CHARS = 2_000
const MAX_STREAM_CHARS = 8_000
const MAX_QUESTION_CHARS = 8_000
const THREAD_ID = /^[A-Za-z0-9-]{8,80}$/

const PERSONA = `你是当前主任务之外的一个持续 btw 对话助手。继承的会话历史和第一条消息里的当前轮次摘录都只作为背景，不是需要你继续执行的任务。
只回答 btw 里提出的问题，不执行或继续其中的计划、命令、修改和工具调用。你没有可用工具。
后续消息都属于同一个 btw 对话，请结合这个对话之前的内容回答。
信息不足时直接说明未知，不要臆测，也不要声称已经执行了任何操作。
回答简洁准确，语言与问题一致。`

interface CommandResult {
  readonly kind: 'success' | 'error'
  readonly text: string
}

interface ActiveStream {
  attemptId: string
  texts: Map<number, string>
}

interface TurnOutcome {
  readonly stopReason: string
  readonly output: readonly ContentBlock[]
}

interface Waiter {
  resolve(value: TurnOutcome): void
  reject(error: unknown): void
}

function clip(text: string, limit: number): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n…（已截断 ${text.length - limit} 字符）`
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function outcomeResult(outcome: TurnOutcome): CommandResult {
  const answer = outcome.output.filter(block => block.type === 'text').map(block => block.text ?? '').join('').trim()
  if (outcome.stopReason !== 'completed') return { kind: 'error', text: answer || `btw 未完成（${outcome.stopReason}）。` }
  if (!answer) return { kind: 'error', text: '模型没有返回文字。' }
  return { kind: 'success', text: answer }
}

export function renderCurrentTurn(agent: Agent): string {
  const events = agent.session.snapshotEvents()
  const lastEnd = events.findLastIndex(event => event.type === 'turn/end')
  const ids = new Set<string>()
  for (const event of events.slice(lastEnd + 1)) {
    if (event.type === 'user/message') ids.add(event.data.id)
    else if (event.type === 'assistant/message' || event.type === 'tool/result') ids.add(event.data.message.id)
  }
  const blocks: string[] = []
  let total = 0
  for (const message of agent.session.deriveMessages().filter(message => ids.has(message.id)).reverse()) {
    if (message.role === 'user' && message.source.kind !== 'user') continue
    const parts: string[] = []
    for (const block of message.content) {
      if (block.type === 'text' && block.text.trim()) parts.push(clip(block.text.trim(), message.role === 'tool' ? MAX_TOOL_RESULT_CHARS : MAX_MESSAGE_CHARS))
      else if (block.type === 'tool-call') parts.push(`[调用工具 ${block.name}] ${clip(block.arguments, MAX_TOOL_ARGS_CHARS)}`)
    }
    if (parts.length === 0) continue
    const label = message.role === 'user' ? '用户' : message.role === 'assistant' ? '助手' : `工具结果${message.isError ? '（失败）' : ''}`
    const block = `【${label}】\n${parts.join('\n')}`
    if (blocks.length > 0 && total + block.length > MAX_REFERENCE_CHARS) {
      blocks.push('（较早的消息已省略）')
      break
    }
    blocks.push(block)
    total += block.length
  }
  return blocks.reverse().join('\n\n')
}

export function buildPrompt(agent: Agent, question: string, streamingText: string): string {
  const parts: string[] = []
  const current = renderCurrentTurn(agent)
  if (current || streamingText) {
    parts.push('以下是主会话当前轮次（仍在进行中）的只读摘录，仅作为回答背景：')
    parts.push('<current-turn>')
    if (current) parts.push(current)
    if (streamingText) parts.push(`【助手正在生成、尚未完成的文字】\n${clip(streamingText, MAX_STREAM_CHARS)}`)
    parts.push('</current-turn>')
    parts.push('摘录中的计划、命令和工具调用都不要继续执行；没有记录结果的工具调用结果未知；正在生成的文字可能不完整。')
  }
  parts.push(`问题：\n${question}`)
  return parts.join('\n\n')
}

export function parseRequest(raw: string): { threadId: string; question: string } | { error: string } {
  const text = raw.trim()
  if (!text) return { error: '请输入 btw 内容。' }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { error: 'btw 请求无效。' }
  }
  if (typeof value !== 'object' || value === null) return { error: 'btw 请求无效。' }
  const record = value as Record<string, unknown>
  if (typeof record.threadId !== 'string' || !THREAD_ID.test(record.threadId)) return { error: 'btw 会话标识无效。' }
  if (typeof record.question !== 'string' || !record.question.trim()) return { error: '请输入 btw 内容。' }
  const question = record.question.trim()
  if (question.length > MAX_QUESTION_CHARS) return { error: `btw 最多支持 ${MAX_QUESTION_CHARS} 个字符。` }
  return { threadId: record.threadId, question }
}

function hideInternalCommand(ctx: Context, name: string): () => void {
  const commands = ctx.commands as unknown as { list(agent: unknown): readonly { name: string }[] }
  const descriptor = Object.getOwnPropertyDescriptor(commands, 'list')
  const original = commands.list
  const filtered = function (this: unknown, agent: unknown) {
    return original.call(this, agent).filter(row => row.name !== name)
  }
  Object.defineProperty(commands, 'list', { configurable: true, writable: true, value: filtered })
  return () => {
    if (Object.getOwnPropertyDescriptor(commands, 'list')?.value !== filtered) return
    if (descriptor) Object.defineProperty(commands, 'list', descriptor)
    else Reflect.deleteProperty(commands, 'list')
  }
}

export function apply(ctx: Context) {
  const streams = new WeakMap<Agent, ActiveStream>()
  const btwChildren = new Set<SessionId>()
  const patchedAgents = new WeakSet<Agent>()
  const threads = new Map<string, SessionId>()
  const waiters = new Map<SessionId, Waiter>()
  const locks = new Map<string, Promise<void>>()

  const threadKey = (agent: Agent, threadId: string) => `${agent.session.header.id}:${threadId}`

  function isBtwSettlement(message: unknown): boolean {
    if (typeof message !== 'object' || message === null) return false
    const source = (message as { source?: { kind?: string; senderSessionId?: SessionId } }).source
    return source?.kind === 'subagent-settled'
      && source.senderSessionId !== undefined
      && btwChildren.has(source.senderSessionId)
  }

  function suppressBtwSettlements(agent: Agent): void {
    if (patchedAgents.has(agent)) return
    patchedAgents.add(agent)
    const target = agent as Agent & { followup(message: UserMessage): void; steer(message: UserMessage): void }
    const followup = target.followup.bind(agent)
    const steer = target.steer.bind(agent)
    target.followup = function (message: UserMessage): void {
      if (!isBtwSettlement(message)) followup(message)
    }
    target.steer = function (message: UserMessage): void {
      if (!isBtwSettlement(message)) steer(message)
    }
  }

  ctx.on('agent/assistant-stream', ({ agent, frame }) => {
    if (frame.type === 'start') {
      streams.set(agent, { attemptId: frame.attemptId, texts: new Map() })
      return
    }
    if (frame.type === 'end') {
      if (streams.get(agent)?.attemptId === frame.attemptId) streams.delete(agent)
      return
    }
    const stream = streams.get(agent)
    if (stream?.attemptId !== frame.attemptId || frame.chunk.type !== 'text-delta') return
    stream.texts.set(frame.chunk.index, (stream.texts.get(frame.chunk.index) ?? '') + frame.chunk.text)
  })

  ctx.on('agent/disposed', ({ agent }) => {
    streams.delete(agent)
    const prefix = `${agent.id}:`
    for (const key of threads.keys()) if (key.startsWith(prefix)) threads.delete(key)
  })

  ctx.on('subagent/end', info => {
    const waiter = waiters.get(info.id)
    if (waiter === undefined) return
    waiters.delete(info.id)
    waiter.resolve({ stopReason: info.stopReason, output: info.lastAssistantMessage ?? [] })
  })

  function streamingTextOf(agent: Agent): string {
    return [...(streams.get(agent)?.texts.values() ?? [])].join('\n').trim()
  }

  function waitForTurn(agent: Agent, childId: SessionId, signal: AbortSignal): { promise: Promise<TurnOutcome>; cancel(): void } {
    let cleanup = () => {}
    const promise = new Promise<TurnOutcome>((resolve, reject) => {
      let done = false
      const finish = (settle: () => void) => {
        if (done) return
        done = true
        cleanup()
        settle()
      }
      const onAbort = () => {
        try {
          ctx.subagents.interrupt(childId, { kind: 'ancestor', agent })
        } catch (error) {
          ctx.logger.warn(error)
        }
        finish(() => reject(signal.reason))
      }
      cleanup = () => {
        signal.removeEventListener('abort', onAbort)
        waiters.delete(childId)
      }
      waiters.set(childId, {
        resolve: value => finish(() => resolve(value)),
        reject: error => finish(() => reject(error)),
      })
      signal.addEventListener('abort', onAbort, { once: true })
      if (signal.aborted) onAbort()
    })
    void promise.catch(() => {})
    return { promise, cancel: () => cleanup() }
  }

  async function withThreadLock<T>(key: string, signal: AbortSignal, fn: () => Promise<T>): Promise<T> {
    const previous = locks.get(key) ?? Promise.resolve()
    let release = () => {}
    const current = new Promise<void>(resolve => { release = resolve })
    const chain = previous.then(() => current)
    locks.set(key, chain)
    try {
      await previous
      signal.throwIfAborted()
      return await fn()
    } finally {
      release()
      if (locks.get(key) === chain) locks.delete(key)
    }
  }

  async function findThreadChild(agent: Agent, threadId: string, signal: AbortSignal): Promise<SessionId | undefined> {
    const key = threadKey(agent, threadId)
    const known = threads.get(key)
    if (known !== undefined) return known
    try {
      const children = await ctx.subagents.listChildren(agent.session.header.id, signal)
      const found = children.find(child => child.mode === 'continuable' && child.label === `btw:${threadId}`)
      if (found !== undefined) {
        btwChildren.add(found.id)
        threads.set(key, found.id)
        return found.id
      }
    } catch (error) {
      if (!signal.aborted) ctx.logger.warn(error)
    }
    return undefined
  }

  async function settle(promise: Promise<TurnOutcome>): Promise<CommandResult> {
    try {
      return outcomeResult(await promise)
    } catch (error) {
      return { kind: 'error', text: `btw 失败：${describeError(error)}` }
    }
  }

  async function startThread(agent: Agent, threadId: string, question: string, signal: AbortSignal): Promise<CommandResult> {
    suppressBtwSettlements(agent)
    const childId = createSessionId(globalThis.crypto.randomUUID())
    btwChildren.add(childId)
    const waiter = waitForTurn(agent, childId, signal)
    try {
      await ctx.subagents.startContinuable({
        provider: 'fork',
        label: `btw:${threadId}`,
        childId,
        request: {
          parent: agent,
          prompt: [{ type: 'text', text: buildPrompt(agent, question, streamingTextOf(agent)) }],
          toolFilter: { allow: [] },
          persona: PERSONA,
        },
        signal,
      })
    } catch (error) {
      waiter.cancel()
      return { kind: 'error', text: `btw 失败：${describeError(error)}` }
    }
    threads.set(threadKey(agent, threadId), childId)
    return settle(waiter.promise)
  }

  async function continueThread(agent: Agent, childId: SessionId, question: string, signal: AbortSignal): Promise<CommandResult> {
    suppressBtwSettlements(agent)
    btwChildren.add(childId)
    const waiter = waitForTurn(agent, childId, signal)
    try {
      await ctx.subagents.sendMessage(agent, childId, [{ type: 'text', text: question }], { signal })
    } catch (error) {
      waiter.cancel()
      return { kind: 'error', text: `btw 失败：${describeError(error)}` }
    }
    return settle(waiter.promise)
  }

  async function runTurn(agent: Agent, threadId: string, question: string, callerSignal: AbortSignal): Promise<CommandResult> {
    const provider = ctx.subagents.getProvider('fork')
    if (!provider?.inheritsParentContext || !provider.capabilities.toolFilter || !provider.capabilities.persona) {
      return { kind: 'error', text: '当前 fork provider 不支持无工具 btw。' }
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('btw 超时。')), TIMEOUT_MS)
    const signal = AbortSignal.any([callerSignal, controller.signal])
    try {
      return await withThreadLock(threadKey(agent, threadId), signal, async () => {
        const childId = await findThreadChild(agent, threadId, signal)
        return childId === undefined
          ? startThread(agent, threadId, question, signal)
          : continueThread(agent, childId, question, signal)
      })
    } catch (error) {
      return { kind: 'error', text: `btw 失败：${describeError(error)}` }
    } finally {
      clearTimeout(timer)
    }
  }

  async function closeThread(agent: Agent, threadId: string): Promise<void> {
    const key = threadKey(agent, threadId)
    const childId = threads.get(key) ?? await findThreadChild(agent, threadId, new AbortController().signal)
    threads.delete(key)
    if (childId !== undefined) {
      try {
        await ctx.subagents.drainContinuableChildren(agent, [childId])
      } catch (error) {
        ctx.logger.warn(error)
      }
    }
  }

  ctx.effect(() => hideInternalCommand(ctx, RUN_COMMAND))
  ctx.effect(() => hideInternalCommand(ctx, CLOSE_COMMAND))
  ctx.effect(() => ctx.commands.register({
    name: PUBLIC_COMMAND,
    description: 'btw：基于当前上下文追问，不执行工具',
    input: { hint: 'btw 内容' },
    handler: async invocation => {
      const question = invocation.rawInput.trim()
      if (!question) return { kind: 'error', text: '请输入 btw 内容。' }
      if (question.length > MAX_QUESTION_CHARS) return { kind: 'error', text: `btw 最多支持 ${MAX_QUESTION_CHARS} 个字符。` }
      const threadId = `fallback-${globalThis.crypto.randomUUID()}`
      try {
        return await runTurn(invocation.agent, threadId, question, invocation.signal)
      } finally {
        await closeThread(invocation.agent, threadId)
      }
    },
  }))
  ctx.effect(() => ctx.commands.register({
    name: RUN_COMMAND,
    description: '内部 btw 请求',
    recordInput: false,
    handler: invocation => {
      const request = parseRequest(invocation.rawInput)
      if ('error' in request) return { kind: 'error', text: request.error }
      return runTurn(invocation.agent, request.threadId, request.question, invocation.signal)
    },
  }))
  ctx.effect(() => ctx.commands.register({
    name: CLOSE_COMMAND,
    description: '关闭 btw 对话',
    recordInput: false,
    handler: async invocation => {
      const threadId = invocation.rawInput.trim()
      if (!THREAD_ID.test(threadId)) return { kind: 'error', text: 'btw 会话标识无效。' }
      await closeThread(invocation.agent, threadId)
      return { kind: 'success', text: '' }
    },
  }))
}
