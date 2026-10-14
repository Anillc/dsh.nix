{
  inputs.lockless.url = "github:Anillc/lockless";
  outputs = inputs@{
    self, nixpkgs, flake-parts, lockless,
  }: flake-parts.lib.mkFlake { inherit inputs; } {
    systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
    perSystem = { self', pkgs, system, ... }: let
      package = {
        name = "dsh-nix";
        version = "0.0.0";
        type = "module";
        dependencies."@deepseek-ai/dsh" = "latest";
        dependencies."tsx" = "latest";
      };
      lock = "${lockless.lib.${system}.mkLock {
        date = "2026-10-01T00:00:00Z";
        peer = true;
        inherit package;
      }}/package-lock.json";
      nm = pkgs.importNpmLock.buildNodeModules {
        inherit package;
        inherit (pkgs) nodejs;
        packageLock = builtins.fromJSON (builtins.readFile lock);
        derivationArgs.postInstall = ''
          cat > $out/node_modules/node-addon-require-builtin/lib/index.js <<EOF
          const Module = require('node:module');
          const req = Module.createRequire(__filename);
          exports.requireBuiltin = (id) =>
            req(id === 'internal/bootstrap/realm' ? 'internal/test/binding' : id);
          exports.isAllowedInternalId = () => true;
          exports.getBindingInfo = () => ({ mode: 'js-shim', product: 'require-builtin', backend: 'js' });
          EOF
        '';
      };
    in {
      devShells.default = let
        dsh = pkgs.writeShellApplication {
          name = "dsh";
          runtimeInputs = with pkgs; [ nodejs ];
          text = ''
            cd "$DSH_NIX"
            exec node --expose-internals --import tsx src/index.ts "$@"
          '';
        };
      in pkgs.mkShell {
        NODE_OPTIONS = "--preserve-symlinks --preserve-symlinks-main";
        nativeBuildInputs = with pkgs; [ nodejs dsh ];
        shellHook = ''
          ln -sfn ${nm}/node_modules      node_modules
          ln -sfn ${nm}/package.json      package.json
          ln -sfn ${nm}/package-lock.json package-lock.json
          export DSH_NIX="$PWD"
        '';
      };
    };
  };
}
