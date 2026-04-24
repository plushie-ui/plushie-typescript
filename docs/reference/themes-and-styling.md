# Themes and Styling

Plushie's visual styling works at three layers: **themes** set the
overall palette, **style maps** override individual widget appearance,
and **prop types** (`Color`, `Border`, `Shadow`, `Gradient`, `Font`)
provide the building blocks. Everything lives in `plushie/ui`.

```tsx
import { Button, Column, Window } from "plushie/ui"

<Window id="main" title="App" theme="dark">
  <Column padding={16}>
    <Button id="save" onClick={save} style="primary">Save</Button>
  </Column>
</Window>
```

Types (`Color`, `Theme`, `StyleMap`, ...) and encoders
(`encodeColor`, `encodeStyleMap`, ...) are re-exported from
`plushie/ui`. Application code almost never calls the encoders
directly; they run inside each widget builder. They are exported so
custom widgets can reuse them.

## Color

The `Color` type accepts several input forms, all normalized to
`"#rrggbb"` or `"#rrggbbaa"` by `encodeColor`.

| Input | Example | Result |
|---|---|---|
| Six-digit hex | `"#3b82f6"` | `"#3b82f6"` |
| Eight-digit hex with alpha | `"#3b82f680"` | `"#3b82f680"` |
| Three-digit shorthand | `"#f00"` | `"#ff0000"` |
| Four-digit shorthand with alpha | `"#f008"` | `"#ff000088"` |
| Named color | `"cornflowerblue"` | `"#6495ed"` |
| RGB record | `{ r: 0.23, g: 0.51, b: 0.96 }` | `"#3b82f5"` |
| RGBA record | `{ r: 1, g: 0, b: 0, a: 0.5 }` | `"#ff000080"` |

RGB and RGBA records use floats in the 0.0 to 1.0 range per channel.
Named lookups are case-insensitive; `"CornflowerBlue"` and
`"cornflowerblue"` produce the same hex. The full named-color catalog
is exported as `namedColors`:

```typescript
import { namedColors } from "plushie/ui"

const hex = namedColors["cornflowerblue"] // "#6495ed"
```

Named colors cover the CSS Color Module Level 4 palette plus
`"transparent"` (which maps to `"#00000000"`). Both the `gray` and
`grey` spellings work for the grey family. Unrecognized string
inputs pass through to the renderer unchanged, which will typically
reject them.

```typescript
import { encodeColor } from "plushie/ui"

encodeColor("#3B82F6")                        // "#3b82f6"
encodeColor({ r: 1, g: 0, b: 0 })             // "#ff0000"
encodeColor({ r: 0, g: 0, b: 0, a: 0.25 })    // "#00000040"
```

## Gradient

Linear gradients fill a region between two points along a list of
color stops. They are accepted wherever a widget accepts a
background (`style.background`, `StyleMap` base, status overrides).

Stops are `[offset, color]` tuples where offset runs from 0.0 to
1.0. The `GradientStop` type is `readonly [number, Color]`.

```typescript
import { linearGradient, linearGradientFromAngle } from "plushie/ui"

const vertical = linearGradient(
  [0, 0],
  [0, 1],
  [
    [0, "#3b82f6"],
    [1, "#1d4ed8"],
  ],
)

const angled = linearGradientFromAngle(135, [
  [0, "#667eea"],
  [1, "#764ba2"],
])
```

`linearGradient(from, to, stops)` takes two points on the unit
square. `linearGradientFromAngle(deg, stops)` converts a degree
angle into start and end coordinates centered on the unit square,
matching the renderer's convention. A 0-degree gradient runs
horizontally from left to right; 90 degrees runs top to bottom.

The underlying `Gradient` interface is read-only and carries a
discriminator:

```typescript
interface Gradient {
  readonly type: "linear"
  readonly start: readonly [number, number]
  readonly end: readonly [number, number]
  readonly stops: readonly GradientStop[]
}
```

