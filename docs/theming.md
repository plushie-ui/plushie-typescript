# Theming

Plushie exposes iced's theming system directly. No additional
abstraction layer, no token system, no design system framework.
If you need those, build them in your app.

## Setting a theme

Themes are set at the window level:

```tsx
<Window id="main" title="My App">
  <Themer id="theme" theme="catppuccin_mocha">
    <Column>
      <Text>Themed content</Text>
    </Column>
  </Themer>
</Window>
```

## Built-in themes

Iced ships with 22 built-in themes. Plushie passes the theme name
string directly to the renderer, which resolves it to an iced `Theme`
variant.

All 22 built-in themes:

| Name | Description |
|---|---|
| `light` | Default light theme |
| `dark` | Default dark theme |
| `dracula` | Dracula color scheme |
| `nord` | Nord color scheme |
| `solarized_light` | Solarized Light |
| `solarized_dark` | Solarized Dark |
| `gruvbox_light` | Gruvbox Light |
| `gruvbox_dark` | Gruvbox Dark |
| `catppuccin_latte` | Catppuccin Latte (light) |
| `catppuccin_frappe` | Catppuccin Frappe |
| `catppuccin_macchiato` | Catppuccin Macchiato |
| `catppuccin_mocha` | Catppuccin Mocha (dark) |
| `tokyo_night` | Tokyo Night |
| `tokyo_night_storm` | Tokyo Night Storm |
| `tokyo_night_light` | Tokyo Night Light |
| `kanagawa_wave` | Kanagawa Wave |
| `kanagawa_dragon` | Kanagawa Dragon |
| `kanagawa_lotus` | Kanagawa Lotus |
| `moonfly` | Moonfly |
| `nightfly` | Nightfly |
| `oxocarbon` | Oxocarbon |
| `ferra` | Ferra |

Unknown names fall back to `dark`.

## Custom themes

Custom themes are defined by providing a palette object:

```typescript
const myTheme = {
  background: '#1e1e2e',
  text: '#cdd6f4',
  primary: '#89b4fa',
  success: '#a6e3a1',
  danger: '#f38ba8',
  warning: '#f9e2af',
}
```

Then pass it to a `Themer` widget or window:

```tsx
<Window id="main" title="My App" theme={myTheme}>
  ...
</Window>

// Or via Themer for a subtree:
<Themer id="appTheme" theme={myTheme}>
  ...
</Themer>
```

The palette is passed to iced's `Theme::custom()` with Oklch-based
palette generation (plushie-iced). Only the colors you specify are
overridden; the rest are derived automatically.

## Extended palette shade overrides

When you set a custom theme, iced generates an "extended palette" of
shade variants from your six core colors. These shades (strong, weak,
base, etc.) control how widgets render their backgrounds, borders,
and text in different states. By default the shades are derived
automatically using iced's Oklch-based color math.

If the auto-generated shades don't match your design, you can override
individual shades by adding flat keys to the theme object. Only the
shades you specify are replaced; the rest keep their generated
values.

### Why override shades?

- Pin a specific button hover or pressed color
- Ensure WCAG contrast ratios on specific shade/text pairs
- Match an existing brand color system that doesn't follow iced's
  derivation

### Key naming convention

For the five color families (primary, secondary, success, warning,
danger), each has three shade levels:

| Key | What it controls |
|-----|------------------|
| `{family}_base` | Base shade background |
| `{family}_weak` | Weak shade background |
| `{family}_strong` | Strong shade background |
| `{family}_base_text` | Text color on the base shade |
| `{family}_weak_text` | Text color on the weak shade |
| `{family}_strong_text` | Text color on the strong shade |

Where `{family}` is one of: `primary`, `secondary`, `success`,
`warning`, `danger`.

The background family has eight levels:

| Key | What it controls |
|-----|------------------|
| `background_base` | Base background |
| `background_weakest` | Weakest background shade |
| `background_weaker` | Weaker background shade |
| `background_weak` | Weak background shade |
| `background_neutral` | Neutral background shade |
| `background_strong` | Strong background shade |
| `background_stronger` | Stronger background shade |
| `background_strongest` | Strongest background shade |

Each background key also supports a `_text` suffix (e.g.
`background_weakest_text`).

### Example

```typescript
const brandedTheme = {
  background: '#1a1a2e',
  text: '#e0e0e0',
  primary: '#0f3460',
  // Override the strong primary shade and its text color
  primary_strong: '#1a5276',
  primary_strong_text: '#ffffff',
  // Pin the weakest background for sidebar panels
  background_weakest: '#0d0d1a',
}
```

```tsx
<Themer id="branded" theme={brandedTheme}>
  ...
</Themer>
```

Shade overrides only apply to custom themes (palette objects).
Built-in theme strings like `"dark"` or `"nord"` are not affected.

## Per-subtree theme override

Themes can be overridden for a subtree using the `Themer` widget:

```tsx
<Column>
  <Text>Uses window theme</Text>
  <Themer id="sidebarTheme" theme="nord">
    <Container id="sidebar">
      <Text>Uses Nord theme</Text>
    </Container>
  </Themer>
</Column>
```

