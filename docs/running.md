# Running plushie

Plushie's **renderer** draws windows and handles input. Your
TypeScript code (the **host**) manages state and builds the UI tree.
They talk over a wire protocol: locally through a pipe, remotely
over SSH, or through any transport you provide. This guide covers
all the ways to connect them.

## Local desktop

The simplest setup: the host spawns the renderer as a child process.

```sh
npx plushie run my-app.tsx
```

Or from code:

```typescript
const handle = await myApp.run()
```

The renderer binary is resolved automatically. For most projects,
`npx plushie download` fetches a precompiled binary and you're done.
If you have native Rust extensions, build a custom renderer. You can
also set `PLUSHIE_BINARY_PATH` explicitly.

For projects that need both the binary and WASM renderer, declare it
in `plushie.extensions.json`:

```json
{
  "artifacts": ["bin", "wasm"],
  "wasm_dir": "static"
}
```

Then `npx plushie download` fetches both to the right locations.

CLI flags (`--bin-file`, `--wasm-dir`, `--bin`, `--wasm`) override
the config for one-off use. The resolution order is:
CLI flag > config file > hardcoded default.

### Dev mode

`npx plushie dev` watches your source files and reloads on change.
Edit code, save, see the result instantly. The model state is
preserved across reloads.

```sh
npx plushie dev my-app.tsx          # live reload enabled
npx plushie dev my-app.tsx --no-watch  # disable file watching
```

### Exec mode

The renderer can spawn the host instead of the other way around. This
is useful when plushie is the entry point (a release binary or
launcher) and it's the foundation for remote rendering over SSH.

```sh
plushie --exec "npx plushie stdio my-app.tsx"
```

The renderer controls the lifecycle. When the user closes the window,
the renderer closes stdin, and the host process exits cleanly.

In this mode, the renderer communicates with the host over a Unix
socket (not stdin/stdout). The `--exec` flag spawns the given command
and passes the socket path via environment variable. The host's
stdio remains free for normal console output, logging, and debugging.

## Remote rendering

Your host runs on a server. You want to see its UI on your laptop.
The renderer runs locally (where your display is), the host runs
remotely (where the data is), and SSH connects them:

```
[your laptop]                    [server]
renderer        <--- SSH --->    host
  draws windows                    init/update/view
  handles input                    business logic
```

Your `init`/`update`/`view` code doesn't change at all.

