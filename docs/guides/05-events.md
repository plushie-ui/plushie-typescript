# Events

Every interaction in a Plushie app produces an event. A button click, a
keystroke in a text input, a checkbox toggle, a timer tick, an async
result. TypeScript apps handle events in two ways: inline handlers
bound to widget props (`onClick`, `onInput`, `onToggle`), and the
`update(state, event)` fallback that receives everything an inline
handler did not catch.

In this chapter we take a closer look at both paths and finish wiring
up the pad's **event log**, keyboard shortcuts, and edit tracking.
Interact with a widget in the preview, see the event it produced at
the bottom of the window.

## Two handler styles

Widget events come with handler props. Clicks, text input, toggles,
selections, and slider drags can all be handled right on the widget:

```tsx
import { Button, Checkbox, TextInput } from "plushie/ui"

<Button id="save" onClick={(s) => saveAndRender(s)}>Save</Button>
<Checkbox id="dark" value={state.dark} onToggle={(s, e) =>
  ({ ...s, dark: typeof e.value === "boolean" ? e.value : s.dark })
} />
<TextInput id="query" value={state.query} onInput={(s, e) =>
  ({ ...s, query: typeof e.value === "string" ? e.value : s.query })
} />
```

Everything else (timers, async results, keyboard subscriptions,
window events, effect responses) routes through `update(state, event)`.
Widget events reach `update` too, but only when no inline handler
matched the widget + type combination.

When should you pick which? A rule of thumb:

- **Inline handler** when the handler is specific to one widget and
  does not need to coexist with rival handlers for the same event
  type. Reads well next to the widget and keeps the `update` switch
  small.
- **`update` fallback** when many widgets need one rule (catch-all
  logging, keyboard shortcuts, every `async` result), or when the
  event has no widget (timers, window lifecycle, effect responses).

The pad uses both. Each text input and button in the toolbar has its
own inline handler. Keyboard shortcuts, timer ticks, and the event
log all flow through `update`.

## Handler return shape

Both inline handlers and `update` return the same two shapes: a new
model, or a tuple `[model, command]` to kick off side effects.

```typescript
import { Command } from "plushie"

(s) => ({ ...s, count: s.count + 1 })
(s) => [{ ...s, loading: true }, Command.task(fetchData, "data")]
```

Models flow through `DeepReadonly<M>`, so every update is a spread.
Never mutate in place.

## Type guards

Import guards from `plushie` and narrow on them inside `update`:

```typescript
import {
  isClick, isInput, isKey, isTimer, isAsync, isEffect,
  isWidget, target,
} from "plushie"
```

Each guard returns a `event is SomeEvent` predicate, so the narrowed
fields become available inside the branch. Many take an optional
second argument that narrows further:

| Guard | Narrows to | Second arg |
|---|---|---|
| `isClick(e, id?)` | `WidgetEvent` with `type: "click"` | Widget id |
| `isInput(e, id?)` | `WidgetEvent` with `type: "input"` | Widget id |
| `isToggle(e, id?)` | `WidgetEvent` with `type: "toggle"` | Widget id |
| `isSelect(e, id?)` | `WidgetEvent` with `type: "select"` | Widget id |
| `isSubmit(e, id?)` | `WidgetEvent` with `type: "submit"` | Widget id |
| `isKey(e, type?)` | `KeyEvent` | `"press"` or `"release"` |
| `isTimer(e, tag?)` | `TimerEvent` | Timer tag |
| `isAsync(e, tag?)` | `AsyncEvent` | Task tag |
| `isEffect(e, tag?)` | `EffectEvent` | Effect tag |
| `isWidget(e)` | Any `WidgetEvent` | - |

See the [Events reference](../reference/events.md) for the full list,
including pointer guards (`isPress`, `isMove`, `isScroll`) and the
subscription-only guards (`isModifiers`, `isIme`, `isWindow`).

## Narrowing on type, id, and tag

Narrowing composes in three directions:

- **By `event.kind`**: `isWidget(event)` tells you it is a widget
  event at all.
- **By `event.type`**: `isClick(event)` further confirms it is a
  click and not some other widget event.
