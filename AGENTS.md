# plushie-typescript

This file is not version controlled. Do not reference it in commit
messages, pull requests, or documentation.

Native desktop GUI SDK for TypeScript, powered by iced. Communicates
with the plushie-renderer binary over stdin/stdout using MessagePack
(default) or JSONL. Sister project to plushie-elixir: same renderer,
same wire protocol, different host language.

Pinned to a specific plushie-rust release via `PLUSHIE_RUST_VERSION`
in `src/client/binary.ts`. Custom renderer builds delegate to
`cargo plushie build` from the matching `cargo-plushie` crate; the TS
SDK does not generate Cargo workspaces itself. See
[docs/versioning.md](docs/versioning.md).

## Stewardship

Direction, trust posture, goals, and explicit non-goals are captured
in `docs/stewardship/`. That directory is the authority on what work
the project takes on and what it declines. The summary below is enough
for routine work; pull the relevant doc when an axis is in play. Use
`docs/stewardship/triage.md` as the routing tool when the answer is
not self-evident.

Pre-1.0: no backcompat, right design wins, rename across SDKs is fine.
Post-1.0: stability obligations begin (Hyrum's Law). plushie-rust =
protocol authority. plushie-elixir = canonical API-shape reference;
plushie-typescript follows on shape (a rename here that diverges from
the cross-SDK shape is drift, not refactoring). Cross-SDK parity
audited in sibling `plushie-sdk-parity/`. Primary runtime is Node
(>=20); browser via `WasmTransport`; SEA bundling supported. Bun and
Deno are not currently supported targets.

### Disciplines (non-negotiable)

Tests through real renderer; cross-SDK claims verified by reading
source on each side; design before code at boundaries (npm public
API, JSX surface, wire codec, Transport interface, test session
contract); clarity is the bar; no half-built features; local cleanup
not scope creep; no legacy shims pre-1.0.

### Goals

Wire codec fidelity on host side; cross-SDK concept parity
(semantics converge, syntax diverges per language); Elm-architecture
purity (`init/update/view`, return-shape validation, commands as
pure data, pure view, declarative subs); TypeScript-native
ergonomics within the contract (JSX + builders, inline handlers,
discriminated unions, `DeepReadonly<M>`); lightweight runtime (no
idle work, microtask coalescing, LIS tree diff); fault tolerance
(crash auto-recover + state re-sync, exception revert, neither side
takes the other down); first-hour DX through error messages
(Promise from handler -> `Command.async` hint, `/` in id ->
scoped-IDs hint); honest typing (no `any` in public API, type
guards for narrowing).

### Non-goals (declined, not deprioritized)

Backcompat before 1.0; per-TypeScript ergonomics that diverge from
cross-SDK shape; API stability hardening pre-1.0 (single 1.0 sweep);
coverage targets as a metric; mocking renderer for speed;
micro-optimization at cost of readability; refactoring without a
forcing function; DSL extensions for hypothetical future widgets or
type-system tricks; multi-runtime support (Bun, Deno) without a
maintainer; defending against speculative deployment shapes.

### Trust model

Asymmetric. Renderer-to-host = closed and typed; host structurally
protected (typed event decoding rejects unknown variants, no
opaque-blob path, effect/query response correlation by wire ID, no
`new Function`/eval on incoming data, type guards parse against
closed enumerations). Host-to-renderer = broad by design (file
paths, fonts, images, screenshots, effects, `--exec`); bounding it
is the capability-manifest roadmap in plushie-rust. Wire =
byte-stream agnostic; confidentiality and integrity delegated to
outer transport. Browser-via-WASM supported as a deployment shape
but not a hardened trust boundary; the page itself is not in our
threat model. Same-access (user attacking themselves) out of scope.

### Resilience

Things-go-wrong axis, not adversary axis. Handler/update/view
exception revert; rate-limited error logging; Promise-from-handler
detection with `Command.async` hint; renderer crash auto-recovery
with fresh snapshot re-sync; AbortController on every async/stream
command + nonce for stale results; microtask coalescing for
high-frequency events; defensive parsing on the wire (reject +
structured error); return-shape validation; subscription failure
isolated; `deepFreeze` in dev. Fail-fast on programming-error
invariant violations and unrecoverable startup; degrade gracefully
on user-facing input.

### Performance

Lightweight = baseline. Worth doing without benchmark (readability
preserved): consolidate redundant traversals, right data structure,
move per-frame work that doesn't depend on per-frame inputs to the
edge. Need benchmark first: clever encoding, big-O without realistic
N, optimization on idle paths, type tricks that hurt `.d.ts`. V8
specifics: hidden-class stability (frozen objects with full shape
from construction); `queueMicrotask` over `setTimeout(fn, 0)`;
Promise allocation per pointer move is wrong (hot path is
synchronous); production builds skip `deepFreeze`. Direction:
16.67ms frame budget at a few hundred to ~1000 nodes; idle CPU = no
measurable work; tree diff is load-bearing (LIS reorder, memo, view
cache).

### Test discipline

Integration spine: tests exercise real renderer (default `mock` =
real binary, real wire, real Core, no GPU). Three modes (cross-SDK
contract): mock (default, sub-millisecond), headless (tiny-skia,
pixels, ~100ms), windowed (full iced, real display). Pooled mock
backend multiplexes via `--max-sessions N`. Stubs acceptable only
for forced crash sim, malformed wire bytes, direct `update` shape
tests, test infra. Sync via public test session API; no peeking at
runtime internals. Tests as documentation; slow tests = slow code;
failing test before fix. `PLUSHIE_RUST_SOURCE_PATH` rebuilds
renderer for preflight (stale binary hides bugs).

### Simplicity

Clarity = constraint, not aspiration. Readability wins ties.
Abstraction earns its place: 3 similar lines > premature
abstraction; single-user abstraction = costume; "we might need this
someday" = reason not to extract. Local complexity > global.
Cohesion across file > brevity of any one file. Functional flavor:
pure where possible, immutable (`DeepReadonly<M>` + spread),
discriminated unions over flag-state-machines, type guards for
narrowing, frozen objects for runtime data, composition over
inheritance. Honest typing: no `any` in public API; name the
limitation when inference falls short. Comments answer
why-not-what.

### Elm invariants

`init`, `update`, inline handlers return: bare model | `[model,
Command]` | `[model, Command[]]`. `UpdateResult<S>` enforces this at
the type level; runtime guards back it up. Commands are pure data
(frozen tagged objects with `COMMAND` symbol); runtime executes.
`view` is pure function of model; top level must be window nodes.
Subs declarative; runtime diffs each cycle. Widget event flow walks
scope chain innermost-first; handlers return
`ignored`/`consumed`/`update_state`/`emit`. Inline handlers fire
after widget interception; non-widget events go straight to
`update`. Wire IDs: `window#scope/path/id`.

### DSL discipline

No macros; type-driven builders + JSX + canvas primitives. Same
readability bar as runtime. New form earns its place when: 2+ real
users, real bug class detectable at compile time, generated `.d.ts`
reads cleanly, error messages point at user's call site (not SDK
source). Type-level cleverness has costs (compile time, error
legibility, hover output); needs to pay for itself in catching real
bugs. `as` casts to satisfy a clever type defeat the point.
Compile-time checks welcome for real bug classes (`DeepReadonly`,
discriminated unions, type guards); not when runtime catches the
same bug cleanly with a better error.

