import type { Context } from '@deepseek-ai/cordis'
import type { ModelSelection } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-default-model'

export const name = 'no-model-persist'
export const inject = ['agentDefaultModel']

type DefaultModel = {
  currentSelection(): ModelSelection
  saveSelection(next: ModelSelection): Promise<void>
}

export function apply(ctx: Context) {
  ctx.effect(() => {
    const service = ctx.agentDefaultModel as unknown as DefaultModel
    const read = service.currentSelection.bind(service)
    let pinned: ModelSelection | undefined
    service.currentSelection = () => (pinned === undefined ? read() : { ...pinned })
    service.saveSelection = async (next: ModelSelection) => {
      pinned = { ...next }
    }
    return () => {
      delete (service as Partial<DefaultModel>).currentSelection
      delete (service as Partial<DefaultModel>).saveSelection
    }
  })
}
