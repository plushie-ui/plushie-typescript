# Browser Deployment

Plushie apps can ship in three shapes. By default an app runs
under Node.js, talking to a native `plushie-renderer` subprocess
over stdin/stdout. The same source can also run in a browser,
where the renderer rides along as a WebAssembly module loaded
into the same page. And a Node build can be packaged as a Single
Executable Application (SEA), a standalone binary that carries
the plushie renderer and the Node runtime inside one file.

This guide covers all three. The Node desktop case is the
baseline; the bulk of the guide is about the browser/WASM target,
which is where the architecture genuinely diverges from desktop.

## The three targets at a glance

| Target | Transport | Wire format | Renderer lives in |
|---|---|---|---|
| Node desktop | `SpawnTransport` (default) | msgpack (default) or JSON | Child process, spoken to over stdin/stdout |
| Browser / WASM | `WasmTransport` | JSON only | Same page, loaded as a WebAssembly module |
| Node SEA | `SpawnTransport` | msgpack or JSON | Extracted from the SEA bundle into a temp file on first run |

The app code itself is identical across targets. `app()`,
`update`, `view`, inline handlers, subscriptions, commands, and
the entire widget surface compile to the same JavaScript. What
changes is how the renderer is reached and which effects are
available.

## Target 1: Node desktop

This is the default covered by the rest of the guides. `plushie
run src/main.tsx` resolves the renderer binary, spawns it, and
wires a `SpawnTransport` into a `Runtime`. Nothing extra to
configure.

```tsx
import { app } from "plushie"
import { Button, Column, Text, Window } from "plushie/ui"

export default app({
  init: { count: 0 },
  view: (s) => (
    <Window id="main" title="Counter">
      <Column id="col">
        <Text id="count">Count: {s.count}</Text>
        <Button id="inc" onClick={(s) => ({ ...s, count: s.count + 1 })}>
          +
        </Button>
      </Column>
    </Window>
  ),
  update: (s) => [s],
})
```

```bash
npx plushie download
npx plushie run src/main.tsx
```

Everything a native desktop app can reach is on the menu: multi
window, file dialogs, clipboard, notifications, GPU accelerated
rendering, hot reload under `plushie dev`, and native widget
extensions. See the [CLI commands reference](../reference/cli-commands.md)
for the full command surface and the
[Configuration reference](../reference/configuration.md) for
environment variables.

## Target 2: Browser (WASM)

Plushie in the browser runs the whole app (model, update, view,
subscriptions) as JavaScript loaded by the page, and the renderer
as a WebAssembly module loaded into the same page. There is no
backend. There is no WebSocket. Your app and the renderer talk to
each other across a function-call boundary inside a single tab.

The WASM module speaks JSON only: it does not implement msgpack
framing. `WasmTransport.format` is fixed to `"json"`. See the
[Wire protocol reference](../reference/wire-protocol.md) for the
JSON framing details.

### Architecture

```
+---------------- browser tab ---------------+
|                                            |
|   your app JS  <-- JSON messages -->  WASM |
|   (Runtime)            in-process    (PlushieApp)
|                                            |
+--------------------------------------------+
```

The app creates a `WasmTransport` wrapping the `PlushieApp`
constructor exported by the `plushie-wasm` npm package (the
wasm-bindgen output of the Rust renderer). A `Runtime` is then
constructed against that transport, and `runtime.start()` drives
the usual Elm loop: initial settings, first render, then event
pump.

### Getting the WASM artifact

Two options. The usual one is to download the precompiled pair:

```bash
npx plushie download --wasm
```

This drops two files into `node_modules/.plushie/wasm/`:

- `plushie_renderer_wasm.js` (the wasm-bindgen JS loader)
- `plushie_renderer_wasm_bg.wasm` (the compiled module)

The destination can be overridden with `--wasm-dir <path>` or the
`wasm_dir` key in `plushie.extensions.json`. At lookup time
`resolveWasm()` checks `PLUSHIE_WASM_PATH`, then an explicit
`wasmDir` argument, then the default
`node_modules/.plushie/wasm/`. Missing files produce an error
that lists the search path.

The other option is to build from source. This requires a local
plushie-rust checkout and `wasm-pack` on `PATH`:

```bash
PLUSHIE_RUST_SOURCE_PATH=../plushie-rust \
  npx plushie build --wasm           # dev build

PLUSHIE_RUST_SOURCE_PATH=../plushie-rust \
  npx plushie build --wasm --release # optimized build
```

Both forms land the same pair of files in the configured
`wasm_dir`. The default is `node_modules/.plushie/wasm/`.

### Wiring the runtime

The canonical wiring in a browser entry point:

```tsx
import init, { PlushieApp } from "plushie-wasm"
import { Runtime } from "plushie"
import { WasmTransport } from "plushie/client"
import counter from "./counter"

await init()
const transport = new WasmTransport(PlushieApp)
const runtime = new Runtime(counter.config, transport)
await runtime.start()
```