### Concurrency shape

Single-threaded event loop; no real parallelism (no Workers).
Runtime/Transport split: Transport owns wire framing, child process,
session multiplexing, WASM interop; Runtime owns
`init/update/view`, commands, subscriptions. Same Runtime against
every Transport (Spawn, Stdio, Pooled, Wasm, Socket). Async via
`Command.async`/`Command.stream` with AbortController + nonce for
stale results. Microtask coalescing (`queueMicrotask`) for
high-frequency events; discrete events flush first to preserve
ordering. Handlers/update synchronous; returned Promise produces a
clear `Command.async` error. No Workers, no RxJS, no
`structuredClone` of model, no auto-resume on rejected promise.

### Common shapes -> outcomes

- "mock the renderer for speed" -> decline
- "peek at runtime internals in test" -> rewrite to public session API
- "add `@deprecated` / API hardening" -> decline; 1.0 sweep
- "this is O(n) on a hot path" -> need realistic N
- "split this large module" -> need forcing function
- "harden against malicious renderer" -> structurally protected;
  check if proposal loosens that, otherwise misframed
- "harden against malicious host" -> defer to capability-manifest
- "harden against the browser page" -> not our boundary
- "wire should encrypt / sign" -> outer transport's job
- "consolidate N redundant traversals" -> do
- "extract single-use helper" -> decline; costume
- "let users return Promise from a handler" -> no; surface
  `Command.async` hint
