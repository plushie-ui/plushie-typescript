# Animation and Transitions

Your widgets are styled. Now make them move. Elements that slide,
fade, and spring give the user feedback that the interface is
reacting to their actions.

Plushie's animation system is built around a key insight: the
renderer is closer to the screen than your TypeScript code. By
declaring animation *intent* in `view` and letting the renderer
handle interpolation, you get smooth 60fps animation with zero
wire traffic during the animation.

Plushie offers two layers. **Renderer-side descriptors**
(transitions, springs, sequences) encode intent as prop values
and let the renderer interpolate locally. The SDK sends one
message to start and one when it completes. **SDK-side tweens**
run in the app model, driven by `Subscription.onAnimationFrame`,
for cases where the animating value must live in your state.
Prefer descriptors for anything visual.

## Applying descriptors to widgets

Animation descriptors are plain frozen objects. They are applied
to an already-built node with `withAnimation`:

```tsx
import { transition, withAnimation } from "plushie"
import { Container, Text } from "plushie/ui"

withAnimation(
  <Container id="panel" padding={16}>
    <Text>Hello</Text>
  </Container>,
  { max_width: transition({ to: 200, duration: 300 }) },
)
```

The second argument maps wire-level prop names to descriptors.
The renderer owns the catalogue of animatable wire props, so the
keys here use wire names (`max_width`, `translate_y`, `opacity`),
not the camelCase names used on widget JSX props. The target
value is whatever your model computes; change it between renders
and the renderer interpolates smoothly to the new target.

No built-in widget accepts `animate` or `exit` as JSX props.
Always reach for `withAnimation` around the node. The
`AnimationProps` interface from `plushie/ui` is there for custom
widgets that want to accept descriptors declaratively.

## Transitions

A transition animates a numeric prop from its current value to a
target over a fixed duration:

```tsx
import { transition, withAnimation } from "plushie"
import { Container } from "plushie/ui"

// Basic fade out over 300ms.
withAnimation(
  <Container id="banner" />,
  { opacity: transition({ to: 0, duration: 300 }) },
)

// Easing and delay.
withAnimation(
  <Container id="banner" />,
  {
    opacity: transition({
      to: 0,
      duration: 300,
      easing: "ease_out",
      delay: 100,
    }),
  },
)

// Enter animation: fade in from transparent.
withAnimation(
  <Container id="banner" />,
  { opacity: transition({ to: 1, from: 0, duration: 200 }) },
)
```

`from` applies only on first appearance. Widgets that enter the
tree later get their own entrance animation while existing
widgets keep their current value. On later renders `from` is
ignored and the animation runs from the current interpolated
value to the new `to`.

The `to` field is required and `duration` must be a positive
integer. Passing anything else to `duration` throws immediately.

## Looping

`loop` is sugar for an infinite-repeat transition. It sets
`repeat: "forever"` and `autoReverse: true` by default:

```tsx
import { loop, withAnimation } from "plushie"
import { Container } from "plushie/ui"

// Pulse forever (auto-reverse between 1.0 and 0.4).
withAnimation(
  <Container id="pulse" />,
  { opacity: loop({ to: 0.4, from: 1.0, duration: 800 }) },
)

// Finite: 3 cycles.
withAnimation(
  <Container id="blink" />,
  { opacity: loop({ to: 0.4, from: 1.0, duration: 800, repeat: 3 }) },
)

// Spin forever (no auto-reverse).
withAnimation(
  <Container id="spinner" />,
  { rotation: loop({ to: 360, from: 0, duration: 1000, autoReverse: false }) },
)
```

`loop` needs `from` on first mount because it has to know the
cycle range. For continuous forward motion (a spinner rotation),
disable `autoReverse`.

## Springs

Springs use a damped harmonic oscillator instead of a timed
curve. They have no fixed duration; they settle naturally based
on stiffness, damping, and mass. Interruption preserves
velocity, so springs feel responsive when the target changes
rapidly (drag, hover, scroll).

