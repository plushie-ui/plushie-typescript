# State Management

Once an app grows past a screen or two, the model starts carrying
more than the current render needs. Undo history, list selection,
the current view, a filtered data slice. Plushie ships small
helpers for each of these patterns. They are pure data: plain
immutable values you keep inside your model and update from
handlers.

This chapter extends the pad. It already has a hand-rolled undo
stack and a file-scoped state pattern; we look at those, then at
the shipped helpers (`UndoStack`, `Selection`, `Route`, `Data`)
that cover the same ground with less code and more affordances.

## Model shape

The pad's model in `plushie_pad/src/app.ts` is a single flat
interface. Every field is `readonly`, every collection is a
`readonly T[]`, nested objects are themselves `readonly`:

```typescript
interface Model {
  readonly source: string
  readonly preview: UINode | null
  readonly error: string | null
  readonly files: readonly string[]
  readonly activeFile: string | null
  readonly autoSave: boolean
  readonly dirty: boolean
  readonly undoStack: UndoStack
}
```

Handlers receive `DeepReadonly<Model>` and return a new `Model`.
Spread updates are canonical at every level:

```typescript
(state) => ({ ...state, dirty: true })
(state) => ({ ...state, files: [...state.files, name] })
(state) => ({ ...state, undoStack: { ...state.undoStack, future: [] } })
```

Never mutate. `state.files.push(name)` is both a type error and a
runtime error in dev mode. Reach for `[...state.files, entry]`.

Discriminated unions give variant shapes without losing type
safety. The pad's preview slot is `UINode | null`; if it carried
more states you would name them:

```typescript
type Preview =
  | { kind: "empty" }
  | { kind: "compiling"; source: string }
  | { kind: "ready"; node: UINode }
  | { kind: "error"; message: string }
```

A `switch (preview.kind)` narrows each branch to the fields that
exist there. Worth the extra shape as soon as an `if (error)`
chain starts branching on combinations of flags.

## Deep updates

Spreading one level is cheap. Spreading three levels loses the
signal:

```typescript
(state) => ({
  ...state,
  settings: {
    ...state.settings,
    editor: { ...state.settings.editor, fontSize: 16 },
  },
})
```

Two options: flatten the model, or factor the update. The pad
does the second with small named helpers like `saveAndRender`,
`switchFile`, `deleteFile`, `createNew`. Each takes the state,
does its thing, returns a new state:

```typescript
function switchFile(state: DeepReadonly<Model>, file: string): Model {
  if (state.activeFile) Experiments.save(state.activeFile, state.source)
  const source = Experiments.load(file)
  const [preview, error] = render(source)
  return {
    ...(state as Model),
    activeFile: file,
    source,
    preview,
    error,
    dirty: false,
    undoStack: { past: [], future: [] },
  }
}
```

Handlers then become one-liners:

```typescript
const selectFile = (file: string): Handler<Model> =>
  (state) => switchFile(state, file)
```

Rule of thumb: if you spread more than two levels inline, pull
the update into a function named after the intent. Handlers read
as a menu of verbs, and each verb is a testable pure function.

## Splitting the model

When a single `Model` grows past twenty or thirty fields, group
by domain:

```typescript
interface EditorState {
  readonly source: string
  readonly undoStack: UndoStack<string>
  readonly dirty: boolean
}

interface FilesState {
  readonly files: readonly string[]
  readonly activeFile: string | null
}

interface Model {
  readonly editor: EditorState
  readonly files: FilesState
  readonly autoSave: boolean
}
```

Each domain gets its own update helpers. `switchFile` now takes
and returns `FilesState`; the top-level handler composes them:

```typescript
(state) => ({ ...state, files: switchFile(state.files, name) })
```

Do this once a domain has grown to the point where tests want to
exercise it in isolation, not before. A premature split costs
readability: `state.editor.source` everywhere instead of
`state.source`. See [Composition patterns](../reference/composition-patterns.md)
for larger examples.

## Undo / redo

The pad keeps a hand-rolled undo stack with coalescing. The
shape is small:

```typescript
interface UndoEntry {
  readonly before: string
  readonly after: string
  readonly timestamp: number
}

interface UndoStack {
  readonly past: readonly UndoEntry[]
  readonly future: readonly UndoEntry[]
}
```

Push merges rapid edits inside a short window into one entry, so
one Ctrl+Z reverses a burst of typing instead of a single
keystroke:

```typescript
const COALESCE_MS = 500

function pushUndo(stack: UndoStack, before: string, after: string): UndoStack {
  if (before === after) return stack
  const now = Date.now()
  const last = stack.past.at(-1)
  if (last && now - last.timestamp < COALESCE_MS) {
    const coalesced: UndoEntry = { before: last.before, after, timestamp: now }
    return { past: [...stack.past.slice(0, -1), coalesced], future: [] }
  }
  return { past: [...stack.past, { before, after, timestamp: now }], future: [] }
}
```

`undo(stack, current)` and `redo(stack, current)` return
`[nextStack, nextValue]`. Handlers splice them into the model:

