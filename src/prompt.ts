import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'

export const name = 'prompt'
export const inject = ['systemPrompt']

const RULES = [
  '## Sandbox, network, and packages',
  [
    '- The `bash` tool is confined: no network, and writes land only inside the workspace. A network-using command fails under that confinement — that failure is not evidence the command is broken or the task impossible.',
    '- To run one, retry that exact command **once** as an escalated call: `sandbox_permissions: "danger-full-access"` plus a one-sentence `justification`. The approval prompt is how the user consents — do not also ask in chat, and do not hand back a degraded answer before that retry.',
    '- `nix` is installed and is how you obtain tools. When a CLI or package is missing from the sandbox, build it in that one escalated call (`nix build --print-out-paths --no-link nixpkgs#<package>`), then run the printed store path directly (`<store-path>/bin/<command>`) and put it on `PATH` if the task needs it again. Prefer this over `apt`/`pip`/`npm install -g`, a downloaded release, or a hand-rolled substitute.',
    '- Run confined, that same nix command fails on `~/.cache/nix` or on DNS. Both are expected and neither means nix is unusable: escalate instead of retrying with cleverer flags, and do not conclude nix cannot work here.',
    '- Never give nix another cache or data directory to make a confined run work: no `XDG_CACHE_HOME`/`XDG_DATA_HOME`/`XDG_STATE_HOME` pointing into the workspace or `/tmp`, no `NIX_CONFIG`/`--option` store settings, no `--store`, no hand-made cache dirs. nix uses only the host directories it already has (`~/.cache/nix`, `~/.local/state/nix`, `/nix/var/nix`). A relocated cache is a different cache — it hides the real failure, re-downloads everything, and leaves junk in the repo. A `~/.cache/nix` write failure is answered by the escalated call, nothing else.',
    '- The moment you are about to write "X is not installed", "not available here", or "I can\'t install anything" — that sentence is the trigger. Make the escalated nix call instead of reporting the gap.',
  ].join('\n'),
  '## The nix store',
  [
    '- The nix store is not a tree you search. To read one package, resolve the attribute you want first: `nix eval --raw nixpkgs#<package>.outPath` for its build output, `nix eval --raw nixpkgs#<package>.src.outPath` or `nix build --print-out-paths --no-link nixpkgs#<package>.src` for its sources — then search inside the path that prints. Walking `/nix/store`, or grepping strings across it, is prohibitively expensive and will not finish: every path in it is a separate closure member, not a branch of one tree.',
    '- To make files visible to a nix build, `git add` them. `path:` is the expensive alternative — it copies the whole directory into the store — so use it only when git cannot carry the files.',
  ].join('\n'),
  'When writing code, write no comments by default. Add one only where the code cannot carry the reason itself — a non-obvious constraint, a deliberate workaround, or a hazard a reader would otherwise trip over. Never restate what the code already says.',
].join('\n\n')

export function apply(ctx: Context) {
  ctx.effect(() =>
    ctx.systemPrompt.section({
      name: 'custom:prompt',
      order: 2950,
      text: RULES,
      interpolate: false,
    }),
  )
}
