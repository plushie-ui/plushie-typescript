# Custom widgets

The pad's view function keeps growing. The sidebar, the editor
pane, and the event log are each self-contained slices of UI
with their own layout and state, and they are all glued into a
single top-level view function. In this chapter we extract them
into **custom widgets**: reusable modules that own rendering,
internal state, and event handling.

Plushie has three layers of custom widget:

- **Composition**: a plain function that returns a `UINode` tree.
  No registration, no state. Good when a piece of UI just needs
  a name.
- **WidgetDef**: a stateful TypeScript widget with its own state,
  internal event handling, and subscriptions. Built with
  `buildWidget` from `plushie`. Runs on both BEAM and WASM
  targets and hot-reloads cleanly.
- **Native widgets**: a Rust-backed widget registered with
  `defineNativeWidget`, rendered by a crate inside the renderer
  binary. Escape hatch for custom GPU drawing or performance
  critical visuals.

This chapter walks through all three using concrete additions to
the pad. For the full API reference see
[Custom widgets](../reference/custom-widgets.md).

## Layer 1: a composition widget

The simplest custom widget is a function that takes some props
and returns a `UINode`. Event handlers inside fire through to
the app's `update` unchanged because a composition widget does
not register anything with the runtime.

The pad renders a small header above the event log ("log-lines"
with a count and a Clear button). Pulling that into a `card`
widget that wraps any header plus body is a clean first step.

```tsx
import type { UINode } from "plushie"
import { Column, Container, Row, Text } from "plushie/ui"

interface CardProps {
  readonly id: string
  readonly title: string
  readonly trailing?: UINode
  readonly children: readonly UINode[]
}

export function Card(props: CardProps): UINode {
  return (
    <Container
      id={props.id}
      padding={8}
      style={{ border: { color: "#333333", width: 1 }, borderRadius: 4 }}
    >
      <Column id="body" spacing={6}>
        <Row id="head" spacing={8}>
          <Text id="title" size={13}>{props.title}</Text>
          {props.trailing ?? <Text id="spacer"> </Text>}
        </Row>
        {...props.children}
      </Column>
    </Container>
  )
}
```

The pad wires it in as a regular JSX element:

```tsx
<Card id="log-card" title="Events" trailing={<Button id="clear" onClick={clearLog}>Clear</Button>}>
  <EventLog entries={state.eventLog} />
</Card>
```

Because `Card` returns a plain tree, the `onClick` handler on
the Clear button reaches the app's `update` the same way it
would if it had been inlined into the parent view. The widget
pays no runtime cost beyond the call itself, and it does not
need the `buildWidget` machinery.

### ID conventions for composition widgets

Composition widgets take an `id` prop and pass it through to the
top-level node. Children use local IDs (`"title"`, `"body"`, ...),
and the tree normalizer glues them together with `/` separators
so the final scoped ID becomes `"log-card/body/head/title"`.
This is the same scoped ID scheme the built-in widgets use; see
[Scoped IDs](../reference/scoped-ids.md) for the mechanics.

The rule: every `UINode` emitted by the widget needs a stable
`id`. If you build children from a list, use the item's natural
key (the filename, the row UUID) rather than the loop index.
Changing IDs between renders looks like a removal plus a fresh
mount and throws away any per-node state the renderer holds,
like scroll offsets and input focus.

## Layer 2: a stateful widget with `WidgetDef`

Composition widgets cannot own state. The moment something needs
to remember a toggle, a hover target, or an animation frame,
step up to `WidgetDef`. Import `buildWidget` and the types from
`plushie`:

```typescript
import type { Event, EventAction, UINode, WidgetDef } from "plushie"
import { buildWidget } from "plushie"
```

`WidgetDef<State, Props>` has five fields (all but `view` are
optional):

| Field | Signature | Description |
|---|---|---|
| `init` | `() => State` | Builds the initial state on first mount. |
| `view` | `(id, props, state) => UINode \| null` | Renders the subtree. |
| `handleEvent` | `(event, state) => [EventAction, State]` | Intercepts events before `update` sees them. |
| `subscriptions` | `(props, state) => Subscription[]` | Declares per-instance subscriptions, typically timers. |
| `cacheKey` | `(props, state) => unknown` | Reserved for view memoization. No runtime effect today. |

The runtime stores the state, calls `view` on every render, and
walks events through `handleEvent` before dispatching them to
the app's `update`.

### Worked example: a toast widget

The pad currently logs a line to the event log when save
succeeds. Say we want something more visible: a toast that pops
in, shows the message for three seconds, then disappears. The
parent should only have to hand the widget an initial message;
the widget handles its own lifecycle.

