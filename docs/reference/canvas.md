# Canvas

The canvas system draws 2D shapes onto a surface: rectangles,
circles, lines, paths, text, images, and SVG. Shapes are grouped
into named layers that cache independently on the renderer side.
The `Canvas` widget itself comes from `plushie/ui`; shape
builders, path commands, strokes, gradients, transforms, and the
interactive wrapper come from `plushie/canvas`.

```tsx
import { Canvas } from "plushie/ui"
import { layer, rect, circle, canvasText } from "plushie/canvas"

<Canvas id="chart" width={400} height={200}>
  {layer("background", [
    rect(0, 0, 400, 200, { fill: "#f5f5f5" }),
  ])}
  {layer("bars", [
    rect(10, 50, 80, 150, { fill: "#3b82f6" }),
    rect(110, 100, 80, 100, { fill: "#22c55e" }),
  ])}
  {layer("labels", [
    canvasText(50, 190, "A", { fill: "#333", size: 12 }),
    canvasText(150, 190, "B", { fill: "#333", size: 12 }),
  ])}
</Canvas>
```

## Canvas widget

The widget participates in the layout system like any other
widget (has `width`, `height`, `background`), but its content is
drawn shapes rather than child widgets. `Canvas` is stateful:
keep its `id` stable across renders so renderer-side layer
caches survive.

### Props

| Prop | Type | Description |
|---|---|---|
| `id` | `string` | Widget identifier. Required for stable caching. |
| `width` | `Length` | Canvas width. |
| `height` | `Length` | Canvas height. |
| `background` | `Color` | Canvas background color. |
| `interactive` | `boolean` | Emit pointer events without installing handlers. |
| `onPress` | `Handler \| boolean` | Mouse/touch press events. |
| `onRelease` | `Handler \| boolean` | Mouse/touch release events. |
| `onMove` | `Handler \| boolean` | Pointer move events. |
| `onScroll` | `Handler \| boolean` | Wheel and touch scroll. |
| `alt` | `string` | Accessible label. |
| `description` | `string` | Extended accessible description. |
| `a11y` | `A11y` | Full accessibility override. See [Accessibility](accessibility.md). |
| `role` | `string` | Accessible role (for instance `"radiogroup"`, `"toolbar"`). |
| `arrowMode` | `string` | Arrow key navigation mode (`"wrap"`, `"clamp"`, `"linear"`, `"none"`). |
| `eventRate` | `number` | Max events per second for coalescable pointer events. |

Handler props accept either a function (installs an inline
handler) or `true` (delivers the event to `update` instead). A
boolean flag is useful when the canvas is interactive but the
state update lives in the app's `update` function.

```tsx
<Canvas id="drawing" width="fill" height={400}
  onPress={(s, e) => ({ ...s, stroke: beginStroke(e.data) })}
  onMove={true} />
```

## Layers

Canvas content is organized into named layers. Each layer is
drawn independently and maps to a separate cache on the renderer.
When a layer's shapes change, only that layer is re-tessellated.

```tsx
import { layer, rect, circle } from "plushie/canvas"

<Canvas id="scene" width={400} height={300}>
  {layer("grid", gridLines)}
  {layer("markers", state.markers.map(renderMarker))}
  {layer("cursor", [circle(state.cursorX, state.cursorY, 4, { fill: "#ef4444" })])}
</Canvas>
```

**Drawing order.** Layers render in alphabetical order by name.
`"background"` draws before `"foreground"`. Pick names to control
z-ordering explicitly; the child-array order does not determine
draw order.

**Independent caching.** Splitting a canvas into a static
background layer, a dynamic data layer, and a cursor layer means
the dynamic layer re-tessellates on each change without touching
the others. For canvases with many shapes, this is the primary
performance lever.

**Bare shapes.** Shape children placed directly inside `Canvas`
(without a wrapping `layer(...)`) are auto-wrapped into a layer
named `"default"`. Use explicit layers once you have more than a
single kind of content.

## Shape catalog

All shape builders return plain objects that encode to the wire
format. Required positional arguments come first; optional
styling arrives in a trailing options record.

| Function | Signature | Description |
|---|---|---|
| `rect` | `(x, y, w, h, opts?)` | Rectangle. `opts.radius` makes it rounded. |
| `circle` | `(x, y, r, opts?)` | Circle. |
| `line` | `(x1, y1, x2, y2, opts?)` | Line segment. Stroke only. |
| `path` | `(commands, opts?)` | Arbitrary path from an array of path commands. |
| `canvasText` | `(x, y, content, opts?)` | Text at a point. |
| `canvasImage` | `(source, x, y, w, h, opts?)` | Raster image. |
| `canvasSvg` | `(source, x, y, w, h)` | Inline SVG source string. |
| `group` | `(children, opts?)` or `(id, children, opts?)` | Nested group with transforms and clip. |

