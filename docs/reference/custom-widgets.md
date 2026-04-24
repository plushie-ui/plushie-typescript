# Custom widgets

Plushie has two ways to build widgets beyond the built-in catalog:
**composition-only** widgets written in pure TypeScript via
`WidgetDef` and `buildWidget`, and **native widgets** backed by a
Rust crate and wired in through `defineNativeWidget`. Both produce
`UINode` values and slot into an app's `view` next to any built-in
widget. The composition-only system lives in `plushie` as
`buildWidget`, `WidgetDef`, and `EventAction`. Native widget
support lives in `plushie` as `defineNativeWidget`,
`nativeWidgetCommands`, and `NativeWidgetConfig`.

```tsx
import { buildWidget, type WidgetDef } from "plushie"
import { Canvas } from "plushie/ui"

interface ClickerProps { readonly label: string }
interface ClickerState { readonly count: number }

const clicker: WidgetDef<ClickerState, ClickerProps> = {
  init: () => ({ count: 0 }),
  view: (id, props, state) =>
    <Canvas id={id} width={120} height={40} alt={props.label} />,
  handleEvent: (event, state) => [{ type: "consumed" }, state],
}

// In a parent view:
buildWidget(clicker, "tally", { label: "Clicks" })
```

Choose composition-only when the behavior can be expressed with
built-in widgets, canvas shapes, or existing layout primitives.
Choose native when you need to render pixels the built-in engine
cannot produce (custom GPU draws, platform-native controls,
performance-critical visuals). The two approaches can coexist in
one app; composition-only widgets can include native widgets in
their view, and native widgets can be wrapped in composition-only
widgets to layer TypeScript-side state.

## Composition-only widgets

A composition-only widget is a value of type `WidgetDef<State, Props>`
together with the call to `buildWidget` that mounts it. The runtime
stores the state, calls `view` on every render, and walks events
through `handleEvent` before dispatching them to `update`. State
lives entirely inside the runtime; parents see the widget as an
opaque `UINode`.

### The `WidgetDef` contract

```typescript
import type { Event, Subscription, UINode } from "plushie"
import type { EventAction, WidgetDef } from "plushie"

interface WidgetDef<State, Props> {
  readonly init?: () => State
  readonly view: (id: string, props: Props, state: State) => UINode | null
  readonly handleEvent?: (
    event: Event,
    state: State,
  ) => readonly [EventAction, State]
  readonly subscriptions?: (props: Props, state: State) => Subscription[]
  readonly cacheKey?: (props: Props, state: State) => unknown
}
```

| Field | Signature | Description |
|---|---|---|
| `init` | `() => State` | Produces the initial state when the widget first appears in the tree. Omit for stateless widgets; the runtime treats state as `{}`. |
| `view` | `(id, props, state) => UINode \| null` | Renders the widget's subtree. Use the `id` argument for the top-level node; child IDs are scoped to it. Return `null` to render nothing while keeping the widget registered. |
| `handleEvent` | `(event, state) => [EventAction, State]` | Intercepts events traveling through the widget's scope. Returns an action and the next state. Omit for render-only widgets. |
| `subscriptions` | `(props, state) => Subscription[]` | Declares per-widget subscriptions. Timer tags are namespaced automatically; see below. |
| `cacheKey` | `(props, state) => unknown` | Returns a stable key for view memoization. When the key is unchanged, the runtime reuses the prior subtree. |

`Props` is whatever the parent passes. `State` is owned by the
runtime; the widget only sees it through `view` and `handleEvent`.

### Event actions

`EventAction` is a discriminated union on `type`:

| Variant | Effect |
|---|---|
| `{ type: "ignored" }` | The event passes unchanged to the next handler in the scope chain (or `update` if this is the outermost). |
| `{ type: "consumed" }` | The event is suppressed. No further handler sees it; `update` is not called. |
| `{ type: "update_state" }` | Like `consumed`, but the returned state replaces the widget's state and triggers a re-render. |
| `{ type: "emit", kind, value? }` | Emit a synthetic widget event of `kind`. `value` populates `WidgetEvent.value` (scalar). The event continues walking the chain and ends up in `update`. |
| `{ type: "emit", kind, data? }` | Same as above, but `data` populates `WidgetEvent.data` as a structured map. |

