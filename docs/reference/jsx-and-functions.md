# JSX and function forms

Every built-in widget is exported from `plushie/ui` twice: as a
PascalCase JSX component and as a camelCase function. The two
surfaces wrap the same underlying builder, produce the same
`UINode` on the wire, and can be mixed freely inside one view.

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

Both snippets emit an identical tree. Pick the form that reads
best for the code around it; the runtime does not distinguish
them.

## Why two APIs

JSX is the ergonomic default for view code. Nested children,
conditional branches, and static layouts are easier to read as
markup than as nested function calls.

The function form wins wherever the view becomes data: building
rows from a loop, composing higher-order helpers, conditionally
wrapping a subtree, or returning nodes from a utility module that
should not depend on a JSX toolchain. Function-form code is also
plain TypeScript, which makes it the simpler target for tooling
that generates or transforms UI trees.

Most apps mix both. Use JSX for the view backbone, drop into
function form when children are derived from data or when a
helper assembles a fragment programmatically.

## How JSX resolves

The SDK ships a JSX runtime at `plushie/jsx-runtime` (and a dev
runtime at `plushie/jsx-dev-runtime`) that the TypeScript compiler
picks up with the automatic transform:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "plushie"
  }
}
```

The transform rewrites `<Button id="save">Save</Button>` into
`jsx(Button, { id: "save", children: "Save" })`. `jsx` then
normalizes `children` (flattens arrays, drops `null`, `undefined`,
and booleans) and calls the `Button` component with the final
props object. `Button` is a plain TypeScript function that returns
a `UINode`. There is no virtual DOM, no reconciler, no fiber; JSX
is sugar over the component function call.

`jsxs` (used by the compiler when all children are statically
known) behaves identically to `jsx` in this SDK.

## PascalCase and camelCase side by side

Every widget module exports a PascalCase constant and a camelCase
constant. The PascalCase one is the JSX component; the camelCase
one is the function form. They live in the same file and share
the same builder.

```typescript
export { Button, button } from "./widgets/button.js"
export { Column, column } from "./widgets/column.js"
export { Text, text } from "./widgets/text.js"
export { TextInput, textInput } from "./widgets/text_input.js"
```

The PascalCase component takes a single props object. The
camelCase function takes positional arguments matching the common
call shape for that widget, plus an optional opts object.
Internally the function form calls the PascalCase component, so
every feature available on one is available on the other.

Lowercase JSX tags (`<button>`, `<div>`) are HTML intrinsics in
TypeScript's JSX type system and do not resolve to Plushie. Always
use PascalCase JSX components; the IDE autocompletion will guide
you.

## Function-form overloads

The camelCase functions use TypeScript overloads so the common
invocations stay short. Three shapes recur across the catalog.

| Shape | Example | When to use |
|---|---|---|
| Single-arg shortcut | `button("Save")` | Stateless, no options, auto-ID is fine |
| Value + opts | `button("Save", { onClick: save })` | Stateless with options, auto-ID still fine |
| ID + value + opts | `button("save", "Save", { onClick: save })` | Explicit ID required or preferred |
| Children-only | `column([a, b, c])` | Layout container, no props |
| Opts + children | `column({ padding: 16 }, [a, b])` | Layout container with props |
| ID + opts + children | `container("card", { padding: 16 }, [a])` | Container with explicit ID and props |

The overloads are distinguished by argument types at runtime.
`button(first, second, third)` inspects `typeof second`: `string`
means the caller passed an ID, `object` means they skipped the ID
and went straight to opts.

Stateful widgets do not offer the auto-ID shortcut. `textInput`,
`textEditor`, `slider`, `pickList`, `comboBox`, `paneGrid`, and
`canvas` all require an explicit ID, so their function forms start
at the three-argument shape:

```typescript
textInput("email", state.email, { placeholder: "Email", onInput: handler })
slider("volume", { min: 0, max: 100, value: state.volume, onSlide: setVolume })
```

When the function form feels redundant because the call site is
already JSX-heavy, use the PascalCase component directly from
function context:

```typescript
const label = Text({ size: 18, children: state.name })
```

That is the same node JSX would produce.

## Mixing the two

Function-form nodes are `UINode` values. JSX produces `UINode`
values. The two are interchangeable anywhere children are
expected.

```tsx
import { Column, Row, Text, button } from "plushie/ui"

function toolbar(state: DeepReadonly<Model>) {
  return (
    <Row spacing={8}>
      {state.actions.map((a) =>
        button(a.id, a.label, { onClick: runAction(a) }))}
    </Row>
  )
}

function view(state: DeepReadonly<Model>) {
  return (
    <Column>
      <Text size={18}>{state.title}</Text>
      {toolbar(state)}
    </Column>
  )
}
```

The `button` calls inside `.map` return `UINode` objects; the JSX
runtime accepts them as children without any wrapper.

## Children handling

JSX children arrive through `props.children`:

- A single child becomes `props.children` directly.
- Multiple children become an array.
- `null`, `undefined`, and booleans are filtered out.
- Nested arrays are flattened one level (deep nesting is not
  typical; the JSX compiler rarely produces it).
- String content for widgets that accept text (`Button`, `Text`,
  `Markdown`) is passed through as `props.children: string`.

```tsx
<Text>{state.count === 0 ? "No items" : `${state.count} items`}</Text>

<Column>
  {state.loading && <Text>Loading...</Text>}
  {state.items.map((item) => <Text key={item.id}>{item.name}</Text>)}