### Shared styling options

| Option | Type | Applies to | Description |
|---|---|---|---|
| `fill` | `Color \| LinearGradient` | Rect, circle, path, text, group-filling shapes | Interior fill. |
| `stroke` | `Stroke` | Rect, circle, line, path | Outline. See [Strokes](#strokes). |
| `opacity` | `number` | All | 0.0 (transparent) to 1.0 (opaque). |
| `radius` | `number \| [tl, tr, br, bl]` | Rect | Uniform corner radius or per-corner array. |
| `fill_rule` | `"non_zero" \| "even_odd"` | Rect, circle, path | Path winding rule for self-intersecting shapes. |

Text-specific options for `canvasText`:

| Option | Type | Description |
|---|---|---|
| `size` | `number` | Font size in pixels. |
| `font` | `string` | Font family name. |
| `align_x` | `"left" \| "center" \| "right"` | Horizontal alignment relative to anchor. |
| `align_y` | `"top" \| "center" \| "bottom"` | Vertical alignment relative to anchor. |

`canvasImage` takes `rotation` (radians) and `opacity` in its
options. `canvasSvg` takes no options; its source is an SVG
string, not a file path. Load the file first with Node's file
API or a bundler asset import.

```tsx
import { path, moveTo, lineTo, close } from "plushie/canvas"

path([
  moveTo(10, 0),
  lineTo(20, 20),
  lineTo(0, 20),
  close(),
], { fill: "#22c55e" })
```

## Path commands

Path commands are the building blocks for `path()`. Each
returns a small opaque value; pass them to `path` in drawing
order.

| Function | Signature | Description |
|---|---|---|
| `moveTo` | `(x, y)` | Move the pen without drawing. |
| `lineTo` | `(x, y)` | Straight line from the current point. |
| `bezierTo` | `(cp1x, cp1y, cp2x, cp2y, x, y)` | Cubic bezier curve. |
| `quadraticTo` | `(cpx, cpy, x, y)` | Quadratic bezier curve. |
| `arc` | `(cx, cy, r, startAngle, endAngle)` | Arc by center point. |
| `arcTo` | `(x1, y1, x2, y2, radius)` | Tangent arc between two control points. |
| `ellipse` | `(cx, cy, rx, ry, rotation, startAngle, endAngle)` | Ellipse arc. |
| `roundedRect` | `(x, y, w, h, radius)` | Rounded rectangle as a subpath. |
| `close` | `()` | Close the current subpath back to the last `moveTo`. |

Angle arguments to `arc`, `ellipse`, and the `rotation` field on
`canvasImage` are all in **radians**. Use `degToRad` and
`radToDeg` from `plushie/canvas` when a source value is in
degrees:

```typescript
import { degToRad, radToDeg } from "plushie/canvas"

degToRad(180)  // 3.141592...
radToDeg(Math.PI / 2)  // 90
```

## Strokes

`stroke(color, width, opts?)` builds a stroke descriptor. It goes
into the `stroke` field of any shape that supports outlining.

```typescript
import { stroke } from "plushie/canvas"

stroke("#333", 2)
stroke("#333", 2, { cap: "round" })
stroke("#333", 2, { dash: { segments: [5, 3], offset: 0 } })
```

| Option | Values | Description |
|---|---|---|
| `cap` | `"butt" \| "round" \| "square"` | End style for open strokes. |
| `join` | `"miter" \| "round" \| "bevel"` | Corner style at vertices. |
| `dash` | `{ segments: number[], offset: number }` | Dashed stroke pattern. |

`segments` alternates solid and gap lengths (for instance
`[5, 3]` means 5 units drawn, 3 units skipped, repeat). `offset`
shifts the pattern's starting point.

The underlying `Stroke` interface is the same shape the wire
expects; the builder is a convenience that omits undefined fields.

## Gradients

Canvas shapes accept `LinearGradient` values as a `fill`. Canvas
gradients use coordinate pairs (two points) rather than an angle,
which differs from the widget-background gradients used in style
maps.

```typescript
import { rect } from "plushie/canvas"
import { linearGradient } from "plushie/canvas"

rect(0, 0, 200, 50, {
  fill: linearGradient([0, 0], [200, 0], [
    [0, "#3b82f6"],
    [1, "#1d4ed8"],
  ]),
})
```

`linearGradient(from, to, stops)` takes explicit start and end
points in the shape's local coordinate space. Stops are
`[offset, color]` tuples with offset from 0.0 to 1.0.

`linearGradientFromAngle(angleDegrees, stops)` exists for cases
where the gradient should span the shape's bounding box at a
given angle. It produces a gradient in unit-square coordinates
(0.0 to 1.0 along each axis) that the renderer maps to the
shape's bounds.

The same two builders are re-exported from `plushie/ui` for use
with widget style maps. For the widget-background variant and
the overall gradient reference, see
[Themes and Styling](themes-and-styling.md#gradient).

## Transforms

Transforms apply to **groups only**, not to individual shapes. A
group carries an ordered list of transforms in its `transforms`
option; they compose in declaration order.

| Function | Signature | Description |
|---|---|---|
| `translate` | `(x, y)` | Shift the coordinate origin. |
| `rotate` | `(angle)` | Rotate around the current origin (**radians**). |
| `scale` | `(x, y?)` | Scale the coordinate system. `y` defaults to `x`. |
| `scaleUniform` | `(factor)` | Uniform scale for both axes. |

```tsx
import { group, rect, translate, rotate, scaleUniform } from "plushie/canvas"
import { degToRad } from "plushie/canvas"

group([
  rect(0, 0, 40, 40, { fill: "#ef4444" }),
], {
  x: 100,
  y: 50,
  transforms: [rotate(degToRad(45)), scaleUniform(1.5)],
})
```

The `x` and `y` options on `group` desugar to a leading
`translate` for convenience; the example above is equivalent to
specifying `translate(100, 50)` as the first element of
`transforms`.

`rotate` takes radians. Pass `degToRad(angle)` for human-friendly
degree inputs; this matches the Rust renderer's internal
representation.

## Clips

`clip(x, y, w, h)` restricts drawing inside a group to the given
rectangle. A group takes at most one clip.

```tsx
import { group, circle, clip } from "plushie/canvas"

group([
  circle(40, 40, 60, { fill: "#3b82f6" }),
], {
  clip: clip(0, 0, 80, 80),
})
```

Only the portion of the circle that falls inside the 80-by-80
clip is rasterized. Clips nest: a group inside a clipped group
is further clipped by its own bounds.

## Interactive shapes

`interactive(shape, id, opts?)` wraps a canvas shape so it can
receive pointer and keyboard events. It encodes as a `group` on
the wire (the split between plain groups and interactive ones is
SDK-side). When the inner shape is already a group, interactive
fields are merged in place; otherwise a new group is created with
the shape as its sole child.

```tsx
import { interactive, rect, circle, layer } from "plushie/canvas"

<Canvas id="switch" width={64} height={32}
  onPress={(s, e) => e.scope?.[0] === "switch" ? toggle(s) : s}>
  {layer("track", [
    interactive(rect(0, 0, 64, 32, {
      fill: state.dark ? "#3b82f6" : "#ddd",
      radius: 16,
    }), "toggle", {
      on_click: true,
      cursor: "pointer",
      a11y: { role: "switch", label: "Dark mode", toggled: state.dark },
    }),
    circle(state.dark ? 44 : 20, 16, 12, { fill: "#fff" }),
  ])}
</Canvas>
```

### Interaction options

| Option | Type | Description |
|---|---|---|
| `on_click` | `boolean` | Enable `click` events for this shape. |
| `on_hover` | `boolean` | Enable `enter` and `exit` events. |
| `draggable` | `boolean` | Enable `drag` and `drag_end` events. |
| `drag_axis` | `"x" \| "y" \| "both"` | Constrain drag direction. |
| `drag_bounds` | `DragBounds` | Limit drag region (`{ min_x, max_x, min_y, max_y }`). |
| `focusable` | `boolean` | Add to Tab order for keyboard navigation. |
| `cursor` | `string` | Cursor style on hover (`"pointer"`, `"grab"`, ...). |
| `tooltip` | `string` | Tooltip shown while hovered. |
| `hit_rect` | `HitRect` | Custom hit-test rectangle (`{ x, y, w, h }`). |

### Visual feedback options

| Option | Type | Description |
|---|---|---|
| `hover_style` | `ShapeStyle` | Overrides while hovered. |
| `pressed_style` | `ShapeStyle` | Overrides while pressed. |
| `focus_style` | `ShapeStyle` | Overrides when keyboard-focused. |
| `show_focus_ring` | `boolean` | Toggle the default focus indicator. |
| `focus_ring_radius` | `number` | Corner radius for the focus ring. |

A `ShapeStyle` is a record with optional `fill`, `stroke`, and
`opacity` fields. Only specified fields override; others inherit
from the shape's base values.

### Accessibility

Canvas is a raw drawing surface; the renderer has no semantic
knowledge of what a shape represents. Interactive elements need
explicit `a11y` annotations to be exposed to screen readers and
keyboard users:

```typescript
interactive(rect(0, 0, 40, 40, { fill: "#3b82f6" }), "hue-ring", {
  on_click: true,
  focusable: true,
  a11y: { role: "slider", label: "Hue", value: `${Math.round(hue)} degrees` },
})
```

Without `a11y`, interactive elements are invisible to assistive
technology. See [Accessibility](accessibility.md) for the full
set of fields and roles.

## Canvas events

All canvas events arrive with `kind: "widget"`. Narrow with type
guards from `plushie`.

### Canvas-level events

Set `interactive: true` on the widget, or a handler prop
(`onPress`, `onRelease`, `onMove`, `onScroll`), to receive
pointer events across the entire canvas surface. Mouse, touch,
and pen input all emit the same event types; the `pointer` field
identifies the device.

| Type | Data fields |
|---|---|
| `press` | `x`, `y`, `button`, `pointer`, `finger`, `modifiers` |
| `release` | `x`, `y`, `button`, `pointer`, `finger`, `modifiers` |
| `move` | `x`, `y`, `pointer`, `finger`, `modifiers` |
| `scroll` | `x`, `y`, `deltaX`, `deltaY`, `pointer`, `modifiers` |

Touch events arrive with `pointer: "touch"` and `button: "left"`
plus a `finger` integer identifying the touch point. Mouse events
arrive with `pointer: "mouse"` and `finger: null`.

```typescript
import { isPointer } from "plushie"

if (isPointer(event, "drawing")) {
  if (event.type === "press" && event.data.pointer === "touch") {
    return { ...state, stroke: beginStroke(event.data.x, event.data.y, event.data.finger) }
  }
}
```

### Element-level events

Interactive elements inside the canvas emit standard widget
events, scoped under the canvas ID.

| Type | Requires | Description |
|---|---|---|
| `click` | `on_click: true` | Pointer click on the element. |
| `enter` | `on_hover: true` | Pointer entered the hit region. |
| `exit` | `on_hover: true` | Pointer left the hit region. |
| `drag` | `draggable: true` | Pointer drag with delta data. |
| `drag_end` | `draggable: true` | Drag completed. |
| `focused` | `focusable: true` | Keyboard focus acquired. |
| `blurred` | `focusable: true` | Keyboard focus lost. |
| `key_press` | `focusable: true` | Key pressed while focused. |
| `key_release` | `focusable: true` | Key released while focused. |

Canvas element events use the same guards as widget events
elsewhere (`isClick`, `isDrag`, `isFocused`). The event's `id`
is the element's local ID and `scope` starts with the canvas ID.

```typescript
import { isClick, isDrag } from "plushie"

if (isClick(event, "toggle") && event.scope?.[0] === "switch") {
  return { ...state, dark: !state.dark }
}

if (isDrag(event, "handle") && event.scope?.[0] === "slider") {
  return { ...state, value: clamp(event.data.x, 0, 300) }
}
```

See [Scoped IDs](scoped-ids.md) for the canonical wire format
and the `scope` / `id` split. See [Events](events.md) for the
complete event taxonomy.

## Coordinate system and angle conventions

Canvas uses a **Y-down** coordinate system. `(0, 0)` is the
top-left corner of the canvas widget; positive `x` extends right,
positive `y` extends down. Nested groups inherit this convention;
transforms modify the origin without flipping the axis.

Angles are in **radians** throughout the canvas API:
`arc`, `ellipse`, `rotate`, and `canvasImage.rotation`. The
`degToRad` and `radToDeg` helpers convert between degrees and
radians for human-friendly inputs.

`linearGradientFromAngle` is the one exception: it takes degrees
because it mirrors the widget-background gradient helper of the
same name. 0 degrees runs east (left to right); 90 degrees runs
south (top to bottom).

## See also

- [Built-in Widgets](built-in-widgets.md)
- [Events](events.md)
- [Accessibility](accessibility.md)
- [Scoped IDs](scoped-ids.md)
- [Themes and Styling](themes-and-styling.md)
