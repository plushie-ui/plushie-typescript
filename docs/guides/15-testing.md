# Testing

The pad has grown real behaviour: compile on save, auto-save on
a timer, undo and redo through Ctrl+Z, an event log that fills up
as you poke at the preview. None of that is verified beyond
eyeballing it. This chapter wires Vitest into the pad and walks
through tests that drive the real renderer end-to-end.

Plushie tests hit the real `plushie` binary. There is no
TypeScript-side mock of the runtime, the wire protocol, or the
widget tree. The binary runs in `mock` mode (sub-millisecond per
interaction, no GPU), which keeps the suite fast while still
exercising every codec, every handshake, and every widget event
path. The full reference lives at
[Testing reference](../reference/testing.md).

## Setting up Vitest

The pad already lists `vitest` as a dev dependency and declares
a `test` script:

```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

Add a minimal `vitest.config.ts` at the pad root so Vitest
discovers tests in the `test/` directory:

```typescript
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
})
```

The pad ships one existing test, `test/compile.test.ts`, that
checks the compile pipeline in isolation. That file never starts
a session; it unit-tests pure functions. The tests we write next
go one level up and drive the whole app.

Before running tests, make sure the binary is on disk. The
`plushie` CLI downloads a precompiled artifact for the pinned
version:

```bash
pnpm exec plushie download
pnpm test
```

If the binary cannot be resolved, the first test fails
immediately with a setup message. There is no fallback to a
fake.

## `testWith(appDef, opts?)`

`testWith` is the Vitest fixture factory exported from
`plushie/testing`. It takes the same `app(...)` definition the
CLI runs and returns a `test` function that creates and tears
down a fresh `TestSession<M>` around each body:

```typescript
import { testWith } from "plushie/testing"
import { expect } from "vitest"
import { padApp } from "../src/app.js"

const test = testWith(padApp)

test("starts with a preview", async ({ session }) => {
  await session.assertExists("preview")
  await session.assertNotExists("error")
})
```

Every `test` call gets a brand-new model, a brand-new renderer
session, and its own event log. Vitest runs them in parallel
against a shared pool (by default eight slots); sessions never
see each other's state.

`testWith` forwards a `TestOptions` object to the pool:

| Option | Type | Description |
|---|---|---|
| `binary` | `string` | Path to the `plushie` binary. Defaults to the resolved installation. |
| `mode` | `"mock" \| "headless"` | Renderer mode. Defaults to `"mock"`. |
| `format` | `"msgpack" \| "json"` | Wire format. Defaults to `"msgpack"`. |
| `maxSessions` | `number` | Maximum concurrent pool slots. Defaults to `8`. |

Options apply to the first pool that gets created; later calls
reuse it. Keep the configuration stable across a module or set
it once in `globalSetup`.

For cases where the Vitest test callback is awkward (for
instance when a single session runs across several assertions in
`beforeAll`), use `createSession` and `stopPool` directly. See
the [Testing reference](../reference/testing.md#testwithappdef-opts)
for the lower-level surface.

## The `TestSession` API

A `TestSession<M>` wraps a `Runtime<M>` bound to one pool slot.
Every interaction round-trips through the renderer and waits for
the update cycle to settle before resolving. By the time an
`await session.click(...)` returns, the model reflects the new
state and the tree has been re-normalised.

### Selectors

Interactions and queries take a unified selector string:

| Form | Matches |
|---|---|
| `"save"` | Local ID anywhere in the tree. |
| `"form/save"` | Scoped path. |
| `"#save"` | Local or scoped ID with explicit prefix. |
| `"main#save"` | Window-qualified ID. |
| `":focused"` | Currently focused widget. |
| `"[text=Save]"` | Widget whose text, label, or value matches. |
| `"[role=button]"` | Widget with the given accessibility role. |
| `"[label=Email]"` | Widget with the given accessibility label. |

If a local ID appears in more than one window, the session
throws and asks for a qualifier. Tests should never guess.

### Interactions

All interaction methods return `Promise<void>` and resolve once
the event has round-tripped through the renderer and the
resulting events have been processed by `update`.

| Method | Signature | Description |
|---|---|---|
| `click` | `(selector)` | Click a clickable widget. |
| `typeText` | `(selector, text)` | Type into a text input or editor. |
| `submit` | `(selector)` | Press Enter on a text input. |
| `toggle` | `(selector)` | Toggle a checkbox or toggler. |
| `select` | `(selector, value)` | Select from a pick list, combo box, or radio group. |
| `slide` | `(selector, value)` | Move a slider. |
| `press` | `(key)` | Key down only. |
| `release` | `(key)` | Key up only. |
| `typeKey` | `(key)` | Press and release. |
| `moveTo` | `(x, y)` | Move the cursor to window coordinates. |
| `scroll` | `(selector, deltaX, deltaY)` | Scroll a scrollable. |
| `paste` | `(selector, text)` | Paste text. |
| `sort` | `(selector, column, direction?)` | Sort a table column. |
| `canvasPress` | `(selector, x, y, button?)` | Press on a canvas. |
| `canvasRelease` | `(selector, x, y, button?)` | Release on a canvas. |
| `canvasMove` | `(selector, x, y)` | Move within a canvas. |

Key strings go through `resolveKey` so both `"Ctrl+s"` and
`"ctrl+s"` resolve to the same key. Modifier names use `+`:
`"Shift+Left"`, `"Alt+F4"`.

### Queries and state inspection

| Method | Signature | Description |
|---|---|---|
| `find` | `(selector)` | Return the matching `Element` or `null`. |
| `findOrThrow` | `(selector)` | Return the matching `Element` or throw. |
| `findByText` | `(text)` | Find by displayed text. |
| `findByRole` | `(role)` | Find by accessibility role. |
| `findByLabel` | `(label)` | Find by accessibility label. |
| `findFocused` | `()` | Return the focused `Element`. |
| `model` | `()` | Current model as `DeepReadonly<M>`. |
| `tree` | `()` | Last normalised wire tree. |

`Element` carries `id`, `type`, `props`, `children`, and a
`text` field extracted from the usual text-bearing props.

### Assertions

Session assertions throw on mismatch, so they compose with
Vitest's `expect` without ceremony:

| Method | Signature | Description |
|---|---|---|
| `assertText` | `(selector, expected)` | Widget text equals `expected`. |
| `assertExists` | `(selector)` | Selector matches at least one widget. |
| `assertNotExists` | `(selector)` | Selector matches nothing. |
| `assertRole` | `(selector, role)` | Resolved a11y role matches. |
| `assertA11y` | `(selector, expected)` | Subset of resolved a11y props matches. |
| `assertModel` | `(expected)` | Model is deep-equal (by JSON) to `expected`. |

For model-shape assertions, prefer `expect(session.model())`
over `assertModel`: Vitest's diff output is friendlier than a
thrown string.

## Testing the pad

Create `test/app.test.ts` next to the existing `compile.test.ts`.
The tests walk through the behaviours the pad guide chapters
added: save renders the preview, invalid source surfaces the
error, Ctrl+S mirrors the Save button, and the auto-save
checkbox flips `dirty` back to false after the timer fires.

```typescript
import { testWith } from "plushie/testing"
import { expect } from "vitest"
import { padApp } from "../src/app.js"

