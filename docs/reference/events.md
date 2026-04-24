# Events

Every interaction flowing back from the renderer becomes an
`Event`. The `Event` type is a discriminated union over a `kind`
field, imported from `plushie`:

```typescript
import type { Event } from "plushie"
```

Event guards from `plushie` narrow to each variant:

```typescript
import { isClick, isInput, isKey, isTimer, isAsync, isEffect } from "plushie"
```

Two event paths coexist:

- **Inline widget handlers** on JSX props (`onClick`, `onInput`,
  `onToggle`, ...) receive widget events directly. The handler
  returns the new model or `[newModel, command]`.
- **The `update(model, event)` fallback** receives every event
  not caught by an inline handler. Timers, async results,
  subscription events, window events, and effect responses
  always go here. Widget events reach `update` only when no
  inline handler matched.

Both paths return the same shape: a new model, or a tuple of
`[model, command]`.

## Event kinds

The top-level `kind` field partitions events into categories:

| Kind | Arrives for | Inline handler? |
|---|---|---|
| `"widget"` | Clicks, inputs, pointer events, drags, focus, scroll, pane actions | Yes (for the widgets that expose handler props) |
| `"key"` | Global key press/release subscriptions | No, `update` only |
| `"modifiers"` | Modifier-key state changes | No, `update` only |
| `"ime"` | Input method editor events | No, `update` only |
| `"window"` | Window lifecycle (open, close, resize, focus, file drop) | No, `update` only |
| `"effect"` | Platform effect responses (file dialog, clipboard, notification) | No, `update` only |
| `"widget_command_error"` | Native widget command errors | No, `update` only |
| `"system"` | Animation frame, theme change, file drop, catch-all | No, `update` only |
| `"timer"` | `Subscription.every` ticks | No, `update` only |
| `"async"` | `Command.task` completion | No, `update` only |
| `"stream"` | `Command.stream` chunk | No, `update` only |
| `"session_error"` | Multiplexed session error (only with `--max-sessions > 1`) | No, `update` only |
| `"session_closed"` | Multiplexed session closed | No, `update` only |

## Widget events

A `WidgetEvent` carries:

| Field | Type | Description |
|---|---|---|
| `kind` | `"widget"` | Discriminant |
| `type` | `string` literal | Event type (see below) |
| `id` | `string` | Widget ID that emitted the event |
| `windowId` | `string \| null` | Window containing the widget |
| `scope` | `string[]` | Ancestor scope IDs (see [Scoped IDs](scoped-ids.md)) |
| `value` | `string \| number \| boolean \| null` | Primary value for simple events |
| `data` | `Record<string, unknown> \| null` | Typed data for richer events |

Widget event types:

| Type | Emitted by | `value` / `data` |
|---|---|---|
| `click` | `Button`, clickable elements | - |
| `double_click` | Canvas, interactive shapes | `PointerData` |
| `input` | `TextInput`, `TextEditor`, `ComboBox` | `value`: current text |
| `submit` | `TextInput` on Enter | `value`: text at submit |
| `paste` | `TextInput` on paste | `value`: pasted text |
| `toggle` | `Checkbox`, `Toggler` | `value`: new boolean |
| `select` | `Radio`, `PickList`, `ComboBox` | `value`: selected option |
| `slide` | `Slider` during drag | `value`: current number |
| `slide_release` | `Slider` at drag end | `value`: final number |
| `press` / `release` / `move` / `scroll` / `enter` / `exit` | `PointerArea`, `Canvas`, `Sensor` | `PointerData` |
| `focused` / `blurred` | Focusable widgets | - |
| `drag` / `drag_end` | Draggable widgets | `DragData` |
| `key_press` / `key_release` | Widget with keyboard capture | `KeyPressData` / `KeyReleaseData` |
| `scrolled` | `Scrollable` | `ScrolledData` |
| `resize` | `Sensor`, `Responsive` | `ResizeData` |
| `pane_resized` / `pane_dragged` / `pane_clicked` / `pane_focus_cycle` | `PaneGrid` | Pane-specific data |
| `link_click` | `RichText`, `Markdown` | `LinkClickData` (`{ link }`) |
| `open` / `close` | `PickList`, `ComboBox` | - |
| `sort` | `Table` column header | `value`: column key |
| `option_hovered` | `PickList`, `ComboBox` | `value`: hovered option |
| `key_binding` | `TextEditor` | `value`: binding name |
| `status` | Native widgets | widget-defined |
| `transition_complete` | Animated subtree | `value`: animation tag |
| `diagnostic` | Native widgets | widget-defined |

