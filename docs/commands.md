# Commands and subscriptions

Iced has two mechanisms beyond the basic update/view cycle: `Task` (async
commands from update) and `Subscription` (ongoing event sources). Plushie
provides TypeScript equivalents for both.

## Commands

Sometimes a handler or `update()` needs to do more than return a new
model. It might need to focus a text input, start a network request,
open a new window, or schedule a delayed event. These are commands.

### Returning commands

Handlers and `update()` can return either a bare model or a
`[model, command]` tuple:

```typescript
// No commands -- just return the model:
const handleSimple = (s: Model) => s

// With a command -- return a tuple:
const handleSave = (s: Model): [Model, Command] => [
  s,
  Command.async(async () => saveToServer(s.data), 'saveResult'),
]
```

Results arrive via `update()`:

```typescript
update(state, event) {
  if (isAsync(event, 'saveResult')) {
    if (event.result.ok) return { ...state, saved: true }
    return { ...state, error: String(event.result.error) }
  }
  return state
}
```

### Available commands

#### Async work

Run a function asynchronously. The result is delivered as an
`AsyncEvent` with `{ ok: true, value }` or `{ ok: false, error }`.

<!-- test: commands_async_construct -- keep this code block in sync with the test -->
```typescript
Command.async(async (signal: AbortSignal) => {
  const res = await fetch(url, { signal })
  return res.json()
}, 'fetchResult')
```

The function receives an `AbortSignal` for cooperative cancellation.
If the function throws, the error is delivered as
`{ ok: false, error }`.

```typescript
function update(state: Model, event: Event): UpdateResult<Model> {
  if (isClick(event, 'fetch')) {
    const cmd = Command.async(async (signal) => {
      const res = await fetch('https://api.example.com/data', { signal })
      return res.json()
    }, 'dataFetched')
    return [{ ...state, loading: true }, cmd]
  }

  if (isAsync(event, 'dataFetched') && event.result.ok) {
    return { ...state, loading: false, data: event.result.value }
  }

  return state
}
```

#### Streaming async work

`Command.stream()` runs an async generator. Each yielded value
produces a `StreamEvent`; the final return value produces an
`AsyncEvent`.

<!-- test: commands_stream_construct -- keep this code block in sync with the test -->
```typescript
Command.stream(async function*(signal) {
  const reader = file.stream().getReader()
  let count = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    count++
    yield { progress: count }
  }
  return { total: count }
}, 'fileImport')
```

Handle intermediate and final values:

```typescript
function update(state: Model, event: Event): UpdateResult<Model> {
  if (isClick(event, 'import')) {
    const cmd = Command.stream(async function*(signal) {
      const lines = bigCsv.split('\n')
      const rows: Row[] = []
      for (let i = 0; i < lines.length; i++) {
        const row = parseRow(lines[i]!)
        rows.push(row)
        yield { progress: i + 1 }
      }
      return { complete: true, rows }
    }, 'fileImport')
    return [{ ...state, importing: true }, cmd]
  }

  if (isStream(event, 'fileImport')) {
    const v = event.value as { progress: number }
    return { ...state, rowsImported: v.progress }
  }

  if (isAsync(event, 'fileImport') && event.result.ok) {
    const v = event.result.value as { rows: Row[] }
    return { ...state, importing: false, data: v.rows }
  }

  return state
}
```

#### Cancel

`Command.cancel()` cancels a running `async` or `stream` command by
its tag. The runtime aborts the associated `AbortController` and
increments a nonce so stale results are discarded. If the task has
already completed, this is a no-op.

<!-- test: commands_cancel_construct -- keep this code block in sync with the test -->
```typescript
Command.cancel('fileImport')
```

```typescript
if (isClick(event, 'cancelImport')) {
  return [{ ...state, importing: false }, Command.cancel('fileImport')]
}
```

#### Done (lift a value)

