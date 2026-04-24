# Lists and Inputs

The pad so far edits a single experiment held in memory. In this
chapter we add file management: save experiments as `.js` files,
list them in a sidebar, create new ones, switch between them,
and delete the ones we no longer want.

Along the way we cover `TextInput`, `Checkbox`, `Toggler`,
`Radio`, `PickList`, `ComboBox`, dynamic list rendering, and the
scoped-ID pattern that lets events from a row recover which row
they came from.

## Saving experiments to disk

Experiments are plain JavaScript source files stored under an
`experiments/` directory alongside the pad's own source. The
file I/O is standard Node stdlib (`readdirSync`, `readFileSync`,
`writeFileSync`, `rmSync`); nothing here is Plushie-specific.
For the rest of the chapter we assume an `Experiments` module
with `list()`, `load(name)`, `save(name, source)`, `remove(name)`,
and `starterSource(label)` helpers and focus on the UI.

## Extending the model

The model grows new fields for the file list, the active file,
the new-experiment name input, and an auto-save flag:

```typescript
interface Model {
  readonly source: string
  readonly preview: UINode | null
  readonly error: string | null
  readonly files: readonly string[]
  readonly activeFile: string | null
  readonly newName: string
  readonly autoSave: boolean
}
```

In `init`, we load the file list and pick the first file if any
exist; otherwise we seed the editor with a starter template:

```typescript
function initModel(): Model {
  const files = Experiments.list()
  const activeFile = files[0] ?? null
  const source = activeFile
    ? Experiments.load(activeFile)
    : Experiments.starterSource("hello")
  return {
    source,
    preview: null,
    error: null,
    files,
    activeFile,
    newName: "",
    autoSave: false,
  }
}
```

## Dynamic lists

To render one row per file, map the list of filenames into a list
of `UINode` values. Plain `Array.map` is all we need:

```tsx
import { Column } from "plushie/ui"

<Column id="files" spacing={4}>
  {state.files.map((file) => (
    <Button id={file} key={file}>{file}</Button>
  ))}
</Column>
```

The function form is equally fine and often reads better when the
children come from a helper:

```typescript
import { column, button } from "plushie/ui"

column({ id: "files", spacing: 4 }, state.files.map((file) =>
  button(file, file),
))
```

Either way, each rendered child must carry a stable ID. That ID
is what the tree differ uses to match children across renders.
Reusing an auto-ID or an index (`` id={`row-${i}`} ``) works when
the list never reorders or grows from the middle, but it breaks
as soon as items can be inserted, deleted, or sorted: focus,
scroll position, and text cursors jump to whatever widget now
occupies that slot.

## KeyedColumn for frequently reordered lists

`Column` matches children by position. If a user inserts a file
at the top of the list, every other child shifts down one slot
and inherits the previous occupant's renderer state.

`KeyedColumn` matches children by ID instead of position. Items
keep their state no matter where they move in the list, so it's
the right container for anything that grows, shrinks, or
reorders at runtime:

```tsx
import { KeyedColumn } from "plushie/ui"

<KeyedColumn id="files" spacing={4}>
  {state.files.map((file) => fileRow(state, file))}
</KeyedColumn>
```

Use `Column` for static layouts with a fixed set of children.
Use `KeyedColumn` the moment `state.files.length` can change or
`state.files` can be sorted at runtime.

## Scoped IDs

Each file in the sidebar needs its own controls (a select button
and a delete button at minimum). If every delete button has
`id="delete"`, how does the handler know which file to remove?

Named containers solve this. Wrapping each row in a `Container`
whose `id` is the filename puts the filename on the scope chain.
Events from widgets inside that container carry the scope in
`event.scope`, nearest ancestor first, window ID last:

```tsx
import { Button, Container, Row } from "plushie/ui"

function fileRow(state: DeepReadonly<Model>, file: string) {
  const selectStyle = state.activeFile === file ? "primary" : "secondary"
  return (
    <Container id={file} padding={4}>
      <Row id="row" spacing={4}>
        <Button id="select" style={selectStyle} onClick={selectFile(file)}>
          {file}
        </Button>
        <Button id="delete" style="danger" onClick={deleteFileHandler(file)}>
          x
        </Button>
      </Row>
    </Container>
  )
}
```

The select and delete handlers are closures that capture the
filename from the `map` callback:

```typescript
import type { Handler } from "plushie"

function selectFile(file: string): Handler<Model> {
  return (state) => switchFile(state, file)
}

function deleteFileHandler(file: string): Handler<Model> {
  return (state) => deleteFile(state, file)
}
```

Closures are the idiomatic way to thread per-row data through an
inline handler in TypeScript. No scope matching in `update`, no
event-kind plumbing, just a small factory per row.