- "rename field across SDKs" -> route through parity workflow
- "add new builder/JSX shape" -> run dsl-discipline criteria
- "use a clever conditional type" -> run dsl-discipline criteria on
  resulting `.d.ts` and error messages
- "support Bun/Deno" -> non-goal until a maintainer commits

## Before committing

Run `pnpm preflight`. It rebuilds the renderer (when
`PLUSHIE_RUST_SOURCE_PATH` is set), then runs lint, type check,
build, test, and docs.

The project uses mise for tool management. If `node`/`pnpm` aren't
on PATH, activate them:

    export PATH="$HOME/.local/share/mise/installs/node/25.2.1/bin:$HOME/.local/share/mise/installs/pnpm/10.24.0:$PATH"

## Renderer freshness

Tests exercise the real renderer binary, so a stale binary hides real
bugs and surfaces phantom ones. Setting `PLUSHIE_RUST_SOURCE_PATH` to
a plushie-rust checkout makes preflight rebuild the renderer first
via `cargo build --release -p plushie-renderer`, then drop the
output into `node_modules/.plushie/bin/` under the platform-specific
name `resolveBinary` expects. Without `PLUSHIE_RUST_SOURCE_PATH` the
existing binary resolution (env -> SEA -> downloaded -> sibling
checkout) is used unchanged. The cargo invocation runs with cwd set
to the workspace so its local `[patch.crates-io]` overrides for
plushie-iced apply.

The script lives at `scripts/rebuild-renderer.mjs` and is also safe
to invoke standalone when you want a fresh binary outside preflight.

## Commit hygiene

Every commit should be self-contained and functional. Preflight
should pass at each commit, not just at the tip.

Commits after `origin/main` are unpublished and can be freely
amended, squashed, or reordered to keep the history clean. Run
`git fetch origin` first to ensure the boundary is current. Use
`--amend` to fold small fixes into the commit they belong to
rather than creating "fix the fix" commits. If a later commit
fixes a bug introduced by an earlier unpublished commit, squash
them together.

Never amend or rebase commits that are already on `origin/main`.

## Commit messages

Commit messages should describe what changed and why. Do not include:
- Counts of any kind (findings, files, tests, items). If the
  content is listed, the reader can count. Counts add noise.
- Ticket, review, or tracking IDs (R-001, PROJ-123, etc.)
- References to this file

More broadly, think carefully before including counts anywhere
(code comments, docs, log messages). If the count is derivable
from the surrounding content, it doesn't add value.

## Writing style

Do not use `--` (double dash) as a separator or em-dash substitute
in prose, docs, comments, or bullet lists. Use a single `-` for
list item separators and reword sentences to avoid inline dashes
(use commas, periods, colons, or parentheses instead). `--` should
only appear as part of CLI flag names (e.g. `--watch`, `--release`).

## Quick reference

```
pnpm preflight          # lint + type check + build + test + docs
pnpm lint               # biome check
pnpm format             # biome format --write (auto-fix)
pnpm check              # tsc --noEmit (type checking only)
pnpm test               # vitest run
pnpm test:watch         # vitest (watch mode)
pnpm build              # tsup (ESM + CJS + declarations)
pnpm docs               # generate API reference (api-docs/)
pnpm docs:check         # generate API reference (warnings as errors)
```

