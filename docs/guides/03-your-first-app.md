# Your First App

In the previous chapter we stood up a tiny counter and watched the
init / view / update loop tick through a click. Now we start building
**Plushie Pad**, a live TypeScript experiment editor that threads
through the rest of this guide. By the end of the book it will
compile snippets you type, save them to disk, replay keystrokes,
undo your edits, and log every event it sees. We grow it one
capability at a time.

This chapter builds the pad's skeleton: a code editor on the left, a
preview pane on the right, a Save button under both. We don't wire
up compilation yet (chapter 4) and we don't react to widget events
from the preview (chapter 5). The focus here is on the shape of a
real app: the `Model` interface, the `app<M>({ init, view, update })`
factory, inline handlers on widgets, and the spread-based update
pattern you'll use everywhere.

The finished pad lives at
`~/projects/plushie-demos/typescript/plushie_pad/`. You can skip
ahead and run it any time. Each chapter shows only the slice of the
code relevant to the concepts introduced so far.

## The two widget APIs

Plushie has two surfaces for describing widgets. JSX is the default
for views; the function form is handy when you want to build a
widget programmatically from data. Both produce the same `UINode`
and can live in the same tree.

```tsx
import { Button, Column, Text } from "plushie/ui"

<Column id="root" spacing={8}>
  <Text id="greeting">Hello, Plushie!</Text>
  <Button id="ok">OK</Button>
</Column>
```

```typescript
import * as ui from "plushie/ui"

ui.column({ id: "root", spacing: 8 }, [
  ui.text("Hello, Plushie!", { id: "greeting" }),
  ui.button("OK", { id: "ok" }),
])
```

The JSX form requires the `react-jsx` transform pointed at
`plushie`; the getting-started chapter covers the `tsconfig.json`
bits. Guides from this chapter on assume JSX unless a section
specifically walks through programmatic construction. For a deeper
look at both, see the [JSX and functions reference](../reference/jsx-and-functions.md).

## Starting small: a counter

Before we lay out the pad we'll warm up with the smallest possible
app. One number, two buttons, one view. This is the template every
Plushie app follows: a `Model` interface, an `initModel()` seed, a
`view` that returns a tree of windows and widgets, and an `update`
that folds events into the next model.

```tsx
import { app } from "plushie"
import type { DeepReadonly } from "plushie"
import { Button, Column, Row, Text, Window } from "plushie/ui"

interface Model {
  readonly count: number
}

const initModel: Model = { count: 0 }

const counter = app<Model>({
  init: initModel,
  view: (state: DeepReadonly<Model>) => (
    <Window id="main" title="Counter">
      <Column id="root" spacing={8} padding={16}>
        <Text id="count">Count: {String(state.count)}</Text>
        <Row id="buttons" spacing={8}>
          <Button id="dec" onClick={(s) => ({ ...s, count: s.count - 1 })}>-</Button>
          <Button id="inc" onClick={(s) => ({ ...s, count: s.count + 1 })}>+</Button>
        </Row>
      </Column>
    </Window>
  ),
  update: (state) => state,
})

await counter.run()
```

A few things to notice.

**The model is a plain interface.** No classes, no observable
wrappers, no framework base type. Whatever shape your app needs,
that's what you write. `readonly` on every field is a habit worth
forming early; the SDK enforces immutability at the type level and
tries to spot mutation attempts at runtime.

**`DeepReadonly<M>`** wraps every state parameter the SDK hands you.
It recursively freezes nested objects and arrays in the type system,
so `state.count++` is a type error and `state.items.push(...)` is a
type error. The only way to produce a new model is to return one.
Spread-based updates are the canonical pattern:

```typescript
(s) => ({ ...s, count: s.count + 1 })
(s) => ({ ...s, items: [...s.items, newItem] })
(s) => ({ ...s, user: { ...s.user, name } })
```

**Inline handlers on widget props.** Widget events (clicks, inputs,
toggles) route through the prop that matches them: `onClick` on a
`Button`, `onInput` on a `TextInput`, `onToggle` on a `Checkbox`.
The handler receives the current state and the event, and returns
the next state. You can return `[newState, command]` as a tuple if
you also need to fire off work. We'll cover that shortly.

**`update` is the fallback.** Timers, async results, subscriptions,
window events, and anything you don't pin to a widget prop all land
here. Counter has nothing to handle so `update` is the identity
function.

**`app<Model>(...)` takes the model type as an explicit generic.**
TypeScript can sometimes infer it from `init`, but writing it out
avoids surprises when the shape has optional fields or unions, and
it makes handler signatures easier to read.

Run it the same way you ran the counter in chapter 2: `tsx` on a
file, or build with your favourite bundler and invoke the compiled
entry point. The rest of this book uses the Plushie Pad project's
layout.

## Introducing Plushie Pad

Plushie Pad is a live editor for TypeScript snippets. Later chapters
will wire up runtime compilation (the snippet you type becomes a
`UINode` that renders in the preview pane), file storage, keyboard
shortcuts, undo, and auto-save. For this chapter we build the
frame: editor on the left, preview on the right, Save button below.

