# CLI commands

Plushie ships a single `plushie` binary exposed from the npm
package. It handles downloading and building the renderer, running
and inspecting apps, connecting to remote renderers, and executing
`.plushie` automation scripts. The entry point lives at
`src/cli/index.ts` and is published as `dist/cli/index.js` under
the `"bin"` field in `package.json`.

Invoke it with `npx plushie <command>` from any project that lists
`plushie` as a dependency, or wire it into `package.json` scripts
so teammates get the same commands via `pnpm`, `npm`, or `yarn`.

```bash
npx plushie --help
npx plushie dev src/main.tsx
npx plushie build --release
```

## Invocation

| Form | When to use |
|---|---|
| `npx plushie <cmd>` | One-off runs from the project root. |
| `pnpm plushie <cmd>` | Same, via pnpm. Equivalent: `yarn plushie <cmd>`. |
| `pnpm run <script>` | Project-defined aliases in `package.json` scripts. |
| `./node_modules/.bin/plushie <cmd>` | Explicit path; useful in CI. |

A typical `package.json` wraps the commands:

```json
{
  "scripts": {
    "dev": "plushie dev src/main.tsx",
    "start": "plushie run src/main.tsx",
    "build:renderer": "plushie build --release",
    "test:scripts": "plushie script test/scripts"
  }
}
```

Node 20 or newer is required. The CLI uses `tsx` to execute
TypeScript app files directly; install it as a dev dependency
(`pnpm add -D tsx`) before running `dev`, `run`, `stdio`,
`inspect`, or `connect <addr> <app>`. The CLI looks for `tsx` in
`node_modules/.bin/` first and then on `PATH`.

## Global flags

| Flag | Description |
|---|---|
| `--help`, `-h` | Print usage and exit. |
| `--version`, `-v` | Print the SDK version from `package.json`. |
| `--json` | Use JSON wire format instead of MessagePack. Sets `PLUSHIE_FORMAT=json` in the child process. |
| `--binary <path>` | Override renderer binary path. Sets `PLUSHIE_BINARY_PATH` in the child process. |
| `--bin-file <path>` | Override the download or build destination for the native binary. |
| `--wasm-dir <dir>` | Override the WASM output directory for `download --wasm` or `build --wasm`. |

`--help` and `--version` are parsed before the subcommand;
everything else is parsed per subcommand. Unknown commands print
usage and exit with status 1.

## download

Download a precompiled renderer from GitHub releases.

```bash
plushie download                        # native binary (default)
plushie download --wasm                 # WASM renderer tarball
plushie download --bin --wasm           # both artifacts
plushie download --force                # re-download even if present
plushie download --bin-file ./bin/renderer
```

Selection order: CLI flags, then the `artifacts` key in
`plushie.extensions.json`, then `["bin"]` as the default. `--bin`
and `--wasm` can be combined.

### Destinations

- Native tool set: `bin/plushie`, `bin/plushie-renderer`, and
  `bin/plushie-launcher` by default. `bin/plushie` owns renderer and
  launcher sync. A custom path given by `--bin-file` / `bin_file` only
  overrides the renderer destination.
- WASM tarball: extracted to `node_modules/.plushie/wasm/` by
  default, producing `plushie_renderer_wasm.js` and
  `plushie_renderer_wasm_bg.wasm`. Override with `--wasm-dir` or
  the `wasm_dir` config key.

### Checksum verification

Every download fetches a sibling `.sha256` file and compares the
hash. A mismatch prints a warning but does not delete the
artifact; a missing checksum prints a notice and proceeds. The
native binary path runs through the SDK's programmatic
`downloadBinary` and is then re-verified with the CLI's own
checksum check.

### Release mirrors

By default downloads come from GitHub releases. Set
`PLUSHIE_RELEASE_BASE_URL` to verify the same flow against another
release mirror. The mirror must expose assets as
`BASE/vVERSION/ARTIFACT` with checksum sidecars at
`BASE/vVERSION/ARTIFACT.sha256`.

Remote mirrors must use HTTPS. `file://` mirrors and loopback HTTP are
for local release verification before assets are uploaded.

### Native widgets block precompiled downloads