```typescript
import type { Event, EventAction, SubscriptionType, UINode, WidgetDef } from "plushie"
import { buildWidget, Subscription } from "plushie"
import { Container, Text } from "plushie/ui"

interface ToastProps {
  readonly message: string
}

interface ToastState {
  readonly visible: boolean
  readonly shown: string | null
}

function view(id: string, props: ToastProps, state: ToastState): UINode | null {
  if (!state.visible || state.shown !== props.message) return null
  return (
    <Container
      id={id}
      padding={[6, 10]}
      style={{ background: "#1f2937", borderRadius: 4 }}
    >
      <Text id="label" size={12} color="#f9fafb">{props.message}</Text>
    </Container>
  )
}

function handleEvent(
  event: Event,
  state: ToastState,
): readonly [EventAction, ToastState] {
  if (event.kind === "timer" && event.tag === "dismiss") {
    return [{ type: "update_state" }, { ...state, visible: false }]
  }
  return [{ type: "ignored" }, state]
}

function subscriptions(
  props: ToastProps,
  state: ToastState,
): SubscriptionType[] {
  // Start or reset the countdown whenever the message changes.
  if (state.shown !== props.message) {
    return [Subscription.every(3000, "dismiss")]
  }
  return state.visible ? [Subscription.every(3000, "dismiss")] : []
}

const toastDef: WidgetDef<ToastState, ToastProps> = {
  init: () => ({ visible: true, shown: null }),
  view,
  handleEvent,
  subscriptions,
}

export function Toast(props: { id: string } & ToastProps): UINode {
  return buildWidget(toastDef, props.id, { message: props.message })
}
```

A few things are worth calling out. `view` may return `null`,
and the runtime keeps the widget in its registry anyway; that is
how the toast disappears without being unmounted and remounted
on every message change. `subscriptions` is recomputed after
every update and diffed against the previous list, so the timer
starts and stops automatically. Tag routing is handled by the
runtime: the tag `"dismiss"` is namespaced per instance so two
Toasts on screen never collide.

The pad uses it like any other JSX element:

```tsx
<Toast id="save-toast" message={state.lastSaveMessage} />
```

There is one subtle thing happening in `init`. `shown` starts as
`null`, which differs from any real `message`, so the first
render flows through the "message changed" branch in
`subscriptions` and fires a `dismiss` timer. The
`handleEvent` branch then flips `visible` to `false`, `view`
returns `null`, and the toast vanishes.

What is missing: the message is remembered (`shown`) but never
stored. The full version would add an `ignored` branch for a
`show` emit from the parent and gate the `visible` flag on a
prop change. That is an exercise left to the reader.

### Event actions

`handleEvent` returns an `EventAction` plus the next state. The
action controls what happens to the event:

| Variant | Effect |
|---|---|
| `{ type: "ignored" }` | Let the event continue up the scope chain to the parent or the app. |
| `{ type: "consumed" }` | Drop the event entirely. |
| `{ type: "update_state" }` | Drop the event, trigger a re-render with the returned state. |
| `{ type: "emit", kind, value }` | Replace the event with a `WidgetEvent` carrying a scalar `value`. Parent sees `event.value`. |
| `{ type: "emit", kind, data }` | Replace the event with a `WidgetEvent` carrying structured `data`. Parent sees `event.data`. |

Events walk from the innermost widget outward. A widget that
returns `ignored` passes the event to the next widget in the
scope. The first non-`ignored` action stops the walk. If every
widget returns `ignored`, the event reaches `update`.

Use `value` for scalars (`number`, `string`, `boolean`, `null`);
the emitted event is then indistinguishable from a built-in
widget event of the same type and narrows under the same guards.
Use `data` for structured payloads; the parent pulls fields out
of `event.data`.

### Emitting semantic events

When a widget should tell its parent "something meaningful
happened" rather than leak the underlying click or key press,
emit it. Here is the pattern used by the `star_rating` widget in
`examples/widgets/`:

```typescript
function handleEvent(
  event: Event,
  state: StarState,
): readonly [EventAction, StarState] {
  if (event.kind === "widget" && event.type === "canvas_element_click") {
    const match = String(event.data?.["element_id"]).match(/^star-(\d+)$/)
    if (match) {
      const n = Number(match[1]) + 1
      return [{ type: "emit", kind: "select", value: n }, state]
    }
  }
  return [{ type: "consumed" }, state]
}
```

The parent narrows on the emitted event kind in its `update`:

```typescript
import { isWidget } from "plushie"

function update(state: Model, event: Event): Model {
  if (isWidget(event) && event.type === "select" && event.id === "stars") {
    return { ...state, rating: Number(event.value) }
  }
  return state
}
```

