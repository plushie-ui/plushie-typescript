# Styling

With the layout in place, it is time to make the pad look good.
Plushie has a layered styling system: themes set the overall
palette, per-widget style presets override individual elements,
and prop types like `Border`, `Shadow`, and `StyleMap` (all
exported from `plushie/ui`) handle the details.

This chapter covers the parts you will use most often. The full
theme list, shade override keys, and every accepted prop value are
in the [Themes and Styling reference](../reference/themes-and-styling.md).

## Themes

Every `Window` has a `theme` prop that sets the palette for every
widget inside it. Plushie ships with a set of built-in themes
exposed via the `BuiltinTheme` string union:

```tsx
import { Window } from "plushie/ui"

<Window id="main" title="Plushie Pad" theme="dark">
  {/* all widgets inside use the dark palette */}
</Window>
```

The pad uses `theme: "dark"` on its main window, which is enough
to retint every button, text input, and scrollbar to match. Other
built-in options include `"light"`, `"nord"`, `"dracula"`,
`"solarized"`, `"gruvbox"`, `"catppuccin"`, `"tokyo_night"`,
`"kanagawa"`, `"moonfly"`, `"nightfly"`, `"oxocarbon"`, and
`"ferra"`. Pick one for the main window and the rest of the UI
falls in line.

Use `"system"` to follow the operating system's light / dark
preference:

```tsx
<Window id="main" title="Plushie Pad" theme="system">
  {/* follows OS theme */}
</Window>
```

The same string can be passed through the `settings.theme` field
on the app so it applies before the first window opens. The pad
sets both: `theme: "dark"` on the `Window` and `theme: "dark"` on
`settings`, which keeps the startup flash consistent with the
steady state.

Try a few variants on the pad's window to see how the entire UI
adapts. Buttons, text inputs, scrollbars, and the editor all
respond.

## Custom themes

`customTheme(name, palette)` builds a validated custom theme
object from a record of seed colours. The function rejects
unknown keys at call time, which catches typos before the theme
reaches the renderer:

```tsx
import { customTheme, Window } from "plushie/ui"

const brand = customTheme("My Brand", {
  primary: "#3b82f6",
  danger: "#ef4444",
  background: "#1a1a2e",
  text: "#e0e0e8",
})

<Window id="main" title="Plushie Pad" theme={brand}>
  {/* ... */}
</Window>
```

The seed keys understood by `customTheme` are `background`,
`text`, `primary`, `success`, `danger`, and `warning`. Beyond the
seeds, every shade slot in the generated palette is also
overridable. Shade keys take the form
`<family>_<shade>` or `<family>_<shade>_text`, where family is
one of `primary`, `secondary`, `success`, `warning`, `danger`
(with shades `base`, `weak`, `strong`) or `background` (with
shades `base`, `weakest`, `weaker`, `weak`, `neutral`, `strong`,
`stronger`, `strongest`).

```tsx
const fine = customTheme("Fine Grained", {
  primary: "#3b82f6",
  primary_strong: "#1d4ed8",
  background_weak: "#1f2937",
  danger_base_text: "#ffffff",
})
```

Unknown keys throw immediately with the full list of valid keys
in the message, so a typo like `primary_stronger` surfaces on the
next run.

## Subtree theming

The `Themer` widget applies a different theme to its children
without affecting the rest of the window:

```tsx
import { Column, Container, Text, Themer } from "plushie/ui"

<Column id="body">
  <Text id="light-text">This is light themed</Text>
  <Themer id="dark-section" theme="dark">
    <Container id="sidebar" padding={12}>
      <Text id="dark-text">This section is dark</Text>
    </Container>
  </Themer>
</Column>
```

This is useful for a dark sidebar in a light app, brand-specific
sections, or any case where part of the UI needs a different
palette. `Themer` changes the theme context for everything inside
it.

You can give the pad's preview pane a different theme from the
rest of the editor so experiments render in a distinct palette:

