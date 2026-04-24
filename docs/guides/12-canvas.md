# Canvas

Canvas is a different paradigm from the widget tree. Instead of
composing layout containers and input widgets, you draw shapes
on a 2D surface: rectangles, circles, lines, paths, text,
images, and SVG. Shapes group into named layers that cache
independently, and any group can be made interactive with click,
hover, drag, and keyboard handlers.

In this chapter we extend the pad with two small canvas pieces:
a **gradient save button** that replaces the plain `<Button>` in
the toolbar, and a **progress arc** that animates from the
auto-save timer. Along the way we cover shapes, layers,
transforms, paths, gradients, interactive groups, and the
canvas-level pointer events.

The full surface lives in the [Canvas reference](../reference/canvas.md).

## The model

Shapes are retained: every render, `view` returns a fresh shape
tree and the renderer diffs it against the previous tree, only
re-tessellating layers that changed. A shape is a plain value
with a `type` discriminator and geometry plus style fields; it
carries no callbacks or local state.

The `Canvas` widget participates in layout like any other
widget. Its children are `Layer` elements, shape values, or
interactive wrappers:

```tsx
import { Canvas } from "plushie/ui"
import { layer, rect, circle, canvasText } from "plushie/canvas"

<Canvas id="demo" width={200} height={100}>
  {layer("bg", [
    rect(0, 0, 200, 100, { fill: "#f0f0f0", radius: 8 }),
    circle(100, 50, 20, { fill: "#3b82f6" }),
    canvasText(100, 58, "Hello", { fill: "#333", size: 14, align_x: "center" }),
  ])}
</Canvas>
```

Shape builders come from `plushie/canvas`; the `Canvas` widget
comes from `plushie/ui`.

## Layers

Layers control drawing order and caching. A layer is a named
bucket of shapes; each layer maps to its own cache on the
renderer side. When the shapes in a layer change, only that
layer is re-tessellated.

```tsx
import { layer, rect, circle } from "plushie/canvas"

<Canvas id="scene" width={400} height={300}>
  {layer("background", gridLines)}
  {layer("markers", state.markers.map(renderMarker))}
  {layer("cursor", [circle(state.cursorX, state.cursorY, 4, { fill: "#ef4444" })])}
</Canvas>
```

Layers draw in alphabetical order by name, not child order. Pick
names to control z-order explicitly: `"a-background"`,
`"b-content"`, `"c-overlay"` is a common convention when numeric
prefixes feel noisy.

Shapes placed directly under `Canvas` without a wrapping
`layer()` auto-attach to a single layer named `"default"`. That
is fine for small canvases; split into named layers as soon as
some parts are static and others update every frame.

## Shapes

The shape catalog is small and each builder takes positional
geometry followed by an options record:

| Function | Signature | Description |
|---|---|---|
| `rect` | `(x, y, w, h, opts?)` | Rectangle, optionally rounded via `radius`. |
| `circle` | `(x, y, r, opts?)` | Circle. |
| `line` | `(x1, y1, x2, y2, opts?)` | Line segment. Stroke only. |
| `path` | `(commands, opts?)` | Arbitrary path from command list. |
| `canvasText` | `(x, y, content, opts?)` | Text at a point. |
| `canvasImage` | `(source, x, y, w, h, opts?)` | Raster image. |
| `canvasSvg` | `(source, x, y, w, h)` | SVG source string. |
| `group` | `(children, opts?)` or `(id, children, opts?)` | Nested group with transforms and clip. |

`fill`, `stroke`, and `opacity` are available on most shapes.
`rect` adds `radius` (uniform or per-corner), and rect / circle /
path expose `fill_rule` for winding control.

### Snake case at the shape boundary

Most of the SDK uses camelCase at the call site and maps to
snake_case on the wire, but the canvas shape builders carry the
wire names directly: `fill_rule`, `align_x`, `align_y`. The same
holds for `InteractiveOpts`: `on_click`, `on_hover`,
`hover_style`, `pressed_style`, `drag_axis`, `drag_bounds`,
`hit_rect`. These snake_case keys are intentional, not typos.
TypeScript enforces them at compile time.

### Strokes and dashes

`stroke(color, width, opts?)` builds a stroke descriptor. Assign
it to the `stroke` field of any outlineable shape:

```typescript
import { stroke } from "plushie/canvas"

stroke("#333", 2)
stroke("#333", 2, { cap: "round" })
stroke("#333", 2, { dash: { segments: [5, 3], offset: 0 } })
```

`segments` alternates solid and gap lengths; `[5, 3]` means five
units drawn, three skipped, repeat. `offset` shifts the pattern
start. `cap` chooses `"butt"`, `"round"`, or `"square"`; `join`
selects `"miter"`, `"round"`, or `"bevel"` for corners on paths.

