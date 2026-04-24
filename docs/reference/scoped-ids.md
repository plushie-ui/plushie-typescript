# Scoped IDs

Named containers automatically scope their children's IDs,
producing unique hierarchical paths without manual prefixing.
Rendering the same widget shape under two different parents is
common, and without scoping, events from the two subtrees would
be indistinguishable:

```tsx
<Container id="form1">
  <Button id="save" onClick={saveForm1}>Save</Button>
</Container>
<Container id="form2">
  <Button id="save" onClick={saveForm2}>Save</Button>
</Container>
```

Normalization rewrites the inner IDs to `"form1/save"` and
`"form2/save"`. The renderer emits events against the scoped wire
ID, and the SDK splits the ID back into a local part (`id`) and
an ancestor chain (`scope`) before dispatching. Scope resolution
runs during tree normalization, before the diff against the
previous tree.

## Scoping rules

| Node type | Creates scope? | Notes |
|---|---|---|
| Named container (explicit ID) | Yes | ID pushed onto the scope chain |
| Auto-ID container (`auto:` prefix) | No | Transparent, no scope effect |
| `Window` node | Yes | Uses `#` separator instead of `/` |

User-provided IDs must be non-empty, must not contain `/` or `#`,
must be printable ASCII (`0x21`-`0x7E`), and must not exceed 1024
bytes. The slash is reserved for the scope separator and `#` is
reserved for window-qualified paths (`"main#form/email"`).
`normalize` throws on any violation because invalid IDs are a
programming error, not a runtime condition.

## ID resolution

During normalization the scope chain builds canonical wire IDs.
Window nodes use `#` as the separator to their children;
containers within a window use `/`:

```
main (window)               ->  "main"
  sidebar (container)       ->  "main#sidebar"
    form (container)        ->  "main#sidebar/form"
      email (text_input)    ->  "main#sidebar/form/email"
      save (button)         ->  "main#sidebar/form/save"
```

The `#` appears at most once, at the window boundary. The
canonical wire format is `window#scope/path/id`. Recursion depth
is capped at 256 (with a warning at 200).

## Auto-ID containers are transparent

Layout widgets created without an explicit `id` get an
auto-generated identifier (`auto:column:1`, `auto:row:2`, etc.)
from `autoId`. Auto IDs are unstable across re-renders and do
not create scope boundaries, so intermediate layout wrappers
never leak into child IDs:

```tsx
import { Button, Column, Container, TextInput } from "plushie/ui"

<Container id="form">
  <Column spacing={8}>
    <TextInput id="email" value={state.email} />
    <Button id="save" onClick={save}>Save</Button>
  </Column>
</Container>
```

The text input is scoped as `"form/email"`, not
`"form/auto:column:1/email"`.

## Stateful widgets require explicit IDs

Stateful widgets (`TextInput`, `TextEditor`, `Slider`, `Checkbox`,
`Toggler`, `PickList`, `ComboBox`, `Radio`) must be given an
explicit `id`: auto IDs are not stable across renders and would
break cursor position, selection, and focus. Stateless widgets
(`Text`, `Button`, `Image`, layout containers) fall back to
`autoId("text")`, `autoId("button")`, and so on when `id` is
omitted.

## Duplicate ID detection

Normalization walks each level of siblings and throws if any two
share the same ID:

```
Error: Duplicate sibling ID "save" under parent "form". Each sibling must have a unique ID.
```

For duplicates rooted at an `auto:` ID, the message suggests the
fix: provide explicit IDs for items rendered from a dynamic list.
Detection is sibling-scoped; the same local ID can exist safely
in different scopes because the scope prefix makes the full wire
ID unique (`"form-a/save"` and `"form-b/save"` do not collide).

## Dynamic IDs

IDs can be any string, including values read from the model. This
is the canonical pattern for list items:

```tsx
{state.files.map((file) => (
  <Container id={file.id}>
    <Button id="select">{file.name}</Button>
    <Button id="delete">x</Button>
  </Container>
))}
```

Each file becomes a scope. The delete button for `"hello.ts"` has
the wire ID `"hello.ts/delete"`. Extract the file ID from the
scope chain in `update`:

```typescript
if (isClick(event, "delete")) {
  const [fileId] = event.scope
  return { ...state, files: state.files.filter((f) => f.id !== fileId) }
}
```

Dynamic IDs follow the same rules as static IDs: no `/`, no `#`,
not empty, printable ASCII, within the byte cap, unique among
siblings.

## Event scope field

When the renderer emits a widget event, the wire ID is the
canonical `window#scope/path/id` string. `splitScopedId` in
`plushie/client` splits it into the fields on `WidgetEvent`:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | The local ID (last path segment) |
| `scope` | `readonly string[]` | Ancestor chain in reverse, nearest parent first |
| `windowId` | `string \| null` | Source window ID |

