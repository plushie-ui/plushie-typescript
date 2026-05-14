# Standalone Packaging

The first supported standalone shape for TypeScript apps is a
host-only Node SEA executable wrapped by the shared Rust package
launcher. SEA owns bundling the TypeScript host into a Node
executable. The Rust launcher owns the outer executable, payload
extraction, cache lifecycle, renderer-parent startup, and future
update hooks.

## Shape

The packaged payload should contain:

- a host-only SEA executable
- a payload-local `bin/plushie-renderer`
- any application assets needed by the SEA host
- `payload.tar.zst`
- `plushie-package.toml`

The manifest is consumed by `cargo plushie package`. Paths in the
manifest are payload-relative, so the renderer path must point inside
the archived payload. A packaged app must not depend on a renderer in
`node_modules`, a downloaded cache, or `PATH`.

## Startup

The launcher starts the payload-local renderer with renderer-parent
socket mode, then starts the SEA host through structured exec args.
When `PLUSHIE_SOCKET` is present, `app.run()` selects socket mode and
connects to that renderer instead of spawning or resolving another
renderer. `PLUSHIE_TOKEN` is sent as `token_sha256` in settings.

This keeps the shared Rust launcher responsible for renderer
ownership, update cache behavior, and process lifecycle.

## SEA Payload

SEA is the TypeScript host payload format, not the final owner of
renderer startup. Earlier host-parent proofs embedded the renderer as
a SEA asset, but the shared-launcher path should avoid duplicate
renderer ownership:

- the Rust launcher embeds and extracts the payload
- the payload contains a host-only SEA executable
- the renderer is a separate payload-local binary
- `app.run()` connects through `PLUSHIE_SOCKET`

This avoids nested renderer extraction and keeps TypeScript aligned
with the other wire SDKs.

## Demo Proof

The current proof lives in:

```text
plushie-demos/typescript/data-explorer
```

The demo package script builds the SEA host payload, adds the
payload-local renderer, writes `plushie-package.toml`, and lets
`cargo plushie package` build the outer launcher.

Strict artifact smoke runs the generated launcher from a temporary
working directory with a narrowed runtime `PATH`. The smoke requires
the shared renderer-parent ready marker and writes a report next to
the generated launcher recording payload size, launcher size, target,
host SDK, runtime path, exit status, and the renderer path reported by
launcher diagnostics.