```tsx
<Themer id="preview-theme" theme="light">
  <Container id="preview" width={{ fillPortion: 1 }} height="fill" padding={8}>
    {/* preview content */}
  </Container>
</Themer>
```

## Colour values

Anywhere a `Color` prop appears (`Text` `color`, `StyleMap`
`background`, `Border` `color`, and so on) the SDK accepts three
shapes:

```tsx
<Text id="a" color="#3b82f6">hex</Text>
<Text id="b" color="cornflowerblue">named</Text>
<Text id="c" color={{ r: 0.23, g: 0.51, b: 0.96 }}>rgba record</Text>
```

Hex accepts the short forms (`#rgb`, `#rgba`) and the long forms
(`#rrggbb`, `#rrggbbaa`); the SDK normalises everything to
`#rrggbbaa` on the wire. Named colours come from the CSS Color
Module Level 4 set; the full map is exported as `namedColors` if
you need to look one up. The RGBA record uses `0.0 - 1.0` floats;
`a` is optional and defaults to fully opaque.

## Preset styles on widgets

The fastest way to style a widget is a preset name. Every
style-aware widget accepts a string in its `style` prop and maps
it to the renderer's named preset for that widget:

```tsx
<Button id="save" style="primary" onClick={save}>Save</Button>
<Button id="cancel" style="secondary" onClick={cancel}>Cancel</Button>
<Button id="delete" style="danger" onClick={remove}>Delete</Button>
```

The pad uses this pattern on its file rows: the active file gets
`style="primary"` and the inactive ones get `style="secondary"`,
and the trailing `x` delete button is always `style="danger"`.

Available presets vary per widget. `"primary"`, `"secondary"`,
`"success"`, `"danger"`, `"warning"`, and `"text"` are common for
buttons. `Container` recognises preset names like
`"rounded_box"`, `"bordered_box"`, and `"dark"`. See
[Built-in widgets](../reference/built-in-widgets.md) for each
widget's supported presets.

## Full StyleMap objects

When a preset is not enough, pass a `StyleMap` object. The object
form accepts a `base` preset to extend, a `background`, a
`textColor`, a `border`, a `shadow`, and per-status override
blocks:

```tsx
import { Button } from "plushie/ui"

<Button
  id="save"
  style={{
    background: "#3b82f6",
    textColor: "#ffffff",
    border: { color: "#1d4ed8", width: 1, radius: 6 },
    shadow: { color: "#00000033", offsetY: 2, blurRadius: 4 },
  }}
  onClick={save}
>
  Save
</Button>
```

The sidebar wrapper in the pad uses a minimal `StyleMap` to draw
a single dividing edge:

```tsx
<Container
  id="sidebar-wrap"
  width={200}
  height="fill"
  style={{ border: { color: "#333333", width: 1 } }}
>
  {/* sidebar children */}
</Container>
```

Only the fields you set are applied. Unset fields inherit from
the active theme.

### Status overrides

`hovered`, `pressed`, `disabled`, and `focused` each take the
same shape as the base block and apply while the widget is in
that state. Unset fields in the override inherit from the base,
which means you can change just the background on hover without
redeclaring the border:

```tsx
<Button
  id="save"
  style={{
    background: "#3b82f6",
    textColor: "#ffffff",
    border: { color: "#1d4ed8", width: 1, radius: 6 },
    hovered: { background: "#2563eb" },
    pressed: { background: "#1d4ed8" },
    disabled: { background: "#9ca3af", textColor: "#e5e7eb" },
    focused: { border: { color: "#60a5fa", width: 2, radius: 6 } },
  }}
  onClick={save}
>
  Save
</Button>
```

### Extending a preset

Set `base` to a preset name to start from a theme-aware preset
and override selected fields:

```tsx
<Button
  id="save"
  style={{ base: "primary", hovered: { background: "#2563eb" } }}
  onClick={save}
>
  Save
</Button>
```

## Borders and corner radius

