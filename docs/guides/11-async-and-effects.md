# Async and Effects

The pad runs everything inline so far: the compile step happens
in the update handler, saves hit the filesystem synchronously,
the preview tree is ready by the time we return a new model.
Real apps need more than that. They fetch data over the network,
ask the user to pick a file, copy text to the clipboard, and
show desktop notifications. None of that is synchronous, and
none of it should block the Elm loop.

In this chapter we add async commands for background work,
streaming commands for progress updates, and platform effects
for file dialogs, clipboard, and notifications. By the end the
pad has Export and Copy buttons in the toolbar, a "Run tests"
command that streams progress, and a proper handle on
cancellation.

## Async commands

`Command.task` runs an async function and delivers its return
value as an `AsyncEvent` with the tag you choose:

```tsx
import { Command, isAsync, isClick } from "plushie"
import { Button } from "plushie/ui"

<Button id="run-tests" onClick={startTests}>Run tests</Button>
```

```typescript
const startTests: Handler<Model> = (state) => [
  { ...state, status: "running" },
  Command.task(runTestSuite, "tests"),
]

async function runTestSuite(signal: AbortSignal): Promise<TestReport> {
  const res = await fetch("/api/run-tests", { signal })
  return (await res.json()) as TestReport
}
```

The second argument to `Command.task`, `"tests"`, is the **tag**
that identifies this task. The result arrives back in `update`
as an `AsyncEvent`:

```typescript
function update(state: DeepReadonly<Model>, event: Event) {
  if (isAsync(event, "tests")) {
    if (event.result.ok) {
      const report = event.result.value as TestReport
      return { ...state, status: "done", report }
    }
    return {
      ...state,
      status: "failed",
      error: String(event.result.error),
    }
  }
  return state
}
```

`event.result` is a discriminated union: `{ ok: true, value }`
on success, `{ ok: false, error }` on failure. The compiler
narrows `value` and `error` once you branch on `result.ok`.

A few things to know about async:

- **The function receives an `AbortSignal`.** Wire it through to
  `fetch`, streams, or any cancellable API. If the task is
  cancelled, the signal aborts and in-flight work stops.
- **One task per tag.** Starting a new task with a tag already in
  flight cancels the old one. This is exactly what you want for
  search-as-you-type or repeated "Refresh" clicks.
- **Rejections become errors.** A thrown or rejected value shows
  up as `{ ok: false, error }`, carrying the thrown value
  (typically an `Error`).
- **Stale results are dropped.** Every task carries an internal
  nonce. A cancelled task that resolves anyway is discarded
  before it reaches `update`.
- **`value` is `unknown`.** The payload has no static type. Cast
  it once you've checked `ok`, or narrow with a type guard.

## Streaming and progress

For long-running work that produces intermediate results, use
`Command.stream`. Yielded chunks arrive as `StreamEvent` values;
the generator's return value arrives as the final `AsyncEvent`:

```typescript
import { Command, isAsync, isStream } from "plushie"

function runExportStream(signal: AbortSignal): AsyncIterable<unknown> {
  return (async function* () {
    for (let i = 0; i <= 100; i += 10) {
      if (signal.aborted) return
      await new Promise((r) => setTimeout(r, 80))
      yield i
    }
  })()
}

Command.stream(runExportStream, "export-progress")
```

Handle chunks and completion side by side:

```typescript
if (isStream(event, "export-progress")) {
  const progress = typeof event.value === "number" ? event.value : state.progress
  return { ...state, progress }
}

if (isAsync(event, "export-progress")) {
  if (event.result.ok) {
    return { ...state, progress: 100, status: "exported" }
  }
  return { ...state, status: "failed", error: String(event.result.error) }
}
```

Bind `state.progress` to a `ProgressBar` in the view and the bar
fills as the stream emits. Streams share the async tag namespace:
two streams with the same tag cancel each other, as does a
`Command.task` with a tag already used by a stream.

## Cancellation