## Tooling

- **pnpm**: package manager (strict, no phantom deps)
- **TypeScript 5.9+**: strict mode, see tsconfig.json
- **tsup**: builds ESM + CJS with .d.ts and sourcemaps
- **vitest**: test runner
- **biome**: linter and formatter
- **typedoc**: API reference generation
- **One runtime dependency**: `@msgpack/msgpack`

TypeScript strictness flags (all enabled):
`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`.

## Project config (plushie.extensions.json)

Project-level configuration for the CLI and build system:

```json
{
  "artifacts": ["bin", "wasm"],
  "bin_file": "bin/plushie-renderer",
  "wasm_dir": "static",
  "source_path": "../plushie-rust",
  "extensions": [...]
}
```

- `artifacts`: what to download/build (default `["bin"]`). Set to
  `["bin", "wasm"]` for projects that need the WASM renderer.
- `bin_file`: override binary destination path.
- `wasm_dir`: override WASM output directory.
- `source_path`: Rust source for local builds. If omitted, extension
  builds use published crates from crates.io.
- `extensions`: native widget extension declarations. Each entry with
  a `rustCrate` triggers a custom renderer build; the crate itself
  must declare `[package.metadata.plushie.widget]` with `type_name`
  and `constructor`.

Resolution order: CLI flag > config > env var > hardcoded default.

## Custom renderer builds

`npx plushie build` shells out to `cargo plushie build` (from the
`cargo-plushie` crate in plushie-rust). The SDK does not generate
Cargo workspaces or forward `[patch.crates-io]` entries on its own;
that logic lives in the build tool.

`src/cli/cargo-plushie.ts` resolves how to invoke the tool:

- `PLUSHIE_RUST_SOURCE_PATH` set: run via
  `cargo run -p cargo-plushie --release --quiet -- ...` out of the
  checkout.
- `cargo-plushie` on PATH at a matching `PLUSHIE_RUST_VERSION`:
  invoke the binary directly.
- Neither: throw a clear error with both remediation options.

The CLI writes a scratch app crate to
`node_modules/.plushie/renderer-spec/` that lists each native widget
as a path dep, then invokes
`cargo plushie build --manifest-path <scratch>/Cargo.toml`. The
produced binary is copied into `node_modules/.plushie/bin/` using the
platform naming convention so `resolveBinary` picks it up.

## Project layout