```tsx
import { spring, withAnimation } from "plushie"
import { Container } from "plushie/ui"

withAnimation(
  <Container id="card" />,
  { scale: spring({ to: 1.05, preset: "bouncy" }) },
)

withAnimation(
  <Container id="card" />,
  { scale: spring({ to: 1.05, stiffness: 200, damping: 20 }) },
)
```

Explicit `stiffness` and `damping` override a preset's values.

| Preset | Feel |
|---|---|
| `"gentle"` | Slow, smooth, no overshoot |
| `"snappy"` | Quick, minimal overshoot |
| `"bouncy"` | Quick with visible overshoot |
| `"stiff"` | Very quick, crisp stop |
| `"molasses"` | Slow, heavy, deliberate |

When the target flips mid-flight the spring redirects smoothly
instead of snapping. This is why springs are the right choice
for anything the user drives with a pointer or keystroke.

## Sequences

Chain transitions and springs that run one after another on the
same prop. Each step's starting value defaults to the previous
step's final value.

```tsx
import { sequence, spring, transition, withAnimation } from "plushie"
import { Container } from "plushie/ui"

withAnimation(
  <Container id="item" />,
  {
    opacity: sequence({
      steps: [
        transition({ to: 1, from: 0, duration: 200 }),
        spring({ to: 0.7, preset: "bouncy" }),
        transition({ to: 0, duration: 300 }),
      ],
      onComplete: "fade-cycle-done",
    }),
  },
)
```

Only the sequence-level `onComplete` tag fires. Step-level tags
inside a sequence are ignored. An empty `steps` array, or a step
that is not a descriptor, throws at construction time.

## Easing curves

The `easing` option on `transition` accepts a named curve or a
cubic bezier. The named curves cover the usual CSS easing
families, with in / out / in-out variants of each:

| Family | In | Out | In-out |
|---|---|---|---|
| Sine (default) | `"ease_in"` | `"ease_out"` | `"ease_in_out"` |
| Quadratic | `"ease_in_quad"` | `"ease_out_quad"` | `"ease_in_out_quad"` |
| Cubic | `"ease_in_cubic"` | `"ease_out_cubic"` | `"ease_in_out_cubic"` |
| Quartic | `"ease_in_quart"` | `"ease_out_quart"` | `"ease_in_out_quart"` |
| Quintic | `"ease_in_quint"` | `"ease_out_quint"` | `"ease_in_out_quint"` |
| Exponential | `"ease_in_expo"` | `"ease_out_expo"` | `"ease_in_out_expo"` |
| Circular | `"ease_in_circ"` | `"ease_out_circ"` | `"ease_in_out_circ"` |
| Back (overshoot) | `"ease_in_back"` | `"ease_out_back"` | `"ease_in_out_back"` |
| Elastic | `"ease_in_elastic"` | `"ease_out_elastic"` | `"ease_in_out_elastic"` |
| Bounce | `"ease_in_bounce"` | `"ease_out_bounce"` | `"ease_in_out_bounce"` |

`"linear"` is the constant-velocity curve used for continuous
motion like progress bars and spinners.

For a custom shape, pass `cubicBezier(x1, y1, x2, y2)`:

```tsx
import { cubicBezier, transition, withAnimation } from "plushie"
import { Container } from "plushie/ui"

withAnimation(
  <Container id="drawer" />,
  {
    translate_x: transition({
      to: 0,
      from: -240,
      duration: 400,
      easing: cubicBezier(0.25, 0.1, 0.25, 1.0),
    }),
  },
)
```

The control points match the CSS `cubic-bezier()` function. See
the [animation reference](../reference/animation.md) for the
full catalogue and recommendations on which curve to pick.

## Exit animations

The third argument to `withAnimation` declares animations that
play when the widget is removed from the tree:

