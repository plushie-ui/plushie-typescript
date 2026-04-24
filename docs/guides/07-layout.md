# Layout

The pad from chapter 6 works, but the layout could use some
attention. The sidebar, editor, and preview panes are functional
but not well-proportioned, and spacing is inconsistent. In this
chapter we fix that by learning Plushie's layout system.

We cover the layout containers you use every day, how sizing
works, and how spacing and alignment give the UI structure. The
full container catalog is in the
[Windows and layout reference](../reference/windows-and-layout.md)
and the complete prop tables live in the
[Built-in widgets reference](../reference/built-in-widgets.md).
Here we focus on the pieces that matter most.

## Layout containers

Plushie gives you a small set of layout containers. These are
the workhorses.

### Column

`plushie/ui` exports `Column`. Stacks children vertically, top
to bottom. The main props are `spacing` (gap between children),
`padding` (space inside), `width`, `height`, and `alignX`.

```tsx
import { Column, Text } from "plushie/ui"

<Column id="numbers" spacing={12} padding={16}>
  <Text id="one">First</Text>
  <Text id="two">Second</Text>
  <Text id="three">Third</Text>
</Column>
```

### Row

Stacks children horizontally, left to right. Same props as
`Column`, except with `alignY` instead of `alignX`. Also
supports `wrap` to flow children to the next line when they
overflow.

```tsx
import { Button, Row } from "plushie/ui"

<Row id="actions" spacing={8}>
  <Button id="a">Left</Button>
  <Button id="b">Right</Button>
</Row>
```

### Container

A single-child wrapper (it accepts multiple children, but its
job is to scope and style). Use it for visual styling
(background, border, shadow), for alignment and padding, or to
give its children a named ID scope.

```tsx
import { Container, Text } from "plushie/ui"

<Container id="card" padding={16} background="#f5f5f5">
  <Text id="content">Inside the card</Text>
</Container>
```

For the full styling vocabulary (gradients, style presets, per-
corner borders), see the
[Themes and styling reference](../reference/themes-and-styling.md).

### Scrollable

Adds scroll bars when content overflows. `direction` accepts
`"vertical"` (default), `"horizontal"`, or `"both"`. Set a fixed
`height` to constrain the scrollable area.

```tsx
import { Column, Scrollable, Text } from "plushie/ui"

<Scrollable id="list" height={300} direction="vertical">
  <Column id="items" spacing={4}>
    {state.items.map((item) => (
      <Text id={item.id}>{item.name}</Text>
    ))}
  </Column>
</Scrollable>
```

`Scrollable` also supports `autoScroll` for chat-like behaviour
where new content scrolls into view automatically. See the
[Composition patterns reference](../reference/composition-patterns.md)
for log- and feed-style recipes that lean on it.

## Sizing: fill, shrink, and fixed

Every layout-participating widget has `width` and `height` props
typed as `Length` (from `src/ui/types.ts`). A `Length` is one of:

| Value | Behaviour |
|---|---|
| `"fill"` | Take all available space |
| `"shrink"` | Take only as much as content needs |
| `{ fillPortion: n }` | Take a proportional share of available space |
| number | Exact pixel size |

Most widgets default to `"shrink"`. Layout containers grow to
fit their children.

### Fill vs shrink

In a `Row`, a `"fill"` child takes all remaining space after
`"shrink"` children are measured:

```tsx
import { Button, Row, TextInput } from "plushie/ui"

<Row id="search-bar" width="fill">
  <TextInput
    id="search"
    value={state.query}
    width="fill"
    placeholder="Search..."
  />
  <Button id="go">Go</Button>
</Row>
```

The button shrinks to fit its label. The text input fills the
rest.

### fillPortion

When multiple children use `"fill"`, they share available space
equally. For proportional splits, use the object form:

```tsx
import { Container, Row, Text } from "plushie/ui"

<Row id="layout" width="fill">
  <Container id="sidebar" width={{ fillPortion: 1 }}>
    <Text id="nav">Sidebar</Text>
  </Container>
  <Container id="main" width={{ fillPortion: 3 }}>
    <Text id="content">Main content</Text>
  </Container>
</Row>
```

The sidebar gets 1/4 of the width, the main area gets 3/4. The
numbers are relative: `{ fillPortion: 1 }` and
`{ fillPortion: 3 }` is the same ratio as `{ fillPortion: 2 }`
and `{ fillPortion: 6 }`. `"fill"` is shorthand for
`{ fillPortion: 1 }`.

`fillPortion` must be at least 1. Passing `0` or a negative
number throws at build time.

### Fixed size

A plain number means exact pixels:

```tsx
<Container id="icon" width={48} height={48}>
  <Text id="x">X</Text>
</Container>
```

Negative numbers throw.

