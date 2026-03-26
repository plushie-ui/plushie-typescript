# Accessibility

Plushie integrates with the platform accessibility layer via
[accesskit](https://github.com/AccessKit/accesskit). Screen readers,
keyboard navigation, and other assistive technologies work out of
the box for built-in widgets.

## Automatic accessibility

Built-in widgets automatically expose their role, label, and state
to the accessibility tree:

- `Button` has role `"button"` and announces its label
- `TextInput` has role `"text_input"` with description from placeholder
- `Checkbox` announces its toggled state
- `Slider` announces its value
- `Image` uses its `alt` prop as the accessible label

No configuration needed for basic accessibility.

## The a11y prop

Every widget accepts an `a11y` prop for explicit overrides:

```tsx
<Button id="save" a11y={{ label: 'Save document', description: 'Saves all changes to disk' }}>
  Save
</Button>

<Image id="logo" source="logo.png" alt="Company logo" />

<Slider id="volume" value={state.volume} range={[0, 100]}
  label="Volume" a11y={{ orientation: 'horizontal' }} />
```

### Available fields

| Field | Type | Description |
|---|---|---|
| `role` | string | Accessible role (e.g., `"button"`, `"slider"`) |
| `label` | string | Primary accessible label |
| `description` | string | Extended description |
| `hidden` | boolean | Hide from assistive technology |
| `expanded` | boolean | Expanded/collapsed state |
| `required` | boolean | Required field indicator |
| `level` | number | Heading level (1-6) |
| `live` | `'off' \| 'polite' \| 'assertive'` | Live region mode |
| `busy` | boolean | Suppresses AT announcements until cleared (auto-managed by sliders during drag; set explicitly for custom continuous interactions) |
| `invalid` | boolean | Validation failed |
| `modal` | boolean | Modal container |
| `readOnly` | boolean | Read-only field |
| `mnemonic` | string | Keyboard mnemonic (single char) |
| `toggled` | boolean | Toggle state |
| `selected` | boolean | Selection state |
| `value` | string | Value announced by AT |
| `orientation` | `'horizontal' \| 'vertical'` | Orientation |
| `labelledBy` | string | ID of the labelling element |
| `describedBy` | string | ID of the describing element |
| `errorMessage` | string | ID of the error message element |
| `disabled` | boolean | Widget is disabled |
| `positionInSet` | number | Position in set (1-based) |
| `sizeOfSet` | number | Total items in set |
| `hasPopup` | string | Popup type |

### Cross-references

`labelledBy`, `describedBy`, and `errorMessage` reference other
widgets by ID. Inside scoped containers, the references are
resolved automatically:

```tsx
<Container id="form">
  <Text id="emailLabel">Email:</Text>
  <TextInput id="email" value={state.email}
    a11y={{ labelledBy: 'emailLabel' }} />
  <Text id="emailError" color="red">{state.emailError}</Text>
</Container>
```

On the wire, `labelledBy` becomes `"form/emailLabel"`. See
[Scoped IDs](scoped-ids.md).

## Announcements

Trigger a screen reader announcement without a visible widget:

```typescript
Command.announce('File saved successfully')
```

In headless and mock modes, announcements produce a synthetic
`announce` event for testing.

## Busy state and continuous interactions

When a value changes rapidly (e.g. during a slider drag or canvas
interaction), setting `busy: true` on the node suppresses AT
announcements until `busy` clears. AT then announces the final
value once, avoiding a flood of intermediate announcements. This
maps to WAI-ARIA `aria-busy`.

**Built-in widgets handle this automatically.** Sliders set
`busy: true` during drag and clear it on release. No SDK code
needed.

**For app-managed live regions** that reflect values from a
continuous interaction (e.g. a text display showing a hex color
while the user drags a canvas), set `busy` explicitly:

```tsx
<Text id="hex" a11y={{ live: 'polite', busy: state.drag !== null }}>
  {hexValue}
</Text>
```

When the drag ends, `busy` clears and the screen reader announces
the final hex value.

## Widget-specific props

Some widgets have accessibility-related top-level props:

| Widget | Prop | Description |
|---|---|---|
| `Image`, `Svg`, `QrCode`, `Canvas` | `alt` | Accessible label |
| `Image`, `Svg` | `description` | Extended description |
| `Image`, `Svg` | `decorative` | Hide from AT (purely visual) |
| `Slider`, `VerticalSlider` | `label` | Accessible label |
| `ProgressBar` | `label` | Accessible label |

## Testing accessibility

Use the `assertA11y` and `assertRole` test helpers:

```typescript
await session.assertRole('saveButton', 'button')
await session.assertA11y('emailInput', {
  label: 'Email address',
  required: true,
})
```

## Canvas accessibility

Interactive canvas shapes participate in the accessibility tree.
Add an `a11y` field to the shape's `interactive` descriptor:

```typescript
interactive(rect(10, 50, 30, 200, { fill: '#3498db' }), {
  id: 'bar-jan',
  onClick: true,
  a11y: { role: 'button', label: 'January: 200 units' },
})
```

Canvas keyboard navigation:
- Tab enters/exits the canvas
- Arrow keys move between interactive shapes
- Enter/Space activates the focused shape
- Home/End jump to first/last shape