```tsx
import { transition, withAnimation } from "plushie"
import { Container, Text } from "plushie/ui"

withAnimation(
  <Container id={toast.id}>
    <Text>{toast.message}</Text>
  </Container>,
  { opacity: transition({ to: 1, from: 0, duration: 200 }) },
  { opacity: transition({ to: 0, duration: 150 }) },
)
```

When the widget leaves the tree, the renderer keeps it visible
as a ghost in layout flow and plays the exit descriptors. Other
widgets do not collapse into the space until the exit completes.
Once the ghost's descriptors all finish the node is removed from
the screen. The model has already dropped the entry; exit is a
renderer-side effect.

Pair `KeyedColumn` with exit animations for lists: the keyed
variant matches children by stable ID across renders, so the
correct row animates out rather than a positional sibling.

## Completion events

Any descriptor with `onComplete` emits a `transition_complete`
widget event when the renderer is done. Narrow on it in `update`
to chain the next phase:

```typescript
import { isWidget } from "plushie"
import type { Event } from "plushie"

function update(state: Model, event: Event): Model {
  if (isWidget(event) && event.type === "transition_complete") {
    const { tag } = event.value as { tag: string; prop: string }
    if (tag === "preview-faded-in") {
      return { ...state, previewReady: true }
    }
  }
  return state
}
```

The event's `value` carries `{ tag, prop }`. At most one
completion event fires per animation start. Interrupted
animations do not fire; only the animation that replaced them
can fire a tag of its own. Loops do not emit
`transition_complete` unless they carry a finite `repeat` count.

## Applying it: animating the pad

The pad has three pieces of state that change in ways the user
should be able to follow visually: the sidebar opens and closes,
the preview pane updates after a successful compile, and the
toast that confirms a save dismisses itself after a moment.

Fade the preview in when a fresh compile succeeds. The preview
pane renders whatever `state.preview` holds, so gate the
animation on the compile status:

```tsx
import { transition, withAnimation } from "plushie"
import { Container, Text } from "plushie/ui"

const opacity = state.error === null ? 1.0 : 0.2

withAnimation(
  <Container id="preview">
    {state.preview ?? <Text id="empty">Waiting...</Text>}
  </Container>,
  {
    opacity: transition({
      to: opacity,
      duration: 250,
      easing: "ease_out",
      onComplete: "preview-faded-in",
    }),
  },
)
```

When `state.error` flips back to `null`, the renderer
interpolates opacity from the current (dimmed) value to full
visibility over 250ms and fires `transition_complete` with tag
`"preview-faded-in"` once it settles. That is a good hook to
mark the preview interactive or to focus an input inside it.

Animate the sidebar collapse with a spring so rapid toggles feel
responsive:

```tsx
import { spring, withAnimation } from "plushie"
import { Container } from "plushie/ui"

const sidebarWidth = state.sidebarOpen ? 240 : 0

withAnimation(
  <Container id="sidebar">{sidebar(state)}</Container>,
  { max_width: spring({ to: sidebarWidth, preset: "snappy" }) },
)
```

Because the spring preserves velocity on interruption, toggling
the sidebar mid-flight redirects smoothly instead of snapping.

The save toast slides in from above and dismisses itself. A
keyed container plus exit descriptors lets the renderer animate
it off-screen after the model drops it:

```tsx
import { transition, spring, withAnimation } from "plushie"
import { KeyedColumn, Container, Text } from "plushie/ui"

<KeyedColumn id="toasts" spacing={8}>
  {state.toasts.map((toast) =>
    withAnimation(
      <Container id={toast.id}><Text>{toast.message}</Text></Container>,
      {
        opacity: transition({ to: 1, from: 0, duration: 200 }),
        translate_y: spring({ to: 0, from: -30, preset: "snappy" }),
      },
      { opacity: transition({ to: 0, duration: 150 }) },
    ),
  )}
</KeyedColumn>
```

When the dismissal timer removes a toast from `state.toasts`,
the renderer keeps the node visible long enough to play the exit
fade, then discards it.

## Reusable helpers

