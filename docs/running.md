# Running plushie

Plushie's **renderer** draws windows and handles input. Your
TypeScript code (the **host**) manages state and builds the UI tree.
They talk over a wire protocol -- locally through a pipe, remotely
over a socket, or through a WASM module in the browser. This guide
covers all the ways to connect them.

## Local desktop

The simplest setup: the host spawns the renderer as a child process.

```sh
npx plushie run my-app.tsx
```

Or from code:

```typescript
const handle = await myApp.run()
```

The renderer binary is resolved automatically. Use
`npx plushie download` to fetch a precompiled binary. Set
`PLUSHIE_BINARY_PATH` to use a specific binary.

### Dev mode

Hot reload with state preservation:

```sh
npx plushie dev my-app.tsx
```

Edit your TypeScript file, save, and the window updates instantly.
The model survives the reload -- only `view()` is re-evaluated
with the new code. Pass `--no-watch` to disable file watching.

### Wire format

The default wire format is MessagePack (binary, fast). Use JSON
for debugging:

```sh
npx plushie run my-app.tsx --json
```

## Stdio transport

When the renderer spawns the host (via `plushie --exec`), the host
reads from stdin and writes to stdout:

```sh
npx plushie stdio my-app.tsx
```

The renderer runs the command and pipes its stdin/stdout to the host.
This is useful for remote rendering scenarios.

## Socket transport

Connect to a renderer running with `plushie --listen`:

```sh
# Start the renderer listening on a Unix socket:
plushie --listen /tmp/plushie.sock

# Connect from TypeScript:
npx plushie connect /tmp/plushie.sock my-app.tsx
```

Or from code:

```typescript
import { SocketTransport, Session } from 'plushie/client'
import { Runtime } from 'plushie'

const transport = new SocketTransport({ address: '/tmp/plushie.sock' })
const runtime = new Runtime(myApp.config, transport)
await runtime.start()
```

TCP is also supported: `plushie --listen 0.0.0.0:9000`.

## WASM (browser)

The renderer can run as a WebAssembly module in the browser:

```typescript
import init, { PlushieApp } from 'plushie-wasm'
import { WasmTransport } from 'plushie/client'
import { Runtime } from 'plushie'

await init()
const transport = new WasmTransport(PlushieApp)
const runtime = new Runtime(myApp.config, transport)
await runtime.start()
```

WASM mode uses JSON (not MessagePack) for communication. Download
the WASM files with `npx plushie download --wasm`.

## Standalone executables

Bundle your app as a single executable using Node.js SEA (Single
Executable Applications):

```typescript
import { generateSEAConfig, isSEA, extractBinaryFromSEA } from 'plushie'

// Generate the SEA config:
const config = generateSEAConfig({
  main: 'dist/my-app.js',
  output: 'my-app',
  binaryPath: 'node_modules/.plushie/bin/plushie-linux-x86_64',
})
```

The plushie binary is included as a SEA asset and extracted to a
temp file at runtime. Binary resolution checks SEA assets
automatically.

## Building from source

If you have the plushie Rust source checkout:

```sh
PLUSHIE_SOURCE_PATH=~/plushie npx plushie build
PLUSHIE_SOURCE_PATH=~/plushie npx plushie build --wasm
PLUSHIE_SOURCE_PATH=~/plushie npx plushie build --release
```

Requires `cargo` (Rust) and optionally `wasm-pack` for WASM builds.

## Binary resolution

The runtime resolves the binary in this order:

1. `PLUSHIE_BINARY_PATH` environment variable
2. SEA-bundled binary (if running in a Node.js SEA)
3. Downloaded binary at `node_modules/.plushie/bin/`
4. Local build paths (`./plushie`, `../plushie/target/release/plushie`)
5. Error with download instructions

## Environment isolation

The renderer subprocess receives a cleaned environment with only
whitelisted variables (display, GPU, font, and locale settings).
Credentials and secrets from the host environment are not leaked.

## Renderer restart

If the renderer crashes, the runtime automatically restarts it with
exponential backoff (100ms base, 5s max, up to 5 retries). On
restart:

1. Settings are re-sent
2. A full snapshot replaces the tree
3. Subscriptions are re-synced
4. Pending effects receive error callbacks

The model survives restarts. Use `handleRendererExit` to adjust
state before the restart.

## Error resilience

Exceptions in handlers, `update()`, or `view()` are caught and
logged. The model reverts to its pre-exception state. The GUI
stays up.

Logging is rate-limited: full stack traces for the first 10 errors,
debug-level for 11-100, then suppressed with periodic reminders.