### Gradients

Canvas fills accept a `LinearGradient` value anywhere a color
works. Canvas gradients use explicit start and end points in the
shape's local coordinate space:

```typescript
import { linearGradient, rect } from "plushie/canvas"

rect(0, 0, 100, 36, {
  fill: linearGradient([0, 0], [100, 0], [
    [0.0, "#3b82f6"],
    [1.0, "#1d4ed8"],
  ]),
  radius: 6,
})
```

Stops are `[offset, color]` tuples with offset in the `[0, 1]`
range. `linearGradientFromAngle(angleDegrees, stops)` is the
alternative when you want the gradient aligned to the shape's
bounding box at a specific angle. See
[Themes and Styling](../reference/themes-and-styling.md) for
widget-background gradients, which live in style maps and share
the angle helper.

### Paths

Paths are sequences of pen commands. Each command is a small
typed value returned by a builder; feed an array of them to
`path`:

```typescript
import { path, moveTo, lineTo, bezierTo, close } from "plushie/canvas"

path([
  moveTo(10, 0),
  lineTo(20, 20),
  lineTo(0, 20),
  close(),
], { fill: "#22c55e" })
```

| Command | Signature | Description |
|---|---|---|
| `moveTo` | `(x, y)` | Move the pen without drawing. |
| `lineTo` | `(x, y)` | Straight line from current point. |
| `bezierTo` | `(cp1x, cp1y, cp2x, cp2y, x, y)` | Cubic bezier. |
| `quadraticTo` | `(cpx, cpy, x, y)` | Quadratic bezier. |
| `arc` | `(cx, cy, r, startAngle, endAngle)` | Arc by center point. |
| `arcTo` | `(x1, y1, x2, y2, radius)` | Tangent arc between two points. |
| `ellipse` | `(cx, cy, rx, ry, rotation, startAngle, endAngle)` | Ellipse arc. |
| `roundedRect` | `(x, y, w, h, radius)` | Rounded rectangle subpath. |
| `close` | `()` | Close the current subpath to the last `moveTo`. |

All angles in path commands and transforms are **radians**. The
`degToRad` and `radToDeg` helpers convert between the two:

```typescript
import { degToRad, radToDeg } from "plushie/canvas"

degToRad(180)        // Math.PI
radToDeg(Math.PI / 2) // 90
```

## Transforms and clips

Transforms apply to groups, not individual shapes. A group
carries an ordered list of transforms that compose in
declaration order:

```tsx
import { group, rect, translate, rotate, scaleUniform, degToRad } from "plushie/canvas"

group([
  rect(0, 0, 40, 40, { fill: "#ef4444" }),
], {
  x: 100,
  y: 50,
  transforms: [rotate(degToRad(45)), scaleUniform(1.5)],
})
```

| Function | Signature | Description |
|---|---|---|
| `translate` | `(x, y)` | Shift the coordinate origin. |
| `rotate` | `(angle)` | Rotate around the current origin (**radians**). |
| `scale` | `(x, y?)` | Scale both axes; `y` defaults to `x`. |
| `scaleUniform` | `(factor)` | Uniform scale for both axes. |

The `x` and `y` options on `group` desugar to a leading
`translate`, so the example above is equivalent to having
`translate(100, 50)` as the first element of `transforms`.

`clip(x, y, w, h)` restricts drawing inside a group to a
rectangle. A group takes at most one clip, and clips nest:

```tsx
import { group, circle, clip } from "plushie/canvas"

group([
  circle(40, 40, 60, { fill: "#3b82f6" }),
], {
  clip: clip(0, 0, 80, 80),
})
```

## Interactive shapes

`interactive(shape, id, opts?)` makes a canvas shape respond to
pointer and keyboard input. If the shape is already a group, the
interactive fields are merged in place; otherwise a new group
wraps it. The `id` becomes the scoped ID for any events the
shape emits.

```tsx
import { interactive, rect, circle, layer } from "plushie/canvas"

<Canvas id="switch" width={64} height={32}>
  {layer("track", [
    interactive(
      rect(0, 0, 64, 32, {
        fill: state.dark ? "#3b82f6" : "#ddd",
        radius: 16,
      }),
      "toggle",
      {
        on_click: true,
        cursor: "pointer",
        a11y: { role: "switch", label: "Dark mode", toggled: state.dark },
      },
    ),
    circle(state.dark ? 44 : 20, 16, 12, { fill: "#fff" }),
  ])}
</Canvas>
```

The interactive group infers a default `a11y.role` when you set
one of the interaction flags (`on_click` infers `"button"`,
`draggable` infers `"slider"`, `focusable` alone infers
`"group"`). Override with an explicit `a11y.role` when the
semantic is different.

### Interaction options