## Font

The `Font` type accepts a string shorthand or an object with family
and variant fields.

```typescript
import type { Font } from "plushie/ui"

const systemDefault: Font = "default"
const systemMono: Font = "monospace"
const byName: Font = "Inter"
const custom: Font = {
  family: "Inter",
  weight: "semi_bold",
  style: "italic",
  stretch: "normal",
}
```

The string form `"default"` selects the renderer's default font;
`"monospace"` selects the default monospace font. Any other string
is treated as a font family name.

The object form carries optional `weight`, `style`, and `stretch`
fields. Valid values mirror the renderer's CSS-aligned enums:

| Field | Values |
|---|---|
| `weight` | `"thin"`, `"extra_light"`, `"light"`, `"normal"`, `"medium"`, `"semi_bold"`, `"bold"`, `"extra_bold"`, `"black"` |
| `style` | `"normal"`, `"italic"`, `"oblique"` |
| `stretch` | `"ultra_condensed"`, `"extra_condensed"`, `"condensed"`, `"semi_condensed"`, `"normal"`, `"semi_expanded"`, `"expanded"`, `"extra_expanded"`, `"ultra_expanded"` |

## Border

A `Border` describes the stroke and corner treatment for a widget.
All fields are optional.

```typescript
interface Border {
  color?: Color
  width?: number
  radius?: number | CornerRadius
}
```

A uniform border looks like:

```typescript
const outline: Border = {
  color: "#e5e7eb",
  width: 1,
  radius: 8,
}
```

For per-corner control, set `radius` to a `CornerRadius` object. Any
corner omitted defaults to 0.

```typescript
interface CornerRadius {
  topLeft?: number
  topRight?: number
  bottomRight?: number
  bottomLeft?: number
}

const topOnly: Border = {
  color: "#ccc",
  width: 1,
  radius: { topLeft: 8, topRight: 8 },
}
```

`encodeBorder` rejects negative widths and negative per-corner radii
at call time:

```
Error: border width must be non-negative, got -1
Error: border radius must be non-negative, got top_left=-2
```

## Shadow

A `Shadow` describes a drop shadow cast behind a widget's
background. All fields are optional; defaults are black at zero
offset and zero blur.

```typescript
interface Shadow {
  color?: Color
  offsetX?: number
  offsetY?: number
  blurRadius?: number
}

const card: Shadow = {
  color: { r: 0, g: 0, b: 0, a: 0.1 },
  offsetX: 0,
  offsetY: 4,
  blurRadius: 8,
}
```

Negative offsets are allowed; they shift the shadow in the opposite
direction. `blurRadius` is a non-negative number of pixels.

## StyleMap

`StyleMap` overrides the appearance of a specific widget. Themes
set the baseline; style maps customise an individual widget on top
of that. Most widgets accept a `style` prop typed as `StyleMap`.

The simplest form is a preset name:

```tsx
<Button id="save" onClick={save} style="primary">Save</Button>
<Button id="cancel" onClick={cancel} style="text">Cancel</Button>
```

Common presets across widgets include `"primary"`, `"secondary"`,
`"success"`, `"danger"`, `"warning"`, and `"text"`. Which presets a
widget supports depends on the widget; check the widget's module
docs or the style definitions in the Rust renderer.

The full form is an object:

```typescript
interface StyleMap {
  base?: string
  background?: Color | Gradient
  textColor?: Color
  border?: Border
  shadow?: Shadow
  hovered?: StatusOverride
  pressed?: StatusOverride
  disabled?: StatusOverride
  focused?: StatusOverride
}
```

`base` extends an existing preset. The other top-level fields set
the resting appearance. Every field is optional; omitted fields
inherit from the preset named by `base` (or from the widget's
default if `base` is omitted).

