import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'

export const name = 'prompt'
export const inject = ['systemPrompt']

const RULES = [
  'Your command tool runs in a sandbox and cannot reach the network. When a command needs network access, ask for it to run outside the sandbox with an escalated call. Tools like `web_fetch` reach the network fine from inside the sandbox.',
  'Missing a tool? Reach for nix before concluding it is unavailable. Build it **outside the sandbox** with an escalated bash call — `nix build --print-out-paths --no-link nixpkgs#<package>` — and use the printed store path, running its binaries directly (for example `<store-path>/bin/<command>`).',
  'When writing code, write no comments by default. Add one only where the code cannot carry the reason itself — a non-obvious constraint, a deliberate workaround, or a hazard a reader would otherwise trip over. Never restate what the code already says.',
].join('\n\n')

export function apply(ctx: Context) {
  ctx.effect(() =>
    ctx.systemPrompt.section({
      name: 'custom:prompt',
      order: 440,
      text: RULES,
      interpolate: false,
    }),
  )
}