If `plushie.extensions.json` declares any extension with a
`rustCrate` entry, `plushie download` refuses to fetch the stock
binary and prints a hint to run `plushie build` instead. Precompiled
binaries do not contain project-specific widgets.

## build

Build the renderer from Rust source (or a stock or custom renderer
via `cargo-plushie`).

```bash
plushie build                           # native binary, debug profile
plushie build --release                 # native binary, release profile
plushie build --wasm                    # WASM renderer via wasm-pack
plushie build --bin --wasm --release    # both, optimized
```

Selection order matches `download`: CLI flags, then `artifacts` in
`plushie.extensions.json`, then `["bin"]`.

### Native widget builds

When `plushie.extensions.json` declares one or more extensions
with `rustCrate` set, `build` writes a virtual app crate at
`node_modules/.plushie/renderer-spec/` that lists each native
widget as a path dependency, then delegates to `cargo plushie
build`. `cargo-plushie` walks the dep graph via `cargo metadata`,
reads each widget crate's `[package.metadata.plushie.widget]`
table, and generates the renderer workspace. The compiled binary
is copied back to `bin/` under the platform
binary name.

### cargo-plushie resolution

`cargo plushie` is resolved from `src/cli/cargo-plushie.ts`:

1. `PLUSHIE_RUST_SOURCE_PATH` set: invoke via `cargo run
   --manifest-path <path>/Cargo.toml -p cargo-plushie --release
   --quiet --`. Always wins when set, even if a matching binary
   is installed.
2. `cargo-plushie` on `PATH` at the version matching
   `PLUSHIE_RUST_VERSION` (from `src/client/binary.ts`). Probed
   via `cargo-plushie --version`.
3. Otherwise, fails with a two-option install hint.

### Stock binary builds

Without any native widget extensions, `build` compiles the stock
renderer via `cargo build -p plushie-renderer` in the directory
given by `PLUSHIE_RUST_SOURCE_PATH` or `source_path` in the
project config. The binary ends up at
`<source>/target/<profile>/plushie-renderer`; it is not copied to
`bin/` in this path. Use `--binary <path>`
at runtime or set `PLUSHIE_BINARY_PATH` to point at it.

### WASM builds

WASM builds always run against a local plushie-rust checkout.
`PLUSHIE_RUST_SOURCE_PATH` (or `source_path`) must point at one,
and `wasm-pack` must be on `PATH`. The build runs `wasm-pack
build --target web` in `<source>/crates/plushie-renderer-wasm/`
with `--dev` or `--release` based on the flag. The two output
files are copied to the resolved WASM directory.

### Requirements

- Rust toolchain with `cargo` on `PATH`. `rustc` 1.92 or newer;
  older versions fail the build with an `rustup update` hint.
- For native-widget builds: `cargo-plushie` at the matching
  version, or `PLUSHIE_RUST_SOURCE_PATH` pointing at a checkout.
- For WASM: `wasm-pack` on `PATH` and a local checkout.

## package

Prepare the payload archive and manifest consumed by
`cargo plushie package`.

```bash
plushie package \
  --app-id dev.example.my_app \
  --app-name "My App" \
  --app-version 0.1.0 \
  --main dist/app.cjs \
  --output dist/shared-launcher \
  --default-icon
```

Choose a host input, and do not pass both:

| Flag | Description |
|---|---|
| `--main <path>` | Bundled CommonJS host entry. The SDK turns it into a host-only Node SEA executable. |
| `--host-bin <path>` | Prepared host executable copied into the payload. |

Package metadata and output flags:

| Flag | Description |
|---|---|
| `--app-id <id>` | Required package app identifier. |
| `--app-name <name>` | Optional display name. |
| `--app-version <v>` | App version. Defaults to local `package.json` version, then `0.1.0`. |
| `--host-name <name>` | Payload-local host executable name. |
| `--output <dir>` | Package payload output directory. Defaults to `dist/shared-launcher`. |
| `--target <target>` | Override package target such as `linux-x86_64`. |
| `--sea-output <path>` | Also write a renderer-embedded SEA executable for compatibility proofs. |
| `--icon <path>` | Copy an app icon into the payload. |
| `--default-icon` | Export Plushie's default icon set and use the 512px PNG. |