For a widget emitted as `"main#sidebar/form/save"`:

```typescript
{
  kind: "widget",
  type: "click",
  id: "save",
  scope: ["form", "sidebar"],
  windowId: "main",
  value: null,
  data: null,
}
```

The `scope` is reversed so you can pattern match on the immediate
parent without caring about deeper ancestry. Note that the wire
payload separates `window_id` from the widget path, so the window
ID is not duplicated at the end of `scope` the way it is in some
other Plushie SDKs.

### Pattern matching examples

```typescript
import { isClick, isToggle } from "plushie"

function update(state: DeepReadonly<Model>, event: Event): Model {
  // Any save button, any scope
  if (isClick(event, "save")) return save(state)

  // Immediate parent match
  if (isClick(event, "save") && event.scope[0] === "form") return saveForm(state)

  // Bind a dynamic parent (list items)
  if (isToggle(event, "done") && event.scope.length > 0) {
    const [itemId] = event.scope
    return toggleItem(state, itemId, event.value as boolean)
  }

  // Match the source window
  if (isClick(event, "save") && event.windowId === "settings") {
    return saveSettings(state)
  }

  return state
}
```

Only `WidgetEvent` carries per-target `scope`. `ImeEvent`,
`KeyEvent`, `ModifiersEvent`, and `WindowEvent` expose `windowId`
only; timers, async results, streams, and system events are
global.

## Path reconstruction

`target` in `plushie` rebuilds the forward-slash path from an
event's `id` and `scope` fields, stripping the window ID so the
result is a relative path suitable for `Command.focus`,
`Command.scrollTo`, and friends:

```typescript
import { target } from "plushie"

target({ id: "save", scope: ["form"], windowId: "main", /* ... */ })
// => "form/save"

target({ id: "save", scope: [], windowId: "main", /* ... */ })
// => "save"
```

## Worked example: routing by scope

Two forms share the same button layout but write to different
slices of state. Route in `update` by branching on the immediate
parent:

```tsx
import { isClick, isInput } from "plushie"

function update(state: DeepReadonly<Model>, event: Event): Model {
  if (isInput(event, "email")) {
    const [form] = event.scope
    return { ...state, [form]: { ...state[form], email: event.value as string } }
  }
  if (isClick(event, "save")) {
    const [form] = event.scope
    return persist(state, form)
  }
  return state
}
```

Inline handlers on `Button` and `TextInput` work too and read
cleaner for small forms. The `update` form scales better when
many list items or forms share routing logic.

## Command paths

Commands that address a widget accept the forward-slash scoped
format, optionally prefixed with `windowId#` to target a specific
window:

```typescript
import { Command } from "plushie"

Command.focus("form/email")
Command.scrollTo("sidebar/list", 0, 0)
Command.selectAll("settings#email")
```

Without a window qualifier the command targets whatever window
contains the widget. See the [Commands reference](commands.md)
for the full command surface.

## Multi-window scoping

Each window creates a separate namespace. A widget at
`"main#form/save"` is distinct from `"settings#form/save"` in
window `"settings"`, and events from one window never match a
handler keyed on the other. The widget handler registry keys
every stateful widget by window ID plus scoped path, so visually
identical widgets in different windows keep independent state.

```typescript
if (isClick(event, "save") && event.windowId === "settings") {
  return saveSettings(state)
}
```

## Test selectors

The session API in `plushie/testing` accepts the same scoped
format, optionally prefixed with `#`:

```typescript
await session.find("save")                     // local ID
await session.click("sidebar/form/save")       // full scoped path
await session.click("main#save")               // window-qualified
await session.assertText("settings#form/email", "")
```

Without a window qualifier the selector searches all windows; an
ambiguous match across windows raises an error. Use the window
qualifier to disambiguate.

## Accessibility cross-references

A11y props (`labelledBy`, `describedBy`, `errorMessage`,
`activeDescendant`, and each element of `radioGroup`) reference
widget IDs. Bare IDs are resolved relative to the current scope
during normalization; IDs that already contain `/` or `#` pass
through unchanged:

```tsx
<Container id="form">
  <Text id="email-label">Email</Text>
  <TextInput id="email" value={state.email} a11y={{ labelledBy: "email-label" }} />
</Container>
```

`labelledBy` rewrites to `"form/email-label"`. An unresolved
reference logs an `a11y_ref_unresolved` warning but does not
throw.

## See also

- [Events reference](events.md): `WidgetEvent` fields and guard
  functions
- [Commands reference](commands.md): `focus`, `scrollTo`, and
  other commands that address widgets by scoped path
- [Built-in Widgets reference](built-in-widgets.md): `Container`,
  `Window`, and other scope-creating widgets
- [Subscriptions reference](subscriptions.md): how window-scoped
  subscriptions work
