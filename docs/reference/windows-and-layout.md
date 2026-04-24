# Windows and Layout

Every Plushie app renders through one or more windows, and every
window holds a tree of layout containers. This page covers the
shared sizing and spacing primitives (`Length`, `Padding`,
alignment), the `Window` descriptor, multi-window apps, and every
layout container exported from `plushie/ui`.

```tsx
import { Window, Column, Row, Container, Text, Button } from "plushie/ui"

<Window id="main" title="My App" width={800} height={600}>
  <Column width="fill" height="fill" padding={16} spacing={8}>
    <Text size={18}>Hello</Text>
    <Row spacing={8}>
      <Button id="ok" onClick={confirm}>OK</Button>
      <Button id="cancel" onClick={cancel}>Cancel</Button>
    </Row>
  </Column>
</Window>
```

Prop names are camelCase at the call site and the SDK translates
them to snake_case on the wire (`maxWidth` becomes `max_width`,
`alignX` becomes `align_x`). The wire form appears only in the
[wire-protocol reference](wire-protocol.md); use camelCase
everywhere in TypeScript code.

## Sizing with Length

The `Length` type from `plushie/ui` controls how much space a
widget occupies on one axis. Every layout container exposes
`width` and `height` props typed as `Length`:

| Value | Behaviour |
|---|---|
| `number` | Exact pixel size. Must be non-negative. |
| `"shrink"` | Take only as much space as the content needs. |
| `"fill"` | Take available space in the parent (shorthand for `{ fillPortion: 1 }`). |
| `{ fillPortion: n }` | Take a proportional share of available space. `n` must be at least 1. |

```typescript
import type { Length } from "plushie/ui"

const widths: Length[] = [200, "fill", "shrink", { fillPortion: 3 }]
```

Negative numbers or `fillPortion` values below 1 throw at build
time; the error points at the widget that produced the bad
value.

### How fillPortion divides space

When multiple siblings use `"fill"` or `{ fillPortion: n }`, the
space left after fixed-size and `"shrink"` siblings are measured
splits by the weights:

```tsx
<Row width="fill">
  <Container width={{ fillPortion: 1 }}>Sidebar</Container>
  <Container width={{ fillPortion: 3 }}>Main</Container>
</Row>
```

Sidebar takes a quarter, main takes three quarters. The weights
are relative; `fillPortion: 1` plus `fillPortion: 3` is the same
ratio as `fillPortion: 2` plus `fillPortion: 6`. Two `"fill"`
siblings split evenly.

### Resolution order and constraints

The renderer resolves siblings in this order: fixed pixel
children are measured first, `"shrink"` children next at their
intrinsic content size, then `"fill"` and `{ fillPortion: n }`
children divide the remaining space by weight. A fixed-width
sidebar always gets its pixels, a shrinkable toolbar takes only
what it needs, and the filling content area expands into
whatever is left.

`maxWidth` and `maxHeight` (pixels) cap a dimension. A filling
child with `maxWidth: 600` expands to fill but never grows past
600 pixels. `Column`, `Row`, `Container`, and `KeyedColumn`
expose `maxWidth`; `Container` also exposes `maxHeight`.

## Padding

The `Padding` type accepts several shorthand forms. All of them
normalize to per-side values before hitting the wire:

| Input | Result |
|---|---|
| `16` | 16px on all sides |
| `[8, 16]` | 8px top/bottom, 16px left/right |
| `[8, 16, 8, 12]` | `[top, right, bottom, left]` |
| `{ top: 16, bottom: 8 }` | Per-side object; unset sides default to 0 |

Prefer the tuple forms in examples; they are compact and read
naturally:

```tsx
<Container padding={[16, 24]}>
  <Text>Vertical 16, horizontal 24</Text>
</Container>
```

Uniform four-sided padding collapses to a single number on the
wire. Negative values throw at encode time. Padding reduces the
content area inside a container (a 200-pixel column with
`padding: 16` has 168 pixels of content width); padding and
spacing are independent.

## Spacing

`spacing` is the pixel gap between sibling children. It applies
to `Column`, `Row`, `Grid`, `KeyedColumn`, and `Scrollable`:

```tsx
<Column spacing={12}>
  <Text>First</Text>   {/* 12px gap below */}
  <Text>Second</Text>
  <Text>Third</Text>   {/* no gap after last child */}
</Column>
```

Spacing applies between children only, never before the first or
after the last.

## Alignment