```tsx
const primary: StyleMap = {
  base: "primary",
  background: "#3b82f6",
  textColor: "#ffffff",
  border: { color: "#2563eb", width: 1, radius: 6 },
  shadow: { color: { r: 0, g: 0, b: 0, a: 0.1 }, offsetY: 2, blurRadius: 4 },
  hovered: { background: "#2563eb" },
  pressed: { background: "#1d4ed8" },
  disabled: { background: "#9ca3af", textColor: "#6b7280" },
  focused: {
    border: { color: "#3b82f6", width: 2, radius: 6 },
  },
}

<Button id="save" onClick={save} style={primary}>Save</Button>
```

### Status overrides

`hovered`, `pressed`, `disabled`, and `focused` accept a
`StatusOverride`. Only the fields you set are replaced for that
status; every other field inherits from the resting style.

```typescript
interface StatusOverride {
  background?: Color | Gradient
  textColor?: Color
  border?: Border
  shadow?: Shadow
}
```

Gradients are valid in both `background` slots. A button can shift
from a flat color at rest to a gradient on hover:

```typescript
const flashy: StyleMap = {
  background: "#3b82f6",
  textColor: "#ffffff",
  hovered: {
    background: linearGradientFromAngle(90, [
      [0, "#3b82f6"],
      [1, "#1d4ed8"],
    ]),
  },
}
```

## Themes

Every window has a `theme` prop that sets the palette for its
widgets. Button backgrounds, input fields, scrollbar tints, and
default text colors all derive from the active theme.

```tsx
<Window id="main" title="My App" theme="dark">
  <Column padding={16}>
    <Text>Hello</Text>
  </Column>
</Window>
```

The `Theme` type is a union:

```typescript
type Theme = BuiltinTheme | string | Record<string, unknown>
```

`BuiltinTheme` covers the names the renderer recognizes. Any other
string is passed through and the renderer rejects it with a
diagnostic. The object form is a custom palette (see below).

### Built-in themes

