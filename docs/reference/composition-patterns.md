# Composition patterns

Techniques for structuring Plushie apps as they grow. Plushie has
no built-in component system, no context, no hooks. State lives in
a single model, `view(state)` is a pure function, and inline
handlers mutate-by-return. Every pattern below composes those
three primitives with the helpers in `plushie` (`memo`, `Route`,
`Selection`, `UndoStack`, `Data`) and the custom-widget system in
`plushie` (`buildWidget`, `WidgetDef`).

This page is about how to organize code. For widget-level recipes
(tabs, modals, toasts, search boxes) see the guides.

## Splitting the model

A flat model gets noisy around ten fields. Name your domains and
nest them as records:

```typescript
interface Model {
  readonly route: RouteType
  readonly editor: EditorState
  readonly sidebar: SidebarState
  readonly toasts: readonly Toast[]
}

interface EditorState {
  readonly source: string
  readonly dirty: boolean
  readonly undo: UndoStackType<string>
  readonly selection: SelectionType
}
```

Nested state is still immutable. Spreads nest too:
`(s) => ({ ...s, editor: { ...s.editor, source: next, dirty: true } })`.

Factor the deep update into a helper when a branch writes the
same slice twice in one function. Keep the helper local to the
module that owns the domain:

```typescript
function setEditor(s: Model, patch: Partial<EditorState>): Model {
  return { ...s, editor: { ...s.editor, ...patch } }
}
```

`setEditor` reads at the call site like domain language:
`setEditor(s, { source, dirty: true })`. The type system already
enforces immutability through `DeepReadonly<M>`, and the spread
pattern is explicit about what changed.

For very large models, move a domain's types, init, reducers, and
view into its own module and re-export a tiny surface. The
top-level `app({ ... })` call stays flat; the domain modules
carry the detail.

## View helpers

`view` is a pure function returning a `UINode` tree. Break it into
smaller pure functions that return subtrees. Name them for what
they render, not for which component they "are":

```tsx
import { Column, Container, Row, Text, Window } from "plushie/ui"
import type { DeepReadonly } from "plushie"

function appView(state: DeepReadonly<Model>) {
  return (
    <Window id="main" title="Editor" width={1024} height={768}>
      <Column width="fill" height="fill">
        {header(state)}
        <Row width="fill" height="fill">
          {sidebar(state)}
          {editor(state)}
        </Row>
        {statusBar(state)}
      </Column>
    </Window>
  )
}

function header(state: DeepReadonly<Model>) {
  return (
    <Row padding={[8, 16]} spacing={8}>
      <Text size={18}>{state.session.title}</Text>
    </Row>
  )
}
```

Each helper takes the slice of state it needs. Pass the whole
model when the helper has to reach several slices; pass a slice
when one will do. Avoid passing "event dispatchers" or callback
props; handlers are attached directly to the widget they belong
to.

Each helper returns a `UINode`, a `readonly UINode[]`, or `null`.
`null` and `boolean` children are filtered by the JSX runtime so
`{state.showSidebar && sidebar(state)}` works without wrapping in
a fragment.

JSX inside a `map` is fine for list items, but when building
children programmatically the function form (`column(id, opts,
children)`) composes more cleanly. Both forms produce the same
wire node.

## Scoped subtrees

`<Container id="...">` is the scoping primitive. Its ID is pushed
onto the scope chain during tree normalization, and every
descendant's wire ID is prefixed with it. Two copies of the same
subtree under different container IDs never collide:

```tsx
import { Button, Container, Column, TextInput } from "plushie/ui"

function loginForm(id: string, state: DeepReadonly<FormState>) {
  return (
    <Container id={id}>
      <Column spacing={8}>
        <TextInput id="email" value={state.email} />
        <TextInput id="password" value={state.password} />
        <Button id="submit">Submit</Button>
      </Column>
    </Container>
  )
}

// Used twice in the same view; no ID collision.
<Row>
  {loginForm("signin", state.signin)}
  {loginForm("signup", state.signup)}
</Row>
```

The `submit` button's wire ID becomes `"signin/submit"` in one
subtree and `"signup/submit"` in the other. Route them in
`update` by branching on `event.scope[0]`:

```typescript
if (isClick(event, "submit")) {
  const [form] = event.scope
  return form === "signin" ? doSignin(state) : doSignup(state)
}
```