`Command.done()` wraps an already-resolved value as a command. The
runtime immediately dispatches `mapper(value)` through `update()`
without spawning a task. Useful for lifting a pure value into the
command pipeline.

```typescript
Command.done(value, mapper)
```

```typescript
if (isClick(event, 'reset')) {
  return [state, Command.done(defaults, (v) => ({ type: 'configLoaded', config: v }))]
}
```

#### Exit

`Command.exit()` terminates the application.

```typescript
Command.exit()
```

#### Widget operations

##### Focus

<!-- test: commands_focus_construct, commands_focus_next_construct, commands_focus_previous_construct -- keep this code block in sync with the test -->
```typescript
Command.focus('todoInput')         // Focus a widget by scoped ID path
Command.focusNext()                // Focus next focusable widget
Command.focusPrevious()            // Focus previous focusable widget
```

Example:

```typescript
if (isClick(event, 'newTodo')) {
  return [{ ...state, input: '' }, Command.focus('todoInput')]
}
```

##### Text operations

```typescript
Command.selectAll('editor')                    // Select all text
Command.moveCursorToFront('editor')            // Cursor to start
Command.moveCursorToEnd('editor')              // Cursor to end
Command.moveCursorTo('editor', 42)             // Cursor to char position
Command.selectRange('editor', 5, 10)           // Select character range
```

Example:

```typescript
if (isClick(event, 'selectWord')) {
  return [state, Command.selectRange('editor', 5, 10)]
}
```

##### Scroll operations

<!-- test: commands_snap_to_end_construct, commands_snap_to_construct, commands_scroll_by_construct -- keep this code block in sync with the test -->
```typescript
Command.scrollTo('list', 0, 100)   // Scroll to absolute position
Command.snapTo('list', 0.0, 0.5)   // Snap to relative position (0.0-1.0)
Command.snapToEnd('list')           // Snap to end of scrollable content
Command.scrollBy('list', 0, 50)    // Scroll by relative delta
```

Example:

```typescript
if (isClick(event, 'scrollBottom')) {
  return [state, Command.snapToEnd('chatLog')]
}
```

#### Window management

Windows are opened declaratively by including window nodes in the view
tree. There is no `openWindow` command. To open a window, add a
`<Window>` node to the tree returned by `view()`. To close one, remove
it or use `Command.closeWindow()`.

```typescript
Command.closeWindow('settings')                           // Close a window
Command.resizeWindow('main', 800, 600)                    // Resize
Command.moveWindow('main', 100, 100)                      // Move
Command.maximizeWindow('main')                             // Maximize (default: true)
Command.maximizeWindow('main', false)                      // Restore from maximized
Command.minimizeWindow('main')                             // Minimize (default: true)
Command.minimizeWindow('main', false)                      // Restore from minimized
Command.setWindowMode('main', 'fullscreen')                // 'fullscreen', 'windowed', etc.
Command.toggleMaximize('main')                             // Toggle maximize state
Command.toggleDecorations('main')                          // Toggle title bar/borders
Command.gainFocus('main')                                  // Bring window to front
Command.setWindowLevel('main', 'always_on_top')            // 'normal', 'always_on_top', etc.
Command.dragWindow('main')                                 // Initiate OS window drag
Command.dragResizeWindow('main', 'south_east')             // Initiate OS resize from edge
Command.requestUserAttention('main', 'informational')      // Flash taskbar ('informational', 'critical')
Command.screenshotWindow('main', 'screenshot_tag')         // Capture window pixels
Command.setResizable('main', false)                        // Enable/disable resize
Command.setMinSize('main', 400, 300)                       // Set minimum window size
Command.setMaxSize('main', 1920, 1080)                     // Set maximum window size
Command.enableMousePassthrough('main')                     // Click-through window
Command.disableMousePassthrough('main')                    // Normal click handling
Command.showSystemMenu('main')                             // Show OS window menu
Command.setIcon('main', rgbaData, 32, 32)                  // Set window icon (raw RGBA)
Command.setResizeIncrements('main', 8, 8)                  // Set resize step increments
Command.allowAutomaticTabbing(true)                        // Enable/disable macOS automatic tab grouping
```