| Name | Description |
|---|---|
| `"light"` | Default light palette |
| `"dark"` | Default dark palette |
| `"system"` | Follow the operating system light/dark preference |
| `"dracula"` | [Dracula](https://draculatheme.com/) palette |
| `"nord"` | [Nord](https://www.nordtheme.com/) palette |
| `"solarized"` | [Solarized](https://ethanschoonover.com/solarized/) palette |
| `"gruvbox"` | [Gruvbox](https://github.com/morhetz/gruvbox) palette |
| `"catppuccin"` | [Catppuccin](https://catppuccin.com/) palette |
| `"tokyo_night"` | [Tokyo Night](https://github.com/enkia/tokyo-night-vscode-theme) palette |
| `"kanagawa"` | [Kanagawa](https://github.com/rebelot/kanagawa.nvim) palette |
| `"moonfly"` | [moonfly](https://github.com/bluz71/vim-moonfly-colors) palette |
| `"nightfly"` | [nightfly](https://github.com/bluz71/vim-nightfly-colors) palette |
| `"oxocarbon"` | [Oxocarbon](https://github.com/nyoom-engineering/oxocarbon.nvim) palette |
| `"ferra"` | [Ferra](https://github.com/casperstorm/ferra) palette |

### Custom themes

`customTheme(name, palette)` builds a validated palette object. It
throws if any palette key is unknown, so typos fail at call time
instead of being silently dropped by the renderer.

```typescript
import { customTheme } from "plushie/ui"

const brand = customTheme("Brand", {
  background: "#1a1a2e",
  text: "#e0e0e8",
  primary: "#3b82f6",
  danger: "#ef4444",
})

<Window id="main" theme={brand}>
  ...
</Window>
```

The palette is built from three groups of keys.

**Core seeds** set the headline colors the renderer uses to derive
the rest of the palette:

| Key | Purpose |
|---|---|
| `background` | Window and surface background |
| `text` | Default text color |
| `primary` | Primary accent (buttons, focus rings) |
| `success` | Success indicators |
| `danger` | Error and destructive actions |
| `warning` | Warning indicators |

**Color-family shades** override specific tones inside a family.
Each of `primary`, `secondary`, `success`, `warning`, and `danger`
has three shades (`base`, `weak`, `strong`) plus matching text
variants. The full key shape is `<family>_<shade>` or
`<family>_<shade>_text`:

```
primary_base       primary_base_text
primary_weak       primary_weak_text
primary_strong     primary_strong_text
secondary_base     secondary_base_text
...
danger_strong      danger_strong_text
```

**Background shades** cover the eight levels the renderer uses for
window surfaces, cards, and elevated panels. Each level has a text
variant:

```
background_base         background_base_text
background_weakest      background_weakest_text
background_weaker       background_weaker_text
background_weak         background_weak_text
background_neutral      background_neutral_text
background_strong       background_strong_text
background_stronger     background_stronger_text
background_strongest    background_strongest_text
```

Only keys from these three groups are accepted. An unknown key
throws at `customTheme` call time:

```
Error: Unknown key "accent" in custom theme. Valid keys: background, background_base, ...
```

If you need the list programmatically, read
`customTheme("probe", {})` and inspect the thrown error, or refer
to the `VALID_CUSTOM_KEYS` set in `plushie/ui/types`.

### Extending built-in themes

To start from a built-in and tweak a few keys, combine the built-in
name as the `base` seed with the shades you want to override.
Built-in themes can serve as the `base` inside a `StyleMap`, but for
a full theme override the pattern is to supply the seeds and shades
directly:

```typescript
const nordPlus = customTheme("Nord+", {
  primary: "#88c0d0",
  primary_strong: "#5e81ac",
})
```

### Subtree theming with Themer

The `Themer` widget applies a different theme to a subtree without
disturbing the rest of the window. Children of the `Themer` use the
passed-in theme; siblings outside it keep the window theme.

```tsx
import { Column, Row, Themer } from "plushie/ui"

<Column padding={16}>
  <Row>
    <Text>Main content uses the window theme</Text>
  </Row>
  <Themer id="sidebar" theme="dark">
    <Column>
      <Text>Always dark, even on a light window</Text>
    </Column>
  </Themer>
</Column>
```

The function form takes the theme first and the children array
second:

```typescript
import { themer, column, text } from "plushie/ui"

themer("dark", [
  column({ padding: 12 }, [text("Always dark")]),
])
```

## App-level theme

The default theme for every window can be set once in
`AppSettings.theme` and applied at startup. Individual windows still
override it per-window with their own `theme` prop.

```typescript
import { app } from "plushie"
import { Window, Text } from "plushie/ui"

const myApp = app({
  init: { count: 0 },
  view: (s) => (
    <Window id="main" title="App">
      <Text>{`${s.count}`}</Text>
    </Window>
  ),
  update: (s) => s,
  settings: { theme: "dark" },
})

myApp.run()
```

The settings-level theme accepts the same shapes as the window prop:
a built-in name, a custom theme object from `customTheme`, or a raw
record for advanced cases. It is sent in the initial `settings`
message before the first view render.

## Validation errors

Errors thrown during encoding surface as thrown exceptions at view
build time, which the runtime propagates as a render failure rather
than silently dropping invalid styles.

| Source | Condition |
|---|---|
| `encodeBorder` | `width < 0` |
| `encodeBorder` | `radius < 0` (uniform or per-corner) |
| `encodeLength` | `number < 0` or `fillPortion < 1` |
| `encodePadding` | any side `< 0` |
| `customTheme` | palette key not in the valid-key set |

Unknown theme names passed as strings are not validated at the SDK
boundary; the renderer rejects them and emits a diagnostic event
(see [Events](events.md)).

## See also

- [Built-in Widgets](built-in-widgets.md)
- [Accessibility](accessibility.md)
- [Configuration](configuration.md)
- [Events](events.md)
- [Wire Protocol](wire-protocol.md)