The rules for scoped IDs (reserved characters, sibling
uniqueness, dynamic IDs for list items) are on the
[Scoped IDs reference](scoped-ids.md).

## Reusable handlers

Inline handlers are ordinary functions; they take `(state, event)`
and return a model or `[model, command]`. Extract them when a
handler is used in more than one place, when it has nontrivial
logic, or when it benefits from a name:

```typescript
import type { DeepReadonly, WidgetEvent } from "plushie"

const toggleSidebar = (s: DeepReadonly<Model>, _e: WidgetEvent) => ({
  ...s,
  sidebarOpen: !s.sidebarOpen,
})

function header(state: DeepReadonly<Model>) {
  return (
    <Row>
      <Button id="toggle" onClick={toggleSidebar}>Menu</Button>
    </Row>
  )
}
```

Handlers can be parameterized through a closure. Partial
application produces a new handler per call:

```typescript
const setField = (field: keyof Model) =>
  (s: DeepReadonly<Model>, e: WidgetEvent) =>
    ({ ...s, [field]: e.value as string })

<TextInput id="email" value={state.email} onInput={setField("email")} />
```

The closure allocates a new function every render; the runtime's
handler registry stores the newest one keyed by widget ID and
event type, so there is no stale-handler problem.

## Lifted vs inline handlers

Two places react to a widget event: the inline handler on the
widget, and the `update` fallback for events no inline handler
caught. The tradeoff:

- **Inline** reads naturally. The handler lives next to the
  widget. Widget authors never forget to wire it up. Use for
  local state: a click that flips a visible flag, an input that
  writes back to the field it came from.
- **`update` fallback** centralizes. Every event flows through a
  single dispatch table. Use when many widgets share routing
  logic (list items where the ID encodes the target), when the
  handler needs to inspect cross-cutting state, or when the same
  event type comes from several widgets with different scopes.

Mix them. A `Button` can have `onClick` for the local case and
`update` can still handle `isClick(event, "something-else")` for
unhandled clicks elsewhere. Handlers never fall through;
`update` only sees events that no inline handler caught.

## Model updates for nested structures

A deeply nested spread is an eyesore. Flatten it with a local
helper, a `Partial` patcher, or a sub-reducer:

```typescript
// Local helper for per-domain logic.
function setSource(s: Model, source: string): Model {
  return { ...s, editor: { ...s.editor, source, dirty: true } }
}

// Partial patcher when the shape is uniform.
function patchEditor(s: Model, patch: Partial<EditorState>): Model {
  return { ...s, editor: { ...s.editor, ...patch } }
}

// Sub-reducer when the slice has its own event vocabulary.
function editorReducer(s: EditorState, event: EditorEvent): EditorState {
  switch (event.kind) {
    case "set_source": return { ...s, source: event.value, dirty: true }
    case "saved": return { ...s, dirty: false }
  }
}
```

Reach for a sub-reducer when a slice has its own event shape and
its reducers are worth testing in isolation. Do not introduce
sub-reducers for small slices; the indirection costs more than
the duplication it saves.

Arrays update in the same immutable style. The canonical
operations:

```typescript
// Append
{ ...s, items: [...s.items, newItem] }

// Prepend
{ ...s, items: [newItem, ...s.items] }

// Remove by id
{ ...s, items: s.items.filter((i) => i.id !== targetId) }

// Update one by id
{ ...s, items: s.items.map((i) => i.id === targetId ? { ...i, done: true } : i) }

// Insert at index
{ ...s, items: [...s.items.slice(0, i), item, ...s.items.slice(i)] }
```

`Array.prototype.toSorted`, `toReversed`, `toSpliced`, and `with`
are non-mutating alternatives when targeting ES2023.

## Data pipelines with `query`

`Data.query(items, opts)` from `plushie` is a declarative filter /
search / sort / paginate / group pipeline over an in-memory array.
Bind its result to any list widget:

```typescript
import { Data } from "plushie"
import type { QueryResult } from "plushie"

interface User extends Record<string, unknown> {
  id: string
  name: string
  role: string
  active: boolean
}

function visibleUsers(state: DeepReadonly<Model>): QueryResult<User> {
  return Data.query<User>(state.users, {
    filter: (u) => u.active,
    search: { fields: ["name", "role"], query: state.query },
    sort: { direction: state.sortDir, field: state.sortField },
    page: state.page,
    pageSize: 25,
  })
}
```