## Spacing and padding

**Spacing** is the gap between sibling children inside a
container:

```tsx
<Column id="list" spacing={12}>
  <Text id="a">First</Text>   {/* 12px gap below */}
  <Text id="b">Second</Text>  {/* 12px gap below */}
  <Text id="c">Third</Text>   {/* no gap after the last child */}
</Column>
```

**Padding** is the space between a container's edges and its
content. `Padding` accepts four forms (see `src/ui/types.ts`):

```typescript
// Uniform: 16px on every side
padding={16}

// Vertical and horizontal: 8px top/bottom, 16px left/right
padding={[8, 16]}

// Per-side, in [top, right, bottom, left] order
padding={[16, 12, 8, 12]}

// Per-side, named; omitted sides default to 0
padding={{ top: 16, right: 12, bottom: 8, left: 12 }}
```

Use the tuple forms in examples; they are the most compact. The
object form is handy when you want to set only one or two sides
and let the rest default. Negative numbers throw.

## Alignment

`alignX` and `alignY` control how children are positioned within
a container's available space:

| Prop | Container | Values |
|---|---|---|
| `alignX` | `Column`, `Container` | `"left"` (default), `"center"`, `"right"` |
| `alignY` | `Row`, `Container` | `"top"` (default), `"center"`, `"bottom"` |

```tsx
import { Container, Text } from "plushie/ui"

<Container
  id="hero"
  width="fill"
  height={200}
  alignX="center"
  alignY="center"
>
  <Text id="centered">I am centred</Text>
</Container>
```

`Container` accepts `center: true` as a shortcut that sets both
axes at once:

```tsx
<Container id="hero" width="fill" height="fill" center>
  <Text id="centered">Centred both ways</Text>
</Container>
```

Alignment only has room to work when the container is larger
than its child. A `"shrink"` container collapses to its child's
size and leaves nothing to align against; set `width` or
`height` to `"fill"`, a `fillPortion`, or a fixed number for the
alignment to take effect.

## Max-width constraints

`maxWidth` sets an upper bound on a `"fill"` or `fillPortion`
container. Handy for keeping a reading column from stretching
too wide on a large window:

```tsx
<Container id="article" width="fill" maxWidth={720} center>
  {/* content expands with the window up to 720px, then stops */}
</Container>
```

`Column`, `Row`, `Container`, and `KeyedColumn` all accept
`maxWidth`. `Container` also accepts `maxHeight`.

## Other layout tools

These cover specialised needs. We will not reach for them in
the pad right now, but they are good to have in your pocket.

- `Stack` layers children on top of each other on the z-axis.
  Useful for overlays, badges, and loading spinners.
- `Grid` gives you a CSS-like grid. Set `numColumns` for a
  fixed column count, or `fluid: true` with `columnWidth` to
  let columns auto-wrap based on available width.
- `Pin` positions a child at exact `(x, y)` pixel coordinates
  inside a parent `Stack`.
- `Floating` applies translate and scale transforms to a child
  without affecting layout flow.
- `Responsive` lets children adapt based on available size.
- `Space` is an explicit empty spacer with configurable `width`
  and `height`. Useful for nudging items apart in a `Row` when
  `spacing` is not granular enough.
- `KeyedColumn` behaves like `Column` but diffs by each child's
  ID, which is cheaper when the list reorders frequently.

See the [Built-in widgets reference](../reference/built-in-widgets.md)
for full prop tables on each.

## Applying it: the polished pad layout

With these tools, refine the pad into a clean three-pane
layout: a fixed-width sidebar on the left, an editor and
preview that split the remaining width, a compact toolbar, and
an event log pinned to the bottom.