const test = testWith(padApp)

test("starter code renders on init", async ({ session }) => {
  await session.assertExists("preview")
  await session.assertNotExists("error")
  expect(session.model().dirty).toBe(false)
})

test("Save button compiles and clears dirty", async ({ session }) => {
  await session.typeText("editor", `ui.text("t", { children: "Hi" })`)
  expect(session.model().dirty).toBe(true)

  await session.click("save")

  expect(session.model().dirty).toBe(false)
  await session.assertNotExists("error")
  const preview = await session.findOrThrow("preview")
  expect(preview.children.length).toBeGreaterThan(0)
})

test("invalid source surfaces the error pane", async ({ session }) => {
  await session.typeText("editor", `ui.text(`)
  await session.click("save")
  await session.assertExists("error")
})

test("Ctrl+S mirrors the Save button", async ({ session }) => {
  await session.typeText("editor", `ui.text("ok", { children: "ok" })`)
  await session.typeKey("Ctrl+s")
  expect(session.model().dirty).toBe(false)
})

test("Ctrl+Z pops the undo stack", async ({ session }) => {
  await session.typeText("editor", "first")
  await session.typeText("editor", "second")
  await session.typeKey("Ctrl+z")
  expect(session.model().source).toBe("first")
})
```

Run them:

```bash
pnpm test
```

Each test owns a fresh session. There is no cleanup to write,
no `beforeEach` to thread; `testWith` handles teardown even when
the body throws.

## Timers, async, and effect stubs

The pad's auto-save subscription fires a `TimerEvent` every
second once `autoSave && dirty` is true. Tests should not wait
for wall-clock time. Inject the event directly:

```typescript
test("auto-save flushes after a dirty edit", async ({ session }) => {
  await session.toggle("auto-save")
  await session.typeText("editor", `ui.text("auto", { children: "auto" })`)
  expect(session.model().dirty).toBe(true)

  session.timer("auto_save")
  await new Promise((r) => setTimeout(r, 0))

  expect(session.model().dirty).toBe(false)
})
```

`session.timer(tag)` synthesises a `TimerEvent` on the runtime's
mailbox, skipping the renderer-side clock entirely. The zero-ms
yield gives the runtime one tick to process it.

For async tasks (`Command.task`), use `awaitAsync` to block on
the `AsyncEvent` with a given tag. It resolves when the result
arrives or rejects after the timeout (default `5000` ms):

```typescript
test("initial fetch resolves", async ({ session }) => {
  const event = await session.awaitAsync("initial-load")
  expect(event.result.ok).toBe(true)
})
```

For platform effects (file dialogs, clipboard, notifications),
register a stub before the effect fires. Stubs match by effect
kind, not tag, so one stub covers every call site that issues
that kind during the test:

```typescript
test("import loads a file from disk", async ({ session }) => {
  await session.registerEffectStub("file_open", {
    kind: "file_opened",
    path: "/tmp/hello.ts",
    content: `ui.text("h", { children: "imported" })`,
  })

  await session.click("import")

  expect(session.model().activeFile).toBe("/tmp/hello.ts")
})
```

The stub returns immediately with the configured payload, but
the encode and decode path still runs, so wire mismatches
surface the same way they would in production.

## Backends

Two backends are available from the Vitest harness: `mock` (the
default) and `headless` (software rendering, real pixels). The
`plushie script` CLI runner recognises a third `windowed`
backend; the Vitest harness does not expose it directly.

| Backend | Rendering | Screenshots | Typical cost |
|---|---|---|---|
| `mock` | Protocol only, no GPU | Stubbed hash, `rgba` is null | Sub-ms per interaction |
| `headless` | Software (tiny-skia) | Real pixel data | Tens of ms per interaction |

Switch a whole module to `headless`:

```typescript
const test = testWith(padApp, { mode: "headless" })
```

For suite-wide control from CI, read `PLUSHIE_TEST_BACKEND` in a
shared setup file. The SDK does not read it automatically:

```typescript
// test/setup.ts
import { testWith as _testWith } from "plushie/testing"
import type { AppDefinition } from "plushie"

