# Built-in Widgets

All built-in widgets are available via two interchangeable surfaces
from `plushie/ui`: a PascalCase JSX component and a camelCase
function. The two produce the same tree node and can be mixed
freely.

```tsx
import { Button, Column, Text } from "plushie/ui"

<Column id="root" padding={16} spacing={8}>
  <Text size={18}>Hello</Text>
  <Button id="save" onClick={save}>Save</Button>
</Column>
```

```typescript
import { button, column, text } from "plushie/ui"

column({ id: "root", padding: 16, spacing: 8 }, [
  text("Hello", { size: 18 }),
  button("save", "Save", { onClick: save }),
])
```

Prop names use camelCase at the call site (`eventRate`,
`onClick`, `alignX`) and are translated to snake_case on the wire
(`event_rate`, `on_click`, `align_x`). The translation is per
widget; the full wire shape is documented in the
[wire-protocol reference](wire-protocol.md).

Auto-generated IDs are supplied for stateless widgets that omit
`id`. Stateful widgets (`TextInput`, `TextEditor`) require an
explicit ID; reusing an auto-ID across renders would drop cursor
and scroll position. All examples below show explicit IDs.

## Widget catalog

### Layout

| JSX component | Function | Module |
|---|---|---|
| `Window` | `window` | `plushie/ui/widgets/window` |
| `Column` | `column` | `plushie/ui/widgets/column` |
| `Row` | `row` | `plushie/ui/widgets/row` |
| `Container` | `container` | `plushie/ui/widgets/container` |
| `Scrollable` | `scrollable` | `plushie/ui/widgets/scrollable` |
| `Stack` | `stack` | `plushie/ui/widgets/stack` |
| `Grid` | `grid` | `plushie/ui/widgets/grid` |
| `KeyedColumn` | `keyedColumn` | `plushie/ui/widgets/keyed_column` |
| `Responsive` | `responsive` | `plushie/ui/widgets/responsive` |
| `Pin` | `pin` | `plushie/ui/widgets/pin` |
| `Floating` | `floating` | `plushie/ui/widgets/floating` |
| `Space` | `space` | `plushie/ui/widgets/space` |

Full prop tables for layout containers are in the
[Layout reference](windows-and-layout.md).

### Input

| JSX component | Function | Widget events |
|---|---|---|
| `Button` | `button` | `click` |
| `TextInput` | `textInput` | `input`, `submit`, `paste` |
| `TextEditor` | `textEditor` | `input` |
| `Checkbox` | `checkbox` | `toggle` |
| `Toggler` | `toggler` | `toggle` |
| `Radio` | `radio` | `select` |
| `Slider` | `slider` | `slide`, `slide_release` |
| `VerticalSlider` | `verticalSlider` | `slide`, `slide_release` |
| `PickList` | `pickList` | `select`, `open`, `close` |
| `ComboBox` | `comboBox` | `input`, `select`, `open`, `close` |

Every widget interaction delivers an `Event` with `kind: "widget"`
and a typed `type` field matching the event name above. Type
guards (`isClick`, `isInput`, `isSubmit`, ...) live in `plushie`;
see the [Events reference](events.md) for the full taxonomy.

Widgets accept handler props (`onClick`, `onInput`, `onToggle`,
`onSelect`, `onSlide`, `onSubmit`, `onPaste`) that take a pure
function `(state, event) => newState`. Events not caught by an
inline handler fall through to `app.update(state, event)` if
configured.

**Button** is the simplest interactive widget. The label is the
JSX child or the `label` argument to the function form.

```tsx
<Button id="save" onClick={save} style="primary">Save</Button>
```

```typescript
button("save", "Save", { onClick: save, style: "primary" })
```

**TextInput** is a single-line editable field. `value` is always
controlled by the model. `onInput` fires on every keystroke with
the full text; `onSubmit` fires on Enter; `onPaste` fires on
paste. `onSubmit` and `onPaste` accept either a handler function
or a boolean to enable wire delivery without installing a local
handler.