- **By `event.id` / `event.tag`**: pass the second argument to fix the
  widget id or tag in a single check.

```typescript
if (isClick(event, "save")) {
  return saveAndRender(state)
}

if (isInput(event, "new-name")) {
  const name = typeof event.value === "string" ? event.value : state.newName
  return { ...state, newName: name }
}

if (isAsync(event, "fetch")) {
  if (event.result.ok) {
    return { ...state, items: event.result.value as Item[] }
  }
  return { ...state, error: String(event.result.error) }
}
```

`event.value` on `WidgetEvent` is typed as
`string | number | boolean | null`. Refine it to a concrete type with
`typeof` before use. The guards narrow the event shape, but the
`value` union still needs runtime discrimination.

## Widget events

Most interactions produce a `WidgetEvent`. The shared fields:

| Field | Type | Description |
|---|---|---|
| `kind` | `"widget"` | Discriminant |
| `type` | `string` literal | The event subtype: `"click"`, `"input"`, ... |
| `id` | `string` | The widget's local id |
| `scope` | `readonly string[]` | Ancestor scope chain (nearest first) |
| `windowId` | `string \| null` | Source window |
| `value` | `string \| number \| boolean \| null` | Primary value |
| `data` | `Record<string, unknown> \| null` | Structured payload |

The inline-handler props map onto widget event types:

| Prop | Widget | Event type |
|---|---|---|
| `onClick` | `Button`, `PointerArea` | `click` |
| `onInput` | `TextInput`, `TextEditor`, `ComboBox` | `input` |
| `onSubmit` | `TextInput` | `submit` |
| `onToggle` | `Checkbox`, `Toggler` | `toggle` |
| `onSelect` | `Radio`, `PickList`, `ComboBox` | `select` |
| `onSlide` | `Slider` | `slide` |
| `onSlideRelease` | `Slider` | `slide_release` |
| `onFocused` / `onBlurred` | Focusable widgets | `focused` / `blurred` |

The [Built-in Widgets reference](../reference/built-in-widgets.md)
lists every handler prop per widget.

## Keyboard shortcuts

Keyboard input arrives as `KeyEvent`, not `WidgetEvent`. The app must
subscribe with `Subscription.onKeyPress()` to receive it, then match
in `update`. The pad uses this for Ctrl+S, Ctrl+Z, and Ctrl+Shift+Z:

```typescript
import { Subscription, isKey } from "plushie"
import type { Event, SubscriptionType } from "plushie"

function subscribe(state: DeepReadonly<Model>): SubscriptionType[] {
  const subs: SubscriptionType[] = [Subscription.onKeyPress()]
  if (state.autoSave && state.dirty) {
    subs.push(Subscription.every(1000, "auto_save"))
  }
  return subs
}

function update(state: DeepReadonly<Model>, event: Event) {
  if (isKey(event, "press")) {
    const { key, modifiers } = event
    if (key === "s" && modifiers.command) {
      return saveAndRender(state)
    }
    if (key === "z" && modifiers.command && !modifiers.shift) {
      const [undoStack, source] = undo(state.undoStack, state.source)
      return { ...state, undoStack, source }
    }
    if (key === "z" && modifiers.command && modifiers.shift) {
      const [undoStack, source] = redo(state.undoStack, state.source)
      return { ...state, undoStack, source }
    }
    if (key === "Escape") {
      return { ...state, error: null }
    }
  }
  return state
}
```

`modifiers.command` is the cross-platform shortcut modifier: Ctrl on
Linux and Windows, Cmd on macOS. Use it instead of `modifiers.ctrl`
unless you specifically mean the Control key.

Key name values follow the renderer's KeyboardEvent.key convention.
`plushie/keys` exports constants for every named key:

```typescript
import { Enter, Escape, ArrowUp } from "plushie/keys"

if (isKey(event, "press") && event.key === Escape) {
  return { ...state, dialogOpen: false }
}
```

See the [Subscriptions reference](../reference/subscriptions.md) for
the full keyboard, pointer, window, and animation-frame catalogue.

## Pointer events