```
src/
  index.ts                    # main entry: app(), Command, Subscription, event guards
  app.ts                      # app() factory, AppConfig type, model inference
  types.ts                    # core types: UINode, Command, Event union, DeepReadonly
  command.ts                  # Command constructors (frozen, Symbol-tagged)
  effect.ts                   # Effect constructors (tag-based platform effects)
  subscription.ts             # Subscription constructors + key-based diffing
  events.ts                   # event type guards (isClick, isPointer, isTimer, etc.)
  runtime.ts                  # update loop, handler dispatch, command execution
  data.ts                     # data query pipeline: filter, search, sort, group, paginate
  dev-server.ts               # file watcher for hot reload (debounce + callback)
  keys.ts                     # keyboard key constants (KeyboardEvent.key values)
  native-widget.ts            # defineNativeWidget, nativeWidgetCommands (runtime, browser-safe)
  route.ts                    # client-side navigation routing (stack-based history)
  script.ts                   # .plushie test script parser and runner
  selection.ts                # selection state management (single/multi/range)
  undo.ts                     # undo/redo stack with coalescing support
  widget-handler.ts           # WidgetDef system for pure TS widgets with internal state
  wasm.ts                     # WASM renderer resolution and loading
  sea.ts                      # Node.js SEA (Single Executable Application) support
  jsx-runtime.ts              # JSX automatic transform (react-jsx)
  jsx-dev-runtime.ts          # JSX dev transform (delegates to production)
  animation/
    index.ts                  # re-exports (descriptors + tween)
    transition.ts             # transition(), loop() descriptor builders
    spring.ts                 # spring() descriptor builder with presets
    sequence.ts               # sequence() descriptor builder
    easing.ts                 # 31 named easing curves + cubic bezier
    tween.ts                  # SDK-side manual interpolation (createAnimation, etc.)
  canvas/
    index.ts                  # re-exports: shapes, path, stroke, gradient, transform, interactive
    shapes.ts                 # shape builders: rect, circle, line, path, text, image, svg, group
    path.ts                   # path command builders (moveTo, lineTo, bezierTo, arc, etc.)
    stroke.ts                 # stroke descriptor (color, width, cap, join, dash)
    gradient.ts               # linear gradient builder and types
    transform.ts              # transform values (translate, rotate, scale) and clip rects
    interactive.ts            # interactive shape wrapper for hit testing and events
  client/
    index.ts                  # createClient, Client type (public API)
    binary.ts                 # binary resolution, download, architecture validation
    transport.ts              # Transport interface, SpawnTransport, PooledTransport
    socket_transport.ts       # Transport over Unix socket or TCP (for --listen)
    wasm_transport.ts         # Transport for WASM renderer in browser
    framing.ts                # wire framing: msgpack length-prefix, JSONL
    protocol.ts               # message encode/decode (wire format <-> TS types)
    session.ts                # single session management
    pool.ts                   # multiplexed session pool (shared binary, N sessions)
    env.ts                    # environment variable whitelist for renderer subprocess
  cli/
    index.ts                  # CLI entry point (download, build, dev, run, stdio, inspect, etc.)
    cargo-plushie.ts          # resolve how to invoke `cargo plushie` (source-path or installed)
  tree/
    index.ts                  # re-exports
    node.ts                   # UINode creation, auto-ID generation
    normalize.ts              # tree normalization (widget structs -> wire nodes)
    diff.ts                   # tree diffing, patch generation
    search.ts                 # tree search utilities (depth-first find)
  ui/
    index.ts                  # re-exports all widget builders
    types.ts                  # shared prop types (Length, Padding, Color, Font, etc.)
    build.ts                  # widget builder utilities (typed props, nil-omission, handlers)
    handlers.ts               # handler collection for the view -> runtime bridge
    widgets/                  # per-widget builder modules
  testing/
    index.ts                  # testWith, createSession (public API)
    session.ts                # test session: click, typeText, find, model, assertText, etc.
CHANGELOG.md                    # release history
test/                           # unit and integration tests
examples/                       # example apps
  widgets/                      # custom widget examples (canvas-based)
```

## Package exports

```
plushie                  -> app(), Command, Subscription, event guards, types
plushie/ui               -> widget builder functions + JSX components
plushie/canvas           -> canvas drawing primitives (shapes, paths, gradients, interactive)
plushie/jsx-runtime      -> JSX automatic transform
plushie/jsx-dev-runtime  -> JSX dev transform (delegates to production)
plushie/testing          -> test framework
plushie/client           -> low-level protocol client
```

Most apps need two imports:
```typescript
import { app, Command, Subscription, isClick, isTimer } from 'plushie'
import { Window, Column, Row, Text, Button, TextInput } from 'plushie/ui'
```

## Architecture

This is NOT a direct port of plushie-elixir. It is a TypeScript-native
SDK that speaks the same wire protocol. The Elixir version chose the
pure Elm architecture because Elixir's process model and pattern
matching make it natural. This SDK makes TypeScript-native choices.

### Four-layer architecture

```
Layer 4: Testing        test sessions, helpers, vitest fixtures
Layer 3: App Framework  app(), runtime, handler dispatch, dev server
Layer 2: Tree           UINode construction, normalization, diffing
Layer 1: Client         binary management, transport, framing, protocol
```

**Layer 1 (Client)** is foundational. Everything depends on it. The
binary is required; there are no TypeScript-side mocks or stubs.
All testing, all rendering, all interaction goes through the real
plushie binary (in mock, headless, or windowed mode).

**Layer 2 (Tree)** handles diff and patch. Every state change produces
a new view tree, which is diffed against the previous tree. Only
patches are sent to the renderer. This is not optional. Snapshot
on every change is too expensive for non-trivial apps.