`emit` with `value` produces an event indistinguishable from a
built-in widget event of the same `kind` (`select`, `toggle`,
`change`, and so on). `emit` with `data` is for structured
payloads whose fields the parent wants to pattern-match on.

Default behavior when `handleEvent` is omitted: every event is
`ignored` and flows past the widget.

### `buildWidget` and tree placement

`buildWidget(def, id, props, opts?)` returns a frozen `UINode`
tagged with metadata. During normalization the runtime detects
the tag, looks up stored state (or calls `init`), and calls `view`
with the scoped ID. The placeholder is replaced by the rendered
tree in-place; custom widget IDs do not create their own scope.
Children of the rendered tree see the parent container's scope,
not the widget's ID. See the
[Scoped IDs reference](scoped-ids.md).

```typescript
const opts = { a11y: { role: "slider", label: "Volume" }, eventRate: 30 }
buildWidget(clicker, "tally", { label: "Clicks" }, opts)
```

The optional fourth argument carries standard widget options.
`a11y` is merged onto the top-level rendered node's `a11y` prop;
`eventRate` is forwarded the same way. Widgets do not need to
forward these manually.

A widget must be mounted inside a `Window` node. Mounting one at
the root of the view outside a window raises at normalization
time.

### A toy counter widget

The widget renders a canvas button and a count, handles canvas
clicks, and emits a `select` event carrying the new count.

```tsx
import type { Event, EventAction, UINode, WidgetDef } from "plushie"
import { buildWidget } from "plushie"
import { Canvas } from "plushie/ui"
import { group, interactive, rect, canvasText } from "plushie/canvas"

interface CounterProps { readonly step: number }
interface CounterState { readonly count: number }

function view(id: string, props: CounterProps, state: CounterState): UINode {
  return (
    <Canvas id={id} width={120} height={40} alt={`Count: ${state.count}`}>
      {[
        interactive(
          group([rect(0, 0, 60, 40, { fill: "#3b82f6", radius: 6 })]),
          "inc",
          { on_click: true, cursor: "pointer", a11y: { role: "button", label: "Increment" } },
        ),
        canvasText(80, 28, String(state.count), { fill: "#111", size: 18 }),
      ]}
    </Canvas>
  )
}

function handleEvent(
  event: Event,
  state: CounterState,
): readonly [EventAction, CounterState] {
  if (
    event.kind === "widget" &&
    event.type === "canvas_element_click" &&
    event.data?.["element_id"] === "inc"
  ) {
    const next = { count: state.count + 1 }
    return [{ type: "emit", kind: "select", value: next.count }, next]
  }
  return [{ type: "ignored" }, state]
}

const counterDef: WidgetDef<CounterState, CounterProps> = {
  init: () => ({ count: 0 }),
  view,
  handleEvent,
}

export function counter(id: string, props: CounterProps): UINode {
  return buildWidget(counterDef, id, props)
}
```

Usage in an app:

```tsx
import { counter } from "./counter"

function appView(state: Model) {
  return (
    <Window id="main" title="Counter">
      <Column id="root" padding={16}>
        {counter("clicks", { step: 1 })}
      </Column>
    </Window>
  )
}
```

The parent treats the emitted event exactly like a built-in
`select` event: the runtime synthesizes a `WidgetEvent` with
`kind: "widget"`, `type: "select"`, and `value: n`. Narrow it in
`update` with `isSelect(event, "clicks")`. See the
[Events reference](events.md) for the full guard set.

### Inner views compose other widgets

A widget's `view` is an ordinary view function. It can include
built-in widgets, canvas content, or other custom widgets.
Nested custom widgets get their own state slot, tracked by their
(scoped) ID.

