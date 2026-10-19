import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'

export const name = 'prompt'
export const inject = ['systemPrompt']

const RULES = [
  'Missing a tool? Reach for nix before concluding it is unavailable: run it for one command as `nix shell nixpkgs#<package> -c <command>` (or `nix run nixpkgs#<package> -- <args>`). Nix itself runs outside the sandbox, so use an escalated bash call when the sandboxed one cannot reach the network.',
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
