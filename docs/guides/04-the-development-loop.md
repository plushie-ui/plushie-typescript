# The Development Loop

The pad has a layout but the preview does not work yet. In this
chapter we bring it to life with two complementary techniques:
**hot reload** for editing the pad's own source code, and
**runtime compilation** for compiling experiment code typed into
the pad's editor.

Along the way we cover how to inspect a running app without
attaching a debugger, then how to attach one when inspection is
not enough.

## The feedback loop you want

TypeScript developers expect a tight edit, save, see loop from
tools like Vite and `tsx`. Plushie keeps the same rhythm. Edit
a source file, save, watch the window repaint. No extra compile
step, no refresh button, no browser reload.

Two commands drive the loop:

```bash
npx plushie dev src/index.ts     # hot reload
npx plushie inspect src/index.ts # print the initial tree
```

Both are documented in full in the
[CLI commands reference](../reference/cli-commands.md); this
chapter shows them in context.

## Hot reload with `plushie dev`

`plushie dev <app>` is the primary development command. It spawns
`tsx --watch <app>` as a child process: `tsx` handles TypeScript
execution, and `--watch` restarts the Node process whenever any
imported source file changes.

```bash
npx plushie dev src/index.ts
```

The pad's `package.json` already wraps this as a script:

```json
{
  "scripts": {
    "dev": "plushie dev src/index.ts"
  }
}
```

Run it with `pnpm dev`, edit any file in `src/`, save, and the
process restarts. The renderer window closes and reopens each time
because the Node process is replaced, but the transition happens in
a few hundred milliseconds.

### What "hot reload" means in TypeScript

The Elixir and Gleam SDKs reload compiled modules in place and
preserve the model across the reload. Node.js does not offer the
same module replacement primitive cheaply, so `plushie dev` takes
the simpler path: restart the process, replay `init`, re-render.

This matters in exactly one place: **state does not survive a
reload**. Every `plushie dev` restart calls `init` again. If you
want state to persist, put it on disk.

The pad's editor source is the canonical example. The
`experiments/` directory on disk holds every experiment's source
text, and `src/experiments.ts` loads the active file on startup:

```typescript
function initModel(): Model {
  const files = Experiments.list()
  const activeFile = files[0] ?? null
  const source = activeFile
    ? Experiments.load(activeFile)
    : Experiments.starterSource("hello")
  const [preview, error] = render(source)
  return { source, preview, error, /* ... */ }
}
```

With that in place, edits to the pad's own source (`src/app.ts`,
`src/compile.ts`) restart the window but the editor reopens with
the same experiment loaded. It reads as hot reload even though the
process itself is new.

### Alternatives to `plushie dev`

Three equivalent ways to run the pad during development:

| Command | Notes |
|---|---|
| `plushie dev src/index.ts` | Standard. Sets the binary path and wire format via env. |
| `tsx watch src/index.ts` | Identical watcher; you handle binary resolution. |
| `pnpm dev` | Project script that wraps one of the above. |

`plushie dev` is preferred because it routes `--binary`, `--json`,
and other CLI flags into the child process via environment
variables. Running `tsx watch` directly works for minimal setups
but you lose flag forwarding.

To disable the watcher for a one-off run, pass `--no-watch`:

```bash
npx plushie dev src/index.ts --no-watch
```

This is useful when you want to test startup behaviour without the
watcher intercepting a fast exit.

### Why the process restarts (and not the module)

Node's module cache is global and mutable, but its graph is not
safely re-entrant. Clearing a subtree and re-importing fails for
anything that opens a file descriptor, binds a socket, spawns a
child process, or holds a timer. The Plushie runtime does all
four. A fresh process avoids the whole class of "stale handle"
bugs; the only shared state is whatever you put on disk or in an
environment variable.

For apps that want to reload on file change without restarting,
the SDK exports `DevServer` from `plushie`:

```typescript
import { DevServer } from "plushie"

const watcher = new DevServer({
  dirs: ["experiments"],
  debounceMs: 200,
  onReload: (paths) => { /* recompile, rebuild preview */ },
})
watcher.start()
```

The pad does not use `DevServer` because its reloads happen from
user actions (clicking Save). See
[App lifecycle reference](../reference/app-lifecycle.md) for the
runtime's own restart and recovery behaviour; `DevServer` sits
orthogonal to that.

## Making the preview work

The editor holds an experiment. We want to evaluate it at runtime
and render the result in the preview pane. Node ships a runtime
JavaScript evaluator in the `Function` constructor, so we do not
need a separate parser or bundler; the language is already live.

The strategy is narrow:

1. Wrap the source text in a function body that returns a value.
2. Inject the `plushie/ui` namespace as the function's single
   argument so experiments do not need imports.
3. Invoke the function and verify the return is a `UINode`.

Here is `src/compile.ts` from the pad:

