# Concurrency shape

How plushie-typescript's runtime is structured against the
JavaScript event-loop model, why the parts split the way they do,
and the discipline that holds them together. Other host SDKs have
their own concurrency story (BEAM processes for Elixir, Tokio
tasks for Rust, asyncio for Python); this is plushie-typescript's,
and it is downstream of Node and V8 idioms rather than cross-SDK
convergence.

## Single-threaded event loop

There is one event-loop thread. There is no real parallelism in
the SDK's runtime. Async work uses Promises, microtasks, and the
event loop; CPU-bound work blocks. The runtime's hot path is
synchronous because hot-path async would multiply Promise
allocations across every event.

This is fine for the SDK's workload. The renderer does the GPU
work in its own process. The host SDK's job is decoding events,
running the user's `update`/`view`, diffing trees, and emitting
patches. None of that wants to be parallel; serial dispatch with
microtask coalescing is the right shape.

The Worker Threads API is not used. Web Workers are not used. The
runtime runs on the main thread; user code runs on the main
thread; the transport reads the binary's stdout on the main
thread. If a user's `update` blocks for a hundred milliseconds,
the next event waits a hundred milliseconds. That is the right
default for a UI runtime; users with CPU-bound work should run
that work in `Command.async` callbacks that yield, or move it to
a worker themselves.

## The Runtime/Transport split

Two pieces, one composition:

- **Transport** owns the connection to the renderer. It owns wire
  framing (MessagePack length-prefix or JSONL), the child process
  lifecycle (for `SpawnTransport`), the session multiplexing (for
  `PooledTransport`), and the WASM interop (for `WasmTransport`).
  It knows nothing about apps, models, views, or commands.
- **Runtime** owns the app's `init/update/view` loop, the current
  model and tree, the subscription set, the widget handler
  registry, and command execution. It knows nothing about the
  wire format or the renderer process.