`QueryResult<T>` has `entries` (the current page), `total` (all
matching rows before pagination), `page`, `pageSize`, and
`groups` (when `group` is set). Render `entries` in a
`KeyedColumn` or `Table` and drive the controls from `total`:

```tsx
import { Button, KeyedColumn, Row, Text } from "plushie/ui"

function userList(state: DeepReadonly<Model>) {
  const result = visibleUsers(state)
  return (
    <>
      <KeyedColumn spacing={4}>
        {result.entries.map((u) => (
          <Row id={u.id} spacing={8}>
            <Text>{u.name}</Text>
            <Text color="#666">{u.role}</Text>
          </Row>
        ))}
      </KeyedColumn>
      <Row spacing={8}>
        <Button id="prev" onClick={prev}>Prev</Button>
        <Text>{`${state.page} / ${Math.ceil(result.total / 25)}`}</Text>
        <Button id="next" onClick={next}>Next</Button>
      </Row>
    </>
  )
}
```

The pipeline is pure: recomputing it every render is cheap for
small lists and memoizable for large ones (see
[Memoization](#memoization)). Do not cache the `QueryResult` in
the model; the model holds the inputs (`query`, `sortField`,
`page`, ...) and `view` derives the output.

Binding to `Table`: pass `result.entries` as `rows` and let the
table render its own header and sort interactions. For rich
cells, compose `tableRow(id, children)` and `tableCell(id,
column, children)` directly; children are arbitrary widgets.

## Selection

`Selection` from `plushie` holds a set of selected IDs, an anchor
for range extension, and the item order used for range selection.
The mode (`"single"`, `"multi"`, `"range"`) controls which
operations do what. Thread it through the model:

```typescript
import { Selection } from "plushie"
import type { SelectionType } from "plushie"

interface Model {
  readonly items: readonly Item[]
  readonly selection: SelectionType
}

const init: Model = {
  items: [],
  selection: Selection.createSelection({ mode: "multi" }),
}
```

Keep `selection.order` in sync with the rendered order when it
affects range selection. For a stable list, create the selection
once with the order up front; for a dynamic list, rebuild it when
items change:

```typescript
function setItems(s: Model, items: Item[]): Model {
  return {
    ...s,
    items,
    selection: { ...s.selection, order: items.map((i) => i.id) },
  }
}
```

Toggle on click, extend on shift-click, range on shift with an
anchor:

```typescript
const rowClicked = (s: DeepReadonly<Model>, e: WidgetEvent) => {
  const [itemId] = e.scope
  if (!itemId) return s
  const shift = (e.data as { modifiers?: { shift?: boolean } })?.modifiers?.shift === true
  if (shift) return { ...s, selection: Selection.rangeSelect(s.selection, itemId) }
  return { ...s, selection: Selection.toggle(s.selection, itemId) }
}
```

Use `Selection.isSelected(state.selection, id)` to drive per-row
styling in the view. `Selection.selectAll`, `Selection.clear`,
`Selection.deselect`, and `Selection.selected` cover the
remaining operations.

## Undo / redo

`UndoStack` from `plushie` stores reversible commands with
optional coalescing. Each push captures an `apply` and `undo`
closure; coalescing merges adjacent pushes tagged with the same
`coalesce` key inside a time window:

```typescript
import { UndoStack } from "plushie"
import type { UndoStackType } from "plushie"

interface Model {
  readonly source: string
  readonly undo: UndoStackType<string>
}

const init: Model = {
  source: "",
  undo: UndoStack.createUndoStack(""),
}
```

On every edit, push a command and update the mirrored source:

```typescript
function update(s: DeepReadonly<Model>, event: Event): Model {
  if (isInput(event, "editor")) {
    const previous = s.source
    const next = event.value as string
    const undo = UndoStack.push(s.undo, {
      apply: (_) => next,
      undo: (_) => previous,
      coalesce: "typing",
      coalesceWindowMs: 500,
    })
    return { ...s, source: next, undo }
  }
  return s
}
```

Wire Ctrl+Z and Ctrl+Shift+Z through the keyboard subscription:

```typescript
import { Subscription } from "plushie"

const subscriptions = (_s: DeepReadonly<Model>) => [Subscription.onKeyPress()]

function update(s: DeepReadonly<Model>, event: Event): Model {
  if (isKey(event, "press") && event.key === "z" && event.modifiers.command) {
    const stack = event.modifiers.shift
      ? UndoStack.redo(s.undo)
      : UndoStack.undo(s.undo)
    if (stack === s.undo) return s
    return { ...s, undo: stack, source: UndoStack.current(stack) }
  }
  return s
}
```

`UndoStack.canUndo` and `UndoStack.canRedo` drive button enabled
state in the view. `UndoStack.history` lists labels for a
"history" UI.

Coalescing semantics: a push with `coalesce: "typing"` merges
with the previous entry if it also used `coalesce: "typing"` and
the previous timestamp is within `coalesceWindowMs`. The merged
entry keeps the original undo and the latest apply, so undo
rewinds the whole run of keystrokes in one step. Pushes without
a `coalesce` tag never merge.

## Routing

`Route` from `plushie` is a stack-based navigation primitive. The
top of the stack is the current path; `push` pushes a new entry,
`pop` removes the top (never below the root), `replaceTop` swaps
the current entry without growing the stack.

```typescript
import { Route } from "plushie"
import type { RouteType } from "plushie"

interface Model {
  readonly route: RouteType
  readonly users: readonly User[]
}

const init: Model = {
  route: Route.createRoute("list"),
  users: [],
}
```

Dispatch the view on the current path:

```tsx
function view(state: DeepReadonly<Model>) {
  const path = Route.currentPath(state.route)
  const params = Route.currentParams(state.route)
  return (
    <Window id="main" title="Users">
      {path === "list" && listView(state)}
      {path === "detail" && detailView(state, params["id"] as string)}
      {path === "settings" && settingsView(state)}
    </Window>
  )
}
```

Navigation is just a model update:

```typescript
if (isClick(event, "open")) {
  const [userId] = event.scope
  return { ...s, route: Route.push(s.route, "detail", { id: userId }) }
}

if (isClick(event, "back")) {
  return { ...s, route: Route.pop(s.route) }
}
```

`Route.canGoBack(state.route)` gates the back button.
`Route.routeHistory(state.route)` returns the stack newest-first,
useful for breadcrumbs. Params are a plain record; keep them
typed at the call site (`params["id"] as string`) or parse into a
stricter shape in the view helper.

`Route` does not do URL parsing, pattern matching, or guards.
Match on `path` with a switch or extract a `screenFor(path)`
dispatcher that narrows a string to a typed screen union.

## Memoization

`memo(deps, body)` caches a subtree keyed by a value. When `deps`
is deep-equal to the previous render's value at the same call
site, the cached normalized tree is reused and the differ
short-circuits on reference equality. `body` only runs when
`deps` changes.

```typescript
import { memo } from "plushie"

function userCard(user: User) {
  return memo({ id: user.id, v: user.version }, () => (
    <Container id={user.id}>
      <Text size={16}>{user.name}</Text>
      <Text color="#666">{user.email}</Text>
    </Container>
  ))
}
```

Deps should be small and structured. Include every value the body
closes over that can change; exclude anything the body never
reads. The common shape is `{ id, v }` where `v` is a version
counter or `updatedAt` timestamp bumped on mutation.

Apply memo where the body is expensive or where the subtree is
rendered many times per view: list items, chart frames, styled
panels with many children. Do not wrap every subtree; a bare
function call is faster than a deep equality check for trivial
bodies. Memo sites are positional, so call sites must be stable
across renders for the cache to hit.

## Stateful pure-TS widgets

`buildWidget(def, id, props, opts?)` from `plushie` instantiates a
widget defined by a `WidgetDef`. The widget owns internal state
(hover, focus, animation progress, expanded/collapsed) that the
app model should not carry. The runtime stores the state in a
registry keyed by window and scoped ID, calls `view` to produce
the subtree, and threads events through `handleEvent` before they
reach `update`:

```typescript
import { buildWidget } from "plushie"
import type { WidgetDef, EventAction } from "plushie"
import { isPress, isExit } from "plushie"

interface HoverState { readonly hovering: boolean }
interface HoverProps { readonly label: string }

const hoverButton: WidgetDef<HoverState, HoverProps> = {
  init: () => ({ hovering: false }),
  view: (id, props, state) => (
    <Container id={id} background={state.hovering ? "#e5e7eb" : "#ffffff"}>
      <Text>{props.label}</Text>
    </Container>
  ),
  handleEvent: (event, state) => {
    if (isPress(event)) return [{ type: "emit", kind: "click" }, state]
    if (isMove(event)) return [{ type: "update_state" }, { hovering: true }]
    if (isExit(event)) return [{ type: "update_state" }, { hovering: false }]
    return [{ type: "ignored" }, state]
  },
}

// In the parent view:
buildWidget(hoverButton, "save", { label: "Save" })
```

`handleEvent` returns `[action, newState]`. Actions:

| Action | Meaning |
|---|---|
| `{ type: "ignored" }` | Pass the event to the next handler in the scope chain. |
| `{ type: "consumed" }` | Absorb the event; no-op for `update`. |
| `{ type: "update_state" }` | Absorb and re-render with `newState`. |
| `{ type: "emit", kind, value? / data? }` | Replace the event with a semantic `WidgetEvent` and continue. |

Pick this over inline handlers when:

- The widget needs internal state the app model should not own.
  Hover, focus-ring visibility, and open/closed are classic
  examples.
- The widget has a coordinated event vocabulary (`click`,
  `longPress`, `hover`) that the parent should handle uniformly,
  regardless of the low-level events that triggered them.
- The widget is reused in many places and the state tracking is
  nontrivial enough to justify a type-checked definition.

For everything else, inline handlers on built-in widgets are
simpler. The cost of a `WidgetDef` is the extra file and the
registry plumbing; the benefit is encapsulation.

## Passing commands from deep in the tree

Handlers return either the new model or a tuple
`[model, command | command[]]`. A deeply nested handler can kick
off side effects without touching a parent:

```typescript
const save = (s: DeepReadonly<Model>, _e: WidgetEvent): [Model, CommandType] => [
  { ...s, saving: true },
  Command.task(
    async (signal) => {
      const res = await fetch("/api/save", { signal, method: "POST", body: JSON.stringify(s.doc) })
      if (!res.ok) throw new Error(`status ${res.status}`)
      return res.json()
    },
    "save",
  ),
]
```

The command result returns to `update` as an `AsyncEvent` tagged
`"save"`. That's the hand-off: handlers own the request, `update`
owns the reply. Keep the request in one place and tag it so the
reply routes back.

For multiple effects, return a plain array:
`[state, [Command.focus("search"), Command.selectAll("search")]]`.
It is equivalent to `Command.batch(...)`; the runtime accepts
either.

## Windows as composition units

A window is a top-level composition boundary. Everything inside
is namespaced under the window ID (see `scoped-ids.md`), and
inline handlers, subscriptions, and commands can target a window
by qualifying the widget path with `"windowId#..."`:

```typescript
Command.focus("settings#email")
Subscription.onKeyPress({ window: "settings" })
```

For multi-window apps, return `readonly WindowNode[]` from
`view`. Each window renders from the same model but can select
different slices:

```tsx
function view(state: DeepReadonly<Model>) {
  const windows: ReturnType<typeof Window>[] = [
    <Window id="main" title="Editor">{editor(state)}</Window>,
  ]
  if (state.preferencesOpen) {
    windows.push(<Window id="prefs" title="Preferences" exitOnCloseRequest={false}>
      {prefs(state)}
    </Window>)
  }
  return windows
}
```

`exitOnCloseRequest: false` keeps the app alive when a secondary
window is closed; handle the `close_requested` event in `update`
and drop the window from the next `view`:

```typescript
if (isWindow(event, "close_requested") && event.windowId === "prefs") {
  return { ...state, preferencesOpen: false }
}
```

See the [Windows and Layout reference](windows-and-layout.md) for
the full `Window` prop surface and multi-window dispatch rules.

## See also

- [Scoped IDs reference](scoped-ids.md): how container IDs build
  the wire path for nested subtrees.
- [Events reference](events.md): inline handler shape, the
  `update` fallback, event guards.
- [Commands reference](commands.md): `Command.task`,
  `Command.batch`, and the tuple-return handler shape.
- [Windows and Layout reference](windows-and-layout.md): multi-
  window apps, sizing, alignment.
- [Built-in Widgets reference](built-in-widgets.md): catalog of
  widgets that participate in these patterns.
