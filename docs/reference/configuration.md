# Configuration

Plushie is configured at three layers: environment variables for
deployment and CI, a project file (`plushie.extensions.json`) for
build tooling, and the `app()` / `.run()` call sites for runtime
behavior. Most projects need very little: install the binary,
write the app, and go.

The runtime factory lives in `plushie` (`app`, `AppSettings`,
`AppConfig`). Binary and WASM resolution live in `plushie/client`
(`resolveBinary`, `resolveWasm`, `SpawnTransport`, `StdioTransport`,
`SocketTransport`, `WasmTransport`).

## Environment variables

| Variable | Purpose |
|---|---|
| `PLUSHIE_BINARY_PATH` | Explicit path to the renderer binary. Overrides all other binary resolution. Missing file is a hard error. |
| `PLUSHIE_WASM_PATH` | Directory containing the WASM renderer files (`plushie_renderer_wasm.js` and `plushie_renderer_wasm_bg.wasm`). |
| `PLUSHIE_RUST_SOURCE_PATH` | Path to a local plushie-rust checkout for source builds. When set, `npx plushie build` invokes `cargo plushie` from the checkout. |
| `RUST_LOG` | Renderer log verbosity. Set to `plushie=debug` for full protocol logging. Forwarded to the renderer subprocess. |

`PLUSHIE_BINARY_PATH` resolves before any filesystem lookup. It is
useful in CI, in deployments where the binary ships alongside the
app, and for pointing at a specific local build. If the file is
missing, `resolveBinary` raises rather than falling through to
later steps.

`PLUSHIE_WASM_PATH` is read by `resolveWasm` in the browser /
WASM path. The directory must contain both the JS loader and the
`.wasm` binary produced by `wasm-pack`.

`PLUSHIE_RUST_SOURCE_PATH` is used by the CLI. When set, `plushie
build` invokes `cargo run -p cargo-plushie` from that checkout so
local Rust changes flow into the renderer without a cargo
publish. Omit it to build against published crates.

`RUST_LOG` uses the standard `env_logger` format. It is always
forwarded to the renderer; set `rustLog` on `RunOptions` (see
below) to override just for one invocation without touching the
shell environment. Common values:

- `plushie=debug`: full protocol and rendering detail.
- `plushie=info`: connection events and major state changes.
- `plushie=warn`: warnings only.

Combine `RUST_LOG=plushie=debug` with `format: "json"` for a
human-readable wire trace on stderr.

The renderer subprocess also receives a cleaned environment that
forwards display, rendering, locale, accessibility, and font
variables. Any variable prefixed with `PLUSHIE_` is forwarded too,
so `PLUSHIE_` is the reserved namespace for renderer debug
toggles.

## Binary resolution

`resolveBinary` (from `plushie/client`) runs the following order
and returns the first match:

1. `PLUSHIE_BINARY_PATH`.
2. A SEA-bundled binary when the SDK is running inside a Node.js
   Single Executable Application.
3. `node_modules/.plushie/bin/plushie-renderer-<os>-<arch>`, which
   is where both `npx plushie download` and `npx plushie build`
   place their output.
4. `./plushie-renderer`, then
   `../plushie-rust/target/release/plushie-renderer`, then
   `../plushie-rust/target/debug/plushie-renderer` for local
   development against a sibling checkout.
5. A hard error with guidance to run `npx plushie download`.

The chosen path is passed through `validateArchitecture`, a
best-effort check that warns when the binary architecture
disagrees with the host.

## Project config: plushie.extensions.json

The project-level config file sits at the repository root and
drives the CLI. The SDK runtime does not read it; it is consumed
by `plushie download`, `plushie build`, and the dev loop.