Transport speaks wire bytes (or in WASM's case, JS-side messages);
Runtime speaks Elm. They communicate through the Transport's
`send` and `onMessage` interface. Same Runtime code runs against
every Transport implementation.

This split exists because the two responsibilities have different
lifetimes and different failure modes. Transport failures are
renderer crashes or pipe breaks; the recovery is restart the
Transport and replay state. Runtime failures are app code
failures; the recovery is revert to the last good model. Mixing
the two would couple recovery paths that should be independent.

## AbortController for cancellation

Every async command and stream gets an AbortController. The
signal is passed to the user's callback:

```typescript
Command.async(async (signal: AbortSignal) => {
  const res = await fetch(url, { signal });
  return res.json();
}, "fetchResult");
```

`Command.cancel(tag)` does two things:

1. Calls `controller.abort()` so cooperative cancellation can fire
   (`fetch` aborts, the user's loop sees `signal.aborted`).
2. Increments a nonce so any result that arrives later from a
   stale task is dropped before reaching `update`.

Tasks that respect the signal cancel cleanly. Tasks that ignore it
have their results silently discarded. The nonce check is the
load-bearing piece; cooperation is best-effort.

`Command.stream` works the same way. The signal is passed to the
async generator; yields produce `StreamEvent`s; the generator's
return value produces a final `AsyncEvent`.

## Microtask coalescing

High-frequency events (pointer move, scroll, resize, pane resize)
are buffered in a `pendingCoalesce` map keyed by event type plus
target id. The runtime stores the latest event per key and flushes
on the next microtask via `queueMicrotask`. This prevents every
pointer move from triggering a full update/view/diff cycle.

Discrete events (click, input, submit, toggle, key press, etc.)
flush the buffer first to preserve ordering. The user sees the
latest coalesced state before the discrete event.

`queueMicrotask` is correct over `setTimeout(fn, 0)` because:

- Microtasks run before the next event loop tick. The flush
  happens within the same JS execution frame, before control
  returns to the renderer or the user's handlers.
- `setTimeout` would schedule a macrotask, hop through the timer
  queue, and miss the natural batching window.

`requestAnimationFrame` is not used in the runtime; the runtime is
not display-coupled. Animations are renderer-side; the host
emits descriptors (`transition`, `spring`, `sequence`), the
renderer drives the frame loop locally, no wire traffic per
frame.

## Promise discipline in handlers

Handlers and `update` are synchronous. Returning a Promise is a
programming error. The runtime detects a returned Promise
(thenable check) and surfaces a clear error explaining
`Command.async` rather than awaiting it silently.

The Elm-architecture contract is:

- `update(state, event)` returns the next model.
- The next model triggers `view`.
- The next view triggers diff and patch.

Awaiting in `update` would defer the next view until the Promise
settled, which mid-await is a state where `state` is stale. That
is a class of bug we do not want users debugging; the synchronous
contract plus `Command.async` is the better shape.

`Command.async` returns a Command that the runtime executes after
`update` returns. The user's async callback runs; its result
arrives as an `AsyncEvent`; the user's `update` handles the event
synchronously. State stays consistent through the round-trip.

## Backpressure and the firehose

A flooding renderer (or a misbehaving subscription source) can in
principle deliver events faster than the runtime can process them.
The runtime's defenses:

- Microtask coalescing for high-frequency events bounds work per
  flush by the number of distinct (type, target) pairs, not by
  the event rate.
- `defaultEventRate` and per-subscription `maxRate` cap how often
  high-frequency subscriptions deliver to the renderer in the
  first place.
- The transport's read buffer is bounded; backpressure from
  Node's stream mechanics on the binary's stdout pipe applies.

There is no in-memory event queue between the transport and the
runtime that grows unboundedly. The runtime processes events
serially as they decode; the only buffering is the coalesce map,
which holds at most one entry per (type, target) pair.

## Transport interface

`Transport` defines a small surface:

```typescript
interface Transport {
  readonly format: WireFormat;
  send(msg: Record<string, unknown>): void;
  onMessage(handler: (msg) => void): void;
  onClose(handler: (reason) => void): void;
  close(): void;
}
```

Implementations:

- `SpawnTransport`: forks the binary as a child process. The
  standard production transport.
- `StdioTransport`: uses `process.stdin`/`process.stdout` for
  renderer-parent exec mode where the parent process is the
  renderer.
- `PooledTransport`: multiplexed session in a shared
  `plushie --mock --max-sessions N` process. Used by the test
  framework.
- `WasmTransport`: wraps the wasm-bindgen `PlushieApp` for
  browser or embedded use cases. Always JSON-framed (the WASM
  module does not support MessagePack).
- `SocketTransport`: connects over Unix socket or TCP for remote
  rendering scenarios.

New transport modes implement the interface without touching
Runtime internals. This is the kind of small, well-justified
abstraction that earns its place: multiple real implementations
from day one, the shared shape (send, onMessage, close) is
genuinely the same concept, the Runtime code reads cleanly against
it.

## What is not used

- **No Worker Threads or Web Workers in the runtime.** The
  runtime runs on the main thread. CPU-bound user code is the
  user's problem to move off-thread; the SDK does not provide
  worker scaffolding.
- **No reactive streams library (RxJS, etc.).** Subscriptions are
  declarative descriptors; the runtime manages their lifecycle.
  An RxJS-shaped surface would add a dependency without solving a
  bug class the current shape does not solve.
- **No structuredClone of the model on every update.** The model
  is treated as immutable by contract (`DeepReadonly<M>`,
  dev-mode `deepFreeze`); deep cloning would be O(model size)
  per update for no resilience benefit.
- **No async iterators on the public Event surface.** The user
  subscribes via `subscriptions(state)` and handles events in
  `update`; an async-iterator surface would add a parallel path
  that diverges from the cross-SDK shape.
- **No "auto-resume on rejected promise" magic.** A handler that
  returns a Promise produces an error explaining
  `Command.async`; the runtime does not silently await.

## Implications

- A change that introduces a new long-lived async resource
  (interval, watcher, listener) gets a lifecycle question first:
  who owns the cleanup, when does it tear down, what happens on
  Runtime restart.
- A change that makes the Runtime do something the Transport
  already does (or vice versa) is suspect. Wire framing in the
  Runtime is wrong; app state in the Transport is wrong.
- A change that adds an `await` in the synchronous event path is
  a deliberate decision and should be questioned; the synchronous
  hot path is load-bearing for state consistency.
- A change that swallows an `AbortSignal` (skipping the
  cancellation propagation) breaks the cancellation contract;
  surface the signal or surface a clear reason for not doing so.
- A change that adds a cross-runtime concurrency shim (Bun
  worker pool, Deno worker, etc.) is a non-goal until that target
  is supported; see `goals-and-non-goals.md`.
