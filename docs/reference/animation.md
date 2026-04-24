# Animation

Plushie's view is a pure function. There is no widget handle to
call `.animate()` on. Instead, animations are declarative prop
values. You describe what each prop should be and the renderer
interpolates from where it is to where you want it. Zero wire
traffic per frame, zero subscriptions, zero model state.

This reference covers the renderer-side descriptor API, the
SDK-side tween helpers for cases where the animated value must
live in TypeScript, and the glue between them.

## How animation works

### The declarative model

In the `view` function, wrap a prop value in a `transition`,
`spring`, `sequence`, or `loop` descriptor. Apply it to a widget
with the `withAnimation` helper from `plushie`:

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

The renderer receives the descriptor and interpolates `max_width`
toward 200 over 300ms. The TypeScript side does nothing during the
animation: no subscription ticks, no `update` calls, no tree
diffs. Interpolation runs at full display refresh rate regardless
of network or IPC latency.

### The from / to lifecycle

The descriptor lifecycle is the core idea:

- `to` is always required. It is the target value.
- `from` applies only on first mount. When a widget first enters
  the tree, the renderer starts at `from` and animates toward
  `to`. On later renders `from` is ignored.
- When `to` changes between renders, the renderer starts a new
  interpolation from the current interpolated value to the new
  target. No jump, no restart.
- When `to` does not change, nothing happens. Returning the same
  descriptor every render is free.

The view function stays a pure projection of the model. Toggle a
model flag that drives `to` and the widget animates; toggle again
mid-flight and it reverses from its current interpolated value.

### Zero wire traffic

The descriptor crosses the wire once, in the initial snapshot or
a patch. After that, the renderer owns every frame. Animation
quality does not degrade with round-trip latency, which matters
for remote rendering (SocketTransport, WASM worker).

## Applying descriptors to widgets

`withAnimation(node, animate, exit?)` takes an already-built
`UINode`, merges an animation map over its props, and returns a
new frozen node. The original is not mutated.

```typescript
import { withAnimation } from "plushie"

function withAnimation<N>(
  node: N,
  animate: Readonly<Record<string, unknown>>,
  exit?: Readonly<Record<string, unknown>>,
): N
```

The `animate` map is keyed by the wire-level prop name the
descriptor should drive (for instance `max_width`, `opacity`,
`translate_y`). The renderer owns the catalogue of animatable
wire props, so use the wire names here, not the TypeScript
camelCase names used elsewhere on widget JSX props.

```tsx
import { spring, transition, withAnimation } from "plushie"
import { Container } from "plushie/ui"

withAnimation(
  <Container id="card">{content}</Container>,
  {
    scale: spring({ to: 1.05, preset: "bouncy" }),
    opacity: transition({ to: 1, from: 0, duration: 200 }),
  },
)
```