```typescript
const handleEdit: Handler<Model> = (state, event) => {
  const next = typeof event.value === "string" ? event.value : state.source
  return {
    ...(state as Model),
    source: next,
    dirty: true,
    undoStack: pushUndo(state.undoStack as UndoStack, state.source, next),
  }
}
```

Key handling lives in `update` because key events are not widget
events:

```typescript
if (isKey(event, "press")) {
  const { key, modifiers } = event
  if (key === "z" && modifiers.command && !modifiers.shift) {
    const [nextStack, source] = undo(state.undoStack as UndoStack, state.source)
    return { ...(state as Model), undoStack: nextStack, source }
  }
  if (key === "z" && modifiers.command && modifiers.shift) {
    const [nextStack, source] = redo(state.undoStack as UndoStack, state.source)
    return { ...(state as Model), undoStack: nextStack, source }
  }
}
```

### The shipped helper

`UndoStack` in `plushie` implements the same pattern with a
richer command shape. An entry carries `apply` and `undo`
functions instead of before / after values, so one stack can host
heterogeneous commands (typing, formatting, deletion) without
branching on a payload:

```typescript
import { UndoStack } from "plushie"
import type { UndoStackType } from "plushie"

const stack: UndoStackType<string> = UndoStack.createUndoStack("")

const next = UndoStack.push(stack, {
  apply: () => "hello",
  undo: () => "",
  label: "Type hello",
})

UndoStack.current(next)   // "hello"
UndoStack.canUndo(next)   // true

const reverted = UndoStack.undo(next)
UndoStack.current(reverted)  // ""
```

Coalescing takes a key and a window. Commands pushed with the
same `coalesce` key inside the window merge; the merged entry
preserves the original undo function, so reverting always lands
on the pre-burst value:

```typescript
UndoStack.push(stack, {
  apply: (text) => text + "a",
  undo: (text) => text.slice(0, -1),
  coalesce: "typing",
  coalesceWindowMs: 500,
})
```

Swapping the pad to the shipped helper is mechanical: replace
the custom `UndoStack` interface with `UndoStackType<string>`,
replace `pushUndo` with `UndoStack.push` carrying `apply` / `undo`
closures, and use `UndoStack.current` to read the current value.
Coalescing semantics are identical. `UndoStack.history(stack)`
returns labels for a history pane.

## Selection

`Selection` tracks which items in a list are currently selected.
Three modes cover the common cases:

```typescript
import { Selection } from "plushie"

const single = Selection.createSelection({ mode: "single" })
const multi = Selection.createSelection({ mode: "multi" })
const ranged = Selection.createSelection({
  mode: "range",
  order: state.files,
})
```

- `single`: at most one item. Selecting replaces; toggling an
  already-selected item clears.
- `multi`: any number. `toggle` flips one; `select` with
  `{ extend: true }` adds without clearing.
- `range`: contiguous selection with an anchor. `rangeSelect`
  fills every item between the anchor and the target, using the
  `order` array you passed to `createSelection`.

Selection state sits in the model alongside the list:

```typescript
interface Model {
  readonly files: readonly string[]
  readonly selection: Selection.Selection
}
```

A checkbox per file row drives the toggle:

```tsx
import { Selection } from "plushie"

<Checkbox
  id="pick"
  value={Selection.isSelected(state.selection, file)}
  onToggle={(s) => ({
    ...s,
    selection: Selection.toggle(s.selection, file),
  })}
/>
```

Bulk operations read the current set:

```typescript
const handleDelete: Handler<Model> = (state) => {
  const ids = Selection.selected(state.selection)
  return {
    ...(state as Model),
    files: state.files.filter((f) => !ids.has(f)),
    selection: Selection.clear(state.selection),
  }
}
```

`Selection.selectAll` and `Selection.clear` give you the
"Select All" and "Clear" toolbar buttons for free. Keep the
`order` array in sync when the list changes so `rangeSelect` picks
the right slice.

## Routing

`Route` manages a LIFO navigation stack for multi-view apps.
Paths are strings; each entry carries an optional params record:

```typescript
import { Route } from "plushie"

const r = Route.createRoute("editor")
Route.currentPath(r)   // "editor"

const pushed = Route.push(r, "browser", { sort: "name" })
Route.currentPath(pushed)     // "browser"
Route.currentParams(pushed)   // { sort: "name" }
Route.canGoBack(pushed)       // true

const popped = Route.pop(pushed)
Route.currentPath(popped)     // "editor"
```

`Route.pop` on a single-entry stack returns it unchanged: the
root entry never pops. There is no forward stack; navigation is
back-only. Push the path again to move forward.

`Route.replaceTop` swaps the current entry without pushing, which
is the right call for tab switches that shouldn't add to history:

```typescript
Route.replaceTop(state.route, "browser", { sort: "recent" })
```

Store the route in the model, dispatch in `view`, and push or
pop from handlers:

```tsx
function body(state: DeepReadonly<Model>): UINode {
  switch (Route.currentPath(state.route)) {
    case "editor": return editorView(state)
    case "browser": return browserView(state)
    default: return editorView(state)
  }
}

<Button id="show-browser" onClick={(s) => ({ ...s, route: Route.push(s.route, "browser") })}>
  Browser
</Button>
<Button id="back" onClick={(s) => ({ ...s, route: Route.pop(s.route) })}>
  Back
</Button>
```

Read `Route.currentParams(state.route)` inside the target view
for anything you passed on the push. The params object is
`Readonly<Record<string, unknown>>`, so the reader has to
narrow. Keep the set of keys small and documented near the push.

## Data queries

`Data.query` runs a declarative pipeline over an in-memory
collection: filter, search, sort, paginate, group. Stages are
optional; the ones present run in that fixed order:

```typescript
import { Data } from "plushie"

interface Person { readonly name: string; readonly role: string }

const records: readonly Person[] = [
  { name: "Alice", role: "dev" },
  { name: "Bob", role: "design" },
  { name: "Carol", role: "dev" },
]

const result = Data.query(records, {
  search: { fields: ["name", "role"], query: "dev" },
  sort: { direction: "asc", field: "name" },
  page: 1,
  pageSize: 10,
})

result.entries  // [{ name: "Alice", ... }, { name: "Carol", ... }]
result.total    // 2
```

| Option | Signature | Description |
|---|---|---|
| `filter` | `(record) => boolean` | Predicate applied before search |
| `search` | `{ fields, query }` | Case-insensitive substring match across fields |
| `sort` | `{ direction, field }` or array | Multi-column tiebreaking when array |
| `page` | `number` | 1-based page number (default 1) |
| `pageSize` | `number` | Items per page (default 25) |
| `group` | `keyof T` | Group paginated entries by field |

`total` is the count before pagination; use it to build page
indicators. `groups` is a record keyed by the grouped field's
string value, or `null` when `group` is unset.

A search bar that filters the file list is a three-line change:

```tsx
import { Data } from "plushie"

const filtered = state.searchQuery === ""
  ? state.files.map((name) => ({ name }))
  : Data.query(state.files.map((name) => ({ name })), {
      search: { fields: ["name"], query: state.searchQuery },
    }).entries
```

`result.total` reflects the full filtered size before pagination,
so page footers read correctly even on the last short page.

## Commands through nested state

Handlers can return a new state or a tuple `[state, command]`.
The command runs after the update; its result comes back as a
later event. When the state change lives deep in the model,
stitch the command in at the outer return:

```typescript
(state) => [
  { ...state, files: { ...state.files, loading: true } },
  Command.task(() => Experiments.listAsync(), "files_loaded"),
]
```

A guard narrows the tagged result:

```typescript
if (isAsync(event, "files_loaded")) {
  if (event.result.ok) {
    return { ...state, files: { ...state.files, entries: event.result.value, loading: false } }
  }
  return { ...state, files: { ...state.files, error: String(event.result.error), loading: false } }
}
```

If the tuple return becomes a recurring shape, push it into a
helper that returns `[State, Command<Event>]`:

```typescript
function startLoading(files: FilesState): [FilesState, Command<Event>] {
  return [
    { ...files, loading: true },
    Command.task(() => Experiments.listAsync(), "files_loaded"),
  ]
}
```

See the [Commands reference](../reference/commands.md) for the
constructor catalogue, and the
[Events reference](../reference/events.md) for the guards used
to narrow results.

## Pure vs impure

Every helper in this chapter is a pure function from one
immutable value to another. Pure update logic is trivial to test
without a renderer, a clock, or a session:

```typescript
import { describe, it, expect } from "vitest"
import { UndoStack } from "plushie"

describe("UndoStack", () => {
  it("undo restores the previous value", () => {
    const s0 = UndoStack.createUndoStack("")
    const s1 = UndoStack.push(s0, { apply: () => "hello", undo: () => "" })
    expect(UndoStack.current(UndoStack.undo(s1))).toBe("")
  })
})
```

Impure work (file I/O, HTTP, timers, dialogs) lives in commands,
effects, and subscriptions. That leaves `init`, `update`, and
`view` as pure, deterministic functions. Integration tests drive
real events through the runtime; unit tests pin down tricky
transitions in isolation. See the [Testing guide](15-testing.md)
for the full approach.

## Try it

Extend the pad:

- Swap the hand-rolled undo for `UndoStack`. Show
  `UndoStack.history(state.undoStack)` as a sidebar list; clicking
  a label walks back with repeated `UndoStack.undo`.
- Add a multi-select checkbox column to the sidebar, backed by
  `Selection`. Wire a "Delete Selected" button.
- Split the editor into tabs with `Route`: one path per open
  file, `Route.replaceTop` on select, `Route.push` on open.
- Build a command palette that filters the experiment list with
  `Data.query`. Add sort controls that toggle direction.
- Extract `EditorState` and add a unit test for `switchFile`
  that does not touch the renderer.

---

Next: [Testing](15-testing.md)
