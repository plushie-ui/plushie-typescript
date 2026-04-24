# Shared State

The pad so far runs as a single local process: one renderer, one
Node app, one user. This chapter lifts it off a single machine.
One authoritative model lives in a host process; many clients
connect to it and each sees a private view of the same live state.
Edits in one window land in every other window, centrally
validated, without snapshotting the whole tree.

The SDK ships the pieces to build this: `SocketTransport` for
attaching to a listening renderer, `SessionPool` for multiplexing
a single renderer over many apps, `Runtime.injectEvent` for
pushing broadcasts into a running loop, and `SystemEvent` as a
typed carrier for custom messages. What it does not ship is a
turn-key "collaboration" module; that sits at the app layer on
top of these transports.

For the transports themselves see the
[Configuration reference](../reference/configuration.md). For the
CLI flags referenced below see the
[CLI commands reference](../reference/cli-commands.md).

## Why shared state

Three use cases come up repeatedly:

- **Multi-user apps.** A pair-programming pad, a design review
  board, a live dashboard for an ops team. One authoritative
  model; each user has their own input focus, scroll position,
  and window.
- **Remote rendering.** The app runs on a beefy server or inside
  a container; the renderer runs on the user's laptop, reached
  over SSH or a tunnel. The wire protocol is the same; only the
  byte channel changes.
- **Centralised state.** Tests, headless automation, and
  background jobs benefit from a single renderer pool they all
  talk to, rather than spawning one renderer per test or job.

The first two hand each client its own `Runtime`, so widget
event coalescing, subscriptions, and tree diffing stay per-user.
The third hands each test its own session on a shared renderer
process and reuses the renderer's native resources (font cache,
shader cache, windows).

## Two architectures

Two shapes cover almost everything you want to do with shared
state.

### One app, many renderers

The app runs once. Each renderer opens a socket connection into
it. Every renderer sees a distinct `Runtime` instance inside the
one app process; they all read and write the same authoritative
model via a shared actor.

```
 renderer 1  <-- socket -->  Runtime 1 ---+
                                          |
 renderer 2  <-- socket -->  Runtime 2 ---+--- shared model
                                          |
 renderer N  <-- socket -->  Runtime N ---+
```

Use this for multi-user collaboration and for remote rendering
where a relay in front of the app accepts client connections.
The app is the server; the renderer is the client.

### One renderer pool, many apps

A single `plushie --mock --max-sessions N` process hosts many
independent app sessions. Each app gets its own session ID on
the multiplexed stdio channel. Sessions are fully isolated:
widgets, models, subscriptions, and windows do not cross the
boundary.

```
                              +-- session A (app 1)
 plushie --mock --max-sessions N  --+-- session B (app 2)
                              +-- session C (app 3)
```

This is primarily a testing tool, covered in the
[Testing reference](../reference/testing.md) under "Session
pool". Production apps rarely use it directly; the test
framework in `plushie/testing` is the normal consumer.

## Remote rendering over SSH

Remote rendering is the path of least resistance for multi-user
access. The app stays on a server; users SSH in and a local
renderer talks to it over the SSH channel. No new listening
ports, no firewall changes, no TLS story needed: SSH is already
the secure channel.

Two CLI shapes carry this. First, the renderer spawns the app
remotely with `--exec`:

```bash
plushie --exec "ssh pad.example.com plushie-pad stdio"
```

The renderer runs locally. `ssh pad.example.com plushie-pad
stdio` runs on the server and its stdio carries the wire
protocol. On the server, `plushie-pad stdio` is whatever
entrypoint your app package exposes; the CLI helper is:

```bash
plushie stdio src/main.tsx
```