```typescript
import type { UINode } from "plushie"
import * as ui from "plushie/ui"

export interface CompileOk {
  readonly ok: true
  readonly node: UINode
}

export interface CompileError {
  readonly ok: false
  readonly message: string
}

export type CompileResult = CompileOk | CompileError

export function compileAndRender(source: string): CompileResult {
  try {
    const fn = new Function("ui", `"use strict"; return (${source});`)
    const node = fn(ui) as UINode
    if (!node || typeof node !== "object" || typeof (node as { id?: unknown }).id !== "string") {
      return {
        ok: false,
        message: "Experiment did not return a view node. The last expression must be a UINode.",
      }
    }
    return { ok: true, node }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, message }
  }
}
```

Every failure mode (syntax error, reference error, wrong return
type) collapses to a `CompileError` with the thrown message. The
pad displays the message as red text in the preview pane and never
crashes.

`new Function(...)` is not `eval`. It compiles the body into a
standalone function with a clean closure: the only binding
available is the `ui` argument we pass in. Experiments cannot
reach into the pad's internals, and a bad experiment affects only
its own stack frame.

## Wiring up the save button

`compileAndRender` returns a `CompileResult`. Store both outcomes
on the model: the successful tree in `preview`, the failure
message in `error`. Display whichever one is set.

The pad's model in `src/app.ts` carries both:

```typescript
export interface Model {
  readonly source: string
  readonly preview: UINode | null
  readonly error: string | null
  // ...
}
```

The init helper compiles the starter source up front so the
preview pane has something to draw before the first user click:

```typescript
function render(source: string): [UINode | null, string | null] {
  const result = compileAndRender(source)
  return result.ok ? [result.node, null] : [null, result.message]
}

function initModel(): Model {
  const source = Experiments.load("hello.js")
  const [preview, error] = render(source)
  return { source, preview, error, /* ... */ }
}
```

The editor reports every keystroke through `onInput`, and the save
button rebuilds the preview from the current source:

```typescript
const handleEdit: Handler<Model> = (state, event) => {
  const next = typeof event.value === "string" ? event.value : state.source
  return { ...(state as Model), source: next, dirty: true }
}

const handleSaveClick: Handler<Model> = (state) => {
  const [preview, error] = render(state.source)
  if (state.activeFile && error === null) {
    Experiments.save(state.activeFile, state.source)
  }
  return { ...(state as Model), preview, error, dirty: error ? state.dirty : false }
}
```

The preview pane renders whichever of `error` or `preview` is
currently set:

```tsx
function previewPane(state: DeepReadonly<Model>): UINode {
  const body: UINode = state.error
    ? Text({ id: "error", size: 14, color: "#ef4444", children: state.error })
    : state.preview ?? Text({ id: "placeholder", children: "Press Save to compile" })
  return Container({
    id: "preview",
    width: { fillPortion: 2 },
    height: "fill",
    padding: 16,
    children: [body],
  })
}
```

Type experiment code in the editor, click Save, and the preview
updates. Break the syntax and the red error text replaces the
preview. Fix it, save again, and the tree comes back.

## The experiment format

An experiment is a single JavaScript expression whose value is a
`UINode`. The `ui` binding is injected, so no imports are needed:

```javascript
ui.column({ padding: 16, spacing: 8, id: "root" }, [
  ui.text("Hello from hello!", { id: "greeting", size: 24 }),
  ui.text("Edit me and press Save.", { id: "hint" }),
])
```

This uses the function form of the widget API. The JSX form is not
available at runtime evaluation (no transform), so experiments
always use `ui.column(...)`, `ui.text(...)`, and so on. Both forms
produce identical trees; the pad just reaches for the form that
works without a compiler.

The preview pane embeds the returned node directly under
`container "preview"`, which scopes every child ID under
`preview/`. That is how `#preview/greeting` becomes addressable in
a test.

## Auto-save as a worked example

Auto-save exercises the whole loop in miniature. The user toggles
a checkbox, a subscription fires each second, every tick checks
for unsaved changes, and dirty states get written to disk.

The model carries two flags, `autoSave` and `dirty`. The editor
handler marks the model dirty on every keystroke; the save handler
clears the flag. The subscription runs only when both toggled on
and dirty:

```typescript
subscriptions(state) {
  const subs: SubscriptionType[] = [Subscription.onKeyPress()]
  if (state.autoSave && state.dirty) {
    subs.push(Subscription.every(1000, "auto_save"))
  }
  return subs
}

update(state, event) {
  if (isTimer(event, "auto_save")) {
    return saveAndRender(state)
  }
  // ...
}
```

The loop survives a `plushie dev` restart because the file on disk
is the source of truth. When the process restarts, `init` reads
the file back and the editor reopens with the last saved text. The
`autoSave` flag itself resets to `false` on restart, which is
deliberate: a restart signals the process was in flux, and the
user deserves a calm state.

## Inspecting a running app

Console logging is the fastest feedback channel. Inline handlers
and `update` run in the Node process, not the renderer, so
`console.log` goes straight to the terminal where you ran
`plushie dev`:

```typescript
const handleSaveClick: Handler<Model> = (state) => {
  console.log("saving", state.activeFile, state.source.length)
  return saveAndRender(state)
}
```

The renderer subprocess has its own stderr (forwarded
automatically) but its logs are prefixed `[renderer]` and gated
behind `RUST_LOG`. To see full protocol detail:

```bash
RUST_LOG=plushie=debug npx plushie dev src/index.ts
```

### Printing the initial tree with `plushie inspect`

When layout is wrong and you cannot tell whether the bug is in
view, in normalization, or in the renderer, short-circuit the
question. `plushie inspect` builds the initial model, calls `view`,
normalizes the tree, and prints it as JSON without starting a
renderer:

```bash
npx plushie inspect src/index.ts
```

```json
{
  "id": "main",
  "type": "window",
  "title": "Plushie Pad",
  "children": [
    {
      "id": "root",
      "type": "column",
      "width": "Fill",
      "height": "Fill",
      "children": [ /* ... */ ]
    }
  ]
}
```

The output is exactly the wire message the SDK would send as the
first snapshot. If an ID looks wrong, it is wrong in your view. If
the structure looks fine but the renderer draws it differently,
the bug is downstream.

`plushie inspect` requires the app module to `export default` an
`AppDefinition<M>`. The pad's `src/index.ts` just calls
`padApp.run()`, so for inspection point at `src/app.ts` (where
the definition lives) or arrange for the entry point to re-export
it.

### Runtime queries

For finer inspection of a running app, hold onto the handle
returned by `run()`:

```typescript
const handle = await padApp.run()
console.log(handle.model())   // current DeepReadonly<Model>
```

`handle.model()` returns the latest model as a frozen, readonly
snapshot. Pair it with a debug keybinding to dump the model on
demand:

```typescript
if (isKey(event, "press") && event.key === "d" && event.modifiers.command) {
  console.log(JSON.stringify(state, null, 2))
  return state
}
```

## Debugging inline handler return values

TypeScript catches most handler mistakes at compile time, but a
few slip past.

**Forgetting the spread.** Returning `{ count: state.count + 1 }`
drops every other field:

```typescript
(state) => ({ count: state.count + 1 })             // wrong
(state) => ({ ...state, count: state.count + 1 })   // right
```

The compiler catches this when the handler's inferred return type
must match `Model`. It does not catch it when the handler is
stored behind a widened type like `Handler<unknown>`. Keep handler
types narrow.

**Unused event parameter.** If you never use the event,
TypeScript emits a "declared but never used" warning. Prefix with
underscore or omit the argument entirely (trailing parameters are
optional).

**Missing return.** A handler that logs and forgets to return
drops the model. Annotate the handler type explicitly; do not rely
on inference when the signature matters.

## VS Code, sourcemaps, and `node --inspect`

`tsx` emits inline sourcemaps by default, so stack traces from a
crashing handler point back to the `.ts` file and the original
line number. No extra config is required.

To attach VS Code's debugger, use the built-in "Node.js: Attach"
launch profile and run the pad under `node --inspect`:

```bash
NODE_OPTIONS="--inspect" npx plushie dev src/index.ts
```

VS Code picks up the inspector on port 9229 and stops on
`debugger` statements and breakpoints. Logpoints work too. For
headless debugging, `--inspect-brk` pauses on the first line and
waits for a client; connect a Chromium browser to
`chrome://inspect`.

When stepping through an inline handler, the state parameter is
wrapped in `DeepReadonly<M>`. Attempting to assign through it in
the REPL throws; see
[App lifecycle reference](../reference/app-lifecycle.md) on model
immutability.

## Running tests alongside development

While `plushie dev` runs in one terminal, leave a Vitest watcher
in another:

```bash
pnpm vitest
```

Tests run against the real renderer binary in `mock` mode through
the session pool; see [Testing reference](../reference/testing.md)
for the setup and the `testWith` helper. A test file for the pad's
compilation path:

```typescript
import { testWith } from "plushie/testing"
import { expect, test as base } from "vitest"
import { padApp } from "../src/app.js"

const test = testWith(padApp)

test("starter experiment compiles and renders", async ({ session }) => {
  await session.assertExists("#preview/greeting")
  await session.assertText("#preview/greeting", "Hello from hello!")
})
```

Each test gets a fresh session on a pooled renderer. Vitest's
watcher re-runs affected tests on save, which means editing
`src/compile.ts` reruns the compilation tests automatically while
`plushie dev` keeps the live pad open for eyeballing. Two
feedback loops, both tight.

## Try it

With the pad running under `plushie dev`:

- Break an experiment deliberately. Remove a closing `)`, save,
  and read the error message in the preview. Fix it and save
  again.
- Edit `src/app.ts` to change the dark-mode accent colour. Save
  and watch the window repaint after the restart.
- Add a `console.log(event)` inside the pad's `update` before the
  `isKey` branch. Press a few keys, then remove the log and move
  on.
- Run `npx plushie inspect src/index.ts` and pipe the output to
  `jq '.children[0].children[1]'` to zoom in on a subtree.
- Launch the pad under `NODE_OPTIONS="--inspect"`, attach a
  debugger, and set a breakpoint inside `compileAndRender`. Click
  Save and step through the happy path.

In the next chapter we log every event the preview produces into a
panel at the bottom of the pad, so you can watch exactly what a
widget emits when you interact with it.

---

Next: [Events](05-events.md)