**Layer 3 (App Framework)** provides `app()` and the runtime. It
uses Layer 1 for transport and Layer 2 for tree operations.

**Layer 4 (Testing)** connects the same runtime to a pooled transport
backed by a shared `plushie --mock --max-sessions N` process. Tests
exercise the real wire protocol, real encoding, real diffing.

### WASM renderer

The plushie renderer can also run as a WebAssembly module for browser
and embedded use cases. `src/wasm.ts` handles WASM binary resolution
via env var (`PLUSHIE_WASM_PATH`), explicit path, or the default
download location (`node_modules/.plushie/wasm/`). The CLI supports
`npx plushie download --wasm` to show download instructions.

### Node.js SEA support

`src/sea.ts` provides helpers for bundling plushie apps as Node.js
Single Executable Applications. `isSEA()` detects the SEA context,
`extractBinaryFromSEA()` extracts the bundled plushie binary to a
temp file, and `generateSEAConfig()` produces a SEA configuration
object with plushie assets included.

Binary resolution (`src/client/binary.ts`) checks for SEA-bundled
binaries as step 2, after the env var override but before filesystem
lookups.

### Transport abstraction

The runtime doesn't know what it's connected to. It talks to a
Transport interface:

```typescript
interface Transport {
  readonly format: WireFormat
  send(message: Record<string, unknown>): void
  onMessage(handler: (message: Record<string, unknown>) => void): void
  onClose(handler: () => void): void
  close(): void
}
```

- **SpawnTransport**: standalone binary child process (production)
- **StdioTransport**: for `plushie --exec` mode (inherits stdio)
- **PooledTransport**: multiplexed session in a shared binary (testing)

Same runtime code runs in both modes.

### Core design: inline handlers + optional update fallback

Widget events use **inline pure-function handlers** on JSX/builder
props. Handlers receive current state as the first argument (injected
by the runtime, not captured via closure) and return new state or
`[state, command]`:

```tsx
const increment = (s: Model): Model => ({ ...s, count: s.count + 1 })

app({
  init: { count: 0 },
  view: (state) => (
    <Window id="main" title="Counter">
      <Button id="inc" onClick={increment}>+</Button>
    </Window>
  ),
})
```

Non-widget events (subscriptions, timers, async results) fall through
to an optional `update()` function:

```typescript
app({
  init: { count: 0, time: '' },
  subscriptions: (s) => [Subscription.every(1000, 'tick')],
  update(state, event) {
    if (isTimer(event, 'tick')) return { ...state, time: new Date().toLocaleTimeString() }
    return state
  },
  view: (state) => ...
})
```

Users can also use pure Elm style (only `update`, no inline handlers).
Both styles work with the same runtime. The handler model is primary
in docs because it's more natural for TypeScript developers.

### Why inline handlers work here (and why they're problematic elsewhere)

In DOM-based frameworks (React, Hyperapp), inline closures cause
performance problems: new function references trigger VDOM prop diffs,
break memoization, and churn event listeners. **None of this applies
to us.** Handlers never touch the wire. The renderer knows nothing
about them. Tree diffing only compares `{ id, type, props, children }`
-- handlers are stored in a TypeScript-side `Map<widgetId, handler>`
that's rebuilt every render cycle.

### Event dispatch order

1. Wire event arrives from renderer (e.g., `{ family: "click", id: "increment" }`)
2. Client decodes it into a typed Event
3. For widget events: check widget handler registry (composite widget event interception)
4. If not intercepted: look up handler registered during last `view()` for that widget ID + event type
5. If handler found: call `handler(currentState, event)` -> new state
6. If no handler: call `update(currentState, event)` if provided
7. Non-widget events (timer, async, key, etc.) always go to `update()`
8. Re-run `view()`, diff tree, send patches, sync subscriptions and windows

### Error resilience

Wrap handler/update/view calls in try/catch. On exception, log the
error, keep the previous model, skip the render. Rate-limit error
logging (full trace for first 10, debug for 11-100, suppress after
100, reminder every 1000). The app never crashes from a bug in an
event handler.

