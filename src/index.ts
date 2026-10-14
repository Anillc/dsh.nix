import {
  boot,
  readProfilePatches,
  readProfileManifest,
} from '@deepseek-ai/dsh-app-boot'
import { provideCmdline } from '@deepseek-ai/dsh-cmdline'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { INSTALL_ANCHOR } from '@deepseek-ai/dsh/profile-boot'

const context = {
  name: 'ro',
  dir: process.env.RO_PROFILE!,
  patchPath: 'cordis.patch.yml',
  installAnchor: INSTALL_ANCHOR,
  cwd: process.cwd(),
  home: resolveDshHome(),
  startedBundles: readProfileManifest('dsh', process.env.RO_PROFILE!).dsh?.profile?.bundles ?? [],
  overlays: [],
  telemetryDisabledEnv: process.env.DSH_TELEMETRY_DISABLED,
}

let ready = false
const listeners = new Set<() => void>()
await boot(
  'dsh', 'root.yml', readProfilePatches('dsh', context),
  ctx => {
    ctx.provide('profileContext', context)
    provideCmdline(ctx, {
      args: process.argv.slice(2),
      exit: (code) => process.exit(code),
      ready: {
        onReady(listener) {
          if (ready) {
            listener()
            return () => {}
          }
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      },
    })
  },
)

ready = true
listeners.forEach(x => x())