Alignment controls how children sit within their container's
available space. `AlignX` is `"left" | "center" | "right"`,
`AlignY` is `"top" | "center" | "bottom"`, and `Alignment` is
their union (used by shared helpers that accept either axis).

| Prop | Container | Values |
|---|---|---|
| `alignX` | `Column`, `Container` | `"left"` (default), `"center"`, `"right"` |
| `alignY` | `Row`, `Container` | `"top"` (default), `"center"`, `"bottom"` |
| `align` | `Overlay` | Any `Alignment`, cross-axis of `position` |

`Column` aligns children horizontally (they already stack
vertically); `Row` aligns them vertically. `Container` supports
both axes since it wraps a single child. The `center: true`
shorthand on `Container` sets both `alignX: "center"` and
`alignY: "center"`.

## Window

`Window` is the top-level container. Every `view` function must
return a `WindowNode`, a list of `WindowNode`, or `null`. Any
non-window root or intermediate type causes the runtime to
throw.

```tsx
<Window id="main" title="Editor" width={1024} height={768} theme="dark">
  <Column width="fill" height="fill" padding={16}>
    <Text>Editor body</Text>
  </Column>
</Window>
```

### WindowProps

| Prop | Type | Description |
|---|---|---|
| `id` | `string` | Required. Stable identifier; a changing id triggers close and re-open. |
| `title` | `string` | Title bar text. |
| `size` | `[number, number]` | Initial size as `[width, height]` in logical pixels. |
| `width` | `number` | Width alternative to `size`. |
| `height` | `number` | Height alternative to `size`. |
| `position` | `[number, number]` | Initial `[x, y]` position. |
| `minSize` | `[number, number]` | Minimum dimensions. |
| `maxSize` | `[number, number]` | Maximum dimensions. |
| `maximized` | `boolean` | Start maximized. |
| `fullscreen` | `boolean` | Start fullscreen. |
| `visible` | `boolean` | Whether the window is visible. |
| `resizable` | `boolean` | Allow the user to resize by dragging edges. |
| `closeable` | `boolean` | Show a close button. |
| `minimizable` | `boolean` | Allow minimizing. |
| `decorations` | `boolean` | Show OS title bar and borders. |
| `transparent` | `boolean` | Transparent window background. |
| `blur` | `boolean` | Apply a blur effect to the background. |
| `level` | `"normal" \| "always_on_top" \| "always_on_bottom"` | Stacking level. |
| `exitOnCloseRequest` | `boolean` | When the user closes this window, exit the app. |
| `scaleFactor` | `number` | DPI scale override. |
| `padding` | `number` | Uniform padding inside the window in pixels. |
| `theme` | `Theme` | Per-window theme (see [Themes and styling](themes-and-styling.md)). |
| `a11y` | `A11y` | Accessibility overrides. |

The `window()` function form takes the id positionally:

```typescript
import { window, column, text } from "plushie/ui"

window("main", { title: "Editor", width: 1024, height: 768 }, [
  column({ padding: 16 }, [text("Editor body")]),
])
```

### Windows and scoped IDs

Windows do not add a scoped-ID prefix by themselves; the window
`id` appears as the `windowId` field on every widget event and
as the prefix before `#` in fully qualified paths
(`"main#form/email"`). Handlers registered inside a window only
match events from that window, so a button with id `"save"` in
`"main"` cannot be triggered by a same-id button in
`"settings"`. See [Scoped IDs](scoped-ids.md) for the full scope
grammar.

## Multi-window apps

The `view` function may return a single `WindowNode`, a list of
window nodes, or `null`:

```typescript
import type { AppView } from "plushie"

function view(state: DeepReadonly<Model>): AppView {
  return [
    <Window id="main" title="App">
      {mainContent(state)}
    </Window>,
    state.showSettings
      ? <Window id="settings" title="Settings" exitOnCloseRequest={false}>
          {settingsContent(state)}
        </Window>
      : null,
  ].filter(Boolean) as AppView
}
```

The runtime diffs the returned list against the previously open
windows on every view pass. A new id triggers `window_open` with
the current props, a disappearing id triggers `window_close`
(the OS window goes away, the model stays intact), and a
surviving id with changed props triggers `window_update`.

`exitOnCloseRequest: false` on secondary windows is idiomatic:
the user dismisses the panel without killing the app. The
primary window typically keeps the default.

For props shared across every window (theme, scale factor), set
the `windowConfig` callback on the app config. The runtime
merges `windowConfig(model)` with per-window props at sync time,
with window-node props winning on collision:

```typescript
app<Model>({
  init,
  update,
  view,
  windowConfig: (state) => ({ theme: state.theme }),
})
```

## Layout containers

### Column

Arranges children vertically, top to bottom.

| Prop | Type | Description |
|---|---|---|
| `spacing` | `number` | Vertical gap between children. |
| `padding` | `Padding` | Inner padding. |
| `width` | `Length` | Column width. |
| `height` | `Length` | Column height. |
| `maxWidth` | `number` | Maximum width in pixels. |
| `alignX` | `AlignX` | Horizontal alignment of children. |
| `clip` | `boolean` | Clip overflowing children. |
| `wrap` | `boolean` | Wrap to a new column when height is exceeded. |
| `a11y` | `A11y` | Accessibility overrides. |
| `eventRate` | `number` | Max events per second for coalescable events. |

`wrap: true` produces multi-column flow (similar to vertical
CSS `flex-wrap`).

### Row

Arranges children horizontally, left to right.

| Prop | Type | Description |
|---|---|---|
| `spacing` | `number` | Horizontal gap between children. |
| `padding` | `Padding` | Inner padding. |
| `width` | `Length` | Row width. |
| `height` | `Length` | Row height. |
| `maxWidth` | `number` | Maximum width in pixels. |
| `alignY` | `AlignY` | Vertical alignment of children. |
| `clip` | `boolean` | Clip overflowing children. |
| `wrap` | `boolean` | Wrap to a new row when width is exceeded. |
| `a11y` | `A11y` | Accessibility overrides. |
| `eventRate` | `number` | Max events per second for coalescable events. |

`wrap: true` suits tag clouds, toolbars, or content that should
reflow at narrower widths.

### Container

Single-child wrapper for styling, scoping, and alignment.

| Prop | Type | Description |
|---|---|---|
| `padding` | `Padding` | Inner padding. |
| `width` | `Length` | Container width. |
| `height` | `Length` | Container height. |
| `maxWidth` | `number` | Maximum width. |
| `maxHeight` | `number` | Maximum height. |
| `center` | `boolean` | Centre the child on both axes. |
| `clip` | `boolean` | Clip the child when it overflows. |
| `alignX` | `AlignX` | Horizontal child alignment. |
| `alignY` | `AlignY` | Vertical child alignment. |
| `background` | `Color \| Gradient` | Background fill. |
| `color` | `Color` | Text colour propagated to descendants. |
| `border` | `Border` | Border specification. |
| `shadow` | `Shadow` | Drop shadow. |
| `style` | `StyleMap` | Named preset or full style map. |
| `a11y` | `A11y` | Accessibility overrides. |
| `eventRate` | `number` | Max events per second for coalescable events. |

Container styles (background, border, shadow, text colour),
scopes (a named container creates an ID scope for its
children), and aligns its single child. Pass a string to
`style` for a preset like `"primary"`, `"danger"`, or
`"rounded_box"`; pass a full `StyleMap` object for custom
foreground and background plus hover/press/focus overrides.

### Scrollable

Wraps a subtree in a scrollable viewport. The renderer tracks
scroll position as internal state, so `Scrollable` needs a
stable `id`.

| Prop | Type | Description |
|---|---|---|
| `width` | `Length` | Viewport width. |
| `height` | `Length` | Viewport height. |
| `direction` | `"horizontal" \| "vertical" \| "both"` | Scroll direction. |
| `spacing` | `number` | Gap between scrollbar and content. |
| `scrollbarWidth` | `number` | Scrollbar track width. |
| `scrollbarMargin` | `number` | Margin around the scrollbar. |
| `scrollerWidth` | `number` | Scroller handle width. |
| `scrollbarColor` | `Color` | Scrollbar track colour. |
| `scrollerColor` | `Color` | Scroller thumb colour. |
| `anchor` | `"start" \| "end"` | Scroll anchor position. |
| `autoScroll` | `boolean` | Auto-scroll to keep new content visible. |
| `onScroll` | `Handler \| boolean` | Handler or flag for viewport scroll events. |
| `a11y` | `A11y` | Accessibility overrides. |
| `eventRate` | `number` | Max events per second for coalescable events. |

`autoScroll: true` plus `anchor: "end"` is the chat-window
combination: the viewport starts scrolled to the bottom and
follows new messages as they arrive.

`onScroll` accepts a handler function or a plain boolean. A
function registers an inline handler and enables the wire flag
automatically; `true` fires `scrolled` events that reach
`update` without an inline handler. `event.data` carries
`absolute_x`, `absolute_y`, `relative_x`, and `relative_y`: the
viewport offset in absolute pixels and as a 0 to 1 fraction of
the scrollable content.