Clone or follow along in the demo repo:

```bash
cd ~/projects/plushie-demos/typescript/plushie_pad
pnpm install
pnpm start
```

The `plushie` dependency is a `file:` link to the local
`plushie-typescript` checkout; `pnpm install` resolves it to the
working copy. The first run needs the renderer binary:

```bash
npx plushie download
```

`package.json` defines the scripts we'll use:

```json
{
  "scripts": {
    "start": "tsx src/index.ts",
    "dev": "tsx watch src/index.ts",
    "check": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

`pnpm start` boots the pad against the real renderer. `pnpm dev`
rebuilds on change, which lines up with the hot-reload loop we wire
up in chapter 4.

## The pad skeleton

Here is the trimmed version of `src/app.ts` as it stands at the end
of this chapter. Real fields on the final `Model` (like
`eventLog`, `files`, `undoStack`) come in later chapters; for now
we keep only what we use. Save this as `src/app.ts` and we'll walk
through it.

```tsx
import { app } from "plushie"
import type { DeepReadonly, Handler, UINode } from "plushie"
import {
  Button,
  Column,
  Container,
  Row,
  Text,
  TextEditor,
  Window,
} from "plushie/ui"

export interface Model {
  readonly source: string
  readonly preview: UINode | null
  readonly error: string | null
}

function initModel(): Model {
  return {
    source: "// Write some Plushie code here\n",
    preview: null,
    error: null,
  }
}

const handleEdit: Handler<Model> = (state, event) => {
  const next = typeof event.value === "string" ? event.value : state.source
  return { ...(state as Model), source: next }
}

const handleSave: Handler<Model> = (state) => {
  // Chapter 4 replaces this stub with a real compile step.
  return state as Model
}

function editorPane(state: DeepReadonly<Model>): UINode {
  return TextEditor({
    id: "editor",
    value: state.source,
    width: { fillPortion: 1 },
    height: "fill",
    highlightSyntax: "javascript",
    font: "monospace",
    onInput: handleEdit,
  } as never)
}

function previewPane(state: DeepReadonly<Model>): UINode {
  const body: UINode = state.error
    ? Text({ id: "error", color: "#ef4444", children: state.error })
    : state.preview ?? Text({ id: "placeholder", children: "Press Save to compile and preview" })
  return Container({
    id: "preview",
    width: { fillPortion: 1 },
    height: "fill",
    padding: 16,
    children: [body],
  })
}

export const padApp = app<Model>({
  init: initModel(),
  update: (state) => state,
  view: (state) => (
    <Window id="main" title="Plushie Pad">
      <Column id="root" width="fill" height="fill">
        <Row id="split" width="fill" height="fill">
          {editorPane(state)}
          {previewPane(state)}
        </Row>
        <Row id="toolbar" padding={[8, 4]} spacing={8}>
          <Button id="save" onClick={handleSave}>Save</Button>
        </Row>
      </Column>
    </Window>
  ),
})
```

And the entry point, `src/index.ts`:

```typescript
import { padApp } from "./app.js"