### Inline handler shape

Widget events with a handler prop take a pure function. The
runtime injects the current state as the first argument, the
event as the second:

```tsx
import type { WidgetEvent } from "plushie"

const increment = (s: Model, _e: WidgetEvent): Model => ({
  ...s,
  count: s.count + 1,
})

<Button id="inc" onClick={increment}>+</Button>
```

Handlers may also return a tuple `[model, command]` to kick off
side effects:

```tsx
const save = (s: Model, _e: WidgetEvent): [Model, Command] => [
  { ...s, saving: true },
  Command.task(persistToDisk, "persist"),
]

<Button id="save" onClick={save}>Save</Button>
```

### Typed narrowing on widget event `data`

The `data` field is `Record<string, unknown> | null` on the base
`WidgetEvent`. Guards in `plushie` narrow to widget events with a
concrete `data` shape:

| Guard | `data` narrowed to |
|---|---|
| `isPress(e, id?)` | `PointerData` |
| `isRelease(e, id?)` | `PointerData` |
| `isMove(e, id?)` | `PointerData` |
| `isScroll(e, id?)` | `PointerData` |
| `isDrag(e, id?)` | `DragData` |
| `isResize(e, id?)` | `ResizeData` |
| `isScrolled(e, id?)` | `ScrolledData` |
| `isLinkClicked(e, id?)` | `LinkClickData` |
| `isWidgetKeyPress(e, id?)` | `KeyPressData` |

```typescript
import { isMove } from "plushie"

if (isMove(event, "canvas")) {
  const { x, y } = event.data
  // x, y typed as number | undefined
}
```

`PointerData` fields include `x`, `y`, `button`, `pointer`
(`"mouse" | "touch" | "pen"`), `finger`, `modifiers`, `delta_x`,
`delta_y`, `captured`, `lost`. Position is absent for
subscription-level button events (no cursor tracking).

## Global input

Key, modifier, and IME events arrive only when the app has an
active subscription. They never route through inline handlers.

### KeyEvent

```typescript
interface KeyEvent {
  readonly kind: "key"
  readonly type: "press" | "release"
  readonly key: string              // KeyboardEvent.key value
  readonly modifiedKey: string | null
  readonly physicalKey: string | null
  readonly modifiers: Modifiers
  readonly location: "left" | "right" | "standard"
  readonly text: string | null
  readonly repeat: boolean
  readonly windowId: string | null
}
```

`modifiers` is always present:

```typescript
interface Modifiers {
  readonly ctrl: boolean
  readonly shift: boolean
  readonly alt: boolean
  readonly logo: boolean      // Windows/Super/Cmd
  readonly command: boolean   // Cmd on macOS, Ctrl elsewhere (the cross-platform option)
}
```

Match shortcut keys in `update`:

```typescript
import { isKey } from "plushie"

function update(state: Model, event: Event): Model {
  if (isKey(event, "press")) {
    if (event.key === "s" && event.modifiers.command) {
      return save(state)
    }
    if (event.key === "Escape") {
      return { ...state, dialogOpen: false }
    }
  }
  return state
}
```

Key name values come from the renderer's KeyboardEvent.key
equivalent. The full catalogue is exported from `plushie/keys`:

```typescript
import { Enter, Escape, ArrowUp } from "plushie/keys"

if (isKey(event, "press") && event.key === Enter) { ... }
```

### ModifiersEvent

