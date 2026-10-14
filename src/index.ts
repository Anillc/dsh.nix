import {
  boot,
  FAIL_LOUD_RELEASE_TIMEOUT_MS,
  initProfile,
  readProfilePatches,
} from '@deepseek-ai/dsh-app-boot'
import { provideCmdline } from '@deepseek-ai/dsh-cmdline'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { INSTALL_ANCHOR } from '@deepseek-ai/dsh/profile-boot'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const bundles = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']

const dir = mkdtempSync(join(process.env.XDG_RUNTIME_DIR ?? tmpdir(), 'dsh-profile-'))
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))
initProfile(dir, bundles)
symlinkSync(join(process.cwd(), 'node_modules'), join(dir, 'node_modules'))
const root = join(dir, 'root.yml')
writeFileSync(root, '[]\n')
writeFileSync(
  join(dir, 'DO-NOT-EDIT.md'),
  [
    '# Throwaway dsh profile — do not edit',
    '',
    'This directory is recreated on every start, so anything written here is lost.',
    'To change configuration, edit `cordis.patch.yml` in the workspace (or ask the',
    'user to) — never edit this directory.',
    '',
  ].join('\n'),
)

const context = {
  name: 'profile',
  dir,
  patchPath: 'cordis.patch.yml',
  installAnchor: INSTALL_ANCHOR,
  cwd: process.cwd(),
  home: resolveDshHome(),
  startedBundles: bundles,
  overlays: [],
  telemetryDisabledEnv: process.env.DSH_TELEMETRY_DISABLED,
}

let ready = false
const listeners = new Set<() => void>()
const ctx = await boot(
  'dsh', root, readProfilePatches('dsh', context),
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

let closing = false
const close = async (code: number) => {
  if (closing) return process.exit(code)
  closing = true
  setTimeout(process.exit, FAIL_LOUD_RELEASE_TIMEOUT_MS, code).unref()
  await ctx.fiber.dispose()
  process.exit(code)
}
process.on('SIGINT', () => void close(130))
process.on('SIGTERM', () => void close(0))