Example:

```typescript
if (isClick(event, 'goFullscreen')) {
  return [state, Command.setWindowMode('main', 'fullscreen')]
}

if (isClick(event, 'pinOnTop')) {
  return [state, Command.setWindowLevel('main', 'always_on_top')]
}
```

`Command.setIcon()` sends raw RGBA pixel data. The `rgbaData` must be
a `Uint8Array` of `width * height * 4` bytes.

`Command.dragResizeWindow()` initiates an OS-level resize operation from
a specific edge or corner. The `direction` string specifies the resize
handle: `"north"`, `"south"`, `"east"`, `"west"`, `"north_east"`,
`"north_west"`, `"south_east"`, `"south_west"`.

`Command.requestUserAttention()` flashes the taskbar icon. Pass `null`
to cancel a previous attention request. Urgency levels: `"informational"`
(gentle) and `"critical"` (persistent until acknowledged).

`Command.screenshotWindow()` captures the window's pixels. The result
arrives as an event identified by the tag.

#### Window queries

Window queries are commands whose results arrive as events in `update()`.

##### Window property queries

Results arrive as `EffectEvent` where `requestId` is the **window_id**
string.

```typescript
Command.getWindowSize('main', 'sizeResult')
// Result: { kind: "effect", requestId: "main", status: "ok", result: { width, height } }

Command.getWindowPosition('main', 'posResult')
// Result: { kind: "effect", requestId: "main", status: "ok", result: { x, y } }
// (null if position is unavailable)

Command.getMode('main', 'modeResult')
// Result: { kind: "effect", requestId: "main", status: "ok", result: "windowed" | "fullscreen" | "hidden" }

Command.getScaleFactor('main', 'scaleResult')
// Result: { kind: "effect", requestId: "main", status: "ok", result: factor }

Command.isMaximized('main', 'maxResult')
// Result: { kind: "effect", requestId: "main", status: "ok", result: boolean }

Command.isMinimized('main', 'minResult')
// Result: { kind: "effect", requestId: "main", status: "ok", result: boolean }

Command.rawId('main', 'rawResult')
// Result: { kind: "effect", requestId: "main", status: "ok", result: platformId }

Command.monitorSize('main', 'monResult')
// Result: { kind: "effect", requestId: "main", status: "ok", result: { width, height } }
// (null if monitor cannot be determined)
```

Example:

```typescript
if (isClick(event, 'checkSize')) {
  return [state, Command.getWindowSize('main', 'gotSize')]
}

if (isEffect(event, 'main') && event.status === 'ok') {
  const data = event.result as Record<string, number>
  if ('width' in data && 'height' in data) {
    return { ...state, windowWidth: data['width'], windowHeight: data['height'] }
  }
}
```

**Note:** Because the response is keyed by `windowId` rather than `tag`,
issuing multiple different queries against the same window will produce
results that share the same `requestId`. Distinguish them by the shape
of the result (e.g. `{ width, height }` for size vs. `{ x, y }` for
position).

##### System queries

System-level queries use a different transport path. Results arrive as
`SystemEvent` where the tag identifies the response.

```typescript
Command.getSystemTheme('themeResult')
// Result: { kind: "system", type: "system_theme", tag: "themeResult", data: "light" | "dark" | "none" }

Command.getSystemInfo('infoResult')
// Result: { kind: "system", type: "system_info", tag: "infoResult", data: { system_name, ... } }
// data keys: system_name, system_kernel, system_version, system_short_version,
//   cpu_brand, cpu_cores, memory_total, memory_used, graphics_backend, graphics_adapter
// Requires the renderer to be built with the `sysinfo` feature.
```

**Important:** The `tag` arrives as a string in the event, matching the
string you passed to the command.