`Border` is a plain object with optional `color`, `width`, and
`radius`. The radius can be a single number (uniform) or a
`CornerRadius` record with `topLeft`, `topRight`, `bottomRight`,
and `bottomLeft`:

```tsx
import { Container } from "plushie/ui"

<Container
  id="card"
  padding={16}
  style={{
    background: "#ffffff",
    border: {
      color: "#e5e7eb",
      width: 1,
      radius: { topLeft: 8, topRight: 8, bottomRight: 0, bottomLeft: 0 },
    },
  }}
>
  {/* card content */}
</Container>
```

Omitted corners default to `0`. Negative widths and negative
radius values throw at encode time, so malformed values surface
before the renderer sees them.

## Shadows

`Shadow` mirrors `Border`: a plain object with optional `color`,
`offsetX`, `offsetY`, and `blurRadius`:

```tsx
<Container
  id="card"
  padding={16}
  style={{
    background: "#ffffff",
    shadow: { color: "#00000022", offsetX: 0, offsetY: 2, blurRadius: 4 },
  }}
>
  {/* ... */}
</Container>
```

Omitted offsets default to `0`; the colour defaults to opaque
black if you omit it entirely but pass some other shadow field.

## Gradients

Linear gradients are built with `linearGradient(from, to, stops)`
or `linearGradientFromAngle(degrees, stops)`. Stops are
`[offset, color]` tuples where offset runs `0.0 - 1.0`. The
result is assignable anywhere a `StyleMap` background is
accepted:

```tsx
import { linearGradient, linearGradientFromAngle, Container } from "plushie/ui"

const header = linearGradient(
  [0, 0],
  [1, 1],
  [
    [0, "red"],
    [1, "blue"],
  ],
)

const sloped = linearGradientFromAngle(45, [
  [0, "#3b82f6"],
  [1, "#1d4ed8"],
])

<Container id="header" padding={16} style={{ background: header }}>
  {/* ... */}
</Container>
```

`linearGradientFromAngle` centres the gradient on the unit square
and rotates; use it when you want an angle in degrees without
computing endpoints yourself.

## Fonts

The `font` prop on text-bearing widgets (`Text`, `TextInput`,
`TextEditor`, `RichText`, `Markdown`) accepts three shapes:

```tsx
<Text id="a" font="default">system default</Text>
<Text id="b" font="monospace">system monospace</Text>
<Text id="c" font="Fira Code">loaded family</Text>
<Text
  id="d"
  font={{ family: "Inter", weight: "semi_bold", style: "italic", stretch: "normal" }}
>
  fully specified
</Text>
```

`FontWeight` accepts `"thin"`, `"extra_light"`, `"light"`,
`"normal"`, `"medium"`, `"semi_bold"`, `"bold"`, `"extra_bold"`,
and `"black"`. `FontStyle` accepts `"normal"`, `"italic"`, and
`"oblique"`. `FontStretch` accepts the nine CSS stretch keywords
from `"ultra_condensed"` through `"ultra_expanded"`.

Family names work when the font is either installed system-wide
or loaded through the app's `settings.fonts` list at startup. The
pad uses `font: "monospace"` on the `TextEditor` so source code
aligns regardless of the active theme.

## Building a small design system

Plushie does not ship a design system framework. Plain TypeScript
modules are enough: define a file of constants and reusable
`StyleMap` objects, then import them where they're needed. A
`design.ts` module for the pad works well:

```typescript
import type { StyleMap } from "plushie/ui"

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const
export const fontSize = { sm: 12, md: 14, lg: 18, xl: 24 } as const
export const radius = { sm: 4, md: 8, lg: 12 } as const

// Colours lifted from the pad's dark look.
export const divider = "#333333"
export const accent = "#3b82f6"
export const danger = "#ef4444"

export const sidebarWrap: StyleMap = {
  border: { color: divider, width: 1 },
}

export const card: StyleMap = {
  background: "#1f2937",
  border: { color: divider, width: 1, radius: radius.md },
  shadow: { color: "#00000033", offsetY: 2, blurRadius: 4 },
}
```