| Option | Type | Description |
|---|---|---|
| `on_click` | `boolean` | Enable `click` events. |
| `on_hover` | `boolean` | Enable `enter` and `exit` events. |
| `draggable` | `boolean` | Enable `drag` and `drag_end` events. |
| `drag_axis` | `"x" \| "y" \| "both"` | Constrain drag direction. |
| `drag_bounds` | `DragBounds` | Limit drag region. |
| `focusable` | `boolean` | Add to Tab order for keyboard navigation. |
| `cursor` | `string` | Cursor style on hover. |
| `tooltip` | `string` | Tooltip shown while hovered. |
| `hit_rect` | `HitRect` | Custom hit-test rectangle. |
| `hover_style` | `ShapeStyle` | Overrides while hovered. |
| `pressed_style` | `ShapeStyle` | Overrides while pressed. |
| `focus_style` | `ShapeStyle` | Overrides while focused. |
| `show_focus_ring` | `boolean` | Toggle the default focus indicator. |
| `a11y` | `A11y` | Accessibility overrides. |

A `ShapeStyle` is a record with optional `fill`, `stroke`, and
`opacity`; unspecified fields inherit from the base shape. The
renderer applies these states automatically.

## Canvas events

Canvas events arrive as widget events. There are two flavors.

**Canvas-level pointer events** fire for the whole surface when
the `Canvas` has a handler prop or `interactive: true`:

```tsx
<Canvas id="drawing" width="fill" height={400}
  onPress={(s, e) => ({ ...s, strokes: [...s.strokes, beginStroke(e.data)] })}
  onMove={true} />
```

Handler props accept either a function (installs an inline
handler) or `true` (routes the event to `update` instead). Use
`true` when the state update belongs in `update`; use a function
for simple local updates. The four handler props are `onPress`,
`onRelease`, `onMove`, and `onScroll`. Mouse, touch, and pen
all produce the same event types; the `pointer` field (`"mouse"`,
`"touch"`, `"pen"`) identifies the device, and `finger` carries
the touch finger ID.

In `update`, narrow canvas-level pointer events with `isPress`,
`isRelease`, `isMove`, or `isScroll`:

```typescript
import { isMove, isScroll } from "plushie"

if (isMove(event, "drawing")) {
  return { ...state, cursor: { x: event.data.x, y: event.data.y } }
}

if (isScroll(event, "drawing")) {
  return { ...state, zoom: state.zoom * (event.data.deltaY < 0 ? 1.1 : 0.9) }
}
```

**Element-level events** come from interactive groups inside a
canvas. They use the standard widget event guards. The event's
`id` is the interactive group's id; the event's `scope` starts
with the canvas ID, so a canvas with id `"switch"` and an inner
group id `"toggle"` surfaces events with `id: "toggle"` and
`scope: ["switch", ...]`:

```typescript
import { isClick, isDrag } from "plushie"

if (isClick(event, "toggle") && event.scope?.[0] === "switch") {
  return { ...state, dark: !state.dark }
}

if (isDrag(event, "handle") && event.scope?.[0] === "slider") {
  return { ...state, value: clamp(event.data.x, 0, 300) }
}
```

See [Events](../reference/events.md) for the full pointer and
drag event data shapes and [Scoped IDs](../reference/scoped-ids.md)
for the `id` / `scope` split.

## Building the save button

Back to the pad. The plain save button in the toolbar renders as
`<Button id="save">Save</Button>`. A canvas version gives us a
gradient fill, rounded corners, and hover feedback without
writing a custom widget. It also demonstrates the interactive
group in context.

```tsx
import { Canvas } from "plushie/ui"
import { interactive, layer, linearGradient, rect, canvasText } from "plushie/canvas"

function SaveButton() {
  return (
    <Canvas id="save-canvas" width={100} height={36}>
      {layer("button", [
        interactive(
          rect(0, 0, 100, 36, {
            fill: linearGradient([0, 0], [100, 0], [
              [0.0, "#3b82f6"],
              [1.0, "#2563eb"],
            ]),
            radius: 6,
          }),
          "save",
          {
            on_click: true,
            cursor: "pointer",
            focusable: true,
            hover_style: { fill: "#2563eb" },
            pressed_style: { fill: "#1d4ed8" },
            a11y: { role: "button", label: "Save experiment" },
          },
        ),
        canvasText(50, 12, "Save", {
          fill: "#fff",
          size: 14,
          align_x: "center",
        }),
      ])}
    </Canvas>
  )
}
```

Drop it into the toolbar row in place of the plain button:

```tsx
<Row id="actions" spacing={8} padding={4}>
  <SaveButton />
  <Checkbox id="auto-save" label="Auto-save" checked={state.autoSave} />
</Row>
```