The `type` on the `WidgetEvent` is exactly the `kind` string the
widget chose (`"select"`), the `id` is the scoped ID you passed
to `buildWidget`, and `value` is whatever scalar you emitted. No
special tuple wrapping; semantic widget events ride on the same
type as built-in ones. See [Events](../reference/events.md) for
the complete `WidgetEvent` shape.

### Internal events vs emitted events

The dividing line between `consumed`, `update_state`, and
`emit` is about who cares:

- **Nobody outside cares.** Hover highlights, focus state,
  internal animation ticks. Return `update_state` with the new
  state or `consumed` if nothing changes. The event never leaves
  the widget.
- **The parent cares about the semantic outcome.** "User
  selected 3 stars", "color changed to #ff00cc", "toggle
  flipped on". Return `emit` with a stable `kind` string. The
  parent matches on `kind` and ignores the plumbing.
- **The parent should see the raw event.** The widget is
  transparent to this class of events. Return `ignored`.

A sensible default for widgets that fully manage their surface
is `{ type: "consumed" }` at the end of `handleEvent`. If the
widget is meant to be transparent to most events (like a pure
layout wrapper), return `{ type: "ignored" }` at the end
instead. The `color_picker` and `theme_toggle` in
`examples/widgets/` both end with `consumed`; `star_rating`
does the same.

### Accessibility and ID conventions

`buildWidget` accepts an optional third argument that merges
accessibility metadata and `eventRate` into the top-level
rendered node:

```typescript
buildWidget(toastDef, "save-toast", { message }, {
  a11y: { role: "status", live: "polite" },
  eventRate: 30,
})
```

The widget's `view` does not need to forward these manually;
they are applied during normalization. If the view returns
`null`, the a11y metadata is dropped with the placeholder.

Inside `view`, use local IDs on children (`"label"`, `"body"`,
`"row-3"`). The runtime scopes them under the widget's ID so
the final scoped path reads top-down in the tree:
`"save-toast/label"`, not `"label/save-toast"`.

Inside `handleEvent`, you match on **local** IDs. By the time an
event reaches the widget's handler the runtime has already
peeled the widget's own scope frame off, so you compare
`event.id === "toggle"`, not `event.id === "log-card/toggle"`.
See [Scoped IDs](../reference/scoped-ids.md) for the full
scoping rules.

## Layer 3: native widgets

Some things are not expressible in layout plus canvas: a GPU
compute pass over an image buffer, a real video surface, a
platform-native text editor with IME composition and tablet
pressure. For those, reach for a native widget. The TypeScript
side declares the interface; a Rust crate implements the
renderer-side widget.

### Defining a native widget

Use `defineNativeWidget` to create a builder function, and
`nativeWidgetCommands` to generate command constructors for any
imperative ops the widget exposes:

```typescript
import { defineNativeWidget, nativeWidgetCommands } from "plushie"
import type { Command, UINode } from "plushie"

const gaugeConfig = {
  type: "gauge",
  props: {
    value: "number",
    min: "number",
    max: "number",
    color: "color",
    width: "length",
  },
  events: ["change"],
  commands: ["set_value", "reset"],
  rustCrate: "native/gauge",
} as const

const gauge = defineNativeWidget(gaugeConfig)
const gaugeCmd = nativeWidgetCommands(gaugeConfig)

// In a view:
export function Gauge(props: { id: string; value: number }): UINode {
  return gauge(props.id, { value: props.value, min: 0, max: 100 })
}

// In an update handler, nudge the renderer-side widget directly:
export function resetGauge(id: string): Command {
  return gaugeCmd["reset"]!(id)
}
```

`type` is the wire name of the widget and must match the string
the Rust crate registers. `props` declares the prop types for
validation. `events` lists the kinds the Rust widget emits, each
of which turns into an `onX` handler prop on the builder
(`"change"` becomes `onChange`). `commands` lists the imperative
command names `nativeWidgetCommands` exposes on the returned
object. `rustCrate` is the relative path from the project root
to the Rust crate that implements the widget.

### Widget metadata in Cargo.toml

The Rust crate is the source of truth for its own name and
constructor. Its `Cargo.toml` declares the widget under
`[package.metadata.plushie.widget]`:

```toml
[package]
name = "gauge"
version = "0.1.0"

[package.metadata.plushie.widget]
type_name = "gauge"
constructor = "gauge::GaugeExtension::new()"

[dependencies]
plushie_widget_sdk = "*"
```

`type_name` must match the `type` declared in the TypeScript
config. `constructor` is the Rust expression that instantiates
the widget extension. The crate implements the `PlushieWidget`
trait; see [Custom widgets](../reference/custom-widgets.md) for
the trait definition.