const mode = process.env.PLUSHIE_TEST_BACKEND === "headless" ? "headless" : "mock"
export const testWith = <M>(app: AppDefinition<M>) => _testWith(app, { mode })
```

```bash
PLUSHIE_TEST_BACKEND=headless pnpm test
```

## Golden snapshots

Two kinds of regression tests come for free: structural
(`treeHash`) and visual (`screenshot`). Both persist goldens
under `test/`:

```
test/
  golden/
    pad-initial.mock.sha256
    pad-saved.mock.sha256
  screenshots/
    pad-saved.json
    pad-saved.rgba
```

The backend name appears in the golden filename, so the same
test can hold separate baselines for `mock` and `headless`
runs.

```typescript
test("pad renders its saved state deterministically", async ({ session }) => {
  await session.typeText("editor", `ui.text("g", { children: "golden" })`)
  await session.click("save")

  await session.assertTreeHash("pad-saved")
  await session.assertScreenshot("pad-saved")
})
```

On first run, both assertions throw unless
`PLUSHIE_UPDATE_SNAPSHOTS=1` is set; with the flag, they write
the golden and pass:

```bash
PLUSHIE_UPDATE_SNAPSHOTS=1 pnpm test
```

In `mock` mode, `assertScreenshot` compares only the hash (the
`rgba` payload is stubbed), so the same assertion passes under
both backends. Pixel data is only meaningful under `headless`.

## Animation testing

Renderer-side transitions (`transition`, `spring`, `sequence`
from `plushie/animation`) snap straight to their target values
under `mock`. That is fine for most tests: the final state is
what `assertTreeHash` captures.

For step-controlled animation tests under `headless`, dispatch
`Command.advanceFrame(timestamp)` from `update` to move the
renderer clock forward by a known amount:

```typescript
import { Command } from "plushie"

function update(state: Model, event: Event): [Model, Command] {
  if (isClick(event, "step")) {
    return [state, Command.advanceFrame(state.clock + 16)]
  }
  return [state, Command.none()]
}
```

Each call walks the clock to `timestamp`. Combine with
`assertTreeHash` or `assertScreenshot` to lock down intermediate
frames.

## Scripts for UI walkthroughs

For longer declarative walkthroughs the SDK ships a
`.plushie` script format: a header with `app:`, `viewport:`,
`theme:`, and `backend:`, followed by `-----` and a list of
instructions (`click`, `type_text`, `expect`, `tree_hash`,
`screenshot`, `wait`). Scripts run through
`pnpm exec plushie script` or inline via `parseScriptFile` and
`runScript` from `plushie/script`.

See the [Testing reference](../reference/testing.md#plushie-script-runner)
for the complete instruction set and driver code.

## CI notes

The mock backend is the default for local and CI runs. `mock`
exercises every boundary a test needs (codec, handshake, event
routing) without requiring graphics drivers or a display
server, so a stock Ubuntu runner is enough.

```yaml
- run: pnpm install
- run: pnpm exec plushie download
- run: pnpm test
```

Layer the headless backend on top for pixel-level regression:

```yaml
- run: PLUSHIE_TEST_BACKEND=headless pnpm test
```

Vitest workers exit between runs, so the pool subprocess is
cleaned up automatically. For custom runners that reuse a Node
process across suites, call `stopPool()` in `globalTeardown`.

## Try it

Add tests to the pad to exercise what the earlier chapters
built:

- Click Save three times on a valid source and check the event
  log has an entry for each save.
- Register a `clipboard_write` stub, click Copy, and verify the
  stub captured the source.
- Write an `awaitAsync` test for the hypothetical
  `run-experiment` task from the async chapter; stub a quick
  return and assert the report lands in the model.
- Run the whole suite with `PLUSHIE_TEST_BACKEND=headless` and
  watch the wall-clock difference per test.

---

Next: [Shared State](16-shared-state.md)