```json
{
  "artifacts": ["bin", "wasm"],
  "bin_file": "bin/plushie-renderer",
  "wasm_dir": "static/plushie",
  "source_path": "../plushie-rust",
  "extensions": [
    {
      "type": "sparkline",
      "rustCrate": "../widgets/sparkline"
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `artifacts` | `("bin" \| "wasm")[]` | What to download or build. Defaults to `["bin"]`. Set to `["bin", "wasm"]` for projects that ship a browser renderer too. |
| `bin_file` | `string` | Override destination for the native binary. Default is `node_modules/.plushie/bin/<platform-name>`. |
| `wasm_dir` | `string` | Override destination directory for WASM output. Default is `node_modules/.plushie/wasm`. |
| `source_path` | `string` | Path to plushie-rust for source builds. Overridden by `PLUSHIE_RUST_SOURCE_PATH`. |
| `extensions` | `NativeWidgetConfig[]` | Declared native widget extensions. Entries with `rustCrate` trigger a custom renderer build and block precompiled downloads. |

Each extension entry mirrors `NativeWidgetConfig` from
`plushie/native-widget`:

```json
{
  "type": "sparkline",
  "rustCrate": "../widgets/sparkline",
  "events": ["hover"],
  "commands": ["clear"]
}
```

The Rust crate listed in `rustCrate` must declare
`[package.metadata.plushie.widget]` with `type_name` and
`constructor`; `cargo plushie build` uses that metadata to wire
the widget into the generated workspace.

## Runtime settings

`AppSettings` (from `plushie`) holds defaults sent to the renderer
once during the startup handshake. Fields are supplied in
camelCase at the call site; `buildSettings` on the runtime
translates each one to its wire key.

```typescript
import { app } from "plushie"

const counter = app({
  init: { count: 0 },
  view: (s) => ...,
  update: (s, e) => ...,
  settings: {
    defaultTextSize: 16,
    theme: "dark",
    fonts: ["./fonts/inter.ttf"],
    defaultEventRate: 60,
    validateProps: true,
  },
})
```

| Field | Type | Wire key | Description |
|---|---|---|---|
| `defaultTextSize` | `number` | `default_text_size` | Default pixel size for text widgets that omit `size`. |
| `defaultFont` | `string \| { family, weight?, style? }` | `default_font` | Default font for text widgets that omit `font`. |
| `antialiasing` | `boolean` | `antialiasing` | Enables font antialiasing. Defaults on at the renderer. |
| `vsync` | `boolean` | `vsync` | Syncs frame presentation to the display refresh rate. |
| `scaleFactor` | `number` | `scale_factor` | Multiplier on top of OS DPI scaling. `2.0` on a 2x HiDPI display yields 4x physical per logical pixel. |
| `theme` | `string \| object` | `theme` | Built-in theme name (`"dark"`, `"light"`, `"nord"`) or a palette object. |
| `fonts` | `string[]` | `fonts` | Font file paths loaded at startup; loaded families are usable anywhere. |
| `defaultEventRate` | `number` | `default_event_rate` | Cap on events per second for coalescable sources (move, scroll, slide, animation frames). Per-subscription and per-widget overrides still apply. |
| `nativeWidgetConfig` | `Record<string, unknown>` | `extension_config` | Per-widget config forwarded to native widgets at init. Keyed by widget type name. |
| `validateProps` | `boolean` | `validate_props` | When true, the renderer emits diagnostic events for unknown or invalid props. Useful in dev and test. |

The wire keys are listed for people reading protocol traces.
Application code only sees the camelCase form.

## App configuration

`app(config)` accepts an `AppConfig<M>`. `M` is the model type
and is usually inferred from `init`.

| Field | Type | Description |
|---|---|---|
| `init` | `M \| [M, Command \| Command[]]` | Initial state. Optionally returns a tuple to dispatch startup commands. |
| `view` | `(state: DeepReadonly<M>) => WindowNode \| WindowNode[] \| null` | Declarative view. Must return a `Window` node, an array of window nodes for multi-window apps, or `null` to render nothing. |
| `update` | `(state, event) => M \| [M, Command \| Command[]]` | Required fallback for non-widget events (timers, async results, system events). Return the model unchanged for static apps. |
| `subscriptions` | `(state) => Subscription[]` | Active subscriptions, re-evaluated after every state change. Build the array explicitly; filter at the call site. |
| `settings` | `AppSettings` | Renderer settings (see table above). Sent once on startup. |
| `windowConfig` | `(state) => Record<string, unknown>` | Default window props merged under each per-window node. |
| `requiredWidgets` | `(string \| NativeWidgetConfig)[]` | Native widget type names this app expects. The renderer validates its registry and emits `required_widgets_missing` on mismatch. |
| `handleRendererExit` | `(state, reason: RendererExit) => M` | Called when the renderer subprocess exits. Return a new state; the runtime restarts transparently. |

`RendererExit.type` is one of `"crash"`, `"connection_lost"`,
`"shutdown"`, or `"heartbeat_timeout"`; `message` is a short
description and `details` carries wire-specific context.

`requiredWidgets` is validated by the renderer. Strings match
registered widget type names directly; `NativeWidgetConfig`
entries are reduced to their `type` field:

```typescript
import { app } from "plushie"
import { sparkline } from "./widgets/sparkline"