This is useful for panels, modals, or sections that need a different
visual treatment. Themer nodes nest: an inner themer overrides the
outer one for its subtree.

**Note:** The `Themer` widget does not support `"system"` as a theme
value. Setting a themer's theme to `"system"` is treated as "no
override" (the parent theme passes through). Use `"system"` on window
nodes or in `settings` instead.

## Widget-level styling

Individual widgets accept a `style` prop. This can be a named preset
string or a `StyleMap` object for per-instance visual customization.

### Named presets

```tsx
<Button id="save" style="primary">Save</Button>
<Button id="cancel" style="secondary">Cancel</Button>
<Button id="delete" style="danger">Delete</Button>
```

Style strings (`:primary`, `:secondary`, `:danger`, etc.) map to
iced's built-in style functions. Available presets vary by widget.

### Style maps

Style maps let you fully customize widget appearance from TypeScript
without writing Rust. They work on all styleable widgets: button,
container, text_input, text_editor, checkbox, radio, toggler,
pick_list, progress_bar, rule, slider, vertical_slider, and tooltip.

```tsx
const cardStyle = {
  background: '#ffffff',
  textColor: '#1a1a1a',
  border: { radius: 8, width: 1, color: '#e0e0e0' },
  shadow: { color: '#00000020', offsetX: 0, offsetY: 2, blurRadius: 8 },
}

<Container id="card" style={cardStyle}>
  <Text>Card content</Text>
</Container>
```

### StyleMap fields

```typescript
interface StyleMap {
  base?: string           // extend from a preset
  background?: Color      // background color or gradient
  textColor?: Color       // text/foreground color
  border?: Border         // border specification
  shadow?: Shadow         // drop shadow
  hovered?: Partial<StyleMap>   // overrides when hovered
  pressed?: Partial<StyleMap>   // overrides when pressed
  disabled?: Partial<StyleMap>  // overrides when disabled
  focused?: Partial<StyleMap>   // overrides when focused
}
```

### Status overrides

Style maps support interaction state overrides. Each override is a
partial style map that is merged on top of the base when the widget
enters that state:

```typescript
const navItemStyle = {
  background: '#00000000',
  textColor: '#cccccc',
  hovered: { background: '#333333', textColor: '#ffffff' },
  pressed: { background: '#222222' },
  disabled: { textColor: '#666666' },
}
```

Supported statuses: `hovered`, `pressed`, `disabled`, `focused`.

If you don't specify an override for a status, the renderer
auto-derives:

- **hovered**: darkens background by 10%
- **pressed**: uses the base style (matching iced's own pattern)
- **disabled**: applies 50% alpha to background and textColor

This means hover and disabled states "just work" without explicit
overrides in most cases. You only need explicit overrides when you
want a specific look.

### Presets and style maps together

Style maps don't replace presets; they complement them. Use presets
for standard looks and style maps when you need custom appearance:

```tsx
{/* Standard danger button */}
<Button id="delete" style="danger">Delete</Button>

{/* Custom branded button */}
<Button id="cta" style={{
  background: '#7c3aed',
  textColor: '#ffffff',
  border: { radius: 24 },
}}>Get Started</Button>
```

See [composition-patterns.md](composition-patterns.md) for concrete
examples of building polished UI patterns with style maps.

## System theme detection

The simplest way to follow the OS light/dark preference is to set
the window theme to `"system"`:

```tsx
<Window id="main" theme="system">
  ...
</Window>
```

The renderer tracks the current OS mode and applies Light or Dark
automatically. This also works in the app settings:

```typescript
app({
  settings: {
    theme: 'system',
  },
  // ...
})
```

For manual control, subscribe to theme change events with
`Subscription.onThemeChange()`:

```typescript
app({
  subscriptions: () => [Subscription.onThemeChange('themeChanged')],

  update(state, event) {
    if (isSystem(event, 'theme_changed')) {
      // event.data is "light" or "dark"
      return { ...state, preferredTheme: event.data as string }
    }
    return state
  },
})
```

Your app can use this to follow the system theme or ignore it
entirely.

## Density

For apps that need density-aware spacing (compact, comfortable,
roomy), build a simple helper function in your app:

```typescript
type Density = 'compact' | 'comfortable' | 'roomy'
type Size = 'sm' | 'md' | 'lg'

function spacing(density: Density, size: Size): number {
  const table: Record<Density, Record<Size, number>> = {
    compact:     { sm: 2, md: 4,  lg: 8 },
    comfortable: { sm: 4, md: 8,  lg: 16 },
    roomy:       { sm: 8, md: 12, lg: 24 },
  }
  return table[density][size]
}
```

```tsx
<Column spacing={spacing('compact', 'md')}>
  ...
</Column>
```

There is no global density setting or built-in density module; your
app decides how to handle it. This keeps the framework lean and lets
you define density semantics that match your design system.

## Global defaults

Set default font and text size in the app settings:

```typescript
app({
  settings: {
    defaultFont: { family: 'Inter', weight: 'normal' },
    defaultTextSize: 14,
    theme: 'dark',
    antialiasing: true,
  },
  // ...
})
```
