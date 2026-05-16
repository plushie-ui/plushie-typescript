# Standalone Packaging

The first supported standalone shape for TypeScript apps is a
host-only Node SEA executable wrapped by the shared Rust package
launcher. SEA owns bundling the TypeScript host into a Node
executable. The Rust launcher owns the outer executable, payload
extraction, cache lifecycle, host startup, and future update hooks.

## Shape

The packaged payload should contain:

- a host-only SEA executable
- a payload-local `bin/plushie-renderer`
- any application assets needed by the SEA host
- `payload.tar.zst`
- `plushie-package.toml`

The manifest is consumed by `bin/plushie package portable` for the
self-extracting artifact or by `bin/plushie package bundle` for
platform packages. Paths in the manifest are payload-relative, so the
renderer path must point inside the archived payload. A packaged app
must not depend on a renderer in `node_modules`, a downloaded cache, or
`PATH`.

## Startup

The shared package default is host-first. The launcher extracts the
payload, sets package environment for the host, then starts the
structured `[start].command` from `plushie-package.toml`. The host SDK
uses the payload-local renderer path from the package environment, so
`app.run()` owns renderer startup the same way it does outside a
package.

Renderer-parent remains useful for explicit embedding and debugging
flows where an already-running renderer launches the host over stdio
or provides a socket address. It is not the shared package startup
default.

## SEA Payload

SEA is the TypeScript host payload format, not the final launcher.
Earlier host-parent proofs embedded the renderer as a SEA asset, but
the shared-launcher path should avoid duplicate renderer ownership:

- the Rust launcher embeds and extracts the payload
- the payload contains a host-only SEA executable
- the renderer is a separate payload-local binary
- `app.run()` starts the payload-local renderer

This avoids nested renderer extraction and keeps TypeScript aligned
with the other wire SDKs.

## SDK Command

The SDK owns the TypeScript package preparation step:

```sh
npx plushie package \
  --app-id dev.example.my_app \
  --app-name "My App" \
  --main dist/app.cjs \
  --sea-output dist/my-app \
  --output dist
```

The command expects `--main` to point at a bundled CommonJS host file.
App-specific bundling stays with the app because the SDK does not know
which bundler or asset graph the app uses. From there the command
builds the optional renderer-embedded SEA, builds the host-only SEA
for the shared launcher, copies the renderer into the payload, writes
optional app icon assets, writes `payload.tar.zst`, and writes
`plushie-package.toml`.

Use `--icon path/to/icon.png` to copy an app-provided icon into the
payload. When `--icon` is absent, the default Plushie icon set is
exported through `bin/plushie default-icons` and the 512px PNG is
recorded in `[platform].icon`.

For apps that prepare a Node host executable themselves, pass
`--host-bin` instead of `--main`. The SDK still owns the renderer copy,
payload archive, and manifest generation.

Renderer resolution for stock packages uses `--renderer-path`,
`PLUSHIE_BINARY_PATH`, `PLUSHIE_RUST_SOURCE_PATH` with a release
renderer build, then the downloaded binary under
`bin/`. Custom packages must pass
`--renderer-kind custom` with `--renderer-path` or `PLUSHIE_BINARY_PATH` so
the payload cannot silently package stock renderer bits as custom.

Build the final launcher with the shared Plushie tool:

```sh
bin/plushie package check --manifest dist/shared-launcher/plushie-package.toml --strict-tools
bin/plushie package portable --manifest dist/shared-launcher/plushie-package.toml --strict-tools
```

After writing the payload, `plushie package` prints a handoff message:

```
Build launcher with:
  bin/plushie package portable --manifest <path>
```

Use `--strict-tools` with `bin/plushie package portable` when packaging
must fail if the Rust package checker cannot use the expected native
tools.

## Manifest

The generated manifest records the fields the shared launcher needs to
validate and run the payload:

- `host_sdk = "typescript"`
- `host_sdk_version`
- `plushie_rust_version`
- `protocol_version`
- `target`
- `[payload]` archive, hash, and size
- `[renderer]` kind

The demo artifact postcheck runs the portable launcher from a
temporary working directory with a narrowed runtime `PATH`. It writes a
report next to the portable launcher recording payload size, launcher
size, target, host SDK, runtime path, exit status, and the renderer
path reported by launcher diagnostics.
