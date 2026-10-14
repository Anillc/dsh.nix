# dsh.nix

A Nix-deployed DSH checkout: the dependency list and the configuration are files
in this repo, and Nix builds `node_modules` from them.

## Usage

The dependency list is resolved through
[substituter-api](https://github.com/Anillc/substituter-api) at
`https://sns.ani.llc`. Trust it first, or the build fails:

```nix
nix.settings = {
  extra-substituters = [ "https://sns.ani.llc" ];
  extra-trusted-public-keys = [ "substituter-api-1:aJyds2K19yTBaVA2SyQIDqADwkhweR9w1Yib4Eqv4eY=" ];
};
```

```bash
nix develop -c dsh
```

To add a dependency, put it in `package.dependencies` in [flake.nix](./flake.nix)
and re-enter the shell. To add a plugin, write `src/<name>.ts` (a Host plugin
exporting `apply(ctx)`) and add one row to [cordis.patch.yml](./cordis.patch.yml):

```yaml
- insert:
    - id: <name>
      name: ./src/<name>.ts
```

Saving is enough: the `hmr` row watches the patch file and reloads the module or
the row without a restart. Paths are resolved beside the patch file.

## Design

The point is that the deployment is described by this repo and nothing else:
dependencies are listed in `flake.nix`, the composition is `cordis.patch.yml`
plus `src/`, and `node_modules` is a build output. Nothing dsh does at runtime
becomes a second source of truth, so the repo's git history is the whole history.

**Dependencies are resolved in the Nix build.**
[`lockless.mkLock`](https://github.com/Anillc/lockless) resolves
`package.dependencies` at a pinned `date` (see [Usage](#usage)) by running
`npm install --package-lock-only` inside the build: offline, against a local
registry fed by packuments from the substituter, retried until npm can resolve
everything. `importNpmLock.buildNodeModules` then turns the resulting lock into
a store path. Nothing is installed into the working tree — `package.json`,
`package-lock.json` and `node_modules` at the root are symlinks the dev shell's
`shellHook` creates.

Because node realpaths symlinks by default, the shell also sets
`NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main`, so a symlinked
`node_modules` behaves like a real directory.

**`node-addon-require-builtin` is shimmed.** DSH reaches node internals through
this N-API addon; the derivation replaces its entry point with a JS shim that
maps the `internal/bootstrap/realm` specifier onto `internal/test/binding`, so
no native prebuild is needed. That is why the launcher runs node with
`--expose-internals`.

**The profile is throwaway.** DSH writes settings into its profile's patch file
and serializes writers with a lock inside the profile directory, so a
store-backed profile cannot save. [src/index.ts](./src/index.ts) instead creates
a fresh profile in `$XDG_RUNTIME_DIR` on every start — `initProfile(dir,
bundles)`, plus a `DO-NOT-EDIT.md` aimed at agents — and points `patchPath` at
the repo's `cordis.patch.yml`. So the only file dsh writes in the repo is that
patch file — which is what you commit — and every start begins from it.

**Everything is a patch layer.** `root.yml` is just `[]`. The composition is the
`bundles` list in `src/index.ts`, plus these layers in order: bundle patches →
`cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml` → CLI overlays. A fork only
needs to change `bundles` and the patch file.

`src/index.ts` is the whole launcher: `boot()` + `profileContext` +
`provideCmdline()`, plus the readiness handshake the HMR plugin needs.
`src/creator-playbook.ts` is a worked example of a repo-local plugin: it teaches
agents on the `cordis` preset how to add dependencies and plugins here.