```typescript
if (isClick(event, 'detectTheme')) {
  return [state, Command.getSystemTheme('themeDetected')]
}

if (isSystem(event, 'system_theme') && event.tag === 'themeDetected') {
  return { ...state, osTheme: event.data as string }
}
```

#### Image operations

In-memory images can be created, updated, and deleted at runtime. The
`Image` widget references them via `{ handle: "name" }` as its source.

```typescript
Command.createImage('preview', pngBytes)                     // From PNG/JPEG Uint8Array
Command.createImage('preview', 64, 64, rgbaPixels)           // From raw RGBA Uint8Array
Command.updateImage('preview', newPngBytes)                   // Update with PNG/JPEG
Command.updateImage('preview', 64, 64, newRgbaPixels)        // Update with raw RGBA
Command.deleteImage('preview')                                // Remove in-memory image
Command.listImages('imgListResult')                           // List all handles (result via event)
Command.clearImages()                                         // Clear all in-memory images
```

Example:

```typescript
if (isClick(event, 'loadPreview')) {
  const cmd = Command.async(async () => {
    const res = await fetch('/preview.png')
    return new Uint8Array(await res.arrayBuffer())
  }, 'previewLoaded')
  return [state, cmd]
}

if (isAsync(event, 'previewLoaded') && event.result.ok) {
  return [state, Command.createImage('preview', event.result.value as Uint8Array)]
}
```

#### PaneGrid operations

Commands for manipulating panes in a `PaneGrid` widget.

```typescript
Command.paneSplit('paneGrid', 'editor', 'horizontal', 'newEditor')  // Split a pane
Command.paneClose('paneGrid', 'editor')                              // Close a pane
Command.paneSwap('paneGrid', 'editor', 'terminal')                  // Swap two panes
Command.paneMaximize('paneGrid', 'editor')                           // Maximize a pane
Command.paneRestore('paneGrid')                                      // Restore from maximized
```

Example:

```typescript
if (isClick(event, 'splitEditor')) {
  return [state, Command.paneSplit('paneGrid', 'editor', 'horizontal', 'newEditor')]
}
```

#### Timers

```typescript
Command.sendAfter(delayMs, event)  // Send event after delay
```

```typescript
if (isClick(event, 'flashMessage')) {
  return [
    { ...state, message: 'Saved!' },
    Command.sendAfter(3000, { type: 'clearMessage' }),
  ]
}

// In update:
if ((event as any).type === 'clearMessage') {
  return { ...state, message: null }
}
```

#### Batch

Combine multiple commands:

<!-- test: commands_batch_construct -- keep this code block in sync with the test -->
```typescript
Command.batch([
  Command.focus('nameInput'),
  Command.sendAfter(5000, { type: 'autoSave' }),
])
```

Commands in a batch are dispatched sequentially. Async commands spawn
concurrent tasks, but the dispatch loop itself processes each command
in order.

#### Extension commands

Push data directly to a native Rust extension widget without
triggering the view/diff/patch cycle. Used for high-frequency data
like terminal output or streaming log lines.

<!-- test: commands_extension_command_construct, commands_extension_commands_construct -- keep this code block in sync with the test -->
```typescript
// Single command
Command.extensionCommand('term-1', 'write', { data: output })

// Batch (all processed before next view cycle)
Command.extensionCommands([
  { nodeId: 'term-1', op: 'write', payload: { data: line1 } },
  { nodeId: 'log-1', op: 'append', payload: { line: entry } },
])
```

Extension commands are only meaningful for widgets backed by a
`WidgetExtension` Rust implementation. They are silently ignored for
widgets without an extension handler.

#### No-op

When a handler returns a bare model (not a tuple), the runtime treats
it as `[model, Command.none()]`. You never need to write
`Command.none()` explicitly.

### Chaining commands