When a handler needs to read the scope directly (for example when
the event is routed through `update` rather than an inline
handler), the `target` helper from `plushie` joins the scope and
the widget ID into a single path. Full scoping semantics are in
the [Scoped IDs reference](../reference/scoped-ids.md).

## The file list sidebar

Here is the full sidebar. It sits in a fixed-width `Container`,
holds a `Scrollable` so the list never overflows the viewport,
and uses `KeyedColumn` so rows keep their state when files are
added or removed:

```tsx
import { Container, KeyedColumn, Scrollable } from "plushie/ui"

function sidebar(state: DeepReadonly<Model>) {
  return (
    <Container
      id="sidebar-wrap"
      width={200}
      height="fill"
      style={{ border: { color: "#333333", width: 1 } }}
    >
      <Scrollable id="sidebar" height="fill">
        <KeyedColumn id="files" spacing={4} padding={8}>
          {state.files.map((file) => fileRow(state, file))}
        </KeyedColumn>
      </Scrollable>
    </Container>
  )
}
```

Width is a fixed `200` pixels; the editor and preview panes
share the remaining horizontal space via `fillPortion`. We tidy
the layout in [chapter 7](07-layout.md).

## TextInput: controlled values

`TextInput` is a single-line text field. It's always controlled:
the `value` prop is the source of truth, and `onInput` updates
the model on every keystroke. The widget never stores its own
text; if you don't feed `state.newName` back in, nothing appears
when the user types.

```tsx
import { TextInput } from "plushie/ui"

<TextInput
  id="new-name"
  value={state.newName}
  placeholder="new_name.js"
  onInput={(s, e) => ({ ...s, newName: typeof e.value === "string" ? e.value : s.newName })}
  onSubmit={true}
/>
```

- `placeholder` shows grey hint text when `value` is empty.
- `onInput` fires on every keystroke. The handler receives the
  event with the current text in `event.value` as `unknown`;
  narrow with `typeof` before assigning to the model.
- `onSubmit: true` enables the `submit` event (Enter pressed).
  Pass a handler function instead of `true` to route the event
  to an inline handler; leave it off entirely to suppress submit
  events.

`TextInput` is stateful. Its cursor position and text selection
live in the renderer and are keyed by widget ID. Always give it
an explicit ID; the module rejects auto-IDs at build time.

## Form submission and focus

In the pad, pressing Enter in the new-name input should create a
new experiment, clear the input, and move focus back to the
editor so the user can start typing immediately. Inline handlers
on widget events only see the widget event, so we route submit
through the top-level `update` instead. The tuple return form
carries the focus command:

```typescript
import { Command, isSubmit } from "plushie"

update(state, event) {
  if (isSubmit(event, "new-name")) {
    return [createNew(state), Command.focus("editor")]
  }
  return state
}

function createNew(state: DeepReadonly<Model>): Model {
  const raw = state.newName.trim()
  if (raw === "") return state as Model
  const name = raw.endsWith(".js") ? raw : `${raw}.js`
  Experiments.save(name, Experiments.starterSource(name))
  return {
    ...(state as Model),
    files: Experiments.list(),
    activeFile: name,
    source: Experiments.load(name),
    newName: "",
  }
}
```

`Command.focus` takes a widget ID or a scoped path. `"editor"`
matches any widget with that local ID; `"sidebar/new-name"`
targets a specific widget when multiple share an ID across
branches of the tree. Related cursor and selection helpers:
`Command.focusNext()`, `Command.focusPrevious()`,
`Command.selectAll(id)`, `Command.moveCursorTo(id, position)`,
`Command.moveCursorToEnd(id)`, and `Command.selectRange(id,
start, end)`. See the [Commands reference](../reference/commands.md)
for the full surface.

## Checkbox and Toggler: boolean props

`Checkbox` is a labelled boolean toggle. Its controlled prop is
`value` (not `checked`); the boolean you feed in is what the
renderer draws, and `onToggle` pushes the new state back:

```tsx
import { Checkbox } from "plushie/ui"

<Checkbox
  id="auto-save"
  value={state.autoSave}
  onToggle={(s, e) => ({ ...s, autoSave: typeof e.value === "boolean" ? e.value : !s.autoSave })}
>
  Auto-save
</Checkbox>
```

The label can be passed via `label="..."` or as JSX children.

`Toggler` is the visually distinct on/off switch. Same prop
shape: `value: boolean`, `onToggle` delivers the new boolean:

```tsx
import { Toggler } from "plushie/ui"

<Toggler id="notifications" value={state.notify} onToggle={setNotify}>
  Enable notifications
</Toggler>
```