```tsx
const dashboardDef: WidgetDef<DashState, DashProps> = {
  init: () => ({ selected: null }),
  view: (id, props, state) => (
    <Column id={id} spacing={12}>
      {counter(`${id}/clicks`, { step: 1 })}
      {counter(`${id}/doubles`, { step: 2 })}
    </Column>
  ),
  handleEvent: (event, state) => {
    if (event.kind === "widget" && event.type === "select") {
      return [{ type: "update_state" }, { ...state, selected: event.id }]
    }
    return [{ type: "ignored" }, state]
  },
}
```

The outer widget sees `select` events from both inner counters
because events walk the scope chain from innermost to outermost.
Returning `{ type: "ignored" }` lets the event continue past the
dashboard to `update`; returning `{ type: "consumed" }` stops it.

### Handler registration: internal vs hoisted

Built-in widgets use inline `onClick` / `onInput` handler props
(see the [Events reference](events.md)). Custom widgets have two
choices:

- **Internal handlers:** the widget's `view` builds widgets with
  their own handler props, and `handleEvent` never sees those
  events (the inline handler fires first, and if it returns a
  model the event is consumed at dispatch time). Use this when
  the event never needs to leave the widget.
- **Hoisted events:** the widget's `view` builds interactive
  canvas elements (or widgets without handler props) and
  `handleEvent` transforms the raw events into semantic ones via
  `emit`. Use this when the parent needs to observe state
  transitions and the widget wants a single outward-facing event
  vocabulary.

The star rating and theme toggle in `examples/widgets/` both use
the hoisted pattern: canvas elements report clicks and hovers;
`handleEvent` turns them into `select` and `toggle` emits.

### Accessibility

