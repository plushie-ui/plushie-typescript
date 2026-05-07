# App lifecycle

A Plushie app is an Elm loop: `init` produces a model, `view`
turns the model into a tree of windows and widgets, and events
flow back through inline handlers and an `update` fallback to
produce the next model. The `app()` factory and `Runtime` class
in `plushie` own this loop. The renderer subprocess owns the
GPU, windows, and pointer input.

This reference covers the callbacks on `AppConfig`, the dispatch
order for incoming events, the render and diff cycle, error
resilience, and what happens when the renderer exits.

## The `app()` factory

```typescript
import { app } from "plushie"
import type { Command, Event } from "plushie"

const counter = app({
  init: { count: 0 },
  view: (state) => <Window id="main">{...}</Window>,
  update: (state, event) => state,
})

const handle = await counter.run()
```

`app<M>(config)` returns an `AppDefinition<M>`:

| Field | Type | Description |
|---|---|---|
| `config` | `AppConfig<M>` | The config passed in, stored for inspection. |
| `run` | `(opts?: RunOptions) => Promise<AppHandle<M>>` | Start the renderer, send settings, wait for hello, run init, render the first snapshot. |

The model type `M` is inferred from `init` when the shape is
simple. For discriminated unions or complex models, pass the
generic explicitly: `app<TodoModel>({ ... })`.

`AppHandle<M>` is the return value of `run()`:

| Method | Description |
|---|---|
| `stop()` | Shut down the runtime, abort async tasks, clear pending timers and effects, close the transport. |
| `model()` | Return the current model as `DeepReadonly<M>`. Useful for tests and debug logging. |