await padApp.run()
```

Run it:

```bash
pnpm start
```

You'll see a dark window (we'll theme it in chapter 8) with a code
editor on the left, a placeholder message on the right, and a Save
button below that doesn't do anything yet.

## Walking through the code

### The model

`Model` is a plain interface. `source` holds the editor's text,
`preview` holds the most recently compiled widget tree (or `null`
when nothing has been compiled yet), and `error` holds the compiler
message when compilation fails.

Keeping `preview` and `error` as nullable fields instead of, say, a
discriminated union (`{ kind: "ok", node } | { kind: "error", message }`)
is a judgement call. The pad will eventually want to show stale
output *and* an error banner at the same time, which falls out of
two independent slots more naturally than a union. Pick the shape
that matches how your UI wants to behave, not what looks pretty.

### `app<Model>({ ... })`

The factory takes a config object and returns an `AppDefinition`.
The fields we use here:

| Field | Type | Description |
|---|---|---|
| `init` | `Model` or `[Model, Command \| Command[]]` | The seed model, optionally paired with a command to run on start. |
| `view` | `(state: DeepReadonly<Model>) => AppView` | Build the tree from the current model. Called after every update. |
| `update` | `(state, event) => UpdateResult<Model>` | Fallback for events not handled by widget props. |

`init` accepts a tuple when you want to kick off a command at boot,
for example loading a document on startup:

```typescript
init: [initModel(), Command.task(loadStartup, "startup")]
```

We'll use that form in chapter 4. For this chapter we pass the seed
alone. The full list of lifecycle options is in the
[app lifecycle reference](../reference/app-lifecycle.md).

### The view

`view` returns a tree of `UINode`s. The root of a Plushie view is
always a `Window` (or an array of them for multi-window apps). The
window wraps a `Column` that splits into two rows: a content row
containing the editor and preview panes, and a toolbar row holding
the Save button.

Length values are one of `"fill"`, `"shrink"`, a pixel number, or
`{ fillPortion: n }`. `fillPortion` values share the available space
by ratio: editor and preview both use `{ fillPortion: 1 }`, so they
split evenly. Change the editor to `{ fillPortion: 2 }` and it
takes two thirds. Sizing is covered in depth in the
[windows and layout reference](../reference/windows-and-layout.md).

Padding accepts a number, a `[vertical, horizontal]` tuple, a
`[top, right, bottom, left]` tuple, or an object with named sides.
The toolbar uses `padding={[8, 4]}`: eight pixels top and bottom,
four pixels on the sides.

### Widgets with renderer-side state

`TextEditor` holds renderer-side state: cursor position, scroll
offset, text selection. The renderer matches that state across
renders using the widget's `id`. If you change the id, or replace
the editor with a different widget tree, the state resets. The
same goes for `TextInput`, `ComboBox`, `Scrollable`, `PaneGrid`,
and `TextEditor`. Layout widgets like `Column` and `Row` don't
hold renderer state, so any stable id works for them.

Give stateful widgets deliberate, stable ids. For a single editor,
`"editor"` is fine. For a list of editors driven by data, derive
the id from the data's key: `id={`cell-${row}-${col}`}`. Reusing
the same id in different logical positions across renders confuses
the renderer and causes state to jump around.

The full list of built-in widgets, and which ones hold state, is
in the [built-in widgets reference](../reference/built-in-widgets.md).

### Inline handlers

`onInput={handleEdit}` wires the editor's input events straight
into a handler. The handler's signature is
`(state, event) => Model | [Model, Command]`, which is what the
`Handler<Model>` type alias expands to. Inline handlers skip
`update` entirely: when the editor fires, the runtime calls
`handleEdit` with the current state, takes the returned value, and
renders.

The event's `value` is typed as `unknown` because the same widget
prop can fire different event shapes (for `TextEditor` it's always
a string; for `Checkbox.onToggle` it's always a boolean; the SDK
uses `unknown` at the boundary to force you to narrow). The
canonical pattern is a `typeof` check with a fallback:

```typescript
const handleEdit: Handler<Model> = (state, event) => {
  const next = typeof event.value === "string" ? event.value : state.source
  return { ...(state as Model), source: next }
}
```

`event.value` is `unknown`; the `typeof` check narrows it to
`string`; the fallback returns the current source unchanged if
something weird arrives. In practice the fallback never triggers,
but the types make you acknowledge the possibility. We cover event
narrowing in depth in the [events reference](../reference/events.md)
and in chapter 5.

The `(state as Model)` cast is load-bearing: the handler receives
`DeepReadonly<Model>`, and the spread produces a plain `Model`
again. Without the cast, TypeScript widens the return type in a
way that's occasionally surprising. Some handlers don't need it;
if in doubt, write the spread, see what the compiler says, add the
cast when asked.

### Returning tuples from handlers

The Save button's handler is a stub for now:

```typescript
const handleSave: Handler<Model> = (state) => state as Model
```

In chapter 4 we'll replace it with a real compile step that also
writes the current source to disk. That's a side effect, so we'll
return a tuple:

```typescript
import { Command } from "plushie"

const handleSave: Handler<Model> = (state) => {
  const [preview, error] = render(state.source)
  const next = { ...(state as Model), preview, error }
  return [next, Command.writeFile(`experiments/${state.activeFile}`, state.source)]
}
```

The first element is the new model, the second is a command (or an
array of commands) the runtime will dispatch after the view
re-renders. The [commands reference](../reference/commands.md) has
the full list of constructors.

### `update` as the fallback

We're not using `update` yet, so it's the identity function. In
chapter 5 we'll start handling keyboard shortcuts there (for
example `Cmd+S` to save), and in chapter 10 we'll handle timer
ticks for auto-save and async results from background tasks. See
the [composition patterns reference](../reference/composition-patterns.md)
for how to organise an `update` once it grows past a handful of
branches.

## View helpers

The view already has two helper functions, `editorPane` and
`previewPane`, even though the pad is tiny. Breaking up a view into
named functions that each take the state and return a `UINode`
scales better than one giant JSX expression. The full pad has
`sidebar`, `editorPane`, `previewPane`, `toolbar`, and
`eventLogPane`, each a small function that only reads the fields
it cares about. Start the habit early.

## Try it

With `pnpm start` running:

- Type into the editor. The text updates as you go, and the
  handler spreads every new value into `state.source`.
- Switch the editor's width from `{ fillPortion: 1 }` to
  `{ fillPortion: 2 }`, save, restart. It now takes two thirds of
  the split.
- Add a `Button` to the toolbar row. Give it an `onClick` that
  returns `state` unchanged. Notice nothing breaks, even though
  the handler does nothing useful.

The pad is still a shell: an editor beside an empty preview, and a
Save button that smiles at you and does nothing. Chapter 4 wires up
the development loop so code edits reload without restarting the
renderer, and chapter 5 gets the preview rendering real widgets
from the editor's content.

---

Next: [The Development Loop](04-the-development-loop.md)