Custom widgets carry accessibility metadata the same way built-in
widgets do. Pass `a11y` through the `opts` argument to
`buildWidget` for the top-level node, and set `a11y` on
interactive canvas elements (via `plushie/canvas`'s `interactive`)
for inner focusable regions.

```tsx
buildWidget(starRatingDef, "rating", { rating: 3 }, {
  a11y: { role: "radiogroup", label: "Product rating" },
})
```

Inside the view:

```tsx
interactive(shape, `star-${i}`, {
  on_click: true,
  a11y: {
    role: "radio",
    label: `${i + 1} stars`,
    selected: state.selected === i,
    position_in_set: i + 1,
    size_of_set: 5,
  },
})
```

See the [Accessibility reference](accessibility.md) for the full
`A11y` shape.

### Widget-scoped subscriptions

Widgets can declare their own subscriptions via `subscriptions`.
The runtime namespaces each subscription tag with the widget's
scoped ID, so timer events route back to the originating widget's
`handleEvent` rather than surfacing in `update`.

```typescript
import { Subscription } from "plushie"

const themeToggleDef: WidgetDef<ToggleState, ToggleProps> = {
  init: () => ({ progress: 0, target: 0 }),
  view,
  handleEvent,
  subscriptions: (_props, state) =>
    state.progress !== state.target ? [Subscription.every(16, "animate")] : [],
}
```

Inside `handleEvent`, the timer arrives as a normal `Event` with
`kind: "timer"` and the inner tag (`"animate"`) rather than the
namespaced wire tag. Multiple instances of the same widget each
receive their own timer events; they do not cross-talk.

If the widget emits from inside a timer handler, the emitted
event still walks the scope chain so parent widgets can
intercept it.

### View memoization

`cacheKey` lets a widget skip `view` when its visible state has
not changed. Return any value that's stable under structural
equality (primitive, frozen object, tuple).

```typescript
const chartDef: WidgetDef<ChartState, ChartProps> = {
  init: () => ({ hover: null }),
  view,
  cacheKey: (props, state) =>
    [props.series.length, props.color, state.hover] as const,
}
```

The runtime compares keys via deep equality and reuses the
prior rendered subtree on a hit. Use this when `view` is
expensive (large canvas scenes, big tables).

## Native widgets

Native widgets let a Rust crate own the rendering for a widget
type. The TypeScript side declares the widget's wire shape, its
events, and its commands; the Rust crate implements the
`PlushieWidget` trait from `plushie_widget_sdk`. The SDK sends
`NativeWidgetConfig` declarations to the renderer during startup
so the renderer knows how to decode props and dispatch events.

### Declaring a native widget

```typescript
import { defineNativeWidget, nativeWidgetCommands } from "plushie"

const gaugeConfig = {
  type: "gauge",
  props: {
    value: "number",
    max: "number",
    label: "string",
    tint: "color",
  },
  events: ["value_changed", "threshold_hit"],
  commands: ["set_value", "reset"],
  rustCrate: "native/gauge",
} as const

export const gauge = defineNativeWidget(gaugeConfig)
export const gaugeCommands = nativeWidgetCommands(gaugeConfig)
```

`NativeWidgetConfig` carries:

| Field | Type | Description |
|---|---|---|
| `type` | `string` | Wire type name. Must be unique across the app. |
| `props` | `Record<string, NativeWidgetPropType>` | Declared props and their types. Primitives, `"color"`, `"length"`, `"padding"`, `"alignment"`, `"font"`, `"style"`, `"any"`, or `{ list: <type> }`. Future types accepted as string literals. |
| `events` | `string[]` | Wire event type names the widget emits. |
| `container` | `boolean` | When `true`, the widget accepts child `UINode`s. Defaults to `false` (leaf widget). |
| `commands` | `string[]` | Command names the widget supports. Drives `nativeWidgetCommands`. |
| `rustCrate` | `string` | Path to the Rust crate, relative to the project root. Used by `plushie build`. |

### Builder function shape

`defineNativeWidget` returns a builder with signature
`(id, opts?, children?) => UINode`. For leaf widgets the third
argument is ignored; for container widgets it becomes the child
list.

```tsx
// Leaf
gauge("pressure", { value: 42, max: 100, tint: "#3b82f6", onValueChanged: handleChange })

// Container (if container: true)
panel("main", { title: "Details" }, [
  <Text id="subtitle">Press start</Text>,
])
```

Handler props follow the `on<EventName>` convention derived from
each declared event. `value_changed` becomes `onValueChanged`;
`threshold_hit` becomes `onThresholdHit`. Handlers receive the
same `Event` value any built-in widget handler would get. The
`handlerPropName` mapping is automatic; do not list the
`onXxx` names in `props`.

Props whose values are `undefined` are omitted from the wire
message (the `putIf` convention from `plushie/ui/build`). Props
are passed through unchanged; value encoding is up to the call
site (use `encodeColor`, `encodeLength`, and friends from
`plushie/ui` when manual encoding is needed, though most built-in
widgets accept the TypeScript-side shapes directly).

### Events from the Rust widget

The Rust widget sends wire events with its declared `type` name.
The renderer routes them into the runtime, which decodes them as
`Event` values of `kind: "widget"` and `type: <event name>`. Any
handler prop registered on the builder fires with the event
value. Events without a matching handler prop flow to `update`
like any other widget event:

```typescript
function update(state: Model, event: Event): [Model, CommandType] {
  if (event.kind === "widget" && event.type === "value_changed" && event.id === "pressure") {
    return [{ ...state, pressure: Number(event.value ?? 0) }, Command.none()]
  }
  return [state, Command.none()]
}
```

### Commands targeting a widget

`nativeWidgetCommands(config)` returns a record of functions, one
per entry in `commands`. Each command takes a node ID and an
optional payload and returns a `Command`:

```typescript
import { Command } from "plushie"

gaugeCommands.set_value("pressure", { value: 72 })
gaugeCommands.reset("pressure")
Command.batch([
  gaugeCommands.set_value("pressure", { value: 72 }),
  gaugeCommands.set_value("flow", { value: 0.8 }),
])
```

Internally these build `{ type: "command", payload: { id, family, value } }`.
The generic builders `Command.widgetCommand(id, family, value?)`
and `Command.widgetBatch(entries)` are available for ad-hoc
command dispatch when a config-driven accessor is not needed.

Errors from the renderer (unknown `family`, failed payload
validation) arrive as events with `kind: "widget_command_error"`.
Narrow them with `isWidgetCommandError` from `plushie`:

```typescript
if (isWidgetCommandError(event)) {
  console.warn("widget command failed", event.id, event.family, event.message)
  return state
}
```

### Registering native widgets with the app

List native widgets in `App`'s `requiredWidgets` so the runtime
sends the config to the renderer at startup and the build system
knows which crates to compile:

```typescript
import { app } from "plushie"
import { gaugeConfig } from "./widgets/gauge"

export default app<Model>({
  init: () => ({ pressure: 0 }),
  view,
  update,
  requiredWidgets: [gaugeConfig],
})
```

Pass the config object itself, not the builder. Built-in widgets
do not need to be listed.

### Rust crate metadata

The Rust crate that implements the widget must declare metadata
in its own `Cargo.toml`. `cargo plushie build` discovers this
metadata to wire the crate into the renderer workspace.

```toml
[package.metadata.plushie.widget]
type_name = "gauge"
constructor = "gauge::new()"
```

`type_name` must match the `type` field on the TypeScript
`NativeWidgetConfig`. `constructor` is a Rust expression returning
a value that implements the `PlushieWidget` trait from
`plushie_widget_sdk::prelude`. Use `cargo plushie new-widget` to
scaffold a crate that already has the right metadata.

### Building a custom renderer

The default precompiled renderer does not include third-party
widget crates. A project that uses native widgets ships its own
renderer binary:

```bash
npx plushie build              # debug build
npx plushie build --release    # release build
```

`plushie build` generates a minimal virtual app crate under
`node_modules/.plushie-renderer/`, lists every `rustCrate` from
the project's native widgets as a path dependency, and shells
out to `cargo plushie build`. Point the runtime at the compiled
binary through the `PLUSHIE_BINARY` environment variable or the
`--binary` CLI flag. See the
[CLI commands reference](cli-commands.md).

During development, point at a local `plushie-rust` checkout by
setting `PLUSHIE_RUST_SOURCE_PATH`; `cargo plushie` falls back to
the pinned version otherwise.

### A native gauge stub

A minimal native gauge widget, as it would appear on the
TypeScript side before the Rust crate exists:

```typescript
// widgets/gauge.ts
import { defineNativeWidget, nativeWidgetCommands } from "plushie"

export const gaugeConfig = {
  type: "gauge",
  props: { value: "number", max: "number", tint: "color" },
  events: ["value_changed"],
  commands: ["set_value", "reset"],
  rustCrate: "native/gauge",
} as const

export const gauge = defineNativeWidget(gaugeConfig)
export const gaugeCommands = nativeWidgetCommands(gaugeConfig)
```

```tsx
// view.tsx
import { gauge } from "./widgets/gauge"

<Column id="root" padding={16}>
  {gauge("pressure", {
    value: state.pressure,
    max: 100,
    tint: "#3b82f6",
    onValueChanged: (s, e) => ({ ...s, pressure: Number(e.value) }),
  })}
</Column>
```

The Rust crate at `native/gauge` implements `PlushieWidget`, draws
the gauge, and returns `value_changed` events when the user drags
the needle. The full Rust-side lifecycle is covered in the
`plushie_widget_sdk` docs.

## Testing custom widgets

Composition-only widgets test like any other Plushie tree:
mount an app that uses them, drive events through the test
session, and assert on the emitted events or model changes. The
widget's internal state is hidden from the test; assert on
observable behavior.

```typescript
import { testWith } from "plushie/testing"
import app from "./app-with-counter"

const test = testWith(app)

test("counter emits select on click", async ({ session }) => {
  await session.click("clicks/inc")
  expect(session.model().lastSelected).toBe(1)
})
```

Native widgets require a compiled renderer. Run
`npx plushie build` first, then tests pick up the binary through
the standard resolution order. For widget-level tests that do not
exercise real rendering, stub the renderer with the `mock`
backend (`testWith(app)` uses it by default).

## See also

- [Built-in widgets reference](built-in-widgets.md)
- [Events reference](events.md)
- [Commands reference](commands.md)
- [Canvas reference](canvas.md)
- [Composition patterns reference](composition-patterns.md)