Renderer flags:

| Flag | Description |
|---|---|
| `--renderer stock` | Package a stock renderer. This is the default. |
| `--renderer custom` | Package a custom renderer. Requires `--renderer-bin` or `PLUSHIE_BINARY_PATH`. |
| `--renderer-bin <path>` | Copy this renderer binary into the payload. |
| `--renderer-source <s>` | Record a provenance string in `[renderer].source`. |

Stock renderer resolution uses `--renderer-bin`, then
`PLUSHIE_BINARY_PATH`, then `PLUSHIE_RUST_SOURCE_PATH` with a release
build, then the downloaded binary under `bin/`.
Custom renderer packaging requires an explicit binary path so a stock
renderer is not mislabeled as custom.

Package start config:

```bash
plushie package --write-package-config
plushie package --write-package-config --package-config config/package.toml
```

The generated `plushie-package.config.toml` lets the app commit a
shared TOML package start config:

```toml
config_version = 1

[start]
working_dir = "."
command = ["bin/my-app-host"]
forward_env = [
  "PATH",
  "HOME",
]
```

`forward_env = []` is valid when the packaged host should inherit no
parent environment names.

## dev

Run an app with file watching and hot reload.

```bash
plushie dev src/main.tsx
plushie dev src/main.tsx --no-watch     # disable watching
plushie dev src/main.tsx --json         # use JSON wire format
```

`dev` spawns `tsx --watch <app>`. `tsx` handles TypeScript
execution and restarts the process on source changes. The
`DevServer` class in `src/dev-server.ts` is available for apps
that want finer-grained control (debounced file-change callbacks
instead of a process restart); the CLI itself does not use it.

With `--no-watch`, the argument is dropped and the app runs once.

## run

Run an app without watching.

```bash
plushie run src/main.tsx
plushie run src/main.tsx --binary ./target/release/plushie-renderer
```

Shells out to `tsx <app>`. The renderer binary is resolved by the
runtime at startup via `resolveBinary()` in `src/client/binary.ts`;
see the "Environment variables" table below for the precedence.

## stdio

Run an app in stdio transport mode, where a host process spawns
the app and drives it over the app's own stdin and stdout.

```bash
plushie stdio src/main.tsx
```

Shells out to `tsx <app>` with `PLUSHIE_TRANSPORT=stdio` in the
environment. The SDK picks up the env var at startup and wires
the runtime to a `StdioTransport` instead of spawning a child
renderer. Use this when the renderer runs elsewhere and calls
`plushie --exec-bin <program> --exec-arg <arg> ...` to launch the
TypeScript process.

## inspect

Print the initial view tree as formatted JSON without starting a
renderer.

```bash
plushie inspect src/main.tsx
```

`inspect` writes a temporary TypeScript script that imports the
app's default export, pulls the initial model, calls `view`,
normalizes the tree, and prints the result to stdout. The temp
file is deleted on exit. Useful for verifying scoped IDs, prop
encoding, and widget structure during app bring-up.

The app module must `export default` an `AppDefinition<M>` from
`app(...)` so `app.config.init` and `app.config.view` are
reachable.

## connect

Connect to a renderer that is already listening on a socket.

```bash
plushie connect /tmp/plushie.sock                 # interactive
plushie connect /tmp/plushie.sock src/main.tsx    # spawn app
plushie connect :4567 --json                      # TCP loopback, JSON
plushie connect 192.168.1.10:4567                 # TCP host:port
plushie connect "[::1]:4567"                      # IPv6
```

Two modes:

- **Interactive** (no `<app>` argument): opens a `SocketTransport`
  and a `Session`, performs the hello handshake, prints the
  renderer name and version, and idles until Ctrl+C. Used for
  probing a running renderer.
- **App mode** (with an `<app>` argument): spawns `tsx <app>` with
  `PLUSHIE_TRANSPORT=socket`, `PLUSHIE_SOCKET=<addr>`, and
  `PLUSHIE_TOKEN` when a token is available. The SDK's socket
  transport picks up the env vars and connects automatically. The
  Settings message carries `token_sha256`, not the plaintext token.

