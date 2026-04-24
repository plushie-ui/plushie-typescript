# Subscriptions

So far every event in the pad has come from direct widget
interaction: a button click, a keystroke in the editor, a
checkbox toggle. But some events come from outside the widget
tree: keyboard shortcuts, timers, window lifecycle, pointer
motion. These are delivered through **subscriptions**.

## What are subscriptions?

Subscriptions are declarative event sources. You add an optional
`subscriptions` callback to the app config. It receives the
current model and returns a list of subscription specs:

```typescript
import { app, Subscription } from "plushie"
import type { SubscriptionType } from "plushie"

export const myApp = app<Model>({
  init: initModel(),
  update,
  view,
  subscriptions(state): SubscriptionType[] {
    return [Subscription.onKeyPress()]
  },
})
```

The runtime calls `subscriptions(state)` after every update
cycle and diffs the returned list against the currently active
subscriptions. New specs start new event sources; removed specs
stop them. You never start or stop a subscription by hand. You
describe what you want, and the runtime manages the lifecycle.

This is the same declarative approach as `view`: the list is a
function of the model. When the model changes, the active
subscriptions change with it.

`Subscription` is a namespace of constructor functions exported
from `plushie`. The type is re-exported as `SubscriptionType`
for the rare case where you hold a list in a typed local.

## Keyboard subscriptions

`Subscription.onKeyPress()` subscribes to global keyboard events.
Presses arrive as `KeyEvent` values through `update`:

```typescript
import { Subscription, isKey } from "plushie"
import type { Event, KeyEvent } from "plushie"

function subscriptions(_state: DeepReadonly<Model>): SubscriptionType[] {
  return [Subscription.onKeyPress()]
}

function update(state: DeepReadonly<Model>, event: Event): Model {
  if (isKey(event, "press")) {
    if (event.key === "s" && event.modifiers.command) {
      return saveAndRender(state)
    }
    if (event.key === "Escape") {
      return { ...state, error: null }
    }
  }
  return state as Model
}
```

The `KeyEvent` object carries:

- `type`: `"press"` or `"release"`.
- `key`: the logical key as a string. Named keys use labels like
  `"Escape"`, `"Enter"`, `"Tab"`, `"ArrowUp"`; characters are
  single-letter strings like `"s"` or `"1"`.
- `modifiers`: a `Modifiers` object with `shift`, `ctrl`, `alt`,
  `logo`, and `command` boolean fields.
- `repeat`: `true` for OS key-repeat, `false` for a fresh press.
- `windowId`: the focused window, or `null` for global events.

The `command` field is platform-aware: `true` when Ctrl is held
on Linux or Windows, and when Cmd is held on macOS. Matching on
`event.modifiers.command` gives you cross-platform shortcuts with
no platform checks.

Use `Subscription.onKeyRelease()` if you need key-up events.

`Subscription.onModifiersChanged()` tracks modifier-key state
changes without requiring a regular key press. It delivers
`ModifiersEvent` values, narrowed by `isModifiers`:

```typescript
import { isModifiers } from "plushie"

subscriptions(_state): SubscriptionType[] {
  return [
    Subscription.onKeyPress(),
    Subscription.onModifiersChanged(),
  ]
}

// In update:
if (isModifiers(event) && event.modifiers.shift) {
  return { ...state, shiftHeld: true }
}
```

Useful for UI that changes appearance based on held modifiers
(alternate button labels when Shift is held, precision mode when
Ctrl is held).

`Subscription.onIme()` delivers input method editor events
(composition start, preedit, commit, close). These matter for
text input in languages with composition phases.

### Applying it: the pad's keyboard shortcuts

The pad already listens for Ctrl+S (save), Ctrl+Z (undo),
Ctrl+Shift+Z (redo), and Escape (clear error). The subscription
is a single `onKeyPress()` and `update` narrows each shortcut
by key and modifier:

```typescript
subscriptions(state) {
  const subs: SubscriptionType[] = [Subscription.onKeyPress()]
  if (state.autoSave && state.dirty) {
    subs.push(Subscription.every(1000, "auto_save"))
  }
  return subs
},

update(state, event) {
  if (isTimer(event, "auto_save")) {
    return saveAndRender(state)
  }

  if (isKey(event, "press")) {
    const { key, modifiers } = event
    if (key === "z" && modifiers.command && !modifiers.shift) {
      const [nextStack, source] = undo(state.undoStack, state.source)
      return { ...state, undoStack: nextStack, source }
    }
    if (key === "z" && modifiers.command && modifiers.shift) {
      const [nextStack, source] = redo(state.undoStack, state.source)
      return { ...state, undoStack: nextStack, source }
    }
    if (key === "s" && modifiers.command) {
      return saveAndRender(state)
    }
    if (key === "Escape") {
      return { ...state, error: null }
    }
  }

  return logEvent(state, event)
},
```