For a working example showing 6 transport modes (native, exec, WebSocket,
SSH, and client-side WASM), see the
[collab](https://github.com/plushie-ui/plushie-demos/tree/main/typescript/collab)
demo.

### Prerequisites

- **Your laptop**: the `plushie` renderer installed and on your PATH.
  Download from the GitHub releases page, or build with
  `cargo install plushie` if you have a Rust toolchain.
- **The server**: your TypeScript project deployed with its
  dependencies. The server does NOT need the renderer or a display
  server.
- **SSH access**: you can `ssh user@server` from your laptop.

### Quick start

```sh
plushie --exec "ssh user@server 'cd /app && npx plushie stdio my-app.tsx'"
```

The renderer on your laptop spawns an SSH session, which starts the
host on the server. The wire protocol flows through the SSH tunnel.
Each connection starts a fresh Node.js process on the server, so
there's a startup overhead.

### How --exec mode works for SSH

The `--exec` flag is the key to remote rendering. Here's the sequence:

1. The local `plushie` renderer starts on your laptop.
2. It spawns the command you give it (the SSH session).
3. The SSH session runs the host command on the server.
4. The host writes wire protocol messages to stdout, reads from stdin.
5. SSH pipes stdin/stdout between the two machines transparently.
6. The renderer on your laptop reads the host's output and renders it.
7. User input events flow back through the same pipe.

The renderer and host don't know they're on different machines. SSH
is just a transparent byte pipe.

### Binary distribution

The renderer always runs on the **display machine** (your laptop,
not the server). How you get it there depends on your project:

| Your project uses | Renderer needed | How to get it |
|---|---|---|
| Built-in widgets only | Precompiled | `npx plushie download` or GitHub release |
| Pure TypeScript extensions | Precompiled | Same (composites don't need a custom build) |
| Native Rust extensions | Custom build | Build targeting your laptop's architecture |

The server doesn't need the renderer at all. It only needs your
TypeScript project and its dependencies.

## Resiliency

Things go wrong. Renderers crash, code has bugs, networks drop.
Plushie handles these without losing your model state.

### Renderer crashes

If the renderer crashes (segfault, GPU error, out of memory), the
host detects it and restarts automatically with exponential backoff.
Your model state is preserved; the new renderer receives fresh
settings, a full snapshot of the current UI, and re-synced
subscriptions and windows. The user sees a brief flicker, then the
UI is back.

The host retries up to 5 times with exponential backoff:

| Attempt | Delay |
|---|---|
| 1 | 100ms |
| 2 | 200ms |
| 3 | 400ms |
| 4 | 800ms |
| 5 | 1600ms |

If all retries fail, the runtime logs troubleshooting steps and
stops. The rest of your application is unaffected; only the plushie
process exits. A successful connection resets the retry counter, so
intermittent crashes get a fresh budget each time.

On restart, the runtime:
1. Re-sends Settings
2. Sends a full Snapshot (replacing the tree)
3. Re-syncs subscriptions
4. Delivers error callbacks for pending effects

Use `handleRendererExit` to adjust state before a restart.

### Exceptions in your code

If a handler, `update()`, or `view()` throws, the runtime catches it,
logs the error with a full stack trace, and keeps the previous model
state. The window stays open and continues responding to events. You
don't need try/catch in your callbacks.

Error logging is rate-limited to prevent flooding:

| Error count | Behavior |
|---|---|
| 1-10 | Full stack trace |
| 11-100 | Debug-level logging |
| 101+ | Suppressed, with periodic reminders every 1000 errors |

### Network drops

When an SSH connection drops, both sides detect the broken pipe:

- **The renderer** sees the host's stdout close. It can display an
  error or retry the connection.
- **The host** sees stdin close. The plushie runtime exits (the rest
  of your application is unaffected). With daemon mode, plushie keeps
  running with the model preserved.

When a new renderer connects, the host sends a snapshot of the
current state. No restart, no state loss, no cold start.

### Window close

When the user closes the last window, your `update()` receives the
event. You can save state, persist data, or show a confirmation
dialog. In non-daemon mode, the plushie runtime exits. In daemon
mode, plushie keeps running and waits for a new renderer to connect.

## Event rate limiting

Over a network, continuous events like mouse moves, scroll, and
slider drags can overwhelm the connection. A standard mouse generates
60+ events per second; a gaming mouse can hit 1000. Rate limiting
tells the renderer to buffer these and deliver at a controlled
frequency. Discrete events like clicks and key presses are never
rate-limited.

Rate limiting is useful locally too; a dashboard doesn't need 1000
mouse move updates per second even on a fast machine.

### Global default

Set `defaultEventRate` in your app's settings:

```typescript
app({
  settings: {
    defaultEventRate: 60,   // 60 events/sec (good for most cases)
  },
  // ...
})
```

For a monitoring dashboard:

```typescript
app({
  settings: {
    defaultEventRate: 15,
  },
  // ...
})
```

### Per-subscription

Override the global rate for specific event sources:

```typescript
subscriptions: (state) => [
  Subscription.onMouseMove('mouse', { maxRate: 30 }),
  Subscription.onAnimationFrame('frame', { maxRate: 60 }),
  Subscription.onMouseMove('capture', { maxRate: 0 }),   // capture only, no events
],
```

### Per-widget

Override the rate on individual widgets:

```tsx
<Slider id="volume" range={[0, 100]} value={state.volume} eventRate={15} />
<Slider id="seek" range={[0, state.duration]} value={state.position} eventRate={60} />
```

### Latency and animations

| Transport | Localhost | LAN | WAN |
|---|---|---|---|
| Pipe (local) | < 1ms | -- | -- |
| SSH | -- | 1-5ms | 20-150ms |

On a LAN, animations are smooth and interactions feel instant. Over a
WAN (50ms+), user interactions have a visible round-trip delay. Design
for this by keeping UI responsive to local input (hover effects, focus
states) and accepting that model updates lag by the round-trip time.

## Custom transports

For advanced use cases, the `Transport` interface lets you bridge any
I/O mechanism to plushie. Write an adapter that speaks the Transport
interface, and plushie handles the rest. Most projects don't need
this; the built-in local and SSH transports cover the common cases.

### The Transport interface

```typescript
interface Transport {
  send(message: WireMessage): void
  onMessage(handler: (message: WireMessage) => void): void
  close(): void
}
```

Three messages, one contract. The runtime calls `send()` to push
messages to the renderer. The transport calls the `onMessage` handler
when a message arrives from the renderer. Call `close()` to shut
down the transport.

### Built-in transports

- **SpawnTransport**: spawns the renderer as a child process.
  Communication via stdin/stdout pipe. Used for local desktop apps.
- **PooledTransport**: multiplexed sessions over a shared binary.
  Used for testing.
- **SocketTransport**: connects to a renderer listening on a Unix
  socket or TCP port.
- **WasmTransport**: wraps the WASM renderer module for browser use.

### Example: custom TCP adapter

```typescript
import { createConnection, Socket } from 'net'
import { Framing } from 'plushie/client'

class TCPTransport implements Transport {
  private socket: Socket
  private buffer = Buffer.alloc(0)
  private handler: ((msg: WireMessage) => void) | null = null

  constructor(host: string, port: number) {
    this.socket = createConnection(port, host)

    this.socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk])
      const { messages, remaining } = Framing.decodePackets(this.buffer)
      this.buffer = remaining
      for (const msg of messages) {
        this.handler?.(msg)
      }
    })
  }

  send(message: WireMessage): void {
    this.socket.write(Framing.encodePacket(message))
  }

  onMessage(handler: (msg: WireMessage) => void): void {
    this.handler = handler
  }

  close(): void {
    this.socket.destroy()
  }
}
```

Then use it:

```typescript
import { Runtime } from 'plushie'

const transport = new TCPTransport('192.168.1.100', 9000)
const runtime = new Runtime(myApp.config, transport)
await runtime.start()
```

### Framing

Raw byte streams (SSH channels, raw sockets) need message boundaries.
The `Framing` module handles this. Transports with built-in framing
(Node.js child process pipes, `net.Socket` with `{packet: 4}`) may
not need it.

```typescript
import { Framing } from 'plushie/client'

// MessagePack: 4-byte big-endian length prefix
const encoded = Framing.encodePacket(data)
const { messages, remaining } = Framing.decodePackets(buffer)

// JSON: newline-delimited (JSONL)
const encoded = Framing.encodeLine(data)
const { lines, remaining } = Framing.decodeLines(buffer)
```

The default wire format is MessagePack with 4-byte length-prefix
framing. JSON uses newline-delimited framing (JSONL). Format is
auto-detected from the first byte: `0x7B` (`{`) means JSON,
anything else means MessagePack.

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
import { SocketTransport } from 'plushie/client'
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

const config = generateSEAConfig({
  main: 'dist/my-app.js',
  output: 'my-app',
  binaryPath: 'node_modules/.plushie/bin/plushie-renderer-linux-x86_64',
})
```

The plushie binary is included as a SEA asset and extracted to a
temp file at runtime. Binary resolution checks SEA assets
automatically.

For a complete working example with a packaging script, see the
[data-explorer](https://github.com/plushie-ui/plushie-demos/tree/main/typescript/data-explorer)
demo.

## Wire format

The default wire format is MessagePack (binary, fast). Use JSON for
debugging:

```sh
npx plushie run my-app.tsx --json
```

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

## Testing

See [Testing](testing.md) for the full guide. Quick summary:

```sh
pnpm test                                      # pooled mock (fast, no display)
PLUSHIE_TEST_BACKEND=headless pnpm test        # real rendering, no display
PLUSHIE_TEST_BACKEND=windowed pnpm test        # real windows (needs display)
```

## How props reach the renderer

You don't need to understand this to use plushie. It's here for when
you're debugging wire format issues or writing extensions.

When you return a tree from `view()`, it passes through four stages
before reaching the wire:

1. **Widget builders** (JSX components, function-API builders)
   return `UINode` objects with TypeScript values.

2. **Tree normalization** (`normalize()`) walks the tree and converts
   values for wire transport: scoped IDs are resolved, complex
   objects are serialized.

3. **Tree diffing** (`diff()`) compares the new tree against the
   previous tree and generates patch operations.

4. **Protocol encoding** serializes to MessagePack or JSON with
   string keys.

Each stage has one job. Widget builders don't worry about wire
format. The diff layer doesn't know about serialization. And the
protocol layer doesn't know about widget types.

## Next steps

- [Getting started](getting-started.md): setup, first app
- [Commands and subscriptions](commands.md): event rate limiting details
- [Testing](testing.md): three-backend test framework
- [Native widgets](native-widgets.md): custom widgets