```tsx
<TextInput
  id="email"
  value={state.email}
  placeholder="Email"
  onInput={(s, e) => ({ ...s, email: e.value })}
  onSubmit={submit}
/>
```

The `validation` prop accepts `"valid"`, `"pending"`, or
`["invalid", message]`. Validation state flows into `a11y.invalid`
and `a11y.error_message` automatically; see
[Accessibility](accessibility.md).

**TextEditor** is a multi-line editable area. It holds
renderer-side state (cursor, selection, scroll), so the ID must
be stable across renders.

**Checkbox** and **Toggler** are boolean toggles. Both emit
`toggle` with the new value. `Checkbox` shows a box; `Toggler`
shows a switch. The boolean state prop is `value`:

```tsx
<Checkbox id="notify" value={state.notify} label="Notify me"
  onToggle={(s, e) => ({ ...s, notify: e.value })} />
```

**Radio** is a one-of-many selection. `value` is the option this
radio represents; `selected` is the currently selected value
(string or `null`). The radio is checked when `selected === value`.

```tsx
<Radio id="small" value="s" selected={state.size}
  label="Small" onSelect={(s) => ({ ...s, size: "s" })} />
```

**Slider** / **VerticalSlider** take a numeric `value`, `min`,
and `max`. `onSlide` fires continuously while dragging with the
current value; `onSlideRelease` fires once when the drag ends.

```tsx
<Slider id="vol" min={0} max={100} value={state.volume} step={1}
  onSlide={(s, e) => ({ ...s, volume: e.value })} />
```

**PickList** is a dropdown. `options` is an array; `selected` is
the current choice. Emits `select` with the chosen option,
`open` when the dropdown opens, `close` when it closes.

**ComboBox** is a searchable dropdown. Holds renderer-side state
(search text, open state). Emits `input` while the user types and
`select` when an option is chosen.

### Display

| JSX component | Function | Description |
|---|---|---|
| `Text` | `text` | Static text display |
| `RichText` | `richText` | Styled text with per-span formatting |
| `Rule` | `rule` | Horizontal or vertical divider |
| `ProgressBar` | `progressBar` | Progress indicator |
| `Tooltip` | `tooltip` | Popup tip on hover |
| `Image` | `image` | Raster image from file path or handle |
| `Svg` | `svg` | Vector image from SVG file |
| `QrCode` | `qrCode` | QR code from a data string |
| `Markdown` | `markdown` | Rendered markdown |
| `Canvas` | `canvas` | Drawing surface with named layers |

**Text** renders static text content. Key props: `size`, `color`,
`font`, `lineHeight`, `alignX`, `alignY`, `wrapping`, `shaping`,
`ellipsis`, `style`.

```tsx
<Text id="title" size={24} color="#1e40af" font="monospace"
  wrapping="word">Hello</Text>
```