```typescript
import { isScrolled } from "plushie"

if (isScrolled(event, "history")) {
  return { ...state, atBottom: event.data.relative_y >= 0.99 }
}
```

### KeyedColumn

Like `Column`, but children are diffed by `id` instead of
position. Use it for lists that may reorder: inserting at the
top of a plain `Column` shifts every child's widget state down
by one slot and loses focus and scroll; `KeyedColumn` matches
by id and preserves it.

| Prop | Type | Description |
|---|---|---|
| `spacing` | `number` | Vertical gap between children. |
| `padding` | `Padding` | Inner padding. |
| `width` | `Length` | Column width. |
| `height` | `Length` | Column height. |
| `maxWidth` | `number` | Maximum width in pixels. |
| `a11y` | `A11y` | Accessibility overrides. |

### Stack

Layers children along the z-axis. The first child renders at
the back, the last at the front.

| Prop | Type | Description |
|---|---|---|
| `width` | `Length` | Stack width. |
| `height` | `Length` | Stack height. |
| `clip` | `boolean` | Clip overflowing children. |
| `a11y` | `A11y` | Accessibility overrides. |

Use `Stack` for overlays, badges, or spinners layered over
other widgets.

### Grid

Arranges children in a grid.

| Prop | Type | Description |
|---|---|---|
| `numColumns` | `number` | Fixed number of columns. |
| `spacing` | `number` | Gap between cells. |
| `width` | `Length` | Grid width. |
| `height` | `Length` | Grid height. |
| `columnWidth` | `number` | Fixed width per column. |
| `rowHeight` | `number` | Fixed height per row. |
| `fluid` | `boolean` | Auto-wrap columns based on cell width. |
| `a11y` | `A11y` | Accessibility overrides. |

Pick either fixed-columns mode (`numColumns: 3`) or fluid mode
(`fluid: true` plus `columnWidth`); mixing the two is ambiguous.

### Space

Invisible spacer. No children, no visual output; just occupies
its `width` and `height`.

| Prop | Type | Description |
|---|---|---|
| `width` | `Length` | Space width. |
| `height` | `Length` | Space height. |
| `a11y` | `A11y` | Accessibility overrides. |

Use `Space` for explicit gaps, alignment tricks, or pushing
siblings apart in a row or column when `spacing` does not fit
the layout.

### Rule

Horizontal or vertical divider line.

| Prop | Type | Description |
|---|---|---|
| `direction` | `"horizontal" \| "vertical"` | Line orientation. |
| `width` | `number` | Width in pixels. |
| `height` | `number` | Height in pixels. |
| `thickness` | `number` | Line thickness. |
| `style` | `StyleMap` | Preset or style map. |
| `a11y` | `A11y` | Accessibility overrides. |

## Positioning

The positioning widgets sit on top of normal flow layout. They
let you escape the default measuring pass or transform what gets
drawn.

### Pin

Positions a single child at absolute `(x, y)` coordinates. Pin
does not participate in flow layout and is typically nested
inside a `Stack` so the coordinates make sense relative to the
stack's bounds. `x` and `y` accept animation descriptors from
`transition()`, `spring()`, or `sequence()` so positions can be
animated without manual tweening.

| Prop | Type | Description |
|---|---|---|
| `x` | `number \| AnimationDescriptor` | X position in pixels. |
| `y` | `number \| AnimationDescriptor` | Y position in pixels. |
| `width` | `Length` | Pin container width. |
| `height` | `Length` | Pin container height. |
| `a11y` | `A11y` | Accessibility overrides. |

### Floating

Applies a translate and optional scale transform to a child.
Unlike `Pin`, `Floating` keeps the child in flow: it still
occupies its original measured space, and the transform is
visual only (think CSS `transform: translate() scale()` without
`position: absolute`).

| Prop | Type | Description |
|---|---|---|
| `translateX` | `number` | Horizontal translation. |
| `translateY` | `number` | Vertical translation. |
| `scale` | `number` | Scale factor. |
| `width` | `Length` | Container width. |
| `height` | `Length` | Container height. |
| `a11y` | `A11y` | Accessibility overrides. |

### Overlay

Positions its second child as a floating overlay relative to
its first. Exactly two children (anchor, overlay).