### Building the renderer

Native widgets require a custom renderer binary because they
ship as Rust code. Add the crate path to `plushie.config.ts`
(or `plushie.config.json`):

```typescript
export default {
  nativeWidgets: ["native/gauge"],
}
```

Then run the build from the project root:

```bash
npx plushie build
```

This shells out to `cargo plushie build`, which generates a
workspace that includes the widget crates as path dependencies,
compiles them into a `plushie-renderer` binary under
`_build/`, and leaves it there for the TypeScript app to spawn.
See [Configuration](../reference/configuration.md) for the full
list of config keys and [CLI commands](../reference/cli-commands.md)
for the build subcommand.

### Targeting a widget with `Command.widgetCommand`

Native widgets take imperative commands through
`Command.widgetCommand`:

```typescript
import { Command } from "plushie"

function update(state: Model, event: Event): [Model, Command] {
  // ...
  return [next, Command.widgetCommand("my-gauge", "set_value", { value: 42 })]
}
```

The first argument is the widget's scoped ID, the second is the
command family (any string the widget accepts), the third is
the payload. `nativeWidgetCommands` wraps exactly this call per
declared command so call sites read like `gaugeCmd["set_value"]!("my-gauge", { value: 42 })`
instead of a stringly-typed lookup.

`Command.widgetBatch` sends an array of commands in one cycle if
you need to update several instances atomically.

### When to reach for native

Native widgets are an escape hatch. They do not hot-reload
(you need a rebuild), they do not run on the JavaScript/WASM
target, and they ship with a Rust toolchain dependency in your
development environment.

Prefer composition or `WidgetDef` whenever the thing you want to
draw is expressible as layout plus canvas shapes. Canvas already
handles paths, gradients, text, transforms, hit-testing, and per
shape interactivity; it covers most data visualisations and
custom controls. Reach for native when canvas is genuinely not
the right tool: GPU compute, platform-native surfaces, or when
a profiler explicitly points at canvas drawing as a bottleneck.

See the gauge-demo crate in the plushie-demos repository for a
minimal end-to-end native widget, and the [Canvas
reference](../reference/canvas.md) for everything canvas can do
before you write Rust.

## Lifecycle

There are no explicit mount or unmount callbacks. **Tree
presence is the lifecycle.** When `buildWidget` (or a native
widget builder) adds a placeholder to the tree, the runtime
calls `init` and stores the state keyed by the widget's scoped
ID. When the placeholder disappears from the next render, the
state is discarded.

This is why IDs must be stable. A changing ID looks like an
unmount followed by a fresh mount: state resets, timers
restart, animations jump. If you build widgets inside a loop,
use the item's natural key, not the index.

Behind the scenes, `buildWidget` returns a placeholder `UINode`
tagged with metadata. During normalization the runtime looks up
the widget's stored state (or calls `init`), invokes `view`,
and replaces the placeholder with the rendered subtree.
[Composition patterns](../reference/composition-patterns.md) has
more on how widgets compose with regular view functions.

## Testing custom widgets

Widgets test the same way apps do: drive them through the public
surface (events in, UI nodes and emitted events out) with the
testing harness. The `testWith` helper wraps a widget in a
minimal app so you can click on child IDs, advance timers, and
assert on the tree:

```typescript
import { app, isWidget } from "plushie"
import { testWith } from "plushie/testing"
import { Toast } from "./toast.js"

const toastApp = app({
  init: () => ({ message: "Saved." }),
  view: (state) => <Toast id="toast" message={state.message} />,
  update: (state) => state,
})

const test = testWith(toastApp)

test("dismisses after three seconds", async ({ session }) => {
  expect(session.find("toast")).not.toBeNull()
  await session.advanceTime(3000)
  expect(session.find("toast")).toBeNull()
})
```

`session.find` returns the rendered node or `null`, so a toast
whose `view` returned `null` falls out of the tree. For widgets
that emit events, drive a child action (a click, a key press)
and read the resulting model; the emitted event runs through
the same path as any other widget event. For the full harness
API see [Testing](../reference/testing.md).

## Try it

Ideas for the pad:

- Extract the preview pane into a `PreviewPane` composition
  widget that takes the compiled `UINode` and the error string.
- Turn the sidebar into a `FileList` `WidgetDef` that owns the
  hover highlight and emits `select` and `delete` on clicks.
- Write a `Breadcrumbs` widget that renders a slash-separated
  path as clickable segments and emits `navigate` with the index.
- Add a `MiniMap` canvas widget that previews the preview tree
  as a tiny outline beside the editor.
- Ship the toast: add a `show` emit from the parent and wire
  save success into it.

---

Next: [State management](14-state-management.md)