The JSX child (or the function's `content` argument) is the
visible string. `wrapping` accepts `"none"`, `"word"`, `"glyph"`,
or `"word_or_glyph"`. `shaping` is `"basic"` or `"advanced"`.

**RichText** displays styled text with per-span formatting. Each
span is a `Span` object; build them with `encodeSpan` or construct
the object literal directly.

```tsx
import { RichText } from "plushie/ui"

<RichText id="greeting" spans={[
  { text: "Hello, ", size: 16 },
  { text: "world", size: 16, color: "#3b82f6", underline: true },
  { text: "!", size: 16 },
]} />
```

A span with a `link` field becomes clickable; clicking it emits
`link_click` with the link value as `event.link`.

**Tooltip** wraps a child widget. The child is the anchor; the
`tip` prop is the tooltip content.

```tsx
<Tooltip id="tip" tip="Save your work" position="top">
  <Button id="save" onClick={save}>Save</Button>
</Tooltip>
```

**Image** renders a raster image. Two source modes:

- **Path-based** (preferred): the `src` prop is a file path. The
  renderer loads the file directly; no wire transfer.
- **Handle-based**: pass `{ handle: "avatar" }` as `src`, where
  `"avatar"` was previously registered via
  `Command.createImage("avatar", pngBytes)` or
  `Command.createImageRgba("avatar", w, h, rgba)`.

```tsx
<Image id="photo" src="images/photo.png" contentFit="cover"
  width={240} height={180} />
```

Handle-based images send the entire payload over the wire in one
message, which blocks other protocol traffic for large payloads.
Prefer path-based loading when the file exists on disk. See
[Commands](commands.md) for the image lifecycle constructors.

**QrCode** renders a QR code. `data` is the encoded string.

**Markdown** renders a markdown string. Use `linkHandler` (or the
`link_click` event on the update path) to handle link clicks.

**Canvas** contains named layers of shapes. See the
[Canvas reference](canvas.md).

### Table

`plushie/ui/widgets/table`

Displays structured data in rows and columns with sortable headers
and optional separators. Rows are real tree children, so adding,
removing, or reordering rows produces minimal wire patches (LIS
diffing) instead of re-sending the entire dataset.

Two row-construction paths are supported. Use the `rows` prop for
simple text-only tables, or `tableRow`/`tableCell` children for
rich cells containing arbitrary widgets. The two are mutually
exclusive.

#### Simple text-only rows

```tsx
import { Table } from "plushie/ui"

<Table id="users"
  columns={[
    { key: "name", label: "Name", sortable: true },
    { key: "email", label: "Email" },
  ]}
  rows={[
    { name: "Ada", email: "ada@example.com" },
    { name: "Grace", email: "grace@example.com" },
  ]}
  sortBy="name"
  sortOrder="asc"
  onSort={handleSort}
/>
```

#### Rich cells

```tsx
import { Table, tableRow, tableCell, Text, ProgressBar, Button } from "plushie/ui"

<Table id="users"
  columns={[
    { key: "name", label: "Name" },
    { key: "progress", label: "Progress" },
    { key: "actions", label: "" },
  ]}>
  {state.users.map((user) =>
    tableRow(user.id, [
      tableCell(`${user.id}-name`, "name", [<Text>{user.name}</Text>]),
      tableCell(`${user.id}-prog`, "progress", [
        <ProgressBar id={`${user.id}-bar`} value={user.progress} min={0} max={100} />,
      ]),
      tableCell(`${user.id}-act`, "actions", [
        <Button id={`${user.id}-del`} onClick={(s) => deleteUser(s, user.id)}>Delete</Button>,
      ]),
    ]),
  )}
</Table>
```

#### Columns

Column definitions are plain objects with `key` and `label`
required fields. Optional fields:

| Field | Type | Description |
|---|---|---|
| `sortable` | `boolean` | Header clickable for sort |
| `width` | `Length` | Column width |
| `align` | `"left" \| "center" \| "right"` | Cell alignment |

#### Sorting

Set `sortable: true` on a column to make its header clickable.
Clicking emits `sort` with the column key. The table displays the
sort indicator but does not reorder rows; sort in your model.

```typescript
function handleSort(state, event) {
  const col = event.value
  const order = state.sortBy === col && state.sortOrder === "asc" ? "desc" : "asc"
  return { ...state, users: sortBy(state.users, col, order), sortBy: col, sortOrder: order }
}
```

#### Props

| Prop | Type | Description |
|---|---|---|
| `columns` | `TableColumn[]` | Column definitions |
| `rows` | `Record<string, unknown>[]` | Data shorthand |
| `header` | `boolean` | Show header row (default `true`) |
| `separator` | `boolean` | Draw row separators |
| `separatorThickness` | `number` | Divider thickness in pixels |
| `separatorColor` | `Color` | Divider colour |
| `sortBy` | `string` | Currently sorted column key |
| `sortOrder` | `"asc" \| "desc"` | Sort direction |
| `width` | `Length` | Table width |
| `height` | `Length` | Table height (scrollable when set) |
| `padding` | `Padding` | Cell internal padding |
| `headerTextSize` | `number` | Header font size |
| `rowTextSize` | `number` | Body font size (data shorthand) |
| `cellSpacing` | `number` | Horizontal spacing between cells |
| `rowSpacing` | `number` | Vertical spacing between rows |
| `onSort` | `Handler` | Sort event handler |

### Pane grid

`plushie/ui/widgets/pane_grid`

Resizable tiled pane layout. Children are keyed by their node ID
and rendered as individual panes. The renderer manages internal
pane sizes and arrangement, persisted across re-renders by the
widget's ID.

```tsx
import { PaneGrid, TextEditor } from "plushie/ui"

<PaneGrid id="editor"
  panes={["left", "right"]}
  spacing={2}
  onPaneResized={handleResize}>
  <TextEditor id="left" value={state.left} onInput={updateLeft} />
  <TextEditor id="right" value={state.right} onInput={updateRight} />
</PaneGrid>
```

Key props: `panes` (string array of pane IDs, in order), `spacing`
(gap between panes, pixels), `dragAndDrop` (enable dragging panes
to reorder), handlers `onPaneResized`, `onPaneDragged`,
`onPaneClicked`, `onPaneFocusCycle`.

The pane grid emits scoped events: `event.scope` is the pane ID,
`event.id` is `"pane_grid"`. Use the [Scoped IDs reference](scoped-ids.md)
for the matching conventions.

### Responsive

`plushie/ui/widgets/responsive`

Reports viewport size to the app via a `resize` event and accepts
a viewport-keyed children map for breakpoint-based layouts.

```tsx
<Responsive id="layout" onResize={handleResize}>
  <Column spacing={8}>...</Column>
</Responsive>
```

The initial render does not know the viewport, so supply a
sensible default child; the first `resize` event arrives after
layout.

### Pointer area

`plushie/ui/widgets/pointer_area`

Captures pointer events over a transparent region without visible
styling.

```tsx
<PointerArea id="target"
  onPress={handlePress}
  onRelease={handleRelease}
  onMove={handleMove}>
  <Text>Hover me</Text>
</PointerArea>
```

Handler props: `onPress`, `onRelease`, `onMove`, `onScroll`,
`onEnter`, `onExit`. Events carry `x`, `y`, `button`, and
`modifiers` in the `event.data` field; see
[Events](events.md#pointer).

### Sensor

`plushie/ui/widgets/sensor`

Emits lifecycle events for its subtree: resize, focus, blur.
Useful for tying subscriptions to the mount/unmount of a
particular subtree.

```tsx
<Sensor id="panel"
  onResize={(s, e) => ({ ...s, width: e.data.width })}
  onFocused={handleFocus}
  onBlurred={handleBlur}>
  <Column>...</Column>
</Sensor>
```

### Pin and Floating

`Pin` positions its child at absolute coordinates inside the
parent. `Floating` applies a transform (translate, scale) to its
child without affecting layout.

```tsx
<Pin id="badge" x={10} y={10}>
  <Text size={10} color="#ef4444">new</Text>
</Pin>

<Floating id="overlay" offset={{ x: 8, y: 8 }} anchor="top_right">
  <Text>Floating tip</Text>
</Floating>
```

### Overlay

`plushie/ui/widgets/overlay`

Positions children over the rest of the view. Used for modals,
popovers, and anchored dialogs.

```tsx
<Overlay id="modal" anchor="center" closeOnBlur={true}>
  <Container padding={24} style={{ background: "#ffffff" }}>
    <Text>Are you sure?</Text>
    <Row spacing={8}>
      <Button id="confirm" onClick={confirm}>Confirm</Button>
      <Button id="cancel" onClick={cancel}>Cancel</Button>
    </Row>
  </Container>
</Overlay>
```

### Themer

`plushie/ui/widgets/themer`

Applies a theme scope to its subtree, overriding the app-level
theme.

```tsx
<Themer theme="dark">
  <Column>...</Column>
</Themer>
```

See [Themes and Styling](themes-and-styling.md) for the theme
format.

### Rule and Space

Dividers and invisible spacers.

```tsx
<Rule direction="horizontal" />
<Space width="fill" />
<Space height={16} />
```

### KeyedColumn

Like `Column`, but accepts a keyed child list. Use when children
are dynamically generated (for instance from model data) and you
want stable diffing across reorders.

```tsx
<KeyedColumn id="list" spacing={8}>
  {state.items.map((item) => ({ key: item.id, node: <Row>...</Row> }))}
</KeyedColumn>
```

The function form accepts `{ key, node }` objects directly:

```typescript
keyedColumn({ id: "list", spacing: 8 },
  state.items.map((item) => ({ key: item.id, node: row([...]) })))
```

## Length, Padding, and Color props

Several widgets share prop types for size, padding, and color.

**Length** is accepted on `width`, `height`, `minWidth`,
`maxWidth`, `minHeight`, `maxHeight`:

```typescript
width: 240          // 240 pixels
width: "fill"       // fill available space (weight 1)
width: "shrink"     // shrink to content
width: { fillPortion: 2 }  // fill with weight 2 (2:1 ratio vs weight-1 siblings)
```

**Padding** accepts four forms. Arrays and numbers are tuple
shorthand; the object form is the canonical wire shape.

```typescript
padding: 16                   // uniform on all sides
padding: [8, 16]              // [vertical, horizontal]
padding: [8, 16, 8, 16]       // [top, right, bottom, left]
padding: { top: 8, left: 16 } // per-side with named fields (others default to 0)
```

**Color** accepts hex, named colors, or an RGBA record:

```typescript
color: "#1e40af"
color: "cornflowerblue"
color: { r: 0.1, g: 0.3, b: 0.8 }       // 0.0-1.0 per channel
color: { r: 0.1, g: 0.3, b: 0.8, a: 0.5 }  // with alpha
```

The full named color list is exported from `plushie/ui` as
`namedColors` (148 CSS Color Module Level 4 entries plus
`transparent`).

See [Windows and Layout](windows-and-layout.md) for the full
`Length`/`Padding` specification and
[Themes and Styling](themes-and-styling.md) for color and style
maps.

## Shared props

Nearly every widget accepts the following props in addition to
widget-specific ones:

| Prop | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier. Auto-generated for stateless widgets if omitted. |
| `a11y` | `A11y` | Accessibility overrides. See [Accessibility](accessibility.md). |
| `style` | `StyleMap` | Style preset name (`"primary"`, `"danger"`) or style map object. See [Themes and Styling](themes-and-styling.md). |
| `eventRate` | `number` | Maximum events per second for coalescable events (pointer moves, scrolls). |
| `disabled` | `boolean` | When `true`, disables interactive behaviour. |

`onClick` and related handler props follow the same shape
everywhere: `(state, event) => newState` or
`(state, event) => [newState, command]`. Non-widget events
(timers, async results, subscriptions) route through `app.update`
instead; see [Events](events.md).

## Auto-generated IDs

Stateless widgets (`Text`, `Column`, `Row`, `Button`, `Rule`,
`Space`, `Image`, `Svg`, `QrCode`, `Markdown`) generate an ID
automatically if `id` is omitted. Auto-IDs are stable within a
render cycle and based on the widget type; they're intended for
short-lived subtrees where no event targeting or state retention
is needed.

Stateful widgets (`TextInput`, `TextEditor`, `PickList`,
`ComboBox`, `Slider`, `PaneGrid`, `Canvas`) require an explicit
`id`. Reusing an auto-ID across renders would drop renderer-held
state.

Handler-carrying widgets (`Button` with `onClick`,
`Checkbox` with `onToggle`) also require stable IDs if the same
widget is mounted across multiple renders; otherwise handler
registration has nothing to key against.

## See also

- [Events reference](events.md)
- [Windows and Layout reference](windows-and-layout.md)
- [Themes and Styling reference](themes-and-styling.md)
- [Canvas reference](canvas.md)
- [Custom Widgets reference](custom-widgets.md)