</Column>
```

Function-form children are an explicit array, not a variadic
argument:

```typescript
column([
  text(`${state.count} items`),
  ...state.items.map((item) => text(item.name)),
])
```

`KeyedColumn` takes children that are ordinary `UINode` values;
the key used for diffing is each child's `id`. Dynamic lists
should give every child a stable ID derived from the data:

```tsx
<KeyedColumn id="list" spacing={8}>
  {state.items.map((item) => (
    <Row id={`item-${item.id}`}>
      <Text>{item.name}</Text>
    </Row>
  ))}
</KeyedColumn>
```

## Fragments

`Fragment` is exported from the JSX runtime. Use the shorthand
`<>...</>` to group nodes without adding a wrapper:

```tsx
function statusLine(state: DeepReadonly<Model>) {
  return (
    <>
      <Text>{state.status}</Text>
      {state.error && <Text color="#dc2626">{state.error}</Text>}
    </>
  )
}

<Column>
  <Text size={18}>Dashboard</Text>
  {statusLine(state)}
</Column>
```

A fragment's children flatten into the parent's children list.
There is no Plushie equivalent to a React fragment "node"; it
exists only at the JSX level.

## Handler props

Widgets that emit events expose handler props (`onClick`,
`onInput`, `onToggle`, `onSelect`, `onSlide`, `onSubmit`,
`onPaste`, and pointer handlers on `PointerArea`). They accept a
function `(state, event) => newState` or
`(state, event) => [newState, command]`.

Handler props flow through both forms identically:

```tsx
<Button id="save" onClick={(s) => ({ ...s, saving: true })}>Save</Button>
```

```typescript
button("save", "Save", {
  onClick: (s) => ({ ...s, saving: true }),
})
```

The widget builder runs `extractHandlers(id, props, handlerMap)`
before encoding. That helper pulls the handler functions off the
props object, registers them against the widget ID on the runtime
handler map, and removes them from the wire payload. Handlers
never appear in the tree sent to the renderer; the renderer only
sees the widget ID and the event types the widget is subscribed
to.

`TextInput`'s `onSubmit` and `onPaste` accept either a handler
function or a plain boolean. Passing `true` enables wire delivery
of the event without installing a local handler; the event falls
through to `update(state, event)`. Passing a function installs the
handler inline and implicitly enables the event.

Events without a matching inline handler reach
`update(state, event)` if the app defines one. See the
[Events reference](events.md) for the full dispatch order and the
`isClick` / `isInput` / `isKey` / `isTimer` / `isAsync` guard
family.

## Accessibility seeding

Every widget that maps to a platform a11y role calls
`applyA11yDefaults` during build. The helper merges a widget-
specific default role with any caller-supplied `a11y` overrides
before encoding. `Button` seeds `role: "button"`, `Text` seeds
`role: "label"`, `Slider` seeds `role: "slider"`, and so on. The
user-supplied `a11y` prop always wins on keys it sets; defaults
only fill blanks.

```tsx
<Button id="save" a11y={{ description: "Save the current document" }}>
  Save
</Button>
```

The seeded `role: "button"` stays; the description is added on
top. See [Accessibility](accessibility.md) for the full `A11y`
interface and platform behaviour.

## Custom widget forms

Authored widgets should follow the same dual-export convention.
When a module defines a widget with `buildWidget` or
`defineNativeWidget`, re-export both a PascalCase component and a
camelCase function so callers can pick whichever fits their view.

```typescript
// widgets/star_rating.ts
import { buildWidget, type WidgetDef } from "plushie"

const starRatingDef: WidgetDef<State, Props> = { ... }

export function StarRating(props: Props & { id: string }) {
  const { id, ...rest } = props
  return buildWidget(starRatingDef, id, rest)
}

export function starRating(id: string, props: Props) {
  return buildWidget(starRatingDef, id, props)
}
```

Both call sites then feel native:

```tsx
<StarRating id="rating" value={state.rating} onChange={setRating} />
```

```typescript
starRating("rating", { value: state.rating, onChange: setRating })
```

See [Custom widgets](custom-widgets.md) for the `WidgetDef`
contract and the composition-only vs native widget boundary.

## Gotchas

- **Lowercase JSX tags do not resolve to Plushie.** Writing
  `<button>` produces an HTML intrinsic and a TypeScript error (or
  silently nothing if intrinsics are allowed). Always use
  PascalCase components from `plushie/ui`.
- **Stateful widgets need stable IDs.** `TextInput`, `TextEditor`,
  `Slider`, `PickList`, `ComboBox`, `PaneGrid`, and `Canvas` hold
  renderer-side state. Auto-IDs would reset cursor position,
  selection, or scroll offset on every render; the function form
  for these widgets requires an explicit ID.
- **Handler props belong to the SDK, not the wire.** `onClick` is
  stripped by `extractHandlers` before the props are serialized.
  Do not include it in JSON wire payload discussions; see
  [Wire protocol](wire-protocol.md) for the actual message shape.
- **Fragments flatten one level.** Deeply nested fragments still
  flatten into a single child list, but avoid relying on
  pathological nesting; a helper function returning `readonly
  UINode[]` reads better than a deeply nested fragment tree.
- **`children` is a prop, not an argument.** The function form
  takes children in the last positional slot for layout widgets
  and in `opts.children` for widgets that also accept a string
  label. Overload picks the right slot from the argument shape.

## See also

- [Built-in widgets reference](built-in-widgets.md)
- [Events reference](events.md)
- [Composition patterns reference](composition-patterns.md)
- [Custom widgets reference](custom-widgets.md)
- [Accessibility reference](accessibility.md)
