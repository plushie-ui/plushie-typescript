# Subscriptions

Subscriptions tell the runtime which global events the app wants
to receive. Timers, keyboard input, pointer motion, window
lifecycle, animation frames, and theme changes arrive through
subscriptions, not through widget events.

```typescript
import { Subscription } from "plushie"

function subscribe(state: Model): Subscription[] {
  const subs = [Subscription.onWindowClose()]
  if (state.playing) {
    subs.push(Subscription.onAnimationFrame({ maxRate: 60 }))
  }
  if (state.shortcutsEnabled) {
    subs.push(Subscription.onKeyPress())
  }
  return subs
}
```

The `subscribe(state)` callback on the app config runs after
every model update. The runtime diffs the returned list against
the previous one by a structural key and sends `subscribe` or
`unsubscribe` messages for the differences. No manual start / stop
is needed.

`Subscription` is a namespace of constructor functions exported
from `plushie`; the type is re-exported as `SubscriptionType`.

```typescript
import type { SubscriptionType } from "plushie"
```

Most apps never need the type name explicitly: the
`subscribe: (state) => Subscription[]` shape covers it.

## Timers

| Function | Signature | Description |
|---|---|---|
| `Subscription.every` | `(intervalMs, tag)` | Fire a `TimerEvent` with the given tag every `intervalMs`. |

The `tag` appears on the resulting `TimerEvent` so `update` can
distinguish multiple timers. Interval is measured in wall-clock
milliseconds.

```typescript
Subscription.every(1000, "clock")
Subscription.every(5000, "heartbeat")
```

To stop a timer, remove it from the returned list on the next
`subscribe(state)` call. Changing the interval or tag creates a
new subscription; the old one unsubscribes automatically.

## Keyboard

| Function | Signature | Description |
|---|---|---|
| `Subscription.onKeyPress` | `(opts?)` | Key press events. |
| `Subscription.onKeyRelease` | `(opts?)` | Key release events. |
| `Subscription.onModifiersChanged` | `(opts?)` | Modifier-key state changes (Shift, Ctrl, Alt, Logo). |
| `Subscription.onIme` | `(opts?)` | Input method editor events during text composition. |

Events arrive as `KeyEvent`, `ModifiersEvent`, or `ImeEvent`. See
[Events](events.md#global-input).

## Pointer

| Function | Signature | Description |
|---|---|---|
| `Subscription.onPointerMove` | `(opts?)` | Pointer moves (mouse, touch, pen). |
| `Subscription.onPointerButton` | `(opts?)` | Pointer button press/release. |
| `Subscription.onPointerScroll` | `(opts?)` | Scroll wheel. |
| `Subscription.onPointerTouch` | `(opts?)` | Touch-specific pointer events. |

These fire independently of widget handlers. Use them when the app
needs cursor state outside a specific widget (for instance, a
custom drag gesture that began on one widget but continues
outside it).

`onPointerMove` is high-frequency. Set `maxRate` to cap its
delivery:

```typescript
Subscription.onPointerMove({ maxRate: 60 })
```

## Windows

| Function | Signature | Description |
|---|---|---|
| `Subscription.onWindowClose` | `(opts?)` | User requested a window close. |
| `Subscription.onWindowResize` | `(opts?)` | Window resized. |
| `Subscription.onWindowFocus` | `(opts?)` | Window gained focus. |
| `Subscription.onWindowUnfocus` | `(opts?)` | Window lost focus. |
| `Subscription.onWindowOpen` | `(opts?)` | Window opened. |
| `Subscription.onWindowMove` | `(opts?)` | Window moved. |
| `Subscription.onWindowEvent` | `(opts?)` | Catch-all window lifecycle events. |
| `Subscription.onFileDrop` | `(opts?)` | Files dropped onto a window. |

Events arrive as `WindowEvent`. Narrow with `isWindow(event)` and
switch on `event.type`.

`close_requested` fires on every active `onWindowClose`
subscription. If no subscription is active, the window closes
automatically when the user clicks the close button. Include the
subscription when you want to intercept (save dialog, confirm
prompt).

## System

| Function | Signature | Description |
|---|---|---|
| `Subscription.onAnimationFrame` | `(opts?)` | Display vsync-synced animation tick. |
| `Subscription.onThemeChange` | `(opts?)` | System light/dark theme toggled. |
| `Subscription.onEvent` | `(opts?)` | Catch-all; forwards every renderer event. |

`onAnimationFrame` runs at the display refresh rate by default
(~60 Hz). Cap it via `maxRate` for animations that don't need the
full rate. Do not rely on animation frames for general-purpose
periodic work; use `Subscription.every(ms, tag)` instead.

`onEvent` is rarely what you want. Its main use is instrumentation
or logging; it flags every inbound event through `update`, which
can mask the intended routing of specific events.

## Options

Every renderer subscription (not timers) accepts an options
object:

```typescript
interface SubOpts {
  readonly maxRate?: number
  readonly window?: string
}
```

- **`maxRate`**: maximum events per second. The renderer throttles
  to this rate before sending. Low-rate pointer moves (say,
  `maxRate: 30`) are enough for most UI tracking; full rate
  is wasteful.
- **`window`**: scope the subscription to events from the named
  window. Omit to receive events from every window.

```typescript
Subscription.onPointerMove({ maxRate: 60, window: "editor" })
```

`Subscription.maxRate(sub, rate)` returns a copy of an existing
subscription with `maxRate` set, for composing helpers.

`Subscription.forWindow(windowId, subs)` maps a list of
subscriptions to a single window scope:

```typescript
Subscription.forWindow("editor", [
  Subscription.onKeyPress(),
  Subscription.onPointerMove({ maxRate: 60 }),
])
```

## Diffing and keys

Two subscriptions are identical if their `key(sub)` strings match.
The runtime uses this to skip sending duplicate subscribe messages
when `subscribe(state)` returns the same list across renders.

Timer keys combine type, interval, and tag:
`every:1000:clock`. Renderer subscription keys combine type and
window ID: `on_key_press:main`. A subscription list where two
entries share a key produces undefined behaviour; use distinct
tags or different windows.

```typescript
// Bad: two timers with the same key collapse to one
Subscription.every(1000, "tick")
Subscription.every(1000, "tick")

// Good
Subscription.every(1000, "clock")
Subscription.every(500, "health")
```

## Conditional subscriptions

Return only the subscriptions you currently want active; the diff
takes care of the transitions.

```typescript
function subscribe(state: Model): Subscription[] {
  const subs: Subscription[] = []

  if (state.clockVisible) {
    subs.push(Subscription.every(1000, "clock"))
  }

  if (state.menuOpen || state.dialogOpen) {
    subs.push(Subscription.onKeyPress())
  }

  if (state.dragging) {
    subs.push(Subscription.onPointerMove({ maxRate: 120 }))
    subs.push(Subscription.onPointerButton())
  }

  return subs
}
```

A subscription active on render N and absent on render N+1
receives an `unsubscribe` message. No cleanup callbacks are
needed.

## Timer vs `Command.sendAfter`

- `Subscription.every(ms, tag)` keeps firing until removed.
- `Command.sendAfter(delay, event)` fires once after `delay` and
  does not repeat.

Use subscriptions for recurring work (clocks, polling, throttle
gates) and `sendAfter` for one-shot timers (dismiss toast after
2s, retry after 30s).

## See also

- [Events reference](events.md)
- [Commands reference](commands.md)
- [Windows and Layout reference](windows-and-layout.md)
- [App Lifecycle reference](app-lifecycle.md)