`run()` resolves once the renderer has sent its `hello` and the
first snapshot has been dispatched. It rejects if the renderer
fails to start, if the protocol version disagrees (see
[`ProtocolVersionMismatchError`](#protocol-handshake)), or if
the `hello` does not arrive within ten seconds.

## AppConfig callbacks

```typescript
interface AppConfig<M> {
  init: M | readonly [M, Command | Command[]]
  view: (state: DeepReadonly<M>) => AppView
  update: (state: DeepReadonly<M>, event: Event) => UpdateResult<M>
  subscriptions?: (state: DeepReadonly<M>) => Subscription[]
  settings?: AppSettings
  windowConfig?: (state: DeepReadonly<M>) => Record<string, unknown>
  requiredWidgets?: readonly (string | NativeWidgetConfig)[]
  handleRendererExit?: (state: DeepReadonly<M>, reason: RendererExit) => M
}
```

`init`, `view`, and `update` are required. `UpdateResult<M>` is
`M | readonly [M, Command | Command[]]`: return a new model, or
a tuple pairing the model with a command or command array.

### init

`init` is either a plain model value or a tuple
`[model, commands]`. The tuple form schedules commands that run
after the first render:

```typescript
const app1 = app({
  init: { count: 0 },
  view: (state) => <Window id="main"><Text>{String(state.count)}</Text></Window>,
  update: (state, event) => state,
})

const app2 = app({
  init: [
    { loading: true, data: null },
    Command.task(loadData, "bootstrap"),
  ],
  view: (state) => ...,
  update: (state, event) => {
    if (isAsync(event, "bootstrap") && event.result.ok) {
      return { ...state, loading: false, data: event.result.value }
    }
    return state
  },
})
```

Init commands run after the first snapshot is sent to the
renderer. The user sees the initial UI immediately; command
results arrive as events in subsequent updates.

### view

`view(state)` is called after every successful update. It
returns an `AppView`:

```typescript
type AppView = WindowNode | readonly WindowNode[] | null
```

The top level must be a window node (or a list of them, for
multi-window apps). Returning `null` is valid for daemon-style
apps that have closed all their windows; the runtime keeps the
model and subscriptions alive. Non-window nodes at the root
throw at render time.

The returned tree is normalized (scoped IDs, memoization,
widget view caches), diffed against the previous tree, and sent
to the renderer as a patch. On the first render, and after a
renderer restart, the full tree is sent as a snapshot instead.

`view` runs unconditionally after every update. There is no
model-equality check. The cost savings come from the diff: if
the new tree is identical, no patch is sent and no wire traffic
occurs.

### update

`update(state, event)` receives every event that does not match
an inline widget handler. Subscription ticks, async results,
window events, effect responses, and unhandled widget events
all flow here. Narrow with the event guards from `plushie`:

```typescript
update: (state, event) => {
  if (isTimer(event, "clock")) {
    return { ...state, now: new Date() }
  }
  if (isAsync(event, "save")) {
    return event.result.ok
      ? { ...state, saving: false }
      : { ...state, saving: false, error: String(event.result.error) }
  }
  return state
}
```

`update` must be synchronous. Returning a `Promise` is a runtime
error: the Plushie SDK logs a message instructing the caller to
use `Command.task` and drops the result. Async work belongs in
`Command.task` or `Command.stream`.

### subscriptions

`subscriptions(state)` is called after every update. The
runtime keys each subscription (see
[Subscriptions reference](subscriptions.md)), diffs against the
previously active set, and sends subscribe and unsubscribe
messages for the differences. Omitting the callback means the
app has no subscriptions.

### settings

`settings` is an `AppSettings` object sent once on startup:

| Field | Type | Description |
|---|---|---|
| `defaultTextSize` | `number` | Pixel size applied to text widgets that omit `size`. |
| `defaultFont` | `FontSpec` | Baseline font family. |
| `antialiasing` | `boolean` | Enable MSAA. |
| `vsync` | `boolean` | Sync to display refresh. |
| `scaleFactor` | `number` | Override HiDPI scale. |
| `theme` | `string \| Record<string, unknown>` | Built-in theme name or full palette. |
| `fonts` | `string[]` | Additional font sources to load at startup. |
| `defaultEventRate` | `number` | Base rate limit for high-frequency events. |
| `nativeWidgetConfig` | `Record<string, unknown>` | Per-widget init data, keyed by widget type. |
| `validateProps` | `boolean` | Enable renderer-side prop validation diagnostics. |

Full detail lives in the
[Configuration reference](configuration.md).

### windowConfig

`windowConfig(state)` returns a record of default window
settings (title, size, decorations) that is merged under each
window's per-tree props. Used when opening new windows and when
re-opening windows after a renderer restart.

Per-window props in the view tree override the defaults
returned here.

### handleRendererExit

`handleRendererExit(state, reason)` is called when the renderer
subprocess exits unexpectedly. `reason` is a `RendererExit`:

```typescript
interface RendererExit {
  readonly type: "crash" | "connection_lost" | "shutdown" | "heartbeat_timeout"
  readonly message: string
  readonly details?: Readonly<Record<string, unknown>>
}
```

Return a possibly-adjusted model. This is the opportunity to
clear state that depended on renderer-side resources (animation
progress, scroll positions, transient UI flags). The runtime
then attempts a restart and, on success, re-renders a full
snapshot against the returned model.

If the callback throws, the runtime dispatches a
`SystemEvent` with `type: "recovery_failed"` carrying the
exception message and the original exit reason, so `update` can
observe the failure.

## Event dispatch order

Every incoming event runs through the runtime in the following
order. Each step may consume the event or pass it on.

1. **Coalescing.** `move`, `scroll`, `resize`, and `pane_resized`
   events are deferred by scoped ID. Only the latest value per
   key survives; the batch flushes on a `queueMicrotask` before
   the next non-coalescable event runs.
2. **Status interception.** Widget `status` events derive
   `focused` and `blurred` events and update focus tracking.
3. **Diagnostic capture.** Widget `diagnostic` events push to
   an internal buffer (`getDiagnostics()` on the runtime).
4. **`awaitAsync` resolution.** Async events resolve any
   pending `awaitAsync` promises keyed on the event tag.
5. **Widget-handler timers.** Timer events with a widget-handler
   tag route to the widget handler subsystem, which may produce
   a derived event or silently update its own state.
6. **Dev overlay.** Events whose widget ID is part of the dev
   overlay (frozen UI banner) route to the overlay handler and
   stop there.
7. **Widget-handler dispatch.** Custom widget definitions get a
   chance to consume or transform the event before it reaches
   the app.
8. **Inline widget handler.** For a `widget` event, the runtime
   looks up the handler registered from `view` on the
   `(windowId, widgetId, eventType)` key. If found, the handler
   runs; its result replaces the model.
9. **`update` fallback.** Everything else runs through
   `update(state, event)`.

Inline handlers and `update` share the same return shape. Both
may return commands.

## The render cycle

After each successful update:

1. `view(state)` runs and returns a window node or list.
2. The tree is validated (top level must be a window node),
   normalized (scoped IDs, memo cache, widget view cache), and
   the new handler map is extracted.
3. If this is the first render or a forced snapshot, the full
   tree is sent via a `snapshot` message. Otherwise the runtime
   diffs against the previous tree and sends a `patch`.
4. `subscriptions(state)` runs and the active set is diffed.
5. Windows in the new tree are compared against the previous
   set. New windows trigger `window_open`, removed windows
   trigger `window_close`, and surviving windows with changed
   props trigger `window_update`.

The entire cycle is synchronous within a single event tick.
Commands returned from the handler or `update` run between
step 1 and step 2, so their wire traffic lands before the
patch.

## Model immutability

Handlers and `view` receive the model as `DeepReadonly<M>`. The
compiler rejects mutation of frozen fields. In development mode
(`NODE_ENV !== "production"`), the runtime also calls
`Object.freeze` recursively on every new model, catching any
mutation that slips past the type system at runtime.

Spread updates are the canonical pattern:

```typescript
(state) => ({ ...state, count: state.count + 1 })
(state) => ({ ...state, items: [...state.items, item] })
(state) => ({ ...state, user: { ...state.user, name } })
```

Do not write `state.count++`, `state.items.push(...)`, or
`state.user.name = ...`; each is a type error in strict mode
and a runtime error once dev-mode freezing kicks in.

## Error resilience

An exception thrown from an inline handler, `update`, `view`,
`subscriptions`, or `windowConfig` does not crash the runtime.

For handler and `update` failures, the model reverts to its
pre-call value and the render cycle is skipped. Log verbosity
escalates with the consecutive error count so a hot loop does
not flood the console:

| Consecutive errors | Log level |
|---|---|
| 1 to 10 | `console.error` with full detail |
| 11 to 100 | `console.debug` every tenth occurrence |
| 101 | `console.warn` suppression notice |
| 102+ | silent, with a warning every thousandth occurrence |

The counter resets to zero on the next successful handler run.

When `view` throws, the previous tree is preserved (no patch),
the widget handler registry is rolled back to its pre-view
value, and a `SystemEvent` with `type: "view_desync"` is
dispatched to `update` so the app can respond. After
accumulating consecutive view errors past a threshold, the
runtime injects a dev overlay banner noting the stale UI.

## Protocol handshake

Startup:

1. The transport is opened (subprocess for `SpawnTransport`,
   file descriptors for `StdioTransport`, TCP socket for
   `SocketTransport`, WebAssembly instance for `WasmTransport`).
2. The SDK sends a `settings` message carrying the merged
   `AppSettings` plus `requiredWidgets`.
3. The renderer replies with `hello` carrying its protocol
   version.
4. If the version disagrees with `PROTOCOL_VERSION`, the SDK
   rejects with `ProtocolVersionMismatchError` (exported from
   `plushie/client`) carrying both `expected` and `got`. The
   transport is closed.
5. On match, `init` runs, the first snapshot is sent, and init
   commands execute.

The handshake has a ten second timeout. A missing `hello`
rejects with "Renderer did not send hello within 10 seconds".

## Heartbeat

The runtime starts a heartbeat watchdog after the handshake.
Any inbound message from the renderer resets the timer.
If no message arrives within the heartbeat interval (30
seconds by default), the runtime logs a warning, treats it as
a renderer close with `reason = "heartbeat_timeout"`, and
triggers the restart path.

## Renderer restart

When the transport closes unexpectedly (crash, lost connection,
clean shutdown, or heartbeat timeout), the runtime:

- Fails pending `interact` promises with a descriptive error.
- Rejects pending effect-stub acks.
- Resolves pending `awaitAsync` watchers (the async tasks run
  in Node and may still complete; this just unblocks any
  awaiter).
- Dispatches a synthetic `EffectEvent` with
  `result.kind === "renderer_restarted"` for every pending
  effect, so in-flight file dialogs and clipboard reads see a
  concrete failure instead of hanging.
- Calls `handleRendererExit(state, reason)` if configured.

The restart uses exponential backoff: the base delay is 100
milliseconds, the cap is 5 seconds, and the formula is
`min(base * 2^attempt, cap)`. Up to five consecutive failures
are tolerated; on the sixth the runtime gives up and stays
stopped.

On a successful restart:

- Settings are re-sent to the new renderer process.
- The previous tree is cleared so the next render is a full
  snapshot.
- `view` re-runs against the current model.
- The subscription key map is wiped so every active
  subscription re-sends its subscribe message.
- Widget focus tracking resets (the new renderer has no memory
  of the old focus).
- The restart counter and consecutive-error counter reset.

Stale coalescable events captured before the restart are
discarded by virtue of clearing the transport and pending
effect map.

SDK-side state (model, async tasks running in Node, Node-side
timers) survives the restart. Renderer-side widget state
(cursor positions, scroll offsets, text editor internals)
does not: the new renderer is a fresh process.

## Shutdown

`handle.stop()` from `AppHandle` or `Command.exit()` from an
update both stop the runtime. Shutdown:

- Aborts every outstanding `AbortController` for
  `Command.task` and `Command.stream`.
- Clears every pending `setTimeout` used for timer
  subscriptions, `Command.sendAfter`, and effect timeouts.
- Cancels the heartbeat watchdog.
- Closes the transport.

After `stop`, the runtime refuses further sends. The renderer
subprocess exits cleanly on its own once the transport closes.

## See also

- [Commands reference](commands.md)
- [Subscriptions reference](subscriptions.md)
- [Events reference](events.md)
- [Configuration reference](configuration.md)
- [Wire protocol reference](wire-protocol.md)
