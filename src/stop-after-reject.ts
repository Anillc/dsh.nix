import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-user-approval'

export const name = 'stop-after-reject'

export function apply(ctx: Context) {
  const rejected = new Set<string>()

  ctx.on('approval/request', async (request, next) => {
    const outcome = await next()
    if (outcome === 'rejected') rejected.add(request.agent.id)
    return outcome
  }, true)

  ctx.on('agent/pre-step', async (payload, next) => {
    if (!rejected.delete(payload.agent.id)) return next()
    if (payload.messages.length > 0) return next()
    return { kind: 'reject' }
  }, true)

  ctx.on('session/event', (session, event) => {
    if (event.type === 'turn/end') rejected.delete(session.id)
  })
}