const dashboard = app({
  init: { series: [] },
  view: (s) => ...,
  update: (s, e) => ...,
  requiredWidgets: ["sparkline", "color_wheel"],
})
```

A missing widget surfaces as a `required_widgets_missing`
diagnostic event after the handshake; `update` can show a fallback
UI or exit.

Widget events route through inline handlers on the widget props
(`onClick`, `onInput`, ...); only non-widget events and unhandled
widget events reach `update`. See the
[Events reference](events.md).

## Run options

`.run(opts)` starts the app and returns an `AppHandle<M>` with
`stop()` and `model()`.

```typescript
const handle = await counter.run({
  transport: "spawn",
  format: "msgpack",
  rustLog: "plushie=debug",
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `binary` | `string` | `resolveBinary()` | Explicit binary path. Skips auto-resolution. |
| `format` | `"msgpack" \| "json"` | `"msgpack"` | Wire format. JSON is human readable; MessagePack is smaller and faster. |
| `args` | `string[]` | `[]` | Extra CLI arguments forwarded to the binary. Only meaningful for `spawn` transport. |
| `rustLog` | `string` | inherited | Overrides `RUST_LOG` just for this invocation. |
| `transport` | `"spawn" \| "stdio"` | `"spawn"` | Which built-in transport to use. For `socket` and `wasm`, instantiate the transport class directly. |

For anything beyond `spawn` and `stdio`, construct the transport
explicitly and pass it in:

```typescript
import { Runtime } from "plushie"
import { SocketTransport } from "plushie/client"

const runtime = new Runtime(config, () =>
  new SocketTransport({ address: "127.0.0.1:7100" }),
)
await runtime.start()
```

## Transports

Four transports ship in `plushie/client`. Each implements the
`Transport` interface (`send`, `onMessage`, `onClose`, `close`,
`format`) and supports both `"msgpack"` and `"json"` wire
formats.

### SpawnTransport (default)

Spawns the renderer binary as a child process and talks over its
stdin and stdout. This is what `.run()` uses unless overridden.
Stderr is forwarded to the host process so renderer logs stay
visible. Options: `binary`, `format`, `args`, `rustLog`.

### StdioTransport

Uses the host process's own stdin and stdout. This is the target
of `plushie --exec`: the renderer spawns the Node app as a
subprocess and they communicate over the app's stdio. `binary` is
ignored.

### SocketTransport

Connects to a renderer running with `plushie --listen` over a
Unix socket or TCP. Useful for remote rendering where the app and
the renderer live on different machines (local service, embedded
device, SSH-tunneled pairing). The wire protocol is identical to
the stdio transports; only the byte channel differs.

Address formats:

| Form | Interpretation |
|---|---|
| `/path/to/sock` | Unix domain socket at the given path. |
| `:PORT` | TCP on `127.0.0.1:PORT`. |
| `HOST:PORT` | TCP on `HOST:PORT`. |
| `[IPv6]:PORT` | TCP on an IPv6 address. Brackets are required. |

```typescript
import { Runtime } from "plushie"
import { SocketTransport } from "plushie/client"

const runtime = new Runtime(config, () =>
  new SocketTransport({ address: "/run/plushie.sock", format: "msgpack" }),
)
await runtime.start()
```

### WasmTransport

Runs the renderer as a WebAssembly module inside the browser.
The transport takes a `PlushieApp` constructor (produced by
`wasm-pack`) and drives it from the same runtime loop. The wire
format is always JSON on WASM. See
[JSX and bundlers](jsx-and-bundlers.md) for setup and loading.

## See also

- [Built-in widgets reference](built-in-widgets.md)
- [Events reference](events.md)
- [Commands reference](commands.md)
- [Subscriptions reference](subscriptions.md)
- [Wire protocol reference](wire-protocol.md)