The click event routes to `update` with `id: "save"` and
`scope: ["save-canvas", ...]`. Match on both so it does not
collide with any other widget named `"save"`:

```typescript
if (isClick(event, "save") && event.scope?.[0] === "save-canvas") {
  return [saveAndCompile(state), Command.none()]
}
```

Hover feedback needs no code on the app side. The
`hover_style` and `pressed_style` records override the fill
while the pointer is over or pressing the shape; the `fill`
field wins, everything else inherits.

## A progress arc

Now add a small progress indicator next to the save button that
fills as the auto-save debounce timer counts down. The arc is
drawn with a path command list and an animated end angle derived
from the model.

```tsx
import { Canvas } from "plushie/ui"
import { arc, close, layer, moveTo, path, stroke } from "plushie/canvas"

const AUTOSAVE_MS = 1500

function AutoSaveArc(props: { elapsed: number; armed: boolean }) {
  const progress = Math.min(1, props.elapsed / AUTOSAVE_MS)
  const end = -Math.PI / 2 + progress * Math.PI * 2

  return (
    <Canvas id="autosave-arc" width={24} height={24}>
      {layer("track", [
        path([moveTo(12, 2), arc(12, 12, 10, -Math.PI / 2, Math.PI * 1.5)], {
          stroke: stroke("#e5e7eb", 2),
        }),
      ])}
      {layer("fill", props.armed ? [
        path([moveTo(12, 2), arc(12, 12, 10, -Math.PI / 2, end)], {
          stroke: stroke("#3b82f6", 2, { cap: "round" }),
        }),
      ] : [])}
    </Canvas>
  )
}
```

The track layer is static and never re-tessellates. The fill
layer depends on `elapsed`, so only that layer re-runs when the
timer ticks. Splitting static chrome from dynamic content is the
primary performance lever for larger canvases.

Shape props are not tweened by the renderer. Animation means
rebuilding the shape tree from the model on each frame or tick;
see [Subscriptions](../reference/subscriptions.md) for timer and
animation-frame sources.

## Pan and zoom

For a larger drawing surface, canvas-level pointer events plus a
model-driven transform give you pan and zoom with no extra
machinery. Track translation and scale in state; let the view
wrap all content in one transformed group:

```tsx
<Canvas id="stage" width="fill" height={400}
  onPress={(s, e) => ({ ...s, dragging: true, anchor: { x: e.data.x, y: e.data.y } })}
  onRelease={(s) => ({ ...s, dragging: false })}
  onMove={true}
  onScroll={true}>
  {layer("content", [
    group(contentShapes(state), {
      transforms: [translate(state.pan.x, state.pan.y), scaleUniform(state.zoom)],
    }),
  ])}
</Canvas>
```

Pan on drag-move, zoom on scroll:

```typescript
if (isMove(event, "stage") && state.dragging) {
  const dx = event.data.x - state.anchor.x
  const dy = event.data.y - state.anchor.y
  return {
    ...state,
    pan: { x: state.pan.x + dx, y: state.pan.y + dy },
    anchor: { x: event.data.x, y: event.data.y },
  }
}
if (isScroll(event, "stage")) {
  const factor = event.data.deltaY < 0 ? 1.1 : 0.9
  return { ...state, zoom: Math.max(0.1, Math.min(10, state.zoom * factor)) }
}
```

Pointer `move` events are coalescable: the renderer keeps only
the latest per source between frames, so drag responsiveness
stays smooth even when the event rate spikes. Set `eventRate`
on the Canvas to cap delivery per second.

## Composing with widgets

Canvas is just another widget. Put it next to buttons, inside
rows, or at the root of a pane. Shapes stop at the canvas
boundary; widgets stop at the shape boundary; both compose
freely in the outer tree:

```tsx
<Column spacing={8}>
  <Row spacing={8}>
    <SaveButton />
    <Button id="clear">Clear</Button>
  </Row>
  <Canvas id="chart" width="fill" height={200}>
    {layer("bars", state.series.map(bar))}
  </Canvas>
</Column>
```

Reach for canvas when the thing you want to draw is not a built-in
widget (charts, diagrams, badges, custom controls, minimaps).
Everything else stays widget-native. See
[Composition Patterns](../reference/composition-patterns.md) for
guidance on splitting view functions once the tree grows.

## Try it

Quick experiments for the pad:

- Add a minimap canvas that draws a tiny outline of the preview
  tree alongside the editor.
- Replace the plain `<Button id="clear">` with a canvas button
  matching the save button's gradient.
- Build a bar chart from the event log, one `rect` per event.
- Draw a star with `path` commands and rotate the group from an
  animation-frame subscription.
- Make a horizontal slider with `draggable: true` and
  `drag_axis: "x"`; drive a value from `drag` events.

---

Next: [Custom Widgets](13-custom-widgets.md)