A common typo from other frameworks is `checked` / `toggled`;
both are silently ignored. The source of truth is always `value`.

For now the auto-save flag only flips in the model. In
[chapter 10](10-subscriptions.md) we wire it to a debounced timer
so the buffer saves a second after the user stops typing.

## Radio groups

`Radio` is a one-of-many selector. Each option renders as its own
widget; the group is formed by sharing a `group` name and
threading `state.theme` (or whatever the selected value is)
through every radio's `selected` prop:

```tsx
import { Radio, Row } from "plushie/ui"

const themes = ["light", "dark", "solarized"] as const

<Row id="theme-row" spacing={12}>
  {themes.map((value) => (
    <Radio
      id={`theme-${value}`}
      value={value}
      group="theme"
      selected={state.theme}
      onSelect={(s, e) => ({ ...s, theme: typeof e.value === "string" ? e.value : s.theme })}
    >
      {value}
    </Radio>
  ))}
</Row>
```

A radio renders as checked when its `value` equals `selected`.
When the user clicks a radio, the `select` event fires with the
new `value` as `event.value`. `group` makes the renderer
mutually exclusive: clicking one radio visually deselects the
others in the same group.

## PickList vs ComboBox

Both widgets surface a dropdown; they differ in whether free text
is allowed.

`PickList` is a closed dropdown: the user can only pick a value
from the `options` list. Use it when the choice space is small
and fixed.

```tsx
import { PickList } from "plushie/ui"

<PickList
  id="theme"
  options={["Light", "Dark", "Solarized"]}
  selected={state.theme}
  placeholder="Pick a theme"
  onSelect={(s, e) => ({ ...s, theme: typeof e.value === "string" ? e.value : s.theme })}
/>
```

`ComboBox` is a text input with a filtered suggestion dropdown.
The user can type anything; the suggestions narrow as they type,
and `onSelect` fires when they click one. Use it when the option
list is long, partially open (user-extensible), or benefits from
keyboard-driven filtering:

```tsx
import { ComboBox } from "plushie/ui"

<ComboBox
  id="language"
  options={["TypeScript", "JavaScript", "Python", "Rust", "Go"]}
  selected={state.language}
  placeholder="Language"
  onInput={setLanguageText}
  onSelect={setLanguage}
/>
```

`ComboBox` emits `input` on every keystroke (current text),
`select` when the user picks a suggestion, and `open` / `close`
as the dropdown toggles. Like `TextInput`, it's stateful and
needs an explicit ID.

Rough rule: five or fewer fixed options, `PickList`. Long list
or free-text acceptable, `ComboBox`.

## Validation

Every form widget (`TextInput`, `TextEditor`, `Checkbox`,
`PickList`, `ComboBox`) accepts a `validation` prop that flows
into accessibility metadata automatically. The shape is:

```typescript
type ValidationState =
  | "valid"
  | "pending"
  | readonly ["invalid", string]
```

Computing it from the current value is usually a one-liner:

```tsx
import { TextInput } from "plushie/ui"

function nameValidation(name: string): ValidationState | undefined {
  if (name === "") return undefined
  if (!/^[a-z0-9_-]+\.js$/.test(name)) {
    return ["invalid", "Use lowercase letters, numbers, and underscores; end with .js"]
  }
  return "valid"
}

<TextInput
  id="new-name"
  value={state.newName}
  placeholder="new_name.js"
  required={true}
  validation={nameValidation(state.newName)}
  onInput={handleNewNameInput}
  onSubmit={true}
/>
```

The SDK projects `required` onto `a11y.required` and the invalid
tuple onto `a11y.invalid` plus `a11y.error_message`, so screen
readers announce validation state without extra work. `"pending"`
sets `a11y.busy` while an async validator is in flight.

Details on accessibility flow-through are in the
[Accessibility reference](../reference/accessibility.md).

## Wiring file switching and deletion

The select and delete buttons already capture their filename via
closure, so the handlers are ordinary model transforms. The only
subtlety is that switching away from the current file should
save unsaved edits first:

```typescript
function switchFile(state: DeepReadonly<Model>, file: string): Model {
  if (state.activeFile) Experiments.save(state.activeFile, state.source)
  const source = Experiments.load(file)
  return { ...(state as Model), activeFile: file, source }
}

function deleteFile(state: DeepReadonly<Model>, file: string): Model {
  Experiments.remove(file)
  const files = Experiments.list()
  if (state.activeFile !== file) {
    return { ...(state as Model), files }
  }
  const fallback = files[0]
  if (fallback) return switchFile({ ...(state as Model), files }, fallback)
  return {
    ...(state as Model),
    files: [],
    activeFile: null,
    source: Experiments.starterSource("hello"),
  }
}
```