The third argument, `exit`, is a map of descriptors that play
when the widget is removed from the tree. See [Exit
animations](#exit-animations).

### The `animate` and `exit` props interface

`plushie/ui` also exports `AnimationProps`:

```typescript
interface AnimationProps {
  readonly animate?: Readonly<Record<string, unknown>>
  readonly exit?: Readonly<Record<string, unknown>>
}
```

`AnimationProps` is a contract for custom widgets that want to
accept animation directly as JSX props. Built-in widgets do not
include it on their prop types; use `withAnimation` for those.

## Animatable props

The renderer must know how to interpolate between values. These
wire-level props animate:

### Numeric props

| Prop | Widgets | Purpose |
|---|---|---|
| `opacity` | Most widgets | Fade (0.0 to 1.0) |
| `max_width` | Column, Row, Container | Expand / collapse width |
| `max_height` | Container | Expand / collapse height |
| `spacing` | Column, Row | Gaps between children |
| `scale` | Most widgets | Grow / shrink |
| `rotation` | Text, RichText, Image | Rotate in degrees |
| `border_radius` | Image, Text, RichText | Corner rounding |
| `size` | Text, RichText | Text size |
| `translate_x`, `translate_y` | Floating | Slide |
| `x`, `y` | Pin | Position |
| `width` | Slider | Track width |
| `height` | TextEditor | Editor height |
| `value` | ProgressBar | Smooth progress changes |
| `text_size`, `h1_size`, `h2_size`, `h3_size`, `code_size` | Markdown | Heading and code size |

### Props that do not animate

`Length` values (`"fill"`, `"shrink"`, `{ fillPortion: n }`) are
layout directives, not numbers. Use `max_width` or `max_height`
for size animation. Padding sides are not individually
animatable. Boolean props snap immediately.

## Transitions

Timed animations with a fixed duration and easing curve.
Predictable and coordinated.

```typescript
import { transition } from "plushie"

transition({ to: 200, duration: 300 })
transition({ to: 1, from: 0, duration: 200, easing: "ease_out" })
transition({ to: 0, duration: 150, delay: 100 })
```

| Option | Type | Default | Description |
|---|---|---|---|
| `to` | `unknown` | required | Target value |
| `duration` | positive integer (ms) | required | Animation duration |
| `from` | `unknown` | `undefined` | Start value on first mount only |
| `easing` | `Easing` | `"ease_in_out"` | Named curve or `cubicBezier(...)` |
| `delay` | non-negative ms | `0` | Delay before the transition starts |
| `repeat` | `number \| "forever"` | `undefined` | Repeat count |
| `autoReverse` | `boolean` | `undefined` | Reverse direction on each repeat cycle |
| `onComplete` | `string` | `undefined` | Tag emitted on `transition_complete` |

The constructor throws if `duration` is not a positive integer.

### Looping

`loop(opts)` is sugar for infinite-repeat transitions. It sets
`repeat: "forever"` and `autoReverse: true` by default:

```typescript
import { loop } from "plushie"

// Pulse forever, auto-reversing between 1.0 and 0.7
loop({ to: 0.7, from: 1.0, duration: 800 })

// Finite: 3 cycles
loop({ to: 0.7, from: 1.0, duration: 800, repeat: 3 })

// Spin forever, one direction only
loop({ to: 360, from: 0, duration: 1000, autoReverse: false })
```

`loop` requires `from` on first mount since the descriptor needs
a cycle range.

## Springs

Physics-based animations with no fixed duration. A spring pulls
toward the target with a force proportional to the displacement,
opposed by damping. It settles naturally when velocity and
displacement are both near zero.

```typescript
import { spring } from "plushie"

spring({ to: 1.05, preset: "bouncy" })
spring({ to: 200, stiffness: 200, damping: 20 })
```

| Option | Type | Default | Description |
|---|---|---|---|
| `to` | `unknown` | required | Target value |
| `from` | `unknown` | `undefined` | Start value on first mount |
| `stiffness` | positive finite number | `100` | Pull strength (higher = faster) |
| `damping` | non-negative finite number | `10` | Friction (higher = less oscillation) |
| `mass` | positive finite number | `1` | Inertia (higher = slower to start and stop) |
| `velocity` | number | `0` | Initial velocity |
| `preset` | `SpringPreset` | `undefined` | Named parameter set |
| `onComplete` | `string` | `undefined` | Tag emitted on `transition_complete` |

### Presets

| Preset | Stiffness | Damping | Feel |
|---|---|---|---|
| `"gentle"` | 120 | 14 | Slow, smooth, no overshoot |
| `"snappy"` | 200 | 20 | Quick, minimal overshoot |
| `"bouncy"` | 300 | 10 | Quick with visible bounce |
| `"stiff"` | 400 | 30 | Very quick, crisp stop |
| `"molasses"` | 60 | 12 | Slow, heavy, deliberate |

Explicit `stiffness` / `damping` override the preset's values.

Springs preserve velocity across target changes: if the target
flips while the spring is in flight, momentum carries into the
new direction. This is why springs feel right for drag, hover,
and toggle feedback.

## Sequences

Chain transitions and springs that play one after another on the
same prop:

```typescript
import { sequence, transition } from "plushie"

sequence({
  steps: [
    transition({ to: 300, from: 0, duration: 200 }),
    transition({ to: 300, duration: 500 }),
    transition({ to: 0, duration: 300 }),
  ],
  onComplete: "banner-done",
})
```

| Option | Type | Description |
|---|---|---|
| `steps` | non-empty array of `TransitionDescriptor \| SpringDescriptor` | Ordered steps |
| `onComplete` | `string` | Tag emitted when the entire sequence finishes |

Each step's starting value defaults to the previous step's ending
value. Mixing transitions and springs in one sequence is fine.
Common shapes: enter, hold, exit.

The constructor throws if `steps` is empty or if any step is not
an animation descriptor.

## Easing curves

Pass any of these string names as the `easing` option on
`transition`:

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

`"linear"` is the mechanical, constant-velocity curve.

The `EasingName` and `Easing` types are exported from `plushie`
for explicit annotation.

### Easing guidance

- `"ease_out"` for things appearing (decelerate in).
- `"ease_in"` for things disappearing (accelerate out).
- `"ease_in_out"` for things moving within the UI; this is the
  default.
- `"linear"` for continuous motion (progress, spinners).
- `"ease_out_back"` for playful entrances with slight overshoot.
- `"ease_out_elastic"` and `"ease_out_bounce"` for attention or
  physical-settling effects. Use sparingly.

### Custom cubic bezier

When the named curves do not fit, use `cubicBezier(x1, y1, x2, y2)`:

```typescript
import { cubicBezier, transition } from "plushie"

transition({
  to: 1,
  from: 0,
  duration: 300,
  easing: cubicBezier(0.25, 0.1, 0.25, 1.0),
})
```

The four control points match the CSS `cubic-bezier()` function.
Use [cubic-bezier.com](https://cubic-bezier.com/) to design
curves visually.

## Exit animations

The third argument to `withAnimation` declares animations that
play when the widget is removed from the tree:

```tsx
import { transition, withAnimation } from "plushie"
import { Container, Text } from "plushie/ui"

withAnimation(
  <Container id={item.id}>
    <Text>{item.name}</Text>
  </Container>,
  {
    opacity: transition({ to: 1, from: 0, duration: 200 }),
  },
  {
    opacity: transition({ to: 0, duration: 150 }),
  },
)
```

When the widget leaves the tree, the renderer keeps it visible as
a ghost in layout flow and plays the exit descriptors. Other
widgets do not collapse into the space until the exit completes.
When all exit transitions finish, the ghost is removed. The model
has already dropped the entry; this is a renderer-side effect.

Combine enter (`from`) and exit for full lifecycle animation.
Multiple exit props in one map are supported:

```typescript
{
  opacity: transition({ to: 0, duration: 150 }),
  max_height: transition({ to: 0, duration: 200, easing: "ease_in" }),
}
```

## Interruption

### Target changes

When `to` changes mid-animation, the renderer starts a new
animation from the current interpolated value. No jump, no
restart. For springs, velocity carries through: if the sidebar is
moving right and the target flips, the spring redirects smoothly.

### Snapping

A raw value (no descriptor wrapper) cancels any active animation
and snaps immediately:

```tsx
// Animated:
withAnimation(node, { max_width: transition({ to: 200, duration: 300 }) })

// Snap (cancels any animation on max_width):
withAnimation(node, { max_width: 200 })
```

Use snap values for instant state changes such as resetting
layout on a window resize.

## Completion events

Descriptors with `onComplete` emit a `transition_complete` widget
event when they finish. The `value` field carries
`{ tag, prop }`:

```typescript
import { isWidget } from "plushie"

if (isWidget(event) && event.type === "transition_complete") {
  const { tag, prop } = event.value as { tag: string; prop: string }
  if (tag === "panel-collapsed") {
    return { ...state, panelVisible: false }
  }
}
```

Loops do not emit `transition_complete` unless they carry a
finite `repeat` count. See [Events](events.md) for the full event
taxonomy.

## Coordinating animations

Shared timing: give two descriptors the same `duration` and
`easing` to make them move together.

Stagger: offset each item's `delay` by its index. 30 to 50ms per
item produces a cascade; faster looks simultaneous, slower looks
broken.

```tsx
state.items.map((item, i) =>
  withAnimation(
    <Container id={item.id}>{item.name}</Container>,
    { opacity: transition({ to: 1, from: 0, duration: 200, delay: i * 40 }) },
  ),
)
```

Completion chaining: use `onComplete` on the last phase, branch
on the `transition_complete` event in `update` to trigger the
next phase.

## Reusable helpers

Descriptor constructors return plain frozen objects. Build a
motion library as ordinary TypeScript functions:

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

This is plain TypeScript. No framework feature, just functions
returning descriptors. A shared module gives the app a consistent
motion language at no runtime cost.

## SDK-side animation (tween)

Use renderer-side descriptors first. Fall back to SDK-side tween
only when the animated value must live in the model, for instance
to drive canvas drawing, to feed physics, or to branch on in
`update`.

Tween helpers are pure data. Nothing mutates: every step returns
a new `Animation` record.

```typescript
import {
  createAnimation,
  startAnimation,
  advanceAnimation,
  animationFinished,
  animationValue,
  easeOut,
  Subscription,
} from "plushie"
import type { Animation } from "plushie"

interface Model {
  readonly anim: Animation | null
}

function init(): Model {
  const anim = createAnimation(0, 1, 300, { easing: easeOut })
  return { anim }
}

function subscribe(state: Model): Subscription[] {
  return state.anim ? [Subscription.onAnimationFrame({ maxRate: 60 })] : []
}
```

Advance on every frame event. `Subscription.onAnimationFrame`
delivers a `SystemEvent` with `type: "animation_frame"` and the
timestamp in `value`:

```typescript
import { isSystem } from "plushie"

function update(state: Model, event: Event): Model {
  if (!isSystem(event, "animation_frame") || !state.anim) return state
  const ts = Number(event.value)
  const started = state.anim.startedAt === null
    ? startAnimation(state.anim, ts)
    : state.anim
  const { animation } = advanceAnimation(started, ts)
  return animationFinished(animation)
    ? { ...state, anim: null }
    : { ...state, anim: animation }
}
```

Read the value in `view` via `animationValue(state.anim)`.

### Tween API

All exported from `plushie`:

| Function | Signature | Description |
|---|---|---|
| `createAnimation` | `(from, to, durationMs, { easing? })` | Build a one-shot animation |
| `looping` | `(from, to, durationMs, { easing? })` | Build a forever-looping, auto-reversing animation |
| `startAnimation` | `(anim, timestamp)` | Stamp the start time and reset the value to `from` |
| `advanceAnimation` | `(anim, timestamp)` | Return `{ value, finished, animation }` for the given time |
| `animationValue` | `(anim)` | Read the current interpolated value |
| `animationFinished` | `(anim)` | `true` once a one-shot animation reaches `to`; always `false` for loops |
| `interpolate` | `(from, to, t, easing?)` | Eased lerp; `t` is clamped to 0..1 |

### Easing functions

Tween animations take an `EasingFn: (t: number) => number`. These
are exported from `plushie`:

| Name | Curve |
|---|---|
| `linear` | Identity |
| `easeIn` | Cubic ease in |
| `easeOut` | Cubic ease out |
| `easeInOut` | Cubic ease in-out |
| `easeInQuad` | Quadratic ease in |
| `easeOutQuad` | Quadratic ease out |
| `easeInOutQuad` | Quadratic ease in-out |
| `springEase` | Damped sine approximation with overshoot |

These are TypeScript numeric functions, distinct from the
renderer-side easing name strings used in `transition({ easing: ... })`.

### Canvas animation

Canvas shapes live inside prop values, not as individual widgets,
so they cannot carry renderer-side descriptors. Use the tween API
with `Subscription.onAnimationFrame` to animate canvas content:

```tsx
import { Canvas } from "plushie/ui"
import { layer, path, arc, stroke } from "plushie/canvas"
import { animationValue } from "plushie"

const angle = state.gaugeAnim ? animationValue(state.gaugeAnim) * 180 : 0

<Canvas id="gauge" width={120} height={70}>
  {layer([
    path([arc(60, 60, 50, 180, 180 + angle)], {
      stroke: stroke("#3b82f6", 4, { cap: "round" }),
    }),
  ])}
</Canvas>
```

## Renderer-side vs SDK-side: performance

Renderer-side descriptors cost nothing on the TypeScript side: a
descriptor crosses the wire once, the renderer runs every frame
locally. SDK-side tween costs one subscription event per frame,
an `update` pass, a `view` call, a tree diff, and a patch over
the wire. Reach for tween only when the animated value drives
application logic or when the target is canvas content.

## Testing animations

Test backends behave differently with animation:

- `mock` (default): transition descriptors resolve to their
  target value immediately. Tests that assert on final state work
  without animation awareness.
- `headless`: runs real interpolation. Drive the renderer's
  animation clock deterministically with
  `Command.advanceFrame(timestamp)`:

```typescript
import { Command } from "plushie"

function update(state: Model, event: Event): [Model, Command] {
  if (isClick(event, "tick")) {
    return [state, Command.advanceFrame(state.clock + 16)]
  }
  return [state, Command.none()]
}
```

For integration tests that want to step through frames, issue a
sequence of `advanceFrame` commands at the desired timestamps and
assert on the tree between steps.

- `windowed`: real GPU rendering at the display refresh rate.
  Useful for visual validation, not for deterministic assertions.

See the [CLI commands reference](cli-commands.md) for backend
selection at the test runner.

## Examples

### Sidebar toggle

```tsx
withAnimation(
  <Container id="sidebar">{sidebar(state)}</Container>,
  {
    max_width: transition({
      to: state.sidebarOpen ? 250 : 0,
      duration: 250,
      easing: "ease_in_out",
    }),
    opacity: transition({ to: state.sidebarOpen ? 1 : 0, duration: 200 }),
  },
)
```

### Notification slide-in

```tsx
withAnimation(
  <Container id={toast.id}><Text>{toast.text}</Text></Container>,
  {
    opacity: transition({ to: 1, from: 0, duration: 200 }),
    translate_y: spring({ to: 0, from: -30, preset: "snappy" }),
  },
  { opacity: transition({ to: 0, duration: 150 }) },
)
```

### Skeleton shimmer

```tsx
withAnimation(
  <Container id="skeleton-line" width="fill" height={16} />,
  { opacity: loop({ to: 0.4, from: 1.0, duration: 1200 }) },
)
```

### Smooth progress bar

```tsx
withAnimation(
  <ProgressBar id="upload" range={[0, 100]} value={state.uploadProgress} />,
  { value: transition({ to: state.uploadProgress, duration: 300, easing: "ease_out" }) },
)
```

### Hover scale with spring

```tsx
<PointerArea id="card-hover" onEnter onExit cursor="pointer">
  {withAnimation(
    <Container id="card">{cardContent(state)}</Container>,
    { scale: spring({ to: state.cardHovered ? 1.02 : 1.0, preset: "snappy" }) },
  )}
</PointerArea>
```

### Multi-phase sequence

```tsx
withAnimation(
  <Container id="banner"><Text>Release notes</Text></Container>,
  {
    max_height: sequence({
      steps: [
        transition({ to: 80, from: 0, duration: 250, easing: "ease_out" }),
        transition({ to: 80, duration: 3000 }),
        transition({ to: 0, duration: 200, easing: "ease_in" }),
      ],
      onComplete: "banner-dismissed",
    }),
  },
)
```

### Delete with exit animation

Pair a keyed container (so the renderer tracks identity across
re-renders) with an `exit` map:

```tsx
<KeyedColumn spacing={4}>
  {state.items.map((item) =>
    withAnimation(
      <Container id={item.id}>
        <Row spacing={8}>
          <Text>{item.name}</Text>
          <Button id={`delete-${item.id}`}>x</Button>
        </Row>
      </Container>,
      {
        opacity: transition({ to: 1, from: 0, duration: 200, delay: 50 }),
        max_height: transition({ to: 40, from: 0, duration: 200, delay: 50 }),
      },
      {
        opacity: transition({ to: 0, duration: 150 }),
        max_height: transition({ to: 0, duration: 200, easing: "ease_in" }),
      },
    ),
  )}
</KeyedColumn>
```

`KeyedColumn` ensures the correct item animates out rather than a
positional sibling.

## See also

- [Events reference](events.md)
- [Subscriptions reference](subscriptions.md)
- [Commands reference](commands.md)
- [Built-in widgets reference](built-in-widgets.md)
- [cubic-bezier.com](https://cubic-bezier.com/) - visual curve designer