To cancel a running async or stream, issue `Command.cancel(tag)`:

```typescript
if (isClick(event, "cancel-tests")) {
  return [{ ...state, status: "cancelled" }, Command.cancel("tests")]
}
```

Cancellation is tag-based, not reference-based. The
`AbortSignal` handed to your function fires, and anything that
honours it (`fetch`, `ReadableStream`, signal-aware timeouts)
shuts down cleanly.

Starting a new task with the same tag cancels the old one and
starts fresh in one step, which is the standard shape for
search-as-you-type:

```typescript
Command.task((sig) => search(query, sig), "search")
```

## Platform effects

Effects are asynchronous requests to the renderer for native
platform operations: file dialogs, clipboard access, and
notifications. Unlike `Command.task` (which runs JavaScript in
the host process), effects are serviced by the renderer binary
and translated into OS-level calls.

All effect constructors live under the `Effect` namespace. Each
takes a string **tag** as its first argument. The tag identifies
the response, so there is no need to store request IDs in your
model.

### File dialogs

```typescript
import { Effect, isEffect } from "plushie"

Effect.fileSave("export", {
  title: "Export Experiment",
  defaultName: `${state.activeFile ?? "experiment"}.js`,
  filters: [["JavaScript", "*.js"]],
})
```

The result arrives as an `EffectEvent`. Match on the tag with
`isEffect`, then branch on `event.result.kind`:

```typescript
if (isEffect(event, "export")) {
  switch (event.result.kind) {
    case "file_saved":
      return saveExperimentTo(state, event.result.path)
    case "cancelled":
      return state
    case "error":
      return { ...state, error: event.result.message }
    case "timeout":
      return { ...state, error: "Save dialog timed out" }
    case "unsupported":
      return { ...state, error: "File save not supported on this platform" }
    case "renderer_restarted":
      return { ...state, status: "retry" }
  }
}
```

`event.result` is a discriminated union. The success `kind`
depends on which effect you dispatched:

| Effect | Success kind | Payload field |
| --- | --- | --- |
| `fileOpen` | `file_opened` | `path: string` |
| `fileOpenMultiple` | `files_opened` | `paths: readonly string[]` |
| `fileSave` | `file_saved` | `path: string` |
| `directorySelect` | `directory_selected` | `path: string` |
| `directorySelectMultiple` | `directories_selected` | `paths: readonly string[]` |
| `clipboardRead` | `clipboard_text` | `text: string` |
| `clipboardReadHtml` | `clipboard_html` | `html: string, altText: string \| null` |
| `clipboardWrite`, `clipboardWriteHtml` | `clipboard_written` | (none) |
| `clipboardClear` | `clipboard_cleared` | (none) |
| `notification` | `notification_shown` | (none) |

Non-success kinds are shared across every effect:

| Kind | Meaning |
| --- | --- |
| `cancelled` | The user dismissed the dialog, or the task was cancelled. |
| `error` | The platform call failed. `message` carries detail. |
| `timeout` | The renderer did not respond in time. |
| `unsupported` | The platform does not implement this effect. |
| `renderer_restarted` | The renderer crashed and recovered; the request was dropped. |

`cancelled` is distinct from `error`. A user closing a file
dialog is expected behaviour, not a failure. Handle them
separately unless your UX treats them the same.

### Clipboard

```typescript
// Write the editor contents to the clipboard.
Effect.clipboardWrite("copy", state.source)

// Read text from the clipboard into the editor.
Effect.clipboardRead("paste")
```

Handle both:

```typescript
if (isEffect(event, "copy")) {
  if (event.result.kind === "clipboard_written") {
    return { ...state, status: "Copied" }
  }
  return state
}

if (isEffect(event, "paste")) {
  if (event.result.kind === "clipboard_text") {
    return { ...state, source: event.result.text, dirty: true }
  }
  return state
}
```