In iced, commands support `.then()` and `.chain()` for sequencing
async work. Plushie does not need dedicated chaining combinators
because the Elm update cycle provides this naturally: each `update()`
can return `[model, command]`, and the result of each command feeds
back into `update()` as an event, which can return more commands.

The model is updated and `view()` is re-rendered between each step.
This is more powerful than iced's chaining because you get full model
updates and UI refreshes at every link in the chain, not just at the
end.

```typescript
// Step 1: user clicks "deploy" -- validate first
if (isClick(event, 'deploy')) {
  return [
    { ...state, status: 'validating' },
    Command.async(async () => validateConfig(state.config), 'validated'),
  ]
}

// Step 2: validation result arrives -- if OK, start the build
if (isAsync(event, 'validated') && event.result.ok) {
  return [
    { ...state, status: 'building' },
    Command.async(async () => buildRelease(state.config), 'built'),
  ]
}

// Step 3: build result arrives -- if OK, push it
if (isAsync(event, 'built') && event.result.ok) {
  const artifact = event.result.value
  return [
    { ...state, status: 'deploying' },
    Command.async(async () => pushArtifact(artifact), 'deployed'),
  ]
}

// Step 4: done
if (isAsync(event, 'deployed') && event.result.ok) {
  return { ...state, status: 'live' }
}
```

Each step is a separate branch with its own model state. The UI
reflects progress at every stage. No special chaining API needed --
the architecture is the API.

### How commands work internally

Commands are data. They describe what should happen, not how. The
runtime interprets them:

- **Async commands** create a Promise with an AbortController. When
  the promise resolves, the result is wrapped in the tag and dispatched
  through `update()`.
- **Widget operations** are encoded as wire messages and sent to the
  renderer.
- **Window commands** are encoded as wire messages to the renderer.
- **Window property queries** are sent as window_op wire messages.
  The renderer responds with an `effect_response` keyed by window_id.
- **System ops** are sent as `system_op` wire messages.
- **System queries** use `system_query` wire messages. The renderer
  responds with an `op_query_response` keyed by tag.
- **Image operations** are encoded as wire messages to the renderer.
- **PaneGrid operations** are encoded as widget ops sent to the renderer.
- **Timers** use `setTimeout` under the hood.

Commands are not side effects in your handler. They are descriptions
of side effects that the runtime executes after the handler returns.
This keeps handlers testable:

```typescript
import { COMMAND } from 'plushie'

test('clicking fetch returns async command', () => {
  const result = myApp.config.update!(
    { loading: false, data: null },
    { kind: 'widget', type: 'click', id: 'fetch', scope: [], value: null, data: null } as any,
  )
  const [model, cmd] = result as [Model, Command]
  expect(model.loading).toBe(true)
  expect(cmd.type).toBe('async')
})
```

## Subscriptions

Subscriptions are ongoing event sources. Unlike commands (one-shot),
subscriptions produce events continuously as long as they are active.

**Important: tag semantics differ by subscription type.** For timer
subscriptions (`every()`), the tag becomes the event wrapper --
`update()` receives `{ kind: "timer", tag, timestamp }`. For all
renderer subscriptions (keyboard, mouse, window, etc.), the tag is
management-only and does NOT appear in the event. Renderer events
arrive as their fixed types (`KeyEvent`, `MouseEvent`, etc.)
regardless of what tag you chose.

### The subscriptions callback

```typescript
app({
  subscriptions: (state) => [
    // Tick every second while the timer is running
    state.timerRunning && Subscription.every(1000, 'tick'),

    // Always listen for keyboard shortcuts
    Subscription.onKeyPress('keyEvent'),
  ].filter(Boolean),

  update(state, event) {
    if (isTimer(event, 'tick')) {
      return { ...state, elapsed: state.elapsed + 1 }
    }
    if (isKey(event, 'press') && event.key === 'Escape') {
      return { ...state, modalOpen: false }
    }
    return state
  },
})
```