```tsx
import { Subscription, app, isKey, isTimer, isWidget, target } from "plushie"
import type { DeepReadonly, Event, Handler, UINode, WindowNode } from "plushie"
import {
  Button,
  Checkbox,
  Column,
  Container,
  Row,
  Scrollable,
  Text,
  TextEditor,
  TextInput,
  Window,
} from "plushie/ui"

function sidebar(state: DeepReadonly<Model>): UINode {
  return Container({
    id: "sidebar-wrap",
    width: 200,
    height: "fill",
    style: { border: { color: "#333333", width: 1 } },
    children: [
      Scrollable({
        id: "sidebar",
        height: "fill",
        children: [
          Column({
            id: "files",
            spacing: 4,
            padding: 8,
            children: state.files.map((file) => fileRow(state, file)),
          }),
        ],
      }),
    ],
  })
}

function editorPane(state: DeepReadonly<Model>): UINode {
  return TextEditor({
    id: "editor",
    value: state.source,
    width: { fillPortion: 2 },
    height: "fill",
    highlightSyntax: "javascript",
    font: "monospace",
    onInput: handleEdit,
  })
}

function previewPane(state: DeepReadonly<Model>): UINode {
  const body: UINode = state.error
    ? Text({ id: "error", color: "#ef4444", children: state.error })
    : state.preview ?? Text({ id: "placeholder", children: "Press Save to compile" })
  return Container({
    id: "preview",
    width: { fillPortion: 2 },
    height: "fill",
    padding: 16,
    children: [body],
  })
}

function toolbar(state: DeepReadonly<Model>): UINode {
  return Row({
    id: "toolbar",
    padding: [8, 4],
    spacing: 8,
    children: [
      Button({ id: "save", onClick: handleSaveClick, children: "Save" }),
      Checkbox({
        id: "auto-save",
        value: state.autoSave,
        label: "Auto-save",
        onToggle: handleAutoSaveToggle,
      }),
      TextInput({
        id: "new-name",
        value: state.newName,
        placeholder: "new_name.js",
        onInput: handleNewNameInput,
        onSubmit: true,
      }),
    ],
  })
}

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
          Text({ id: `line-${String(i)}`, size: 11, font: "monospace", children: entry }),
        ),
      }),
    ],
  })
}

function view(state: DeepReadonly<Model>): WindowNode {
  return Window({
    id: "main",
    title: "Plushie Pad",
    theme: "dark",
    children: [
      Column({
        id: "root",
        width: "fill",
        height: "fill",
        children: [
          Row({
            id: "main-row",
            width: "fill",
            height: "fill",
            children: [sidebar(state), editorPane(state), previewPane(state)],
          }),
          toolbar(state),
          eventLogPane(state),
        ],
      }),
    ],
  }) as WindowNode
}
```

(See the pad's `src/app.ts` for the full file, including the
inline handler definitions.)

The sidebar has a fixed `width: 200`, so it does not grow when
the window resizes. The editor and preview both use
`width: { fillPortion: 2 }`, giving them an equal share of the
remaining width; change one to `{ fillPortion: 3 }` and the
split becomes 3:2. The toolbar and event log shrink to their
content or their fixed height while the main row takes the
remaining vertical space. Each section owns its internal
spacing; the outer containers stay clean.

The update logic is unchanged from chapter 6.

## Common pitfalls

A few traps catch everyone once.

### The shrink root

Alignment on a container that is `"shrink"` both ways is a
no-op. The container collapses to the child and has no space
to align within. If `alignX` or `alignY` seem to do nothing,
check that the container has room to grow.

### Mixing Fill inside Shrink

A `"fill"` child inside a `"shrink"` parent resolves to the
parent's content size, not to any outer window dimension. Fill
only propagates through a chain of `"fill"` (or fixed) parents.
If your editor pane refuses to stretch, walk up the tree: one
ancestor is probably still `"shrink"`.

### Padding shorthand order

The four-tuple form is `[top, right, bottom, left]`, clockwise
from the top. It matches CSS; if you read a padding value as
`[top, bottom, left, right]` it will render wrong. When in
doubt, use the object form with named fields.

### Nested Scrollables

A `Scrollable` needs a bounded height (or width, for horizontal
scroll) to know when to overflow. Placing one inside a
`"shrink"` parent without a fixed height makes the scrollable
grow to fit its content, which defeats the point. Give the
scrollable itself a fixed `height`, or put it inside a parent
that resolves to a concrete height.

## Verify it

Check that the three-pane layout still behaves after the
restructure:

```typescript
import { testWith } from "plushie/testing"
import { padApp } from "../src/app"

const test = testWith(padApp)

test("three-pane layout", async ({ session }) => {
  await session.expectExists("#sidebar")
  await session.expectExists("#editor")
  await session.expectExists("#preview")

  await session.type("#editor", 'text({ id: "test", children: "hello" })')
  await session.click("#save")
  await session.expectText("#preview/test", "hello")
})
```

This confirms the layout did not break the editing flow. The
editor, save button, and preview pane all still work together.

## Try it

Extend the pad with a few quick experiments:

- Build a sidebar-and-content layout from a `Row` with a
  fixed-width `Column` on the left and a `"fill"` `Container`
  on the right.
- Try different `fillPortion` ratios for the editor and preview.
  Give one `3` and the other `1` to see a 3:1 split.
- Nest a `Scrollable` inside a fixed-height `Container`. Add
  enough items to trigger scrolling.
- Wrap the toolbar in a `Container` with
  `alignX: "center"` and watch the buttons centre themselves
  once the toolbar has `width: "fill"`.
- Swap the toolbar's `Row` for `wrap: true` and add enough
  buttons to overflow the window width.

In the next chapter we style the pad with themes, colours, and
per-widget styling to make it look polished.

---

Next: [Styling](08-styling.md)