Descriptor constructors return plain frozen objects. Build a
motion library as ordinary TypeScript functions and the rest of
the app can share a consistent language:

```typescript
import { spring, transition } from "plushie"

export const motion = {
  fadeIn: (delay = 0) =>
    transition({ to: 1, from: 0, duration: 200, easing: "ease_out", delay }),
  slideDown: (delay = 0) =>
    transition({ to: 0, from: -20, duration: 250, easing: "ease_out", delay }),
  pressScale: () => spring({ to: 0.95, preset: "stiff" }),
}
```

No framework feature, just functions returning descriptors.

## SDK-side tweens

Tweens are the escape hatch for values that must live in your
model: a running clock feeding a progress counter, a physics
simulation driving canvas coordinates, or a state machine where
every frame might trigger a command. The tween API is pure data
and lives in the `plushie` package alongside the descriptors.

```typescript
import {
  advanceAnimation,
  animationFinished,
  createAnimation,
  easeInOut,
  startAnimation,
  Subscription,
} from "plushie"
import type { Animation, Event } from "plushie"
import { isSystem } from "plushie"

interface Model {
  readonly anim: Animation | null
}

function init(): Model {
  return { anim: createAnimation(0, 1, 500, { easing: easeInOut }) }
}

function subscribe(state: Model): Subscription[] {
  return state.anim && !animationFinished(state.anim)
    ? [Subscription.onAnimationFrame({ maxRate: 60 })]
    : []
}

function update(state: Model, event: Event): Model {
  if (!isSystem(event, "animation_frame") || !state.anim) return state
  const ts = Number(event.value)
  const started =
    state.anim.startedAt === null
      ? startAnimation(state.anim, ts)
      : state.anim
  const { animation } = advanceAnimation(started, ts)
  return animationFinished(animation)
    ? { ...state, anim: null }
    : { ...state, anim: animation }
}
```

Drop the subscription when the tween finishes so the runtime
stops consuming frames. Read the current value in `view` with
`animationValue(state.anim)`.

Tween easing functions are numeric (`(t: number) => number`) and
distinct from the string-named curves the renderer uses. The
exported functions include `linear`, `easeIn`, `easeOut`,
`easeInOut`, `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, and
`springEase`. See the [animation reference](../reference/animation.md#tween-api)
for the full list.

If the value ultimately drives a prop the renderer can
interpolate on its own, prefer a transition or spring instead;
the tween path round-trips every frame through the app.

## Verify it

In `mock` mode (the default test backend) animations resolve to
their target values immediately, so tests assert on the settled
state without waiting for frames:

```typescript
import { testWith } from "plushie/testing"
import { padApp } from "./app.js"

const test = testWith(padApp)

test("preview fades in after a successful save", async ({ session }) => {
  await session.click("save")
  session.assertText("preview/greeting", "Hello, Plushie!")
})
```

For tests that need real interpolation (running under the
`headless` backend), drive the animation clock deterministically
with `Command.advanceFrame`:

```typescript
import { Command } from "plushie"

function update(state: Model, event: Event): [Model, Command] {
  if (isClick(event, "tick")) {
    return [state, Command.advanceFrame(state.clock + 16)]
  }
  return [state, Command.none()]
}
```

Issue a sequence of `advanceFrame` commands at the desired
timestamps and assert on the tree between steps to step through
an animation frame by frame.

## Try it

With the updated pad running:

- Swap the preview fade easing: `"linear"`, `"ease_out_back"`, or
  a custom `cubicBezier(...)`. Compare how each curve feels.
- Replace the sidebar spring preset with `"bouncy"` and
  `"molasses"`. Notice how `"bouncy"` overshoots and
  `"molasses"` feels heavy.
- Chain the save toast entrance with a short pulse via
  `sequence`. Use `onComplete` to log when the whole sequence
  finishes.
- Add an exit animation to the sidebar so it slides out instead
  of collapsing instantly.

---

Next: [Subscriptions](10-subscriptions.md)