Order matters inside the `isKey` block. Ctrl+Shift+Z must be
matched before plain Ctrl+Z, or the shift modifier would be
ignored and the branch would undo when you wanted to redo. Each
branch guards on `modifiers` explicitly so an unrelated chord
does not accidentally fall through.

## Timer subscriptions

`Subscription.every(intervalMs, tag)` fires on a recurring
interval:

```typescript
Subscription.every(1000, "clock")
```

Timer ticks arrive as `TimerEvent` values, narrowed by
`isTimer`:

```typescript
import { isTimer } from "plushie"

if (isTimer(event, "clock")) {
  return { ...state, now: new Date() }
}
```

The `tag` argument ties the subscription to its event. When
multiple timers are active, matching on the tag tells them
apart:

```typescript
function subscriptions(state: DeepReadonly<Model>): SubscriptionType[] {
  return [
    Subscription.every(1000, "clock"),
    Subscription.every(5000, "poll"),
  ]
}

// In update:
if (isTimer(event, "clock")) { /* once per second */ }
if (isTimer(event, "poll"))  { /* once per five seconds */ }
```

Renderer subscriptions like `onKeyPress()` take no tag: their
identity is the subscription kind and the optional window scope.
Timers are different. The tag is part of the subscription's key,
so changing the tag creates a new timer and stops the old one.

Timer tags are free-form strings. A typo silently drops the
event: if `subscriptions` returns `every(1000, "clock")` but
`update` checks `isTimer(event, "tick")`, nothing matches.
Reference tags by module-local constant where that helps.

### Conditional subscriptions

Because `subscriptions` is a function of the model, you can
activate subscriptions conditionally. Return only what should be
active right now:

```typescript
subscriptions(state) {
  const subs: SubscriptionType[] = [Subscription.onKeyPress()]
  if (state.autoSave && state.dirty) {
    subs.push(Subscription.every(1000, "auto_save"))
  }
  return subs
}
```

When `autoSave` is off or the buffer has not changed, the timer
is not in the list and the runtime stops it. When both
conditions are met, the timer starts. No manual start / stop
logic.

### Applying it: the pad's auto-save

Auto-save in the pad is gated by two fields: `autoSave` (flipped
by the toolbar checkbox) and `dirty` (set by the editor's
`onInput` handler). When both are true, a once-per-second timer
fires; the handler compiles and saves, which clears `dirty`,
which removes the timer, which stops it.

The pieces wired together:

```typescript
// The editor's input handler flips dirty on every keystroke.
const handleEdit: Handler<Model> = (state, event) => {
  const next = typeof event.value === "string" ? event.value : state.source
  return {
    ...state,
    source: next,
    dirty: true,
    undoStack: pushUndo(state.undoStack, state.source, next),
  }
}

// subscriptions gates the timer on both fields.
subscriptions(state) {
  const subs: SubscriptionType[] = [Subscription.onKeyPress()]
  if (state.autoSave && state.dirty) {
    subs.push(Subscription.every(1000, "auto_save"))
  }
  return subs
},

// update handles the tick by saving; saveAndRender clears dirty.
update(state, event) {
  if (isTimer(event, "auto_save")) {
    return saveAndRender(state)
  }
  // ...
},
```

The `"auto_save"` string is shared between the constructor call
and the narrowing guard. `saveAndRender` returns a new model
with `dirty: false` (on success), which removes the timer from
the next `subscriptions` return, which the diff turns into an
`unsubscribe`. All without writing an explicit cancel.

## Pointer subscriptions

`Subscription.onPointerMove()`, `onPointerButton()`,
`onPointerScroll()`, and `onPointerTouch()` deliver global
pointer events. Use these when the app needs cursor state
outside a specific widget: a drag that began on one widget and
continues outside it, a custom crosshair overlay, a hover
tooltip for arbitrary positions.

For widget-scoped pointer handling, wrap the widget in a
`PointerArea` instead.

`onPointerMove` is high-frequency. Cap its delivery with
`maxRate`:

```typescript
Subscription.onPointerMove({ maxRate: 60 })
```

`maxRate` is in events per second. The renderer coalesces
intermediate events, delivering only the latest state at each
interval. `60` is plenty for most visual tracking; `30` is fine
for status readouts.

## Window lifecycle subscriptions

Window subscriptions cover open, close, resize, focus, unfocus,
and move events, plus a catch-all:

- `Subscription.onWindowOpen()`
- `Subscription.onWindowClose()` (user clicked the close button)
- `Subscription.onWindowResize()`
- `Subscription.onWindowFocus()`
- `Subscription.onWindowUnfocus()`
- `Subscription.onWindowMove()`
- `Subscription.onWindowEvent()` (catch-all)

Window events arrive as `WindowEvent` values, narrowed by
`isWindow(event)`. Switch on `event.type` to pick out a
specific lifecycle stage:

```typescript
import { isWindow } from "plushie"

if (isWindow(event) && event.type === "close_requested") {
  if (state.dirty) {
    return [state, Command.confirm("Discard changes?", "confirm-close")]
  }
  return [state, Command.closeWindow(event.windowId)]
}
```

`onWindowClose` is the common case: without it, clicking the
close button shuts the window immediately. Subscribing lets you
intercept and prompt (save first, confirm quit).

## System subscriptions

- `Subscription.onAnimationFrame()` fires at the display refresh
  rate (~60 Hz). Use it for per-frame SDK-side interpolation.
  Renderer-side animations run independently and do not need it.
- `Subscription.onThemeChange()` fires when the OS light / dark
  preference flips. Pair with `SystemTheme` to follow the OS.
- `Subscription.onFileDrop()` delivers files dragged from the OS
  onto the window.
- `Subscription.onEvent()` is a catch-all that forwards every
  renderer event. Useful for a debug logger, noisy as a primary
  channel.

## Diffing semantics

Two subscriptions are identical when their `key(sub)` strings
match. Timer keys combine type, interval, and tag
(`every:1000:clock`); renderer subscription keys combine type
and window scope (`on_key_press:`). Between renders, a
subscription present in both lists keeps running with no wire
traffic; one added since the last render starts; one removed
stops. Returning the same list on every render is free as long
as the keys stay stable.

Two subscriptions that share a key collapse to one. Avoid:

```typescript
// Bad: both collapse to `every:1000:tick`.
Subscription.every(1000, "tick")
Subscription.every(1000, "tick")

// Good: distinct tags.
Subscription.every(1000, "clock")
Subscription.every(500, "health")
```

## Window-scoped subscriptions

In a multi-window app, events from every window arrive at one
`update`. Scope a subscription to a specific window with the
`window` option, or batch several subscriptions into one scope
with `Subscription.forWindow`:

```typescript
Subscription.onKeyPress({ window: "editor" })

Subscription.forWindow("editor", [
  Subscription.onKeyPress(),
  Subscription.onPointerMove({ maxRate: 60 }),
])
```

The first delivers key presses only from the `"editor"` window.
The second scopes both the key press and pointer subscriptions
to `"editor"`.

Unscoped subscriptions receive events from every window. The
`KeyEvent` and `WindowEvent` types carry a `windowId` field if
you need to tell windows apart from inside `update`.

## Rate limiting

Rate limiting applies at three levels, most to least specific:

1. **Per-widget**: the `eventRate` prop on `PointerArea`,
   `Sensor`, `Canvas`, `Slider`, and `PaneGrid`.
2. **Per-subscription**: the `maxRate` option, or
   `Subscription.maxRate(sub, rate)` on an existing spec.
3. **Global**: the `defaultEventRate` field on app `settings`.

More specific settings override less specific ones. See the
[Subscriptions reference](../reference/subscriptions.md).

## Verify it

Test that Ctrl+S compiles the preview. The test session can
dispatch a synthetic key event and query the model afterward:

```typescript
import { testWith } from "plushie/testing"
import { padApp } from "./app"

const test = testWith(padApp)

test("ctrl+s saves and compiles", async ({ session }) => {
  await session.setInput("editor", "ui.text('greeting', 'Hello')")
  await session.pressKey("s", { command: true })
  const state = session.model()
  expect(state.preview).not.toBeNull()
  expect(state.error).toBeNull()
})
```

This exercises the full subscription pipeline: the key press
subscription is active, the runtime delivers the `KeyEvent`
through `update`, the handler compiles the source and updates
the preview.

## Try it

With the pad running:

- Build a clock: subscribe to `Subscription.every(1000, "tick")`
  and render the current time in the toolbar.
- Log each key's `key` and `modifiers` fields in the event log.
  Hold Shift, Ctrl, Alt and watch the modifier flags.
- Gate auto-save on editor focus. Add an `editorFocused` flag,
  flip it in the editor's `onFocused` / `onBlurred` handlers,
  and require it in `subscriptions`. The timer starts and stops
  as you click in and out.

In the next chapter we wire up file dialogs, clipboard, and
async work.

---

Next: [Async and Effects](11-async-and-effects.md)
