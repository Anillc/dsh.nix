import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-system-prompt'

export const name = 'creator-playbook'
export const inject = ['agents', 'agentPresets', 'systemPrompt']

const PLAYBOOK = [
  'This workspace is a Nix-deployed DSH checkout: flake.nix at the root, node_modules a symlink into /nix/store. Add dependencies and mount plugins like this, never with npm or pnpm directly:',
  '1. Dependencies live in package.dependencies in flake.nix: `"<pkg>" = "latest"`.',
  '2. Run `nix develop` from the repo root (non-interactively: `nix develop --command bash -c true`). It builds node_modules and its shellHook relinks node_modules, package.json and package-lock.json; without that hook nothing is linked.',
  '3. Write the plugin as `src/<name>.ts` — a Host plugin exporting `apply(ctx)` and registering every resource through `ctx.effect` — then add one row to `cordis.patch.yml`: `- insert: [{ id: <name>, name: ./src/<name>.ts }]`. A relative name is anchored beside the patch file.',
  '4. Saving is enough: HMR reloads the module, or the row config, without a restart. Confirm the row through `cordis_inspect_query` `Config.listConfigs`, then exercise the capability itself.',
].join('\n')

export function apply(ctx: Context) {
  const sections = new Map<Agent, () => void>()

  const drop = (agent: Agent) => {
    sections.get(agent)?.()
    sections.delete(agent)
  }

  const sync = (agent: Agent) => {
    const wanted = ctx.agentPresets.composedPreset(agent.ctx) === 'cordis'
    if (wanted === sections.has(agent)) return
    if (wanted) sections.set(agent, agent.ctx.systemPrompt.section({
      name: 'creator:playbook',
      order: 450,
      text: PLAYBOOK,
    }))
    else drop(agent)
  }

  for (const agent of ctx.agents.list()) sync(agent)
  ctx.on('agent/created', ({ agent }) => void sync(agent))
  ctx.on('agent-preset/selected', (sessionId) => {
    const agent = ctx.agents.get(sessionId)
    if (agent !== undefined) sync(agent)
  })
  ctx.on('agent/disposed', ({ agent }) => drop(agent))
  ctx.effect(() => () => {
    for (const dispose of sections.values()) dispose()
    sections.clear()
  })
}