When someone returns a Promise from a handler, detect it and produce
a clear error explaining Command.async(). When a widget ID contains
`/`, explain scoped IDs. First-hour DX is defined by error messages.

### Coalescable event buffering

High-frequency events (pointer move, pointer scroll, resize,
pane resized) are buffered and coalesced. The runtime stores the latest event per
key in a `pendingCoalesce` map and flushes on the next microtask
via `queueMicrotask`. This prevents every pointer move from
triggering a full update/view/diff cycle.

Non-coalescable events (click, input, submit, toggle, key press,
etc.) flush the buffer first, preserving ordering: the user sees
the latest coalesced state before the discrete event.

### WasmTransport (browser runtime)

The plushie renderer also runs as a WebAssembly module for browser
and embedded use cases. `WasmTransport` wraps the wasm-bindgen
`PlushieApp` JavaScript API:

```typescript
import init, { PlushieApp } from 'plushie-wasm'
import { WasmTransport } from 'plushie/client'
import { Runtime } from 'plushie'

await init()  // Load WASM binary
const transport = new WasmTransport(PlushieApp)
const runtime = new Runtime(appConfig, transport)
await runtime.start()
```

Communication is always JSON (WASM module doesn't support msgpack
framing). The `app().run()` convenience method uses SpawnTransport
(child process) by default. For browser use, create a WasmTransport
directly and pass it to the Runtime constructor.

### Model immutability

- **Compile time**: `DeepReadonly<M>` on the model parameter in
  handlers, update, and view. Mutation attempts are type errors.
- **Runtime (dev only)**: `deepFreeze()` the model after each
  update when `NODE_ENV !== 'production'`.
- **Updates use spread**: `{ ...state, count: state.count + 1 }`.
  No Immer dependency. Users can bring Immer themselves if needed.

### Async commands

```typescript
Command.async(async (signal: AbortSignal) => {
  const res = await fetch(url, { signal })
  return res.json()
}, 'fetchResult')
```

- Runtime creates an AbortController per async command
- `signal` enables cooperative cancellation (fetch aborts, etc.)
- `Command.cancel('tag')` aborts the controller AND increments a nonce
- Stale results (from cancelled tasks) are discarded via nonce check
- Results arrive as `AsyncEvent` with `{ ok: true, value }` or `{ ok: false, error }`

### Streams use AsyncIterable

```typescript
Command.stream(async function*(signal) {
  for await (const chunk of someAsyncIterable) yield chunk
}, 'streamTag')
```

Yielded values -> StreamEvent. Return value -> AsyncEvent.

### Renderer-side animation

Animation descriptors declare intent in the view function. The
renderer handles interpolation locally with zero wire traffic:

```typescript
import { transition, spring, withAnimation } from 'plushie'

// Apply animation descriptors to any widget
withAnimation(
  <Container id="panel">...</Container>,
  { opacity: transition({ to: 1, from: 0, duration: 200 }) },
  { opacity: transition({ to: 0, duration: 150 }) },  // exit
)

// Spring physics for interactive elements
withAnimation(<Container id="card" />, {
  scale: spring({ to: 1.05, preset: "bouncy" }),
})
```

Three descriptor types:
- `transition(opts)`: timed with easing curves (31 named + cubic bezier)
- `spring(opts)`: physics-based with presets (gentle, bouncy, stiff, snappy, molasses)
- `sequence(opts)`: sequential chains of transitions and springs

`loop(opts)` is a convenience wrapper for repeating transitions.

The SDK-side tween system (`createAnimation`, `advanceAnimation`,
etc.) remains in `animation/tween.ts` for cases that need manual
frame-by-frame interpolation in TypeScript.

## Wire protocol

The canonical protocol spec is at `../plushie-rust/docs/protocol.md`.
That document is the source of truth for all message types, event
families, and interaction semantics.

## Testing

**All testing goes through the real plushie binary.** There are no
TypeScript-side mocks or stubs. The binary is fast enough (mock mode
is sub-millisecond per interaction) and provides session isolation
via multiplexing. A TypeScript mock would add a second implementation
to maintain, inevitably diverge, and produce false confidence.