Emitted when modifier keys change state without a key press
(for example, Shift pressed or released on its own). `event.modifiers`
holds the new state.

### ImeEvent

Input method editor events during text composition. `type` is
one of `"opened"`, `"preedit"`, `"commit"`, `"closed"`.

## Window events

Emitted for window lifecycle changes when a window subscription is
active (see [Subscriptions](subscriptions.md)).

```typescript
interface WindowEvent {
  readonly kind: "window"
  readonly type:
    | "opened"
    | "closed"
    | "close_requested"
    | "resized"
    | "moved"
    | "focused"
    | "unfocused"
    | "rescaled"
    | "file_hovered"
    | "file_dropped"
    | "files_hovered_left"
  readonly windowId: string
  readonly data: Record<string, unknown> | null
}
```

`close_requested` fires when the user clicks the window's close
button. The app can either include it in the next view (returning
`null` for the window or omitting it) or ignore the event to
keep the window open. See the
[Windows and Layout reference](windows-and-layout.md).

## Effect events

Platform effects (`Effect.fileOpen`, `Effect.clipboardRead`,
`Effect.notification`, ...) return `Command` values. Their
responses arrive as `EffectEvent`:

```typescript
interface EffectEvent {
  readonly kind: "effect"
  readonly tag: string
  readonly result: EffectResult
}
```

`EffectResult` is a discriminated union on `kind`:

| Result kind | Fields | Emitted for |
|---|---|---|
| `file_opened` | `path: string` | `Effect.fileOpen` success |
| `files_opened` | `paths: string[]` | `Effect.fileOpenMultiple` success |
| `file_saved` | `path: string` | `Effect.fileSave` success |
| `directory_selected` | `path: string` | `Effect.directorySelect` success |
| `directories_selected` | `paths: string[]` | `Effect.directorySelectMultiple` success |
| `clipboard_text` | `text: string` | `Effect.clipboardRead` success |
| `clipboard_html` | `html: string`, `altText: string \| null` | `Effect.clipboardReadHtml` success |
| `clipboard_written` | - | `Effect.clipboardWrite*` success |
| `clipboard_cleared` | - | `Effect.clipboardClear` success |
| `notification_shown` | - | `Effect.notification` success |
| `cancelled` | - | User cancelled a dialog |
| `timeout` | - | Effect exceeded timeout |
| `error` | `message: string` | Effect failed |
| `unsupported` | - | Platform doesn't support this effect |
| `renderer_restarted` | - | Renderer restarted before the response arrived |

Narrow with `isEffect` and switch on `result.kind`:

```typescript
import { isEffect } from "plushie"

function update(state: Model, event: Event): Model {
  if (isEffect(event, "import")) {
    switch (event.result.kind) {
      case "file_opened":
        return { ...state, importPath: event.result.path }
      case "cancelled":
        return { ...state, importing: false }
      case "error":
        return { ...state, error: event.result.message }
      default:
        return state
    }
  }
  return state
}
```

The `tag` on an effect matches the tag passed when the effect was
dispatched. Match on tag first, then destructure the result.

## Async and stream events

`Command.task(fn, tag)` returns an `AsyncEvent`:

```typescript
interface AsyncEvent {
  readonly kind: "async"
  readonly tag: string
  readonly result:
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly error: unknown }
}
```

`Command.stream(fn, tag)` emits `StreamEvent` for each yielded
value, plus an `AsyncEvent` when the generator returns:

```typescript
interface StreamEvent {
  readonly kind: "stream"
  readonly tag: string
  readonly value: unknown
}
```

Both `value` and the async `result.value` are `unknown` because
the task's return type isn't known at the type level. Cast or
narrow at the boundary.

```typescript
import { isAsync, isStream } from "plushie"

function update(state: Model, event: Event): Model {
  if (isAsync(event, "fetch")) {
    if (event.result.ok) {
      return { ...state, items: event.result.value as Item[], loading: false }
    }
    return { ...state, error: String(event.result.error), loading: false }
  }
  if (isStream(event, "logs")) {
    return { ...state, logs: [...state.logs, event.value as string] }
  }
  return state
}
```