No scope matching in `update`, no `isClick` guards for per-row
buttons. The closure captured on the widget carries the id the
handler needs. This is the idiomatic TypeScript pattern for
lists with per-row controls.

## Lists that filter, search, or sort

As soon as a list grows beyond a handful of items, users expect
a search box. The `plushie` package ships a `query` helper that
runs a declarative pipeline over an array of records:

```typescript
import { query } from "plushie"
import type { SortSpec } from "plushie"

interface File {
  readonly name: string
  readonly updated: number
}

function visibleFiles(state: DeepReadonly<Model>) {
  return query<File>(state.files, {
    search: { fields: ["name"], query: state.search },
    sort: { direction: "desc", field: "updated" },
    page: 1,
    pageSize: 50,
  })
}
```

`query` returns `{ entries, total, page, pageSize, groups }`.
Render `entries` in the sidebar; use `total` to show a count;
feed `page` back into pagination controls. Because the input is
immutable and the output is a fresh array, it slots neatly into
the view without mutating model state.

Full pipeline options (filter, group, multi-field sort) are in
the [Composition Patterns reference](../reference/composition-patterns.md).

## Tables for structured data

`Table` renders a rows-and-columns dataset with typed column
definitions. Each row is a `Record<string, unknown>`; cells are
drawn by looking up the row value at each column's `key`:

```tsx
import { Table } from "plushie/ui"
import type { TableColumn, TableRow } from "plushie/ui/widgets/table"

const columns: TableColumn[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "size", label: "Size", align: "right", sortable: true },
  { key: "updated", label: "Modified" },
]

const rows: TableRow[] = state.files.map((file) => ({
  name: file.name,
  size: `${file.size} B`,
  updated: new Date(file.updated).toLocaleDateString(),
}))

<Table
  id="file-table"
  columns={columns}
  rows={rows}
  sortBy={state.sortBy}
  sortOrder={state.sortOrder}
  onSort={(s, e) => ({ ...s, sortBy: String(e.value), sortOrder: toggle(s.sortOrder) })}
/>
```

Clicking a sortable column header fires the `sort` event with
the column key in `event.value`. The table itself is stateless;
it just renders what you give it, so feeding `query` output
straight in is the common pattern.

## The full view

Wire the sidebar, editor pane, preview pane, and toolbar
together in a horizontal `Row`, with the event log underneath:

```tsx
import { Column, Row, Window } from "plushie/ui"

view(state) {
  return (
    <Window id="main" title="Plushie Pad" theme="dark">
      <Column id="root" width="fill" height="fill">
        <Row id="main-row" width="fill" height="fill">
          {sidebar(state)}
          {editorPane(state)}
          {previewPane(state)}
        </Row>
        {toolbar(state)}
      </Column>
    </Window>
  )
}

function toolbar(state: DeepReadonly<Model>) {
  return (
    <Row id="toolbar" padding={[8, 4]} spacing={8}>
      <Button id="save" onClick={handleSaveClick}>Save</Button>
      <Checkbox id="auto-save" value={state.autoSave} onToggle={handleAutoSaveToggle}>
        Auto-save
      </Checkbox>
      <TextInput
        id="new-name"
        value={state.newName}
        placeholder="new_name.js"
        onInput={handleNewNameInput}
        onSubmit={true}
      />
    </Row>
  )
}
```

## Verify it

Exercise the create-and-switch flow with the test harness:

```typescript
import { testWith } from "plushie/testing"
import { padApp } from "./app.js"

const test = testWith(padApp)

test("create experiment and switch back", async ({ session }) => {
  await session.typeText("new-name", "test.js")
  await session.submit("new-name")

  session.assertExists("test.js/select")

  await session.click("hello.js/select")
  session.assertText("preview/greeting", "Hello from hello!")
})
```

This exercises scoped IDs, text submission, dynamic list
rendering, and file switching end to end. The testing API is
covered fully in [chapter 15](15-testing.md).

## Try it

With the updated pad running:

- Create a few experiments with different names. Each gets a
  starter template and appears in the sidebar.
- Switch between them. The editor swaps content and the preview
  updates.
- Delete an experiment. The sidebar updates and the next file
  loads automatically.
- Type an invalid name (spaces, uppercase). The validation flag
  turns red and screen readers announce the error.
- Toggle the auto-save checkbox. The model flips but nothing
  saves yet; we wire the debounce timer up in
  [chapter 10](10-subscriptions.md).

The pad now manages a library of experiments. Each one is a
plain `.js` file under `experiments/` that you can also open in
any editor. Next we improve the layout so the panes are sized
and spaced consistently.

---

Next: [Layout](07-layout.md)