which spawns `tsx src/main.tsx` with `PLUSHIE_TRANSPORT=stdio`
and the SDK picks up the env var at startup (see
[Environment variables](../reference/cli-commands.md#environment-variables)).

Second, the app listens on a socket and renderers connect in
with `SocketTransport`:

```typescript
import { Runtime } from "plushie"
import { SocketTransport } from "plushie/client"

const runtime = new Runtime(padApp, () =>
  new SocketTransport({
    address: "/run/plushie-pad.sock",
    format: "msgpack",
  }),
)
await runtime.start()
```

On the renderer side:

```bash
plushie --listen /run/plushie-pad.sock
```

For quick local checks, `plushie connect` opens a transport and
prints the renderer's hello frame:

```bash
plushie connect /run/plushie-pad.sock
plushie connect :4567
plushie connect "[::1]:4567" --json
```

Full address grammar is in
[Configuration -> SocketTransport](../reference/configuration.md).

## Broadcasting model changes

Each client Runtime holds its own copy of the model, derived
from what the shared actor tells it. When the shared state
changes, every Runtime needs the new state to re-render. The
SDK surface for this is `Runtime.injectEvent(event)`: any event
dispatched through `injectEvent` goes through the same
`update -> view -> diff -> patch` pipeline as a real renderer
event.

The carrier is `SystemEvent`. It has three fields (`type`,
`tag`, `value`) that are free for the app to use:

```typescript
import type { SystemEvent } from "plushie"

const broadcast: SystemEvent = {
  kind: "system",
  type: "broadcast",
  tag: "pad",
  value: newSharedModel,
}

runtime.injectEvent(broadcast)
```

Match on it in `update`:

```typescript
import { isSystem } from "plushie"

update(state, event) {
  if (isSystem(event, "broadcast")) {
    return { ...state, shared: event.value as SharedModel }
  }
  // ... rest of update
}
```

Because `value` is `unknown`, narrow it at the boundary: either
with a type guard or a decoder. Never cast blindly; the value
crossed a process boundary and could be anything.

## The shared actor

The authoritative process is plain Node code. A class that holds
the model, runs a central `update`, and broadcasts to a list of
attached runtimes is enough:

```typescript
import type { Runtime, Event } from "plushie"

interface Attachment<M> {
  readonly runtime: Runtime<M>
  readonly id: string
}

export class SharedStore<S> {
  private model: S
  private readonly attachments = new Map<string, Attachment<unknown>>()

  constructor(
    initial: S,
    private readonly apply: (s: S, e: Event) => S,
  ) {
    this.model = initial
  }

  attach<M>(id: string, runtime: Runtime<M>): void {
    this.attachments.set(id, { runtime, id } as Attachment<unknown>)
    this.push(runtime as Runtime<unknown>)
  }

  detach(id: string): void {
    this.attachments.delete(id)
  }

  handle(event: Event): void {
    try {
      this.model = this.apply(this.model, event)
    } catch (err) {
      console.error("shared apply failed", err)
      return
    }
    for (const a of this.attachments.values()) {
      this.push(a.runtime)
    }
  }

  private push(runtime: Runtime<unknown>): void {
    runtime.injectEvent({
      kind: "system",
      type: "broadcast",
      tag: "pad",
      value: this.model,
    })
  }
}
```

`apply` is the pure reducer for shared-state changes: same shape
as the handler the app itself would use, minus anything
per-client. Keeping it as a separate function lets the shared
store and the app's own handlers share a definition.

Every broadcast flows through each client's `update` and `view`,
the tree diffs against that client's previous render, and only
changed patches reach the renderer. No snapshot payloads.

## Session isolation and failure events

When a renderer runs with `--max-sessions > 1`, the wire
protocol grows two session-scoped events for reporting failures
that touch only one session:

```typescript
import { isSessionError, isSessionClosed } from "plushie"

update(state, event) {
  if (isSessionError(event)) {
    return {
      ...state,
      banner: `session ${event.session} errored: ${event.code}`,
    }
  }
  if (isSessionClosed(event)) {
    return { ...state, banner: `session ${event.session} closed` }
  }
  // ...
}
```

The `code` field on `SessionErrorEvent` is stable and programmatic:
`session_panic`, `max_sessions_reached`, `session_channel_closed`,
`writer_dead`, `font_cap_exceeded`, `renderer_panic`,
`session_reset_in_progress`, `session_backpressure_overflow`. Use
it for branching; use `error` only for display. Full definitions
are in the [Events reference](../reference/events.md) and the
[Wire protocol reference](../reference/wire-protocol.md).

A session failure does not tear down its siblings. One client's
panic does not take down the app.

## Persisting shared state

Nothing in the SDK persists the shared model. That is the app's
job, and every shared-state app needs a strategy:

- **Snapshot on write.** After a successful `apply`, serialise
  the model to JSON and atomically replace a file on disk. Small
  models, infrequent writes, durable across restarts.
- **Append-only event log.** Log every accepted event to a file
  or a pipe; rebuild the model by replaying on boot. Natural fit
  for audit trails and debugging.
- **Database.** Write the reducer output through a transaction.
  Pair with a migration story for model-shape changes.

Emitting changes to external systems (a log collector, a message
bus, a second service) follows the same spot in the pipeline:
inside `handle`, right after the successful `apply`, before the
broadcast fan-out. Failures in the emit path must not block
broadcasts; log and move on.

## Event replay for debugging

The `.plushie` script format records and replays events against
the mock backend. When a shared-state bug reproduces for one
user, capture the sequence of events that hit the shared store
and replay them through a single-user harness:

```bash
plushie script test/scripts/pad-bug-1234.plushie
plushie replay test/scripts/pad-bug-1234.plushie
```

`plushie replay` uses the windowed backend so the bug is visible
as real pixels; `plushie script` runs headlessly so the
regression lives in CI. Both are covered in the
[CLI commands reference](../reference/cli-commands.md). The
scripts record `send` frames and assert on `event` frames: the
same shape the transport carries.

## Security

The shipped transports do not encrypt anything. `SocketTransport`
over TCP and Unix sockets is a plain byte stream, as is stdio.
This is intentional; layering is a user choice.

Practical options:

- **SSH.** Wrap the app in `ssh host plushie stdio src/main.tsx`
  or `ssh host plushie --listen ...` tunneled to localhost. SSH
  handles authentication and encryption; the app sees a clean
  stdio channel or a local socket.
- **TLS via a sidecar.** Run a reverse proxy (stunnel, nginx
  `stream`, Caddy L4) that terminates TLS and forwards to the
  app's Unix socket. The app stays plaintext-local; clients see
  TLS.
- **Unix socket permissions.** For local multi-user setups on a
  shared host, `chmod`/`chown` the socket file and rely on
  filesystem ACLs. No network surface at all.

Do not bind a TCP `SocketTransport` to a public interface
without a TLS terminator in front of it. The transports are
fine; the missing piece is the transport below them.

## The pad, collaboratively

Put the pieces together for the plushie_pad demo. The pad
already exposes a `padApp` from `src/app.ts`; wrap it in a host
that owns a `SharedStore` and accepts SSH-tunneled clients on a
Unix socket.

```typescript
// bin/plushie-pad-collab.ts
import { Runtime } from "plushie"
import { SocketTransport } from "plushie/client"
import { padApp } from "../src/app.js"
import { SharedStore } from "../src/shared.js"
import { applyPadEvent, initialSharedModel } from "../src/reducer.js"

const store = new SharedStore(initialSharedModel(), applyPadEvent)

async function attachClient(socketPath: string): Promise<void> {
  const runtime = new Runtime(padApp, () =>
    new SocketTransport({ address: socketPath, format: "msgpack" }),
  )
  const id = `client-${String(Date.now())}-${String(Math.random()).slice(2, 8)}`
  store.attach(id, runtime)
  await runtime.start()
  // Route renderer events to the shared store via a small wrapper
  // around the runtime's event path. For brevity, assume a helper
  // `interceptEvents(runtime, (e) => store.handle(e))`.
}

// A tiny supervisor loop would accept SSH channels and, for each,
// hand off a per-session Unix socket to `attachClient`.
```

The pieces you have to write yourself: the SSH daemon (Node's
`ssh2` works), the logic that assigns a socket per channel, and
the "route renderer events to the shared store" interceptor.
None of that touches SDK internals. The SDK pieces stay
unchanged: `SocketTransport`, `Runtime`, `injectEvent`.

Per-client state (which experiment is active, scroll position,
undo stack) does not belong in the shared model. Keep it in the
per-Runtime model and merge broadcasts with `...state`:

```typescript
if (isSystem(event, "broadcast")) {
  const shared = event.value as SharedModel
  return {
    ...state,
    files: shared.files,
    sourceByFile: shared.sourceByFile,
    // activeFile, source, undoStack stay local
  }
}
```

Splitting the model this way is the single biggest design
decision in a shared-state app. Err on the side of local; promote
fields to shared only when a second user needs to see them.

## What to try

- Add a "presence" bar to the pad: each connected client reports
  its name, the shared store fans out the list, every client
  re-renders it. Shared: `users: User[]`. Local: nothing.
- Wire up a `.plushie` replay of a collaborative editing
  session. Feed the captured events through `store.handle`
  offline and snapshot the final shared model.
- Swap the fan-out `for` loop in `SharedStore.handle` for a
  queue drained on `queueMicrotask`; compare latency under a
  burst of typing events. Measure with the built-in telemetry
  hooks in the [App lifecycle reference](../reference/app-lifecycle.md).
- Persist the shared model on every accepted event via an
  append-only log. On boot, replay the log, then start accepting
  new clients.

---

The guides end here. You have an app that renders, handles
input, animates, runs async work, tests itself, and shares state
across users. The
[reference docs](../reference/built-in-widgets.md) cover every
widget prop, event shape, command constructor, subscription, and
transport option in the depth this walkthrough skipped. When a
question has a specific answer, that is where to look.