See [Commands](commands.md) for task and stream construction.

## Timer events

`Subscription.every(ms, tag)` emits `TimerEvent` with the tick
timestamp:

```typescript
interface TimerEvent {
  readonly kind: "timer"
  readonly tag: string
  readonly timestamp: number  // milliseconds since epoch
}
```

```typescript
if (isTimer(event, "clock")) {
  return { ...state, now: new Date(event.timestamp) }
}
```

## System events

Low-frequency global events: animation frame, theme change, file
drop (when a `Subscription.onFileDrop` is active), and any
catch-all events the renderer forwards. `type` is the specific
subtype; `value` carries payload data in a renderer-defined
shape.

```typescript
if (isSystem(event, "animation_frame")) {
  return { ...state, elapsed: event.value as number }
}
```

## Widget command errors

Native widget commands that fail produce
`WidgetCommandErrorEvent`:

```typescript
interface WidgetCommandErrorEvent {
  readonly kind: "widget_command_error"
  readonly reason: string
  readonly nodeId: string | null
  readonly family: string | null
  readonly widgetType: string | null
  readonly message: string | null
}
```

These should surface to the user (log, toast, banner) rather than
being swallowed: the underlying command failed.

## Session events

Only emitted when the renderer runs with `--max-sessions > 1`
(the testing multiplexer and the `connect` CLI can use this).

`SessionErrorEvent` reports a failure inside one session;
`SessionClosedEvent` reports a session shutdown. Both carry a
`session` field identifying which session the event came from.

```typescript
interface SessionErrorEvent {
  readonly kind: "session_error"
  readonly session: string
  readonly code: string   // session_panic, max_sessions_reached, ...
  readonly error: string
}

interface SessionClosedEvent {
  readonly kind: "session_closed"
  readonly session: string
  readonly reason: string
}
```

Regular single-process apps will never see these events.

## Scoped targeting

Widget IDs can collide at the tree level when multiple subtrees
embed the same named widget. The renderer reports the ID plus its
scope (ancestor IDs) on every widget event.

The `target(event)` helper reconstructs a `"scope1/scope2/id"`
path, stripping the window_id:

```typescript
import { target, isClick } from "plushie"

if (isClick(event)) {
  switch (target(event)) {
    case "settings/save":
      return saveSettings(state)
    case "prefs/save":
      return savePrefs(state)
  }
}
```

See [Scoped IDs](scoped-ids.md) for the scope conventions and how
to build scoped subtrees.

## Coalescing

Some widget events are coalescable: the runtime buffers them in a
per-key `pendingCoalesce` map and flushes on the next microtask.
Only the latest value per (widget, event type) reaches `update`.
Coalescable types: pointer `move`, pointer `scroll`, `pane_resized`,
`resize`, `scrolled`. Non-coalescable events flush the buffer
first, so ordering with discrete events (click, submit) is
preserved.

The `eventRate` prop on a widget sets a per-second cap on its
coalescable events. A canvas with `eventRate={60}` will not emit
more than 60 `move` events per second to the app.

## Event flow summary

1. Renderer emits a wire event.
2. Runtime decodes to a typed `Event`.
3. For `kind === "widget"`: runtime checks the handler registry
   (keyed by widget ID + event type). If a handler is registered,
   it runs with `(state, event)` and returns the new state. No
   fall-through to `update`.
4. For all other kinds (and widget events without a handler):
   `update(state, event)` runs.
5. The new state drives the next `view()` call. The tree is
   diffed and patches are sent to the renderer.
6. Commands returned from handlers or `update` queue for
   execution.

## See also

- [Commands reference](commands.md)
- [Subscriptions reference](subscriptions.md)
- [Scoped IDs reference](scoped-ids.md)
- [Windows and Layout reference](windows-and-layout.md)
- [Built-in Widgets reference](built-in-widgets.md)