### Address formats

| Form | Meaning |
|---|---|
| `/path/to/socket` | Unix domain socket. |
| `:4567` | TCP on loopback at the given port. |
| `host:4567` | TCP on the given host and port. |
| `[::1]:4567` | TCP on an IPv6 address. Brackets required. |

## script

Run `.plushie` automation scripts against the mock backend.

```bash
plushie script                          # all *.plushie in cwd
plushie script test/scripts/login.plushie
plushie script test/scripts/a.plushie test/scripts/b.plushie
```

With no positional arguments, the CLI globs `*.plushie` in the
current directory, sorts them, and runs each. Each script spawns
a fresh renderer session; the backend defaults to `mock` but can
be overridden via the script's `@backend` header. Exit status is
0 if every script passes, 1 on any failure.

The renderer binary is resolved from `--binary`, then
`PLUSHIE_BINARY_PATH`, then the usual resolution chain.

## replay

Replay a single `.plushie` script with the windowed backend.

```bash
plushie replay demo.plushie
plushie replay demo.plushie --binary ./bin/plushie-renderer
```

Unlike `script`, `replay` hardcodes `--windowed` on the renderer
invocation, giving real windows and real timing. Useful for demos
and visual QA. On a headless host, run behind a display server.

## Environment variables

| Variable | Effect |
|---|---|
| `PLUSHIE_BINARY_PATH` | Explicit path to the renderer binary. Resolved first by `resolveBinary()`; errors if set but the file is missing. |
| `PLUSHIE_WASM_PATH` | Directory containing `plushie_renderer_wasm.js` and `plushie_renderer_wasm_bg.wasm`. Checked first by `resolveWasm()`. |
| `PLUSHIE_RUST_SOURCE_PATH` | Path to a local plushie-rust checkout. Switches `build` to source mode, pins `cargo-plushie` to the checkout, and unlocks WASM builds. |
| `PLUSHIE_FORMAT` | Wire format (`msgpack` or `json`). Set automatically by `--json`. |
| `PLUSHIE_TRANSPORT` | Transport kind (`stdio`, `socket`, or unset for spawn). Set automatically by `stdio` and `connect`. |
| `PLUSHIE_SOCKET` | Socket address consumed by the SDK's socket transport. Set automatically by `connect <addr> <app>`. |
| `PLUSHIE_TOKEN` | Fallback authentication token for socket connect. The SDK sends `settings.token_sha256`. |

`--binary <path>` on the CLI is exported as `PLUSHIE_BINARY_PATH`
in the child process for `dev`, `run`, `stdio`, `inspect`, and
`connect <addr> <app>`, so the app inherits it without further
configuration.

## Project config

`plushie.extensions.json` in the project root supplies defaults
for download and build paths. All keys are optional.

```json
{
  "artifacts": ["bin", "wasm"],
  "bin_file": "bin/plushie-renderer",
  "wasm_dir": "public/wasm",
  "source_path": "../plushie-rust",
  "binaryName": "my-app-renderer",
  "extensions": [
    { "type": "my-widget", "rustCrate": "./crates/my-widget" }
  ]
}
```

| Key | Effect |
|---|---|
| `artifacts` | Default selectors for `download` and `build` when no `--bin` / `--wasm` flag is given. |
| `bin_file` | Default value for `--bin-file`. |
| `wasm_dir` | Default value for `--wasm-dir`. |
| `source_path` | Equivalent to `PLUSHIE_RUST_SOURCE_PATH` when the env var is unset. |
| `binaryName` | Override the custom renderer's binary name for native-widget builds. |
| `extensions[].rustCrate` | Mark an extension as native; triggers the `cargo-plushie` build path and blocks precompiled downloads. |

## See also

- [Commands reference](commands.md) for the command values
  returned from handlers that the runtime executes.
- [Events reference](events.md) for the event taxonomy the CLI's
  `inspect` output references.
- [Built-in widgets reference](built-in-widgets.md) for the
  widget catalog surfaced in inspect output.
- [Subscriptions reference](subscriptions.md) for subscription
  constructors that apps registered via `plushie dev` can declare.