| Prop | Type | Description |
|---|---|---|
| `position` | `"below" \| "above" \| "left" \| "right"` | Overlay side. |
| `gap` | `number` | Gap between the anchor and the overlay. |
| `offsetX` | `number` | Horizontal offset. |
| `offsetY` | `number` | Vertical offset. |
| `flip` | `boolean` | Flip to the opposite side on viewport overflow. |
| `align` | `Alignment` | Cross-axis alignment relative to the anchor. |
| `width` | `Length` | Overlay container width. |
| `a11y` | `A11y` | Accessibility overrides. |

```tsx
<Overlay position="below" gap={4} flip>
  <Button id="menu-trigger" onClick={openMenu}>Menu</Button>
  <Container style="rounded_box" padding={8}>
    <Text>Dropdown content</Text>
  </Container>
</Overlay>
```

### Responsive

Adapts its subtree based on available size. The widget emits a
`resize` event whenever its measured size changes; the next
`view` pass can branch on the stored size.

| Prop | Type | Description |
|---|---|---|
| `width` | `Length` | Container width. |
| `height` | `Length` | Container height. |
| `a11y` | `A11y` | Accessibility overrides. |

```typescript
import { isResize } from "plushie"

if (isResize(event, "shell")) {
  const { width, height } = event.data
  return { ...state, viewport: { width, height } }
}
```

The `resize` event is coalesced to one per frame, so switching
layouts (collapsing a sidebar below a threshold width, for
instance) does not fire on every pixel change.

## Handler props that affect layout

Most layout containers emit no events. A few feed back into the
app:

| Widget | Handler / flag | Event type |
|---|---|---|
| `Scrollable` | `onScroll` | `scrolled` (with `ScrolledData`) |
| `Responsive` | implicit | `resize` (with `ResizeData`) |
| `Sensor` | `onResize` | `resize` (with `ResizeData`) |
| `Window` | implicit | Window lifecycle (`opened`, `closed`, `resized`, `moved`, `focused`, ...) |

Window lifecycle events arrive through `update(state, event)`.
Use the `isWindow` guard from `plushie` to narrow, or subscribe
to specific signals via `Subscription.onWindowResize` /
`onWindowClose` (see [Subscriptions](subscriptions.md)).

## Composition recipes

### Sidebar plus content

```tsx
<Row width="fill" height="fill">
  <Column id="sidebar" width={200} height="fill" padding={8}>
    {sidebarItems}
  </Column>
  <Container id="main" width="fill" height="fill" padding={16}>
    {mainContent}
  </Container>
</Row>
```

The sidebar takes a fixed 200 pixels; `main` fills the rest.

### Header, body, footer

Header and footer shrink to their content; the body fills the
remaining vertical space.

```tsx
<Column width="fill" height="fill">
  <Row padding={8}>{header}</Row>
  <Container id="body" width="fill" height="fill">{body}</Container>
  <Row padding={8}>{footer}</Row>
</Column>
```

### Centred content

`center` is shorthand for `alignX: "center"` plus `alignY: "center"`.

```tsx
<Container width="fill" height="fill" center>
  <Text>Centred on both axes</Text>
</Container>
```

### Scrollable list

`KeyedColumn` preserves widget state when the list reorders;
`Scrollable` bounds the height so the content scrolls instead
of the page.

```tsx
<Scrollable id="items" height={400}>
  <KeyedColumn spacing={4}>
    {items.map((item) => (
      <Container id={item.id} padding={8}>
        <Text>{item.name}</Text>
      </Container>
    ))}
  </KeyedColumn>
</Scrollable>
```

### Split panes with weighted fill

Left takes one third, right takes two thirds. Swap in
`PaneGrid` if the user should be able to drag the divider.

```tsx
<Row width="fill" height="fill" spacing={4}>
  <Container width={{ fillPortion: 1 }} height="fill">{leftPane}</Container>
  <Rule direction="vertical" />
  <Container width={{ fillPortion: 2 }} height="fill">{rightPane}</Container>
</Row>
```

### Overlay badge on an icon

`Stack` layers the badge on top of the image; `Pin` places it
at the top right.

```tsx
<Stack>
  <Image src="/avatar.png" />
  <Pin x={28} y={0}>
    <Container style="danger" padding={[2, 6]}>
      <Text size={10}>NEW</Text>
    </Container>
  </Pin>
</Stack>
```

## See also

- [Built-in Widgets reference](built-in-widgets.md)
- [Events reference](events.md)
- [Scoped IDs reference](scoped-ids.md)
- [Themes and styling reference](themes-and-styling.md)
- [Subscriptions reference](subscriptions.md)