The `init()` call resolves the WASM module. It must run to
completion before `new PlushieApp(...)` executes; otherwise the
constructor is undefined. The transport is created with the
`PlushieApp` constructor; the `Runtime` is constructed against
that transport and started.

`Runtime` is exported from `"plushie"`; `WasmTransport` is
exported from `"plushie/client"`. Settings can be passed through
the second argument to `WasmTransport`:

```typescript
const transport = new WasmTransport(PlushieApp, {
  settings: { defaultTextSize: 14, theme: "dark" },
})
```

The settings object is merged into the initial settings message
with `protocol_version` already set by the transport.

### Bundler setup

Plushie takes no stance on bundlers. Any tool that serves ES
modules and `.wasm` files works. The
[JSX and bundlers reference](../reference/jsx-and-bundlers.md)
covers configuration for Vite, esbuild, webpack, and others in
detail; the short form for each:

**Vite.** Exclude `plushie-wasm` from dep optimization so the
wasm-bindgen loader's relative `fetch` for the `.wasm` file
keeps working. Allow dev server access to
`node_modules/.plushie/wasm/` if the files live there.

```typescript
import { defineConfig } from "vite"

export default defineConfig({
  optimizeDeps: { exclude: ["plushie-wasm"] },
  assetsInclude: ["**/*.wasm"],
  server: { fs: { allow: ["..", "node_modules/.plushie"] } },
})
```

**esbuild.** Use `loader: { ".wasm": "file" }` and copy
`plushie_renderer_wasm_bg.wasm` alongside the bundle so the
loader's runtime `fetch` resolves.

**webpack.** Use `type: "asset/resource"` for `.wasm`, set
`experiments.asyncWebAssembly: true`, and make sure `publicPath`
lines up with where the asset is served.

Whichever bundler you pick, the page needs a `<canvas>` element
the renderer can attach to. The WASM module renders into the
first `<canvas>` it finds unless configured otherwise.

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Counter</title>
    <style>
      body { margin: 0; overflow: hidden }
      canvas { width: 100vw; height: 100vh; display: block }
    </style>
  </head>
  <body>
    <canvas id="plushie-canvas"></canvas>
    <script type="module" src="./main.js"></script>
  </body>
</html>
```

### Handlers work unchanged

Inline `onClick`, `onInput`, `onToggle`, and the rest of the
widget event props dispatch the same way in the browser as they
do on the desktop. `update` sees the same `Event` union.
Subscriptions (`Subscription.every`, `Subscription.onKeyPress`)
fire the same way. Tuple returns `[state, command]` work the
same way. Nothing in the update loop needs to change between
targets.

```tsx
<Button
  id="save"
  onClick={(s) => [
    { ...s, saving: true },
    Command.task(async () => save(s), "saved"),
  ]}
>
  Save
