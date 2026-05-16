# Standalone Packaging

The first supported standalone shape for TypeScript apps is a
host-only Node SEA executable wrapped by the shared Rust package
launcher. SEA owns bundling the TypeScript host into a Node
executable. The Rust launcher owns the outer executable, payload
extraction, cache lifecycle, host startup, and future update hooks.

## Shape

The packaged payload contains:

- a host-only SEA executable
- a payload-local `bin/plushie-renderer`
- any application assets needed by the SEA host

The final archive (`payload.tar.zst`) and the full `plushie-package.toml`
are produced by `cargo plushie package assemble`, which reads the SDK's
partial manifest and the payload directory. Paths in the manifest are
payload-relative, so the renderer path must point inside the archived
payload. A packaged app must not depend on a renderer in `node_modules`,
a downloaded cache, or `PATH`.

## Startup

The shared package default is host-first. The launcher extracts the
payload, sets package environment for the host, then starts the
structured `[start].command` from `plushie-package.toml`. The host SDK
uses the payload-local renderer path from the package environment, so
`app.run()` owns renderer startup the same way it does outside a
package.

## SEA Payload

SEA is the TypeScript host payload format, not the final launcher.
Earlier host-parent proofs embedded the renderer as a SEA asset, but
the shared-launcher path avoids duplicate renderer ownership:

- the Rust launcher embeds and extracts the payload
- the payload contains a host-only SEA executable
- the renderer is a separate payload-local binary
- `app.run()` starts the payload-local renderer

This avoids nested renderer extraction and keeps TypeScript aligned
with the other wire SDKs.

## SDK Command

The SDK owns the TypeScript package preparation step. It builds the
host SEA (or copies a prepared host binary), places the renderer, writes
a partial manifest, and delegates final assembly to `cargo plushie
package assemble`:

```sh
npx plushie package \
  --app-id dev.example.my_app \
  --app-name "My App" \
  --main dist/app.cjs \
  --output dist
```

The command expects `--main` to point at a bundled CommonJS host file.
App-specific bundling stays with the app because the SDK does not know
which bundler or asset graph the app uses. From there the command
builds the host-only SEA for the shared launcher, copies the renderer
into the payload directory, writes `plushie-package.toml` (partial
manifest), and calls `cargo plushie package assemble` to produce the
archive and final manifest.

For apps that prepare a Node host executable themselves, pass
`--host-bin` instead of `--main`. The SDK still owns the renderer copy
and partial manifest.

Renderer resolution for stock packages uses `--renderer-path`,
`PLUSHIE_BINARY_PATH`, `PLUSHIE_RUST_SOURCE_PATH` with a release
renderer build, then the downloaded binary under `bin/`. Custom
packages must pass `--renderer-kind custom` with `--renderer-path` or
`PLUSHIE_BINARY_PATH` so the payload cannot silently package stock
renderer bits as custom.

## Partial Manifest

The SDK writes a partial `plushie-package.toml` with the fields it
knows about:

```toml
schema_version = 1
app_id = "dev.example.my_app"
app_version = "0.1.0"
target = "linux-x86_64"
host_sdk = "typescript"
host_sdk_version = "0.6.0"
plushie_rust_version = "0.7.1"
protocol_version = 1

[start]
command = ["bin/my-app-host"]

[renderer]
path = "bin/plushie-renderer"
kind = "stock"
```

`cargo plushie package assemble` reads this file along with
`--package-config` (if provided) and the payload directory to produce
the final manifest with `[payload]`, `working_dir`, `forward_env`,
`[platform]`, and the archive hash.

## Package Config

Use `--package-config` to pass a committed source config to
`cargo plushie package assemble`. The config lets the app commit
platform metadata:

```sh
plushie package --write-package-config
plushie package --write-package-config --package-config config/package.toml
```

The generated `plushie-package.config.toml` template includes
commented-out platform metadata examples. Pass its path to
`--package-config` when running `plushie package` and it is forwarded
to the assemble step.

After assembly, `cargo plushie package assemble` prints the handoff for
the next step.