Related constructors: `clipboardReadHtml`, `clipboardWriteHtml`,
`clipboardClear`. On Linux, `clipboardReadPrimary` and
`clipboardWritePrimary` access the middle-click selection buffer.

### Notifications

```typescript
Effect.notification("exported", "Exported", `Saved to ${path}`, {
  urgency: "normal",
  timeout: 5000,
})
```

Options are `icon`, `timeout` (display duration in milliseconds),
`urgency` (`"low"`, `"normal"`, or `"critical"`), and `sound`.
Completion arrives as `{ kind: "notification_shown" }`.

### Default timeouts

Each effect has a built-in response timeout. File dialogs allow
two minutes (the user may browse for a while); clipboard and
notification effects time out after five seconds. Override the
default by passing `timeout` in the options object:

```typescript
Effect.fileOpen("pick", { timeout: 30_000 })
```

If the renderer does not respond within the timeout, the result
is `{ kind: "timeout" }`.

## Tags as stable identifiers

Every async, stream, and effect constructor takes a string tag.
Tags route results back to a branch in `update`, enable
`Command.cancel(tag)` without a handle, collapse duplicate
in-flight work, and make `isAsync(event, "tag")` narrow cleanly.

Pick short, stable, human-readable names (`"search"`, `"export"`,
`"tests"`). Avoid dynamic tags (`` `req-${Date.now()}` ``) unless
you genuinely need concurrent requests that don't supersede each
other; the one-per-tag rule is usually the behaviour you want.

Tag typos are silent. A result with tag `"expoort"` never matches
`"export"` and falls through to the default branch. If a flow
seems to vanish, check the tag spelling on both sides first.

## One-shot scheduled events

`Command.sendAfter(delayMs, event)` dispatches a single event
after a delay, distinct from `Subscription.every` which keeps
firing:

```typescript
if (isClick(event, "save")) {
  return [
    saveAndRender(state),
    Command.sendAfter(3000, { kind: "clear_status" }),
  ]
}

// Later, in update:
if (event.kind === "clear_status") {
  return { ...state, status: null }
}
```

Calling `sendAfter` again with the same event payload replaces
the pending timer rather than stacking a duplicate. This prevents
runaway toast-dismissal timers when the user clicks save
repeatedly.

## Batching

A single update branch can return more than one command by
wrapping them in `Command.batch`:

```typescript
return [
  { ...state, status: "Copied" },
  Command.batch([
    Effect.clipboardWrite("copy", state.source),
    Effect.notification("copied", "Copied", "Source on clipboard"),
    Command.focus("editor"),
  ]),
]
```

Commands in a batch execute in list order. `Command.none()`
inside a batch is a no-op, which is handy when a branch
conditionally contributes a command:

```typescript
Command.batch([
  Effect.clipboardWrite("copy", state.source),
  state.autoSave ? Effect.notification("saved", "Saved", path) : Command.none(),
])
```

## Renderer restart survival

Async tasks run in the host JavaScript process, not in the
renderer binary. When the renderer restarts (for example after a
crash), in-flight tasks keep running and their results arrive as
usual. The app's model is preserved.

Effects are different. Because the renderer services them, an
in-flight effect gets a `{ kind: "renderer_restarted" }` result
when the renderer is replaced. Treat it like `cancelled` for
most flows; the user can retry once the renderer is back.

## Applying it: export and copy in the pad

Add Export and Copy buttons to the pad's toolbar:

```tsx
<Row id="toolbar" padding={[8, 4]} spacing={8}>
  <Button id="save" onClick={handleSaveClick}>Save</Button>
  <Button id="export" onClick={handleExportClick}>Export</Button>
  <Button id="copy" onClick={handleCopyClick}>Copy</Button>
  <Checkbox id="auto-save" value={state.autoSave}
            label="Auto-save" onToggle={handleAutoSaveToggle} />
</Row>
```

The click handlers are one-liners that return a tuple with the
relevant command:

```typescript
const handleExportClick: Handler<Model> = (state) => [
  state,
  Effect.fileSave("export", {
    title: "Export Experiment",
    defaultName: state.activeFile ?? "experiment.js",
    filters: [["JavaScript", "*.js"]],
  }),
]

const handleCopyClick: Handler<Model> = (state) => [
  state,
  Effect.clipboardWrite("copy", state.source),
]
```

The `update` function handles the results. Each effect has a
distinct tag, so matching is a direct branch:

```typescript
function update(state: DeepReadonly<Model>, event: Event) {
  if (isEffect(event, "export")) {
    if (event.result.kind === "file_saved") {
      writeFileSync(event.result.path, state.source)
      return [
        { ...state, status: `Exported to ${event.result.path}` },
        Effect.notification("exported", "Exported",
          `Saved to ${event.result.path}`),
      ]
    }
    if (event.result.kind === "error") {
      return { ...state, error: `Export failed: ${event.result.message}` }
    }
    return state // cancelled, timeout, unsupported, renderer_restarted
  }

  if (isEffect(event, "copy")) {
    if (event.result.kind === "clipboard_written") {
      return [
        { ...state, status: "Copied" },
        Command.sendAfter(2000, { kind: "clear_status" }),
      ]
    }
    return state
  }

  return state
}
```

The export flow writes the file on the `file_saved` branch, then
batches a notification so the user gets immediate feedback. The
copy flow uses `sendAfter` to clear the status message after two
seconds without wiring up a timer subscription.

## Common pitfalls

**Returning a promise from a handler.** Handlers and `update`
must return synchronously. An `async` handler returns a
`Promise<Model>`, which the runtime cannot render. Any time you
reach for `async` on a handler, you want `Command.task` instead:

```typescript
// Wrong: the runtime sees a Promise, not a model.
const handleClick: Handler<Model> = async (state) => {
  const data = await fetch("/api/data").then((r) => r.json())
  return { ...state, data }
}

// Right: kick off the work, let the result flow back through update.
const handleClick: Handler<Model> = (state) => [
  { ...state, status: "loading" },
  Command.task(async (sig) => {
    const res = await fetch("/api/data", { signal: sig })
    return res.json()
  }, "data"),
]
```

**Forgetting to branch on the discriminant.** Both
`AsyncEvent.result` and `EffectEvent.result` are discriminated
unions. TypeScript won't let you reach into `result.value` or
`result.path` until you've checked `result.ok` or `result.kind`.

**Starting tasks in `view`.** `view` runs on every render. Kick
off a `Command.task` from there and you'll start a fresh task on
every update. Commands belong in `update` and inline handlers,
which only fire in response to events.

**Dropping effect results on the floor.** Unhandled effect events
still arrive in `update` and fall through to your default branch.
Always handle the tag, even if the only interesting branch is
`cancelled`.

## Try it

Write experiments in the pad to exercise these concepts:

- Trigger `Command.task` with a slow fetch. Show a loading
  indicator while it runs, then display the response. Wire the
  `AbortSignal` through so a second click cancels the first.
- Drive a progress bar with `Command.stream`, emitting values
  from zero to a hundred with a short delay between each.
- Combine `Effect.clipboardWrite` with `Effect.notification`
  using `Command.batch` for immediate visible feedback.
- Add a Cancel button that fires `Command.cancel("tests")` and
  watch the abort signal propagate into an in-flight fetch.
- Trigger `Effect.fileOpen` with a `timeout` of 500ms and see
  the `timeout` result kind in action.

## See also

- [Commands reference](../reference/commands.md): full list of
  command constructors with signatures.
- [Events reference](../reference/events.md): `AsyncEvent`,
  `StreamEvent`, and `EffectEvent` shapes in detail.
- [App lifecycle](../reference/app-lifecycle.md): where commands
  and effects fit in the init / update / view cycle.
- [Composition patterns](../reference/composition-patterns.md):
  splitting large `update` functions by event family.

---

Next: [Canvas](12-canvas.md)
