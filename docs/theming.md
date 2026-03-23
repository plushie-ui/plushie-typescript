# Theming

Plushie exposes iced's theming system directly. No additional
abstraction layer, no token system, no design system framework.
If you need those, build them in your app.

## Setting a theme

Themes are set at the window level or via the `Themer` widget:

```tsx
<Window id="main" title="My App" theme="catppuccin">
  <Column>
    <Text>Themed content</Text>
  </Column>
</Window>
```

Or override the theme for a subtree:

```tsx
<Themer id="dark-section" theme="dark">
  <Container id="sidebar" padding={16}>
    <Text>This section uses the dark theme</Text>
  </Container>
</Themer>
```

## Built-in themes

The renderer includes 22 built-in themes from iced:

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

## System theme

Use `"system"` to follow the OS light/dark preference:

```tsx
<Window id="main" theme="system">...</Window>
```

The renderer detects the current OS theme and applies the matching
built-in light or dark theme. Theme changes are delivered as events
via `Subscription.onThemeChange()`.

## Custom palettes

Pass a palette object instead of a theme name:

```tsx
<Window id="main" theme={{
  background: '#1a1a2e',
  text: '#e0e0e0',
  primary: '#0f3460',
}}>
  ...
</Window>
```

## Per-widget styling

Individual widgets accept a `style` prop for overrides. The style can
be a preset name or a `StyleMap` object:

```tsx
// Preset:
<Button id="save" style="primary">Save</Button>

// Custom:
<Button id="danger" style={{
  base: 'danger',
  background: '#cc0000',
  hovered: { background: '#ee0000' },
  pressed: { background: '#aa0000' },
}}>Delete</Button>
```

### StyleMap

```typescript
{
  base?: string           // extend from a preset
  background?: Color      // background color or gradient
  textColor?: Color       // text/foreground color
  border?: Border         // border specification
  shadow?: Shadow         // drop shadow
  hovered?: { ... }       // overrides when hovered
  pressed?: { ... }       // overrides when pressed
  disabled?: { ... }      // overrides when disabled
  focused?: { ... }       // overrides when focused
}
```

Each status override (`hovered`, `pressed`, `disabled`, `focused`)
accepts the same fields: `background`, `textColor`, `border`,
`shadow`.

## Global defaults

Set default font and text size in the app settings:

```typescript
app({
  settings: {
    defaultFont: { family: 'Inter', weight: 'normal' },
    defaultTextSize: 14,
    theme: 'dark',
  },
  ...
})
```