Canvas, `PointerArea`, and `Sensor` deliver pointer events as widget
events with structured `data`. Match on the narrow pointer guards to
get a typed `PointerData` payload:

```typescript
import { isPress, isMove, isScroll } from "plushie"

if (isPress(event, "canvas")) {
  const { x, y, button, pointer } = event.data
  return addPoint(state, x ?? 0, y ?? 0, pointer)
}

if (isMove(event, "canvas")) {
  const { x, y } = event.data
  return { ...state, cursor: { x: x ?? 0, y: y ?? 0 } }
}
```

The `pointer` field is `"mouse" | "touch" | "pen"`. One unified
pointer family handles every input device; there are no separate
`MouseEvent` or `TouchEvent` types.

Pointer `move`, `scroll`, `resize`, `scrolled`, and `pane_resized`
events are coalesced. See [Coalescing](#coalescing) below.

## Subscriptions that feed events

Subscriptions are how non-widget events get delivered. The pad's
`subscribe(state)` callback returns an array of subscriptions the
runtime should keep active for the current model:

```typescript
import { Subscription } from "plushie"

function subscribe(state: DeepReadonly<Model>): SubscriptionType[] {
  const subs: SubscriptionType[] = [Subscription.onKeyPress()]
  if (state.autoSave && state.dirty) {
    subs.push(Subscription.every(1000, "auto_save"))
  }
  return subs
}
```

The runtime diffs this list against the previous one and subscribes
or unsubscribes as needed. Common subscriptions that feed `update`:

- `Subscription.onKeyPress()` / `onKeyRelease()`: keyboard.
- `Subscription.onPointerMove()`: global pointer position.
- `Subscription.every(ms, tag)`: periodic ticks.
- `Subscription.onAnimationFrame({ maxRate })`: paced render ticks.
- `Subscription.onWindowClose()`, `onWindowResize()`: window lifecycle.

Timers arrive as `TimerEvent` with the tag the subscription
registered:

```typescript
if (isTimer(event, "auto_save")) {
  return saveAndRender(state)
}
```

The [Subscriptions reference](../reference/subscriptions.md) has the
complete list.

## Event scope: same id in different subtrees

Named containers scope their children's ids. A widget with the local
id `"save"` inside a `Container` with id `"prefs"` becomes
`"prefs/save"` on the wire. Two widgets in the same tree can share a
local id as long as their scopes differ.

Every widget event carries a `scope` array (nearest parent first)
plus a `full` canonical id like `"main#sidebar/form/save"`. The
`target(event)` helper reconstructs a `"scope1/scope2/id"` string,
stripping the window prefix, so a single switch can distinguish
identically-named widgets in different subtrees:

```typescript
import { isClick, target } from "plushie"

if (isClick(event)) {
  switch (target(event)) {
    case "settings/save":
      return saveSettings(state)
    case "prefs/save":
      return savePrefs(state)
  }
}
```

In the pad's file sidebar each row is a `Container` scoped by the
file name, with `"select"` and `"delete"` buttons inside. To know
which row was clicked we read `event.scope[0]`:

```typescript
if (isClick(event) && event.id === "delete") {
  const [fileId] = event.scope
  if (fileId) return deleteFile(state, fileId)
}
```

See the [Scoped IDs reference](../reference/scoped-ids.md) for the
full scoping model.

## Composing handlers

When two widgets share the same logic, pull the handler out. The pad
factors row-specific logic into factories that close over the row's
file name:

```typescript
import type { Handler } from "plushie"

function selectFile(file: string): Handler<Model> {
  return (state) => switchFile(state, file)
}

function deleteFileHandler(file: string): Handler<Model> {
  return (state) => deleteFile(state, file)
}

<Button id="select" onClick={selectFile(file)}>Open</Button>
<Button id="delete" onClick={deleteFileHandler(file)}>x</Button>
```

Handlers compose naturally with commands. A handler that also wants
to kick off a task returns `[state, command]`:

```typescript
const importFile: Handler<Model> = (state) => [
  { ...state, importing: true },
  Command.effect(Effect.fileOpen("import", { filters: [] })),
]
```

When the effect response lands, it arrives through `update` as an
`EffectEvent` tagged `"import"`. See
[Commands reference](../reference/commands.md) for the effect and
task constructors.

## The event log

The pad's bottom panel shows every event that reaches `update` but
did not match a specific branch. It is the easiest teacher from here
on: interact with the preview, see the event shape, write the branch
that handles it.

### Model

Add an `eventLog` field to the model:

```typescript
interface Model {
  readonly source: string
  readonly preview: UINode | null
  readonly error: string | null
  readonly eventLog: readonly string[]
  // ... the rest of the pad's fields
}
```

### The `update` catch-all

Log everything that falls through the specific branches. Anything
not handled above gets a compact one-line entry:

```typescript
import { isWidget, target } from "plushie"

function logEvent(state: DeepReadonly<Model>, event: Event): Model {
  const entry = JSON.stringify({
    kind: event.kind,
    ...(isWidget(event) ? { target: target(event), type: event.type } : {}),
  })
  const truncated = entry.length > 80 ? `${entry.slice(0, 77)}...` : entry
  return { ...state, eventLog: [truncated, ...state.eventLog].slice(0, 20) }
}

function update(state: DeepReadonly<Model>, event: Event) {
  if (isTimer(event, "auto_save")) return saveAndRender(state)
  if (isKey(event, "press")) { /* shortcuts, see above */ }
  if (isWidget(event) && event.id === "new-name" && event.type === "submit") {
    return createNew(state)
  }
  return logEvent(state, event)
}
```

The log caps at twenty entries so the panel stays bounded. New
events prepend to the head.

### The view

Render the log as a scrollable column of monospace text lines below
the toolbar:

```tsx
import { Column, Scrollable, Text } from "plushie/ui"

function eventLogPane(state: DeepReadonly<Model>): UINode {
  return Scrollable({
    id: "event-log",
    height: 120,
    children: [
      Column({
        id: "log-lines",
        spacing: 2,
        padding: 4,
        children: state.eventLog.map((entry, i) =>
          Text({ id: `line-${String(i)}`, size: 11, font: "monospace",
                 children: entry }),
        ),
      }),
    ],
  })
}
```

Click the Save button in the pad. The log shows
`{"kind":"widget","target":"save","type":"click"}`. Type in the
editor and the log shows `{"kind":"widget","target":"editor",
"type":"input"}`. Press Ctrl+S and the keyboard shortcut fires,
saving the file, without adding a log entry, because `isKey`
matched before the catch-all.

## Coalescing

High-frequency widget events are buffered on the runtime and
flushed on the next microtask. Only the latest value per
(widget id, event type) reaches `update`. This applies to:

- Pointer `move` and `scroll`
- Sensor `resize`
- Scrollable `scrolled`
- Pane grid `pane_resized`

If two `move` events arrive between microtasks, only the second
one reaches your handler. This is what you usually want for a
cursor-following overlay or a resize observer; if you need every
event, the data is not recoverable after coalescing. Design the
handler as if drops are expected.

Non-coalescable events (click, submit, key press) flush the buffer
before running, so ordering is preserved across the boundary: a
`move` followed by a `click` always delivers the `move` first.

Widgets that emit coalescable events expose an `eventRate` prop
that caps per-second emission at the source. A canvas with
`eventRate={60}` emits at most sixty `move` events per second even
if the renderer sees more. Use it to bound work in the view.

## Try it

- Wire a `PickList` into an experiment. Select options and watch
  the `{"kind":"widget","target":"picker","type":"select"}` entries
  in the log.
- Add a second button with the same label (`"Save"`) inside a
  scoped `Container` with id `"backup"`. The two click events
  arrive with the same `id: "save"` but different `target()`
  results (`"save"` vs `"backup/save"`).
- Add a `Slider` and compare `slide` and `slide_release` event
  rates as you drag: `slide` fires many times, coalesced to the
  latest value; `slide_release` fires once, on mouse up.
- Hold Shift and move the mouse over a `PointerArea`. The
  `modifiers.shift` field on every pointer event reflects the
  live state.

---

Next: [Lists and Inputs](06-lists-and-inputs.md)