`subscriptions()` is called after every update. The runtime diffs the
returned list against the previous one and starts/stops subscriptions
as needed. Subscriptions are identified by their specification --
returning the same `Subscription.every(1000, 'tick')` on consecutive
calls keeps the existing subscription alive; removing it stops it.

### Available subscriptions

#### Time

<!-- test: subscriptions_every_construct -- keep this code block in sync with the test -->
```typescript
Subscription.every(1000, 'tick')
// Delivers: { kind: "timer", tag: "tick", timestamp: number }
```

#### Keyboard

<!-- test: subscriptions_on_key_press_construct -- keep this code block in sync with the test -->
```typescript
Subscription.onKeyPress('keys')
// Delivers: KeyEvent { kind: "key", type: "press", key, modifiers, ... }

Subscription.onKeyRelease('keys')
// Delivers: KeyEvent { kind: "key", type: "release", ... }

Subscription.onModifiersChanged('mods')
// Delivers: ModifiersEvent { kind: "modifiers", modifiers: { shift, ctrl, ... } }

// The tag is used by the runtime to register/unregister the subscription
// with the renderer. It is NOT included in the event delivered to update().
```

#### Window lifecycle

```typescript
Subscription.onWindowClose('win')
// Delivers: WindowEvent { type: "close_requested", windowId }

Subscription.onWindowOpen('win')
// Delivers: WindowEvent { type: "opened", windowId, data: { position, width, height } }

Subscription.onWindowResize('win')
// Delivers: WindowEvent { type: "resized", windowId, data: { width, height } }

Subscription.onWindowFocus('win')
// Delivers: WindowEvent { type: "focused", windowId }

Subscription.onWindowUnfocus('win')
// Delivers: WindowEvent { type: "unfocused", windowId }

Subscription.onWindowMove('win')
// Delivers: WindowEvent { type: "moved", windowId, data: { x, y } }

Subscription.onWindowEvent('win')
// Delivers: various WindowEvent types (catch-all for window events)
```

#### Mouse

```typescript
Subscription.onMouseMove('mouse')
// Delivers: MouseEvent { type: "moved", x, y }

Subscription.onMouseButton('mouse')
// Delivers: MouseEvent { type: "pressed" | "released", button }

Subscription.onMouseScroll('mouse')
// Delivers: MouseEvent { type: "scrolled", deltaX, deltaY }
```

#### Touch

```typescript
Subscription.onTouch('touch')
// Delivers: TouchEvent { type: "pressed" | "moved" | "lifted" | "lost", fingerId, x, y }
```

#### IME (Input Method Editor)

```typescript
Subscription.onIme('ime')
// Delivers: ImeEvent { type: "opened" | "preedit" | "commit" | "closed", text, cursor }
```

#### System

```typescript
Subscription.onThemeChange('theme')
// Delivers: SystemEvent { type: "theme_changed", data: "light" | "dark" }

Subscription.onAnimationFrame('frame')
// Delivers: SystemEvent { type: "animation_frame", data: timestamp }

Subscription.onFileDrop('files')
// Delivers: WindowEvent { type: "file_dropped" | "file_hovered" | "files_hovered_left", windowId, data }
```

#### Catch-all

```typescript
Subscription.onEvent('all')
// Receives all renderer events. Event shape varies by family.
```

#### Batch

```typescript
Subscription.batch(subscriptions)
// Combines multiple subscriptions into a flat list. Identity function.
```

### Event rate limiting

The renderer supports rate limiting for high-frequency events (mouse
moves, scroll, animation frames, slider drags, etc.). This reduces
wire traffic and host CPU usage. Three configuration levels, in order
of priority:

#### Per-widget `eventRate` prop

Widgets that emit high-frequency events accept an `eventRate` option:

```typescript
// Volume slider limited to 15 events/sec, seek bar at 60:
<Slider id="volume" range={[0, 100]} value={state.volume} eventRate={15} />
<Slider id="seek" range={[0, state.duration]} value={state.position} eventRate={60} />
```