Then use the tokens in the view:

```tsx
import { Column, Container, Rule, Text } from "plushie/ui"
import { card, divider, fontSize, sidebarWrap, spacing } from "./design"

<Column id="sidebar" spacing={spacing.sm} padding={spacing.md}>
  <Text id="title" size={fontSize.lg}>Experiments</Text>
  <Rule color={divider} width={1} />
  <Container id="active-card" style={card} padding={spacing.md}>
    {/* ... */}
  </Container>
</Column>
```

This is ordinary TypeScript module design, no Plushie magic. As
the pad grows, a design module prevents drift toward inconsistent
spacing, sizes, and colours.

## Applying it: the styled pad

Put it all together. The pad's main window sets a dark theme, the
sidebar wrapper draws a one-pixel divider, file-row buttons use
`"primary"` for the active file and `"secondary"` for everything
else, and the delete button sits in `"danger"`:

```tsx
import { Button, Column, Container, Row, Scrollable, Window } from "plushie/ui"

<Window id="main" title="Plushie Pad" theme="dark">
  <Column id="root" width="fill" height="fill">
    <Row id="main-row" width="fill" height="fill">
      <Container
        id="sidebar-wrap"
        width={200}
        height="fill"
        style={{ border: { color: "#333333", width: 1 } }}
      >
        <Scrollable id="sidebar" height="fill">
          <Column id="files" spacing={4} padding={8}>
            {files.map((file) => (
              <Row id={file} spacing={4}>
                <Button
                  id="select"
                  style={file === active ? "primary" : "secondary"}
                  onClick={selectFile(file)}
                >
                  {file}
                </Button>
                <Button id="delete" style="danger" onClick={deleteFile(file)}>
                  x
                </Button>
              </Row>
            ))}
          </Column>
        </Scrollable>
      </Container>
      {/* editor and preview */}
    </Row>
  </Column>
</Window>
```

The dark theme transforms the entire pad. The primary save button
stands out. The sidebar border creates visual separation. Small
adjustments, dramatic result.

## Accessibility note: colour contrast

Styling choices have accessibility consequences. The built-in
themes are tuned for contrast, but custom palettes and ad-hoc
`StyleMap` overrides can drop below readable thresholds without
warning. When an override replaces a `background`, set
`textColor` to a colour that reaches at least WCAG AA contrast
against the new background. The same applies to `border` against
its surroundings and status overrides (hovered, pressed, focused)
against the base; a hover colour that fades into the background
disappears for low-vision users.

The [Accessibility reference](../reference/accessibility.md)
covers the related `A11y` props (roles, labels, live regions,
validation state). Colour alone never carries meaning: pair
colour cues with text, icons, or `a11y.label` so users who cannot
distinguish them still get the information.

## Verify it

Test that the styled pad still compiles and previews correctly:

```typescript
import { testWith } from "plushie/testing"
import pad from "./pad"

const test = testWith(pad)

test("styled pad compiles and previews", async ({ session }) => {
  await session.click("save")
  expect(session.find("#preview/greeting")?.text()).toBe("Hello, Plushie!")
  expect(session.find("#error")).toBeNull()
})
```

Styling is visual, but this confirms the theme, borders, and
style changes did not break the compile and preview flow.

## Try it

Write a styling experiment in the pad:

- Build a card: `Container` with a `border`, `shadow`, rounded
  corners, and padding.
- Try a `StyleMap` with `hovered`, `pressed`, and `focused`
  overrides on a button.
- Apply different themes to nested `Themer` widgets and watch
  how palettes compose.
- Build a `design.ts` module for your experiments with a spacing
  scale, a palette, and reusable `StyleMap` values.
- Swap `theme="dark"` for `"nord"`, `"dracula"`, or a
  `customTheme(...)` and see how the pad reshapes.

In the next chapter, we will add animations and transitions to
make the pad feel alive.

---

Next: [Animation and Transitions](09-animation.md)
