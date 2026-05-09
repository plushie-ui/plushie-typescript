# Versioning

Plushie has three version numbers that evolve independently: the
TypeScript SDK, the plushie-rust release it targets, and the wire
protocol spoken between the SDK and the renderer. Understanding
which number governs what makes upgrades and diagnostics
straightforward.

## SDK version

The npm package's own semver, declared as `"version"` in
`package.json` and published to
[npm](https://www.npmjs.com/package/plushie). Bumps cover
TypeScript-side changes: bug fixes, new widget builders, type
improvements, docs, test helpers, and so on.

Pre-1.0, breaking changes may land in any minor bump (`0.X.0`).
Patch releases (`0.X.Y`) stay backwards-compatible within the SDK.
The [CHANGELOG](../../CHANGELOG.md) lists every release's changes
with breaking items called out first.

Readers should pin exact versions (`"plushie": "0.6.0"`, not
`"^0.6.0"`) until the SDK reaches 1.0. Minor bumps may reshape
public types, and an accidental resolver upgrade across a minor
line can break a build.

## `PLUSHIE_RUST_VERSION`

The `PLUSHIE_RUST_VERSION` constant in `src/client/binary.ts`
pins the exact [plushie-rust](https://github.com/plushie-ui/plushie-rust)
release this SDK targets. Every plushie-rust artefact the SDK
touches comes from that release:

- The `plushie-renderer` binary downloaded by `npx plushie download`.
- The WASM renderer downloaded by `npx plushie download --wasm`.
- The `cargo-plushie` tool invoked by `npx plushie build`. The
  build fails if the tool on `PATH` does not match this version
  exactly, and prints a
  `cargo install cargo-plushie --version X.Y.Z` command.

Bumping this constant is how the SDK opts in to a newer renderer.
The version axes move independently:

- SDK-only fixes bump the SDK version only; `PLUSHIE_RUST_VERSION`
  stays put.
- plushie-rust upgrades bump `PLUSHIE_RUST_VERSION` (and usually
  the SDK version too, to cut a release that ships the upgrade).

`PLUSHIE_RUST_VERSION` must match a plushie-rust release exactly:
no semver ranges, no `~0.6` fuzzy pins. Exact match is the only
way to guarantee the renderer binary, the generated dependencies,
and the wire protocol travel together.

## Wire protocol version

`PROTOCOL_VERSION` in `src/client/protocol.ts` is a constant
integer embedded in the `settings` message the runtime sends to
the renderer on startup. The renderer advertises its own
`protocol_version` in the `hello` handshake, and the SDK compares
the two before accepting the connection. On mismatch the session
throws `ProtocolVersionMismatchError` with `expected` and `got`
fields, and the runtime surfaces the failure through the normal
error path. A mismatched protocol is not safe to continue on.

```typescript
import { ProtocolVersionMismatchError } from "plushie/client"

try {
  await session.connect()
} catch (err) {
  if (err instanceof ProtocolVersionMismatchError) {
    console.error(`SDK=${err.expected}, renderer=${err.got}`)
  }
  throw err
}
```

Mismatches are a symptom, not the root cause. They indicate the
SDK and the renderer binary came from different plushie-rust
releases. Realigning `PLUSHIE_RUST_VERSION` with the installed
renderer, or re-running `npx plushie download`, restores
compatibility.

## Binary version vs protocol version

The two mismatches behave differently:

- **Protocol version mismatch** is fatal. The connection fails
  before the first snapshot ships. The SDK and renderer cannot
  agree on message framing, so continuing would corrupt state.
- **Binary version mismatch** is a warning. If the renderer
  reports a `version` string that does not share the first two
  components of `PLUSHIE_RUST_VERSION`, the SDK logs a warning on
  stderr and proceeds. The protocol check still governs whether
  the session starts.

Day-to-day, protocol bumps are rare: they happen when plushie-rust
changes the wire format in an incompatible way. Binary bumps
happen on every plushie-rust release, which is why the soft
warning exists: seeing it usually means the local binary is stale
and should be re-downloaded.

## Downloading and building the renderer

Precompiled binaries are the default path:

```bash
npx plushie download
```

This fetches
`plushie-renderer-<os>-<arch>` from the plushie-rust GitHub
release tagged `v<PLUSHIE_RUST_VERSION>` and writes it to
`node_modules/.plushie/bin/`. `npx plushie download --wasm`
fetches the WASM renderer for browser apps.

Building from source is the path for local development against a
plushie-rust checkout or for apps with native widget extensions:

```bash
PLUSHIE_RUST_SOURCE_PATH=../plushie-rust npx plushie build
```

When `PLUSHIE_RUST_SOURCE_PATH` is set, `cargo plushie` runs out
of that checkout via `cargo run -p cargo-plushie`. Without it, the
CLI expects `cargo-plushie` on `PATH` at the exact
`PLUSHIE_RUST_VERSION`, and prints install instructions if the
version does not match.

See [Configuration](configuration.md) for the project-level
settings that influence resolution.

## Upgrade guidance

To take a newer plushie-rust release:

1. Bump the `"version"` in `package.json` if cutting an SDK
   release, and edit `PLUSHIE_RUST_VERSION` in
   `src/client/binary.ts` to the target plushie-rust release.
2. Run `npx plushie download` to fetch the matching renderer
   binary, or `npx plushie build` to rebuild from source.
3. Rebuild the app (`pnpm build`) and run the test suite.
4. Document the bump in `CHANGELOG.md`. If plushie-rust shipped
   breaking changes, list them at the top of the SDK's release
   notes.

The CHANGELOG for each SDK release calls out whether it bumps
`PLUSHIE_RUST_VERSION` and what plushie-rust changes come with
it. Read it before upgrading across minor versions: pre-1.0 there
are no shims, and breaking wire changes surface as
`ProtocolVersionMismatchError` if a stale binary is still on
disk.

## Backwards compatibility

Pre-1.0, compatibility is scoped to exact version pairs. The SDK
does not ship shims for older protocol versions and does not
negotiate feature flags at handshake time. An app built against
SDK `0.6.0` and renderer `0.7.1` is not expected to run against
any other pair without a matching upgrade on the other side.

Post-1.0, the project intends to hold protocol stability across
minor SDK bumps and keep binary compatibility within a major
line. That commitment is not in force yet; treat every minor bump
as potentially breaking until the 1.0 release notes say
otherwise.

See
[plushie-rust's versioning policy](https://github.com/plushie-ui/plushie-rust/blob/main/docs/versioning.md)
for the canonical rules covering the full Rust workspace, the
wire protocol version, and cross-SDK compatibility.

## See also

- [Configuration](configuration.md) - the project-level settings
  and environment variables that influence binary resolution
- [Events](events.md) - how renderer errors and diagnostics
  surface through the event stream
- [Wire Protocol](wire-protocol.md) - message framing and the
  `settings` handshake that carries `protocol_version`