### How it works

1. A shared binary process starts once: `plushie --mock --max-sessions N`
2. Each test gets an isolated session via the multiplexed pool
3. Tests interact via the wire protocol: Interact messages -> events
4. The runtime processes events through the app's handlers/update
5. State changes trigger view -> diff -> Patch back to the binary
6. Tests query the binary's tree (Query message) and the local model
7. Session is Reset at the end of each test

### Session pool

The pool starts in vitest's `globalSetup` (or `beforeAll` of a
shared suite). One binary, many sessions. The pool:
- Spawns `plushie --mock --max-sessions N` (or `--headless`)
- Assigns unique session IDs per test
- Routes incoming messages by session field
- Resets sessions between tests

### Test helpers

```typescript
import { testWith } from 'plushie/testing'
import Counter from './counter'

const test = testWith(Counter)

test('increments', async ({ app }) => {
  await app.click('increment')
  expect(app.model().count).toBe(1)
  app.assertText('count', 'Count: 1')
})
```

Helper API mirrors plushie-elixir: click, typeText, submit, toggle,
select, slide, press, release, typeKey, moveTo, find, model, tree,
assertText, assertExists, assertNotExists, awaitAsync, reset,
screenshot, treeHash, assertTreeHash, assertScreenshot.

### Three backends

- **mock** (`--mock`): sub-millisecond, no rendering, synthetic
  events. Default for `pnpm test`.
- **headless** (`--headless`): real rendering via tiny-skia, no
  display server, real screenshots. ~100ms per interaction.
- **windowed** (default mode): real iced windows, needs display
  server or Xvfb. Seconds per interaction.

Selection via env var: `PLUSHIE_TEST_BACKEND=headless pnpm test`

All three use the same wire protocol. Tests are backend-agnostic.

### Binary requirement for tests

Tests need the binary. It must be downloaded before `pnpm test`
works. The install process (postinstall or explicit download command)
handles this. If the binary is missing, tests fail fast with a clear
error message and download instructions.

## Design principles

- **TypeScript-native, not an Elixir port.** Use patterns that feel
  natural in TypeScript. JSX for views. Inline handlers for widget
  events. Discriminated unions for events. Spread syntax for updates.
- **The wire protocol is the contract.** Everything else is SDK design
  choices. Reference `../plushie-rust/docs/protocol.md` as the
  authoritative source for what the renderer expects and emits.
- **The binary is required.** No TypeScript-side renderer mocks.
  All testing goes through the real binary. Binary management
  (resolution, download, lifecycle) is core infrastructure.
- **Diff, don't snapshot.** Tree diffing and patching is always used.
  Snapshots only on first render and renderer restart.
- **Minimal dependencies.** One runtime dep (`@msgpack/msgpack`).
  No Immer, no class hierarchies, no decorator magic.
- **Strong typing, honest typing.** `DeepReadonly<M>` for the model.
  Discriminated unions for events. No `any` in the public API.
  Where TypeScript inference falls short (inline JSX lambdas), be
  honest about it and recommend named typed handlers instead.
- **Error messages matter.** When someone returns a Promise from a
  handler, detect it and explain Command.async(). When a widget ID
  contains `/`, explain scoped IDs. First-hour DX is defined by
  error messages, not feature lists.
- **No over-engineering.** Don't add features, abstractions, or
  "improvements" beyond what's needed. Widget builders are functions
  that return frozen objects. Commands are frozen tagged objects.
  Keep it simple.

## Reference SDK

The plushie Rust SDK (`../plushie-rust/crates/plushie/`) is the
primary reference for TypeScript due to similar type system
conventions and the inline handler model. The plushie-elixir SDK
is the overall reference implementation. Consult both when adding
features.

## Related repositories

These are expected as sibling directories (e.g. `../plushie-rust/`):

- plushie-rust - Rust workspace (SDK, widget SDK, renderer)
- plushie-elixir - Elixir SDK (reference implementation)
- plushie-iced - vendored iced fork
