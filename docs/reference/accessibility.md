# Accessibility

Plushie integrates with platform accessibility services via
[AccessKit](https://github.com/AccessKit/accesskit): VoiceOver on
macOS, AT-SPI/Orca on Linux, UI Automation/NVDA/JAWS on Windows.
Most accessibility semantics are inferred automatically from widget
types. The `a11y` prop on every widget (typed by the `A11y`
interface in `plushie/ui`) is available for explicit overrides.

## Accessible by default

Built-in widgets seed a default role and expose their state to the
platform without any application-side work. A button announces
itself as a button; a checkbox reports its checked state; a slider
reports its numeric value and range. Interactive widgets
(`TextInput`, `Slider`, `PickList`, `ComboBox`) also project a
`validation` prop onto `a11y.invalid` and `a11y.errorMessage`
automatically, so screen readers announce validation errors
without extra plumbing.

When the default role is wrong, the label is context-dependent, or
one widget labels another, use the `a11y` prop:

```tsx
<Button id="save" a11y={{ description: "Save the current document" }}>
  Save
</Button>

<TextInput
  id="email"
  value={state.email}
  a11y={{ required: true, labelledBy: "email-label" }}
/>
```

The call site is always camelCase. The encoder in
`plushie/ui` (`encodeA11y`) maps to snake_case on the wire.

## The A11y interface

```typescript
import type { A11y } from "plushie/ui"
```

All fields are optional.

| Field | Type | Description |
|---|---|---|
| `role` | `string` | Override the default role. |
| `label` | `string` | Accessible name (override the inferred label). |
| `description` | `string` | Longer description read after the label. |
| `hidden` | `boolean` | Exclude the widget from the accessibility tree. |
| `expanded` | `boolean` | Disclosure state (combobox, menu). |
| `required` | `boolean` | Form field is required. |
| `level` | `number` | Heading level (1 to 6). |
| `live` | `"off" \| "polite" \| "assertive"` | Live region announcement mode. |
| `busy` | `boolean` | Suppress announcements while content updates. |
| `invalid` | `boolean` | Form validation error state. |
| `modal` | `boolean` | Dialog traps focus while open. |
| `readOnly` | `boolean` | Value is readable but not editable. |
| `mnemonic` | `string` | Keyboard mnemonic. Single character; longer strings throw at build time. |
| `toggled` | `boolean` | Toggle or checked state. |
| `selected` | `boolean` | Selection state. |
| `value` | `string` | Current value reported to assistive technology. |
| `orientation` | `"horizontal" \| "vertical"` | Layout orientation hint. |
| `labelledBy` | `string` | ID of the widget that provides this widget's label. |
| `describedBy` | `string` | ID of the widget that provides a longer description. |
| `errorMessage` | `string` | ID of the widget that shows the validation error. |
| `disabled` | `boolean` | Disabled state override. |
| `positionInSet` | `number` | 1-based position in a group. |
| `sizeOfSet` | `number` | Total items in the group. |
| `hasPopup` | `"listbox" \| "menu" \| "dialog" \| "tree" \| "grid"` | Popup type anchored to this widget. |
| `activeDescendant` | `string` | ID of the currently active descendant (combobox, listbox). |
| `radioGroup` | `string` | Group identifier shared by sibling radios. |

### camelCase to snake_case mapping

The TypeScript call site is camelCase. `encodeA11y` rewrites
compound field names to snake_case before they cross the wire:
`readOnly` to `read_only`, `labelledBy` to `labelled_by`,
`describedBy` to `described_by`, `errorMessage` to `error_message`,
`positionInSet` to `position_in_set`, `sizeOfSet` to `size_of_set`,
`hasPopup` to `has_popup`, `activeDescendant` to
`active_descendant`, `radioGroup` to `radio_group`. Fields not in
that list pass through with the same name on both sides.

Wire names only matter when you are reading the wire protocol
reference or a decoded event. In application code, always write
camelCase.

## Default roles

`applyA11yDefaults` in `plushie/ui/build` merges a widget's default
role with any user-supplied `a11y` map. User fields win over
defaults, so passing `a11y={{ role: "link" }}` on a button replaces
the default.

| Widget | Default role |
|---|---|
| `Button` | `button` |
| `Text`, `RichText` | `label` |
| `TextInput` | `text_input` |
| `TextEditor` | `multiline_text_input` |
| `Checkbox` | `check_box` |
| `Toggler` | `switch` |
| `Radio` | `radio_button` |
| `Slider`, `VerticalSlider` | `slider` |
| `PickList`, `ComboBox` | `combo_box` (with `hasPopup: "listbox"`) |
| `ProgressBar` | `progress_indicator` |
| `Scrollable` | `scroll_view` |
| `Image`, `Svg`, `QrCode` | `image` |
| `Canvas` | `canvas` |
| `Table` | `table` |
| `PaneGrid` | `group` |
| `Rule` | `splitter` |
| `Window` | `window` |
| `Markdown` | `document` |
| `Tooltip` | `tooltip` |

Layout containers (`Column`, `Row`, `Container`, `Stack`, `Grid`,
`KeyedColumn`, `Space`, `Pin`, `Floating`, `Overlay`, `Responsive`,
`Themer`, `Sensor`, `PointerArea`) do not seed a role. They accept
the `a11y` prop for explicit annotation, but without one they
fall through to the renderer's `generic_container`, which is
filtered from the accessibility tree. Screen reader users navigate
through the semantic content inside them without encountering
layout wrappers.

## Accessible name computation

When a screen reader announces a widget, it reports the widget's
**accessible name**. The name is determined in this order:

1. **Direct label.** If `a11y.label` is set, or the widget infers
   a label from its own prop (button child, checkbox `label`, image
   `alt`, text_input `placeholder`), that wins.
2. **Labelled-by.** If no direct label, the renderer follows
   `a11y.labelledBy` to another widget and uses its text content.
   For roles that support name-from-contents (button, checkbox,
   radio, link), descendant text is used automatically.
3. **No name.** The screen reader announces only the role
   ("button", "slider"). This is almost always a bug in the tree.

Every interactive widget should end up with an accessible name.
The label-by-content path covers the common case for buttons and
checkboxes with text children; `TextInput` and `TextEditor` need
either a `placeholder`, an explicit `a11y.label`, or an
`a11y.labelledBy` pointing at a sibling `Text`.

## Validation and automatic a11y projection

`TextInput`, `TextEditor`, `Checkbox`, `PickList`, and `ComboBox`
accept a `validation` prop:

```tsx
<TextInput
  id="email"
  value={state.email}
  validation={state.emailError
    ? ["invalid", state.emailError]
    : "valid"}
/>
```

Accepted values:

| Value | Effect on a11y |
|---|---|
| `"valid"` | No a11y change. |
| `"pending"` | Sets `a11y.busy`. |
| `["invalid", message]` | Encodes as `{ state: "invalid", message }` and sets `a11y.invalid` plus `a11y.errorMessage`. |
| `{ state: "invalid", message }` | Same as the tuple form. |

The projection happens in the renderer normaliser, so the SDK
sends the raw `validation` field and the renderer merges it into
the final a11y map before it reaches AccessKit. You do not set
`a11y.invalid` yourself when you use `validation`.

## Screen reader announcements

Use `Command.announce` for transient messages that are not
attached to a visible widget: save confirmations, progress
updates, dismissed toasts.

```typescript
import { Command } from "plushie"
import type { AnnouncePoliteness } from "plushie"

Command.announce("Document saved")
Command.announce("Connection lost", "assertive")
```

The signature is
`announce(text: string, politeness?: AnnouncePoliteness)`.
`AnnouncePoliteness` is `"polite" | "assertive"`.

**Polite** announcements wait for a gap in the user's current
speech. This is the default and the right choice for toast-style
feedback, counters, and confirmations that do not require
immediate attention.

**Assertive** announcements interrupt whatever the screen reader
is currently saying. Reserve this for urgent, time-sensitive
messages: network failures, loss of user input, unrecoverable
errors. Overuse causes announcement storms and user annoyance.

For announcements that belong to a specific widget whose content
is updating in place (live counters, status text), prefer the
widget's own `a11y.live` field instead of a standalone
`announce`. That way the announcement is tied to the widget's
mount lifecycle rather than fired manually.

```tsx
<Text id="status" a11y={{ live: "polite" }}>
  {state.statusMessage}
</Text>
```

Do not set `live` on static content. The screen reader will
re-announce it on every tree rebuild even when the text hasn't
changed.

## Focus navigation

Keyboard focus moves through focusable widgets in document order.
`Tab` advances; `Shift+Tab` retreats. Built-in focus commands are
all in the `Command` namespace:

| Command | Description |
|---|---|
| `Command.focus(id)` | Focus a widget. Supports scoped `"window#path"`. |
| `Command.focusNext()` | Advance focus (equivalent to Tab). |
| `Command.focusPrevious()` | Retreat focus (equivalent to Shift+Tab). |
| `Command.focusNextWithin(scope)` | Cycle focus forward, bounded to a subtree. |
| `Command.focusPreviousWithin(scope)` | Cycle focus backward, bounded to a subtree. |
| `Command.selectAll(id)` | Select all text in an input. |

The `Within` variants wrap at the subtree boundary, keeping the
Tab cycle bounded. Useful for menu bars, pane grids, and modal
dialogs that should not leak focus to siblings. See the
[Commands reference](commands.md) for full constructor details.

```typescript
function handleModalShown(state) {
  return [state, Command.focus("confirm-dialog#ok")]
}
```

Focus follows the **focus-visible** pattern: focus rings appear
on keyboard navigation but are suppressed on mouse clicks.

## Keyboard navigation

The renderer ships keyboard navigation at the AccessKit layer.
The SDK surfaces widget events for inline handling; the
underlying keys follow platform conventions:

| Keys | Behaviour |
|---|---|
| `Tab` / `Shift+Tab` | Cycle focus through focusable widgets. |
| `Space` / `Enter` | Activate the focused widget. |
| Arrow keys | Navigate within sliders, lists, pick lists. |
| `F6` / `Shift+F6` | Cycle focus between `PaneGrid` panes. |
| `Escape` | Close popups and dismiss modals. |

Assistive technology actions (VoiceOver "activate", JAWS "press")
produce the same widget event (`click`, `toggle`, `input`) as
direct interaction. There is no special handling required in
`update` or inline handlers.

## Disabled vs read-only

These are semantically different:

| State | Meaning | Screen reader behaviour |
|---|---|---|
| `disabled` | Not currently usable | Often skipped in Tab navigation; announced as "dimmed" or "unavailable". |
| `readOnly` | Readable but not editable | Fully navigable; edit commands blocked. |

Use `disabled` for controls gated on other state (a Submit button
that enables only when the form is valid). Use `readOnly` for
values the user can select and copy but not change.

## Mnemonic enforcement

`a11y.mnemonic` is validated at encode time. A non-single-character
value throws:

```typescript
<Button id="save" a11y={{ mnemonic: "S" }}>Save</Button>

<Button id="save" a11y={{ mnemonic: "Save" }}>Save</Button>
// throws: A11y mnemonic must be a single character, got "Save" (4 characters)
```

The thrown error surfaces during the render that built the node,
so it crashes loudly in development instead of silently producing
a broken mnemonic on the wire.

## Common patterns

### Form field labelling

Three approaches, in order of simplicity:

**Direct label.** Put the accessible name on the control.

```tsx
<TextInput
  id="email"
  value={state.email}
  placeholder="Email address"
  a11y={{ label: "Email address" }}
/>
```

**Cross-widget labelled-by.** Use when a visible label text is
also the accessible name.

```tsx
<Text id="email-label">Email address</Text>
<TextInput
  id="email"
  value={state.email}
  a11y={{ labelledBy: "email-label" }}
/>
```

**Description for additional context.** A help hint that screen
readers should announce after the label.

```tsx
<TextInput
  id="password"
  value={state.password}
  secure={true}
  a11y={{ label: "Password", describedBy: "password-hint" }}
/>
<Text id="password-hint" size={11}>Must be at least 8 characters</Text>
```

### Grouping related controls

Wrap logically related controls when the grouping adds semantic
value:

```tsx
<Container
  id="shipping-options"
  a11y={{ role: "group", label: "Shipping options" }}
>
  <Radio id="standard" value="std" selected={state.shipping === "std"}
    label="Standard (5-7 days)" onSelect={pickShipping} />
  <Radio id="express" value="exp" selected={state.shipping === "exp"}
    label="Express (1-2 days)" onSelect={pickShipping} />
</Container>
```

Do not group for layout alone. The default `generic_container`
role on layout widgets is already invisible to screen readers.

### Canvas accessibility

`Canvas` is a raw drawing surface. The renderer has no way to know
that a set of shapes is meant to be a button or a link. Use the
`interactive` wrapper from `plushie/canvas` to attach an accessible
role, label, and focus behaviour to a group of shapes:

```typescript
import { canvas, layer, rect, canvasText, interactive } from "plushie/canvas"

const saveBtn = interactive(
  group([
    rect({ x: 0, y: 0, width: 100, height: 36, fill: "#3b82f6" }),
    canvasText({ x: 50, y: 11, text: "Save", fill: "#fff", size: 14 }),
  ]),
  "save-btn",
  {
    onClick: true,
    cursor: "pointer",
    focusable: true,
    a11y: { role: "button", label: "Save experiment" },
  },
)
```

`focusable: true` adds the element to the Tab order and enables
Space/Enter activation. Without it, the element handles mouse
clicks but is invisible to keyboard users and screen readers.

## Testing accessibility

The Vitest session from `plushie/testing` exposes the accessibility
tree. Query by role or label and assert the semantic state:

```typescript
import { testWith } from "plushie/testing"
import form from "./form"

const test = testWith(form)

test("email field reports validation state", async ({ session }) => {
  const email = session.find({ role: "text_input", label: "Email" })
  expect(email.a11y.required).toBe(true)

  await session.type("email", "not-an-email")
  await session.press("submit")

  expect(email.a11y.invalid).toBe(true)
  expect(email.a11y.errorMessage).toBeTruthy()
})
```

These assertions walk the accessibility projection of the tree,
not the visual output. They catch missing labels, wrong roles,
and state that is present visually but absent from the a11y tree.

## Platform notes

| Platform | Assistive technology | Path |
|---|---|---|
| macOS | VoiceOver | AccessKit -> NSAccessibility |
| Linux | Orca (AT-SPI) | AccessKit -> AT-SPI2 |
| Windows | NVDA, JAWS | AccessKit -> UI Automation |

**NVDA** and **JAWS** on Windows operate in two modes: browse
mode (virtual navigation with intercepted keys) and focus mode
(keys pass to the app). They auto-switch to focus mode when Tab
reaches an interactive control.

**VoiceOver** on macOS uses a rotor for category navigation
(headings, buttons, form fields). Correct roles ensure widgets
appear in the right rotor category.

**Orca** on Linux provides structural navigation similar to
browse mode. Wayland keyboard input is currently broken for Linux
screen readers, so Orca users need an X11 session.

## See also

- [Built-in widgets reference](built-in-widgets.md)
- [Commands reference](commands.md)
- [Events reference](events.md)
- [Canvas reference](canvas.md)
- [AccessKit](https://github.com/AccessKit/accesskit)