Supported on: `Slider`, `VerticalSlider`, `Canvas`, `MouseArea`,
`Sensor`, `PaneGrid`, and all extension widgets.

#### Per-subscription `maxRate`

Renderer subscriptions accept a `maxRate` option:

<!-- test: subscriptions_set_max_rate, subscriptions_on_animation_frame_with_rate -- keep this code block in sync with the test -->
```typescript
// Rate-limit mouse moves to 30 events per second:
Subscription.onMouseMove('mouse', { maxRate: 30 })

// Animation frames at 60fps:
Subscription.onAnimationFrame('frame', { maxRate: 60 })

// Subscribe but never emit (capture tracking only):
Subscription.onMouseMove('mouse', { maxRate: 0 })

// Set maxRate on an existing subscription:
Subscription.maxRate(Subscription.onMouseMove('mouse'), 30)
```

Timer subscriptions (`every()`) do not support `maxRate`.

#### Global `defaultEventRate` setting

A global default applied to all coalescable event types:

```typescript
app({
  settings: {
    defaultEventRate: 60,   // 60 events/sec -- good for most cases
  },
  // ...
})
```

Set to 60 for most apps. Lower for dashboards or remote rendering.
Omit for unlimited (current default behavior).

### Subscription lifecycle

Subscriptions are declarative. You do not start or stop them
imperatively. You return a list from `subscriptions()`, and the
runtime manages the rest:

```typescript
app({
  init: { polling: false, data: null },

  subscriptions: (state) => [
    state.polling && Subscription.every(5000, 'poll'),
  ].filter(Boolean),

  update(state, event) {
    if (isClick(event, 'startPolling')) return { ...state, polling: true }
    if (isClick(event, 'stopPolling')) return { ...state, polling: false }
    if (isTimer(event, 'poll')) {
      return [state, Command.async(async () => fetchData(), 'dataReceived')]
    }
    return state
  },
})
```

When `polling` becomes true, the runtime starts the timer. When it
becomes false, the runtime stops it. No explicit cleanup needed.

### How subscriptions work internally

- **Time subscriptions** use `setInterval` or `setTimeout` loops.
- **Keyboard, mouse, touch, and window subscriptions** are registered
  with the renderer via wire messages. The renderer sends events when
  they occur.
- **System subscriptions** (theme change, animation frame, file drop)
  are also renderer-side event sources.

Subscriptions that require the renderer (everything except timers) are
paused during renderer restart and resumed once the renderer is back.

## Application settings

The `settings` object is passed to the renderer on startup. Notable
settings relevant to commands and rendering:

- `vsync` -- boolean (default `true`). Controls vertical sync. Set to
  `false` for uncapped frame rates (useful for benchmarks).
- `scaleFactor` -- number (default `1.0`). Global UI scale factor.
  Values greater than 1.0 make the UI larger.
- `defaultEventRate` -- integer. Maximum events per second for
  coalescable event types. Omit for unlimited.

<!-- test: commands_settings_vsync_and_scale -- keep this code block in sync with the test -->
```typescript
app({
  settings: {
    antialiasing: true,
    vsync: false,
    scaleFactor: 1.5,
    defaultEventRate: 60,
  },
  // ...
})
```

## Commands vs. effects

Commands are TypeScript-side operations handled by the runtime. Effects
are native platform operations handled by the renderer (see
[effects.md](effects.md)).

| | Commands | Effects |
|---|---|---|
| Handled by | TypeScript runtime | Rust renderer |
| Examples | async work, timers, focus | file dialogs, clipboard, notifications |
| Transport | internal | wire protocol request/response |
| Return from | `update()` / handlers | `update()` / handlers (via effects API) |

Widget operations and window commands are a hybrid -- they are
initiated from the TypeScript side but executed by the renderer. They
use the command mechanism for the API but effect/effect_response for
the transport.