</Button>
```

### What's different in the browser

These differences are architectural, not bugs. They fall out of
running inside a page instead of owning a process.

- **No filesystem effects.** `Effect.fileOpen`, `Effect.fileSave`,
  and the directory variants return `unsupported` under WASM.
  Use browser APIs (`<input type="file">`, the File System Access
  API) through your own JS code if you need file input, and feed
  the results back through `Command.task`.
- **No native dialogs or notifications.** Same reason. The Web
  Notifications API is available but the SDK does not call it;
  wire it up as a task if you need it.
- **Clipboard is gesture-gated.** Browsers only grant clipboard
  reads and writes during a user gesture. `Command.clipboardRead`
  / `Command.clipboardWrite` dispatched from, say, a timer
  callback will reject.
- **Single window.** The WASM renderer attaches to one canvas. A
  view that returns more than one top-level `Window` node falls
  back to the first; peers are dropped and a diagnostic is
  logged.
- **Native widget extensions don't apply.** Extensions that
  declare a `rustCrate` in `plushie.extensions.json` only compile
  into the desktop renderer. A pure TS extension (no `rustCrate`)
  runs the same in both targets.
- **No process to restart.** The desktop runtime restarts the
  renderer subprocess with backoff on crash. The WASM runtime
  has nothing to restart; if the module crashes the page reloads.
- **Hot reload under the dev server does not apply.** Browser
  dev reload is whatever your bundler provides; Plushie's
  file-watching dev loop is a Node-side feature.

### Hosting the browser build

The compiled JS bundle and the `.wasm` binary are static assets.
Any static host works: S3 plus CloudFront, Netlify, Vercel's
static export, a plain nginx container, `python3 -m http.server`
for local smoke tests. Two things to check:

- The `.wasm` file must be served with `Content-Type:
  application/wasm`. Most hosts do this by default. If the page
  stalls on startup with a browser warning about WebAssembly
  instantiation, the MIME type is the usual suspect.
- Serve the bundle gzipped or brotli-compressed. The `.wasm`
  file compresses well and dominates first-load page weight.

Some browser features (threads, `SharedArrayBuffer`) require the
page to be cross-origin isolated with `Cross-Origin-Opener-Policy:
same-origin` and `Cross-Origin-Embedder-Policy: require-corp`
headers. The current WASM renderer does not require these, so
plain static hosting is enough. Revisit if you enable features
that need threads.

### Debugging

Browser devtools work the way you'd expect: the Console tab
shows logs and warnings the runtime emits with the `plushie:`
prefix, the Sources tab lets you set breakpoints in your handler
functions, and the Network tab shows the initial `.wasm` fetch.

For the renderer itself, enable verbose WASM logging by passing
`settings.rustLog` through the transport's settings object if
your build includes it, or add `console.log` statements around
the `send` and `onMessage` calls in a wrapper transport if you
need to see wire traffic. Unlike the desktop target, there is no
separate `RUST_LOG` environment for a subprocess to inherit.

## Target 3: Node Single Executable Application

A Node SEA bundle is a single file that contains the Node runtime,
your JavaScript bundle, and any assets you embed, wrapped as one
executable. Users run the binary; they do not need Node installed.
Plushie ships helpers in the `plushie` module (`isSEA`,
`extractBinaryFromSEA`, `generateSEAConfig`) to put the renderer
binary inside that bundle and pull it back out at runtime.

### When to reach for it

- Shipping a desktop app to users who will not install Node.
- Distributing a command-line tool that embeds a Plushie UI for
  interactive commands.
- Air-gapped or locked-down environments where a separate runtime
  install is a non-starter.

When you don't need any of the above, plain `plushie run` against
installed Node is simpler. SEA bundles are larger, slower to start
(the renderer has to be extracted on first run), and harder to
sign than a loose JavaScript app.

### Building a SEA bundle

Node's SEA support takes a JSON config file that points at the
bundled JS entry point, the output path, and an optional map of
embedded assets. `generateSEAConfig` writes that object for you:

```typescript
import { generateSEAConfig } from "plushie"
import { writeFileSync } from "node:fs"

const config = generateSEAConfig({
  main: "dist/app.js",
  output: "build/app.blob",
  binaryPath: "node_modules/.plushie/bin/plushie-renderer",
  wasmDir: "node_modules/.plushie/wasm",
})

writeFileSync("sea-config.json", JSON.stringify(config, null, 2))
```

The returned object includes:

- `main` and `output` as passed.
- `disableExperimentalSEAWarning: true`.
- `useSnapshot: false`, `useCodeCache: true` (the current SDK
  defaults).
- An `assets` map with `"plushie-binary"` pointing at the
  renderer, and, when `wasmDir` is set, `"plushie-wasm-js"` /
  `"plushie-wasm-bg"` for the WASM pair.

From there the standard Node SEA flow applies: `node
--experimental-sea-config sea-config.json` produces the blob,
then `postject` injects it into a copy of the Node binary. The
Node docs cover the invocation; the README for this SDK has a
short recipe.

### Finding the binary at runtime

Inside a running SEA bundle, `isSEA()` returns true and
`extractBinaryFromSEA()` pulls the embedded asset out to a
temp file (`os.tmpdir()/plushie-sea-<pid>` plus a `.exe` suffix
on Windows) and marks it executable on POSIX. The extracted
path can then be handed to `.run()`:

```typescript
import { app, isSEA, extractBinaryFromSEA } from "plushie"
import counter from "./counter"

const binary = isSEA() ? extractBinaryFromSEA() : undefined
await counter.run({ binary })
```

When `binary` is `undefined`, `.run()` falls back to the normal
resolution chain (`PLUSHIE_BINARY_PATH`,
`node_modules/.plushie/bin/`, and so on). `extractBinaryFromSEA`
takes an optional asset key; pass it if you used something other
than the default `"plushie-binary"` in your SEA config.

If the call is made outside a SEA context, it throws. The
`isSEA()` guard keeps the same entry point usable in both
development and packaged builds.

### SEA and WASM together

`generateSEAConfig` can embed the WASM pair alongside the native
binary. The SEA bundle then carries both, which lets a single
distributable ship a desktop runtime and an embeddable WASM
artifact (for apps that hand the WASM off to a webview or an
internal browser). The keys are `"plushie-wasm-js"` and
`"plushie-wasm-bg"`; extracting them follows the same
`sea.getAsset(key)` pattern as the binary.

Most SEA bundles do not need the WASM files. Skip the `wasmDir`
argument to keep the bundle small.

## See also

- [Configuration reference](../reference/configuration.md)
- [CLI commands reference](../reference/cli-commands.md)
- [JSX and bundlers reference](../reference/jsx-and-bundlers.md)
- [Wire protocol reference](../reference/wire-protocol.md)
